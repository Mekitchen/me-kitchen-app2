-- ============================================================================
-- 0002_functions_triggers.sql
-- ============================================================================

-- ----------------------------------------------------------------------------
-- updated_at maintenance
-- ----------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_ingredient_master_updated_at
  before update on ingredient_master
  for each row execute function set_updated_at();

-- ----------------------------------------------------------------------------
-- Only one ACTIVE recipe version per dish
-- ----------------------------------------------------------------------------
create or replace function enforce_single_active_recipe()
returns trigger language plpgsql as $$
begin
  if new.status = 'active' then
    update recipe_header
      set status = 'archived', effective_to = coalesce(effective_to, current_date)
      where dish_id = new.dish_id
        and id <> new.id
        and status = 'active';
  end if;
  return new;
end;
$$;

create trigger trg_enforce_single_active_recipe
  before insert or update of status on recipe_header
  for each row execute function enforce_single_active_recipe();

-- ----------------------------------------------------------------------------
-- Auto-increment recipe version_no per dish when not supplied
-- ----------------------------------------------------------------------------
create or replace function next_recipe_version()
returns trigger language plpgsql as $$
begin
  if new.version_no is null then
    select coalesce(max(version_no), 0) + 1 into new.version_no
      from recipe_header where dish_id = new.dish_id;
  end if;
  return new;
end;
$$;

create trigger trg_next_recipe_version
  before insert on recipe_header
  for each row execute function next_recipe_version();

-- ----------------------------------------------------------------------------
-- Generic audit log trigger — attach to any business table
-- ----------------------------------------------------------------------------
create or replace function audit_trigger_fn()
returns trigger language plpgsql security definer as $$
declare
  actor uuid;
begin
  begin
    actor := auth.uid();
  exception when others then
    actor := null;
  end;

  if (tg_op = 'DELETE') then
    insert into audit_log(table_name, record_id, action, changed_by, old_data, new_data)
      values (tg_table_name, old.id, 'delete', actor, to_jsonb(old), null);
    return old;
  elsif (tg_op = 'UPDATE') then
    insert into audit_log(table_name, record_id, action, changed_by, old_data, new_data)
      values (tg_table_name, new.id, 'update', actor, to_jsonb(old), to_jsonb(new));
    return new;
  elsif (tg_op = 'INSERT') then
    insert into audit_log(table_name, record_id, action, changed_by, old_data, new_data)
      values (tg_table_name, new.id, 'insert', actor, null, to_jsonb(new));
    return new;
  end if;
  return null;
end;
$$;

create trigger trg_audit_ingredient_master after insert or update or delete on ingredient_master for each row execute function audit_trigger_fn();
create trigger trg_audit_dish_master after insert or update or delete on dish_master for each row execute function audit_trigger_fn();
create trigger trg_audit_recipe_header after insert or update or delete on recipe_header for each row execute function audit_trigger_fn();
create trigger trg_audit_menu_plan_header after insert or update or delete on menu_plan_header for each row execute function audit_trigger_fn();
create trigger trg_audit_purchase_requirement after insert or update or delete on purchase_requirement for each row execute function audit_trigger_fn();
create trigger trg_audit_purchase_request_header after insert or update or delete on purchase_request_header for each row execute function audit_trigger_fn();
create trigger trg_audit_purchase_order_header after insert or update or delete on purchase_order_header for each row execute function audit_trigger_fn();
create trigger trg_audit_goods_receipt_header after insert or update or delete on goods_receipt_header for each row execute function audit_trigger_fn();
create trigger trg_audit_inventory_balance after insert or update or delete on inventory_balance for each row execute function audit_trigger_fn();
create trigger trg_audit_supplier_master after insert or update or delete on supplier_master for each row execute function audit_trigger_fn();

-- ----------------------------------------------------------------------------
-- Inventory balance maintenance — every inventory_transaction posted updates
-- (or creates) the corresponding inventory_balance row automatically.
--   receipt / adjustment(+) -> increase on_hand_qty
--   issue / consumption / adjustment(-) -> decrease on_hand_qty (qty stored negative for these)
-- Convention: qty is signed. Positive = stock in, negative = stock out.
-- ----------------------------------------------------------------------------
create or replace function apply_inventory_transaction()
returns trigger language plpgsql as $$
begin
  insert into inventory_balance (kitchen_id, ingredient_id, on_hand_qty, uom_id, as_of_date, updated_at)
    values (new.kitchen_id, new.ingredient_id, new.qty, new.uom_id, new.txn_date, now())
  on conflict (kitchen_id, ingredient_id)
    do update set
      on_hand_qty = inventory_balance.on_hand_qty + excluded.on_hand_qty,
      as_of_date = greatest(inventory_balance.as_of_date, excluded.as_of_date),
      updated_at = now();
  return new;
end;
$$;

create trigger trg_apply_inventory_transaction
  after insert on inventory_transaction
  for each row execute function apply_inventory_transaction();

-- ----------------------------------------------------------------------------
-- Auto-post goods receipt -> inventory_transaction (receipt) when GRN posted
-- ----------------------------------------------------------------------------
create or replace function post_goods_receipt()
returns trigger language plpgsql as $$
declare
  d record;
begin
  if new.status = 'posted' and (old.status is distinct from 'posted') then
    for d in select * from goods_receipt_detail where grn_header_id = new.id loop
      insert into inventory_transaction (kitchen_id, ingredient_id, txn_type, qty, uom_id, ref_type, ref_id, txn_date, created_by)
        values (new.kitchen_id, d.ingredient_id, 'receipt', d.received_qty, d.uom_id, 'goods_receipt', new.id, new.received_date, new.received_by);

      update ingredient_master set last_purchase_cost = d.unit_cost where id = d.ingredient_id;
    end loop;

    update purchase_order_header po
      set status = case
        when (select sum(pod.quantity) from purchase_order_detail pod where pod.po_header_id = po.id)
             <= (select coalesce(sum(grd.received_qty),0) from goods_receipt_detail grd
                   join goods_receipt_header grh on grh.id = grd.grn_header_id
                   where grh.po_header_id = po.id and grh.status = 'posted')
        then 'received' else 'partially_received' end
      where po.id = new.po_header_id;
  end if;
  return new;
end;
$$;

create trigger trg_post_goods_receipt
  after update on goods_receipt_header
  for each row execute function post_goods_receipt();

-- ----------------------------------------------------------------------------
-- Consumption actual -> inventory_transaction (consumption, negative qty)
-- computed from the dish's active recipe at time of posting.
-- ----------------------------------------------------------------------------
create or replace function post_consumption_actual()
returns trigger language plpgsql as $$
declare
  r_id uuid;
  d record;
begin
  select id into r_id from recipe_header where dish_id = new.dish_id and status = 'active' limit 1;
  if r_id is not null then
    for d in select * from recipe_detail where recipe_header_id = r_id loop
      insert into inventory_transaction (kitchen_id, ingredient_id, txn_type, qty, uom_id, ref_type, ref_id, txn_date, created_by)
        values (
          new.kitchen_id,
          d.ingredient_id,
          'consumption',
          -1 * d.quantity * (1 + d.wastage_pct / 100.0) * new.actual_meal_qty,
          d.uom_id,
          'consumption_actual',
          new.id,
          new.consumption_date,
          new.created_by
        );
    end loop;
  end if;
  return new;
end;
$$;

create trigger trg_post_consumption_actual
  after insert on consumption_actual
  for each row execute function post_consumption_actual();
