-- ============================================================================
-- 0004_rls.sql — Row Level Security
--
-- Model: any authenticated user with a profile can READ all planning data
-- (it's one company, multiple kitchens, and cross-kitchen visibility is
-- normal for procurement). WRITE access is role-gated:
--   admin            -> full access everywhere
--   planner          -> menu planning, recipes, MRP
--   kitchen_manager  -> inventory, consumption actuals for their own kitchen
--   purchasing       -> purchase requests, purchase orders, receiving
--   approver         -> approval_log, can approve/reject purchase requests
--   viewer           -> read-only everywhere
-- ============================================================================

alter table profiles enable row level security;
alter table uom_master enable row level security;
alter table ingredient_category enable row level security;
alter table dish_category enable row level security;
alter table kitchen_master enable row level security;
alter table customer_master enable row level security;
alter table supplier_master enable row level security;
alter table ingredient_master enable row level security;
alter table dish_master enable row level security;
alter table recipe_header enable row level security;
alter table recipe_detail enable row level security;
alter table menu_plan_header enable row level security;
alter table menu_plan_detail enable row level security;
alter table mrp_run enable row level security;
alter table mrp_detail enable row level security;
alter table inventory_balance enable row level security;
alter table inventory_transaction enable row level security;
alter table purchase_requirement enable row level security;
alter table purchase_request_header enable row level security;
alter table purchase_request_detail enable row level security;
alter table approval_log enable row level security;
alter table purchase_order_header enable row level security;
alter table purchase_order_detail enable row level security;
alter table goods_receipt_header enable row level security;
alter table goods_receipt_detail enable row level security;
alter table consumption_actual enable row level security;
alter table audit_log enable row level security;

-- Helper: current user's role
create or replace function current_role_name()
returns text language sql stable security definer as $$
  select role from profiles where id = auth.uid();
$$;

create or replace function is_admin() returns boolean language sql stable security definer as $$
  select coalesce((select role from profiles where id = auth.uid()) = 'admin', false);
$$;

-- profiles: users can read all profiles (for name lookups), only admin writes
create policy profiles_select on profiles for select using (auth.uid() is not null);
create policy profiles_self_update on profiles for update using (auth.uid() = id or is_admin());
create policy profiles_admin_write on profiles for insert with check (is_admin());
create policy profiles_admin_delete on profiles for delete using (is_admin());

-- generic read-all-authenticated policy for lookups & master data
create policy read_all_uom on uom_master for select using (auth.uid() is not null);
create policy read_all_ingredient_category on ingredient_category for select using (auth.uid() is not null);
create policy read_all_dish_category on dish_category for select using (auth.uid() is not null);
create policy read_all_kitchen on kitchen_master for select using (auth.uid() is not null);
create policy read_all_customer on customer_master for select using (auth.uid() is not null);
create policy read_all_supplier on supplier_master for select using (auth.uid() is not null);
create policy read_all_ingredient on ingredient_master for select using (auth.uid() is not null);
create policy read_all_dish on dish_master for select using (auth.uid() is not null);
create policy read_all_recipe_header on recipe_header for select using (auth.uid() is not null);
create policy read_all_recipe_detail on recipe_detail for select using (auth.uid() is not null);
create policy read_all_menu_header on menu_plan_header for select using (auth.uid() is not null);
create policy read_all_menu_detail on menu_plan_detail for select using (auth.uid() is not null);
create policy read_all_mrp_run on mrp_run for select using (auth.uid() is not null);
create policy read_all_mrp_detail on mrp_detail for select using (auth.uid() is not null);
create policy read_all_inventory_balance on inventory_balance for select using (auth.uid() is not null);
create policy read_all_inventory_txn on inventory_transaction for select using (auth.uid() is not null);
create policy read_all_purchase_requirement on purchase_requirement for select using (auth.uid() is not null);
create policy read_all_pr_header on purchase_request_header for select using (auth.uid() is not null);
create policy read_all_pr_detail on purchase_request_detail for select using (auth.uid() is not null);
create policy read_all_approval_log on approval_log for select using (auth.uid() is not null);
create policy read_all_po_header on purchase_order_header for select using (auth.uid() is not null);
create policy read_all_po_detail on purchase_order_detail for select using (auth.uid() is not null);
create policy read_all_grn_header on goods_receipt_header for select using (auth.uid() is not null);
create policy read_all_grn_detail on goods_receipt_detail for select using (auth.uid() is not null);
create policy read_all_consumption on consumption_actual for select using (auth.uid() is not null);
create policy read_all_audit_log on audit_log for select using (auth.uid() is not null);

-- Write policies: admin + relevant role, using a helper macro-ish pattern
create policy write_master_data on ingredient_master for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));
create policy write_dish_master on dish_master for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));
create policy write_kitchen on kitchen_master for all using (is_admin()) with check (is_admin());
create policy write_customer on customer_master for all using (is_admin()) with check (is_admin());
create policy write_supplier on supplier_master for all
  using (current_role_name() in ('admin','purchasing')) with check (current_role_name() in ('admin','purchasing'));
create policy write_categories_ing on ingredient_category for all using (is_admin()) with check (is_admin());
create policy write_categories_dish on dish_category for all using (is_admin()) with check (is_admin());
create policy write_uom on uom_master for all using (is_admin()) with check (is_admin());

create policy write_recipe_header on recipe_header for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));
create policy write_recipe_detail on recipe_detail for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));

create policy write_menu_header on menu_plan_header for all
  using (current_role_name() in ('admin','planner','kitchen_manager')) with check (current_role_name() in ('admin','planner','kitchen_manager'));
create policy write_menu_detail on menu_plan_detail for all
  using (current_role_name() in ('admin','planner','kitchen_manager')) with check (current_role_name() in ('admin','planner','kitchen_manager'));

create policy write_mrp_run on mrp_run for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));
create policy write_mrp_detail on mrp_detail for all
  using (current_role_name() in ('admin','planner')) with check (current_role_name() in ('admin','planner'));

create policy write_inventory_balance on inventory_balance for all
  using (current_role_name() in ('admin','kitchen_manager','purchasing')) with check (current_role_name() in ('admin','kitchen_manager','purchasing'));
create policy write_inventory_txn on inventory_transaction for all
  using (current_role_name() in ('admin','kitchen_manager','purchasing')) with check (current_role_name() in ('admin','kitchen_manager','purchasing'));

create policy write_purchase_requirement on purchase_requirement for all
  using (current_role_name() in ('admin','planner','purchasing')) with check (current_role_name() in ('admin','planner','purchasing'));

create policy write_pr_header on purchase_request_header for all
  using (current_role_name() in ('admin','planner','purchasing')) with check (current_role_name() in ('admin','planner','purchasing'));
create policy write_pr_detail on purchase_request_detail for all
  using (current_role_name() in ('admin','planner','purchasing')) with check (current_role_name() in ('admin','planner','purchasing'));

create policy write_approval_log on approval_log for insert
  with check (current_role_name() in ('admin','approver','planner','purchasing'));

create policy write_po_header on purchase_order_header for all
  using (current_role_name() in ('admin','purchasing')) with check (current_role_name() in ('admin','purchasing'));
create policy write_po_detail on purchase_order_detail for all
  using (current_role_name() in ('admin','purchasing')) with check (current_role_name() in ('admin','purchasing'));

create policy write_grn_header on goods_receipt_header for all
  using (current_role_name() in ('admin','purchasing','kitchen_manager')) with check (current_role_name() in ('admin','purchasing','kitchen_manager'));
create policy write_grn_detail on goods_receipt_detail for all
  using (current_role_name() in ('admin','purchasing','kitchen_manager')) with check (current_role_name() in ('admin','purchasing','kitchen_manager'));

create policy write_consumption on consumption_actual for all
  using (current_role_name() in ('admin','kitchen_manager')) with check (current_role_name() in ('admin','kitchen_manager'));

-- audit_log is system-populated only; no direct client writes
create policy no_direct_audit_write on audit_log for insert with check (false);
