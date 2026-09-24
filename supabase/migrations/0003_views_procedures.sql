-- ============================================================================
-- 0003_views_procedures.sql
-- Server-side calculation engine: this is what replaces the Excel workbook.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Document numbering helper (PR-2026-00001, PO-2026-00001, GRN-2026-00001)
-- ----------------------------------------------------------------------------
create sequence if not exists pr_no_seq;
create sequence if not exists po_no_seq;
create sequence if not exists grn_no_seq;

create or replace function next_document_no(prefix text)
returns text language plpgsql as $$
declare
  seq_name text := lower(prefix) || '_no_seq';
  n bigint;
begin
  execute format('select nextval(%L)', seq_name) into n;
  return upper(prefix) || '-' || to_char(current_date, 'YYYY') || '-' || lpad(n::text, 5, '0');
end;
$$;

-- ----------------------------------------------------------------------------
-- STEP: MENU + RECIPE/BOM + MEAL QUANTITY  ->  MATERIAL REQUIREMENT (MRP)
--
-- compute_mrp(run_id) aggregates, for every confirmed/locked menu_plan_detail
-- within the run's date range (and kitchen, if scoped), the ingredient
-- quantities implied by each dish's ACTIVE recipe (or the recipe pinned on
-- the menu line), scaled by planned_qty and grossed up for wastage.
-- ----------------------------------------------------------------------------
create or replace function compute_mrp(p_run_id uuid)
returns void language plpgsql as $$
declare
  v_run mrp_run;
begin
  select * into v_run from mrp_run where id = p_run_id;
  if not found then
    raise exception 'MRP run % not found', p_run_id;
  end if;

  delete from mrp_detail where mrp_run_id = p_run_id;

  insert into mrp_detail (mrp_run_id, ingredient_id, gross_requirement_qty, uom_id)
  select
    p_run_id,
    rd.ingredient_id,
    sum(rd.quantity * (1 + rd.wastage_pct / 100.0) * mpd.planned_qty / nullif(rh.yield_qty, 0)) as gross_requirement_qty,
    rd.uom_id
  from menu_plan_detail mpd
  join menu_plan_header mph on mph.id = mpd.menu_plan_header_id
  join recipe_header rh on rh.id = coalesce(mpd.recipe_header_id, (
    select id from recipe_header where dish_id = mpd.dish_id and status = 'active' limit 1
  ))
  join recipe_detail rd on rd.recipe_header_id = rh.id
  where mph.plan_date between v_run.plan_date_from and v_run.plan_date_to
    and mph.status in ('confirmed', 'locked')
    and (v_run.kitchen_id is null or mph.kitchen_id = v_run.kitchen_id)
  group by rd.ingredient_id, rd.uom_id;

  update mrp_run set status = 'computed' where id = p_run_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- STEP: MATERIAL REQUIREMENT  ->  INVENTORY RECONCILIATION  ->  NET PURCHASE
--
-- generate_purchase_requirement(run_id) reconciles mrp_detail (gross
-- requirement) against inventory_balance (on hand) per kitchen, producing
-- purchase_requirement rows with the net quantity to buy (never negative).
-- ----------------------------------------------------------------------------
create or replace function generate_purchase_requirement(p_run_id uuid)
returns void language plpgsql as $$
declare
  v_run mrp_run;
begin
  select * into v_run from mrp_run where id = p_run_id;
  if not found then
    raise exception 'MRP run % not found', p_run_id;
  end if;

  delete from purchase_requirement where mrp_run_id = p_run_id;

  insert into purchase_requirement (mrp_run_id, ingredient_id, kitchen_id, gross_requirement_qty, on_hand_qty, net_requirement_qty, uom_id, status)
  select
    p_run_id,
    md.ingredient_id,
    coalesce(v_run.kitchen_id, k.id) as kitchen_id,
    md.gross_requirement_qty,
    coalesce(ib.on_hand_qty, 0) as on_hand_qty,
    greatest(md.gross_requirement_qty - coalesce(ib.on_hand_qty, 0), 0) as net_requirement_qty,
    md.uom_id,
    'draft'
  from mrp_detail md
  cross join lateral (
    select id from kitchen_master where v_run.kitchen_id is not null and id = v_run.kitchen_id
    union all
    select id from kitchen_master where v_run.kitchen_id is null limit 1
  ) k
  left join inventory_balance ib on ib.ingredient_id = md.ingredient_id and ib.kitchen_id = k.id
  where md.mrp_run_id = p_run_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- FOOD COST ANALYSIS VIEW — standard (recipe) cost vs actual (receipt) cost
-- ----------------------------------------------------------------------------
create or replace view v_food_cost_analysis as
with std_cost as (
  select
    rh.dish_id,
    rh.id as recipe_header_id,
    sum(rd.quantity * (1 + rd.wastage_pct/100.0) * im.standard_cost) / nullif(rh.yield_qty, 0) as standard_unit_cost
  from recipe_header rh
  join recipe_detail rd on rd.recipe_header_id = rh.id
  join ingredient_master im on im.id = rd.ingredient_id
  where rh.status = 'active'
  group by rh.dish_id, rh.id, rh.yield_qty
),
actual_cost as (
  select
    rh.dish_id,
    sum(rd.quantity * (1 + rd.wastage_pct/100.0) * coalesce(im.last_purchase_cost, im.standard_cost)) / nullif(rh.yield_qty, 0) as actual_unit_cost
  from recipe_header rh
  join recipe_detail rd on rd.recipe_header_id = rh.id
  join ingredient_master im on im.id = rd.ingredient_id
  where rh.status = 'active'
  group by rh.dish_id, rh.yield_qty
)
select
  dm.id as dish_id,
  dm.code as dish_code,
  dm.name as dish_name,
  ca.consumption_date,
  coalesce(mpd.planned_qty, 0) as planned_qty,
  ca.actual_meal_qty as actual_qty,
  coalesce(sc.standard_unit_cost, 0) as standard_unit_cost,
  coalesce(ac.actual_unit_cost, sc.standard_unit_cost, 0) as actual_unit_cost,
  coalesce(sc.standard_unit_cost, 0) * ca.actual_meal_qty as standard_total_cost,
  coalesce(ac.actual_unit_cost, sc.standard_unit_cost, 0) * ca.actual_meal_qty as actual_total_cost,
  (coalesce(ac.actual_unit_cost, sc.standard_unit_cost, 0) - coalesce(sc.standard_unit_cost, 0)) * ca.actual_meal_qty as variance,
  case when coalesce(sc.standard_unit_cost,0) = 0 then 0
    else round((coalesce(ac.actual_unit_cost, sc.standard_unit_cost, 0) - sc.standard_unit_cost) / sc.standard_unit_cost * 100, 2)
  end as variance_pct
from consumption_actual ca
join dish_master dm on dm.id = ca.dish_id
left join menu_plan_detail mpd on mpd.id = ca.menu_plan_detail_id
left join std_cost sc on sc.dish_id = ca.dish_id
left join actual_cost ac on ac.dish_id = ca.dish_id;
