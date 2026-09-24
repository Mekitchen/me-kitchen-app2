-- ============================================================================
-- ME KITCHEN — MENU & PROCUREMENT PLANNING SYSTEM
-- 0001_schema.sql — core tables for all 16 modules
-- ============================================================================

create extension if not exists "pgcrypto";

-- ----------------------------------------------------------------------------
-- 0. USERS / PROFILES
-- ----------------------------------------------------------------------------
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  email text not null,
  role text not null default 'viewer'
    check (role in ('admin','planner','kitchen_manager','purchasing','approver','viewer')),
  kitchen_id uuid, -- FK added after kitchen_master is created
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 1. LOOKUPS
-- ----------------------------------------------------------------------------
create table uom_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null
);

create table ingredient_category (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

create table dish_category (
  id uuid primary key default gen_random_uuid(),
  name text not null unique
);

-- ----------------------------------------------------------------------------
-- 6. KITCHEN MASTER
-- ----------------------------------------------------------------------------
create table kitchen_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  address text,
  city text,
  capacity_meals integer,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

alter table profiles
  add constraint profiles_kitchen_fk foreign key (kitchen_id) references kitchen_master(id) on delete set null;

-- ----------------------------------------------------------------------------
-- 7. CUSTOMER MASTER
-- ----------------------------------------------------------------------------
create table customer_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  contract_type text,
  contact_person text,
  contact_phone text,
  contact_email text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 8. SUPPLIER MASTER
-- ----------------------------------------------------------------------------
create table supplier_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  tax_code text,
  contact_person text,
  phone text,
  email text,
  address text,
  payment_terms text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 2. INGREDIENT MASTER
-- ----------------------------------------------------------------------------
create table ingredient_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid references ingredient_category(id) on delete set null,
  uom_id uuid not null references uom_master(id),
  standard_cost numeric(14,2) not null default 0,
  last_purchase_cost numeric(14,2),
  shelf_life_days integer,
  storage_type text not null default 'dry' check (storage_type in ('dry','chilled','frozen','other')),
  default_supplier_id uuid references supplier_master(id) on delete set null,
  min_stock_qty numeric(14,3) default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 3. DISH MASTER
-- ----------------------------------------------------------------------------
create table dish_master (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  name text not null,
  category_id uuid references dish_category(id) on delete set null,
  description text,
  portion_size numeric(10,2) not null default 1,
  portion_uom_id uuid not null references uom_master(id),
  standard_selling_price numeric(14,2),
  image_url text,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 4/5. RECIPE / BOM + VERSION CONTROL
--   Each row in recipe_header IS a version of the dish's recipe. Only one
--   version per dish may have status = 'active' at any time (enforced by
--   trigger in 0002_functions.sql).
-- ----------------------------------------------------------------------------
create table recipe_header (
  id uuid primary key default gen_random_uuid(),
  dish_id uuid not null references dish_master(id) on delete cascade,
  version_no integer not null,
  status text not null default 'draft' check (status in ('draft','active','archived')),
  yield_qty numeric(10,2) not null default 1,
  yield_uom_id uuid not null references uom_master(id),
  effective_from date not null default current_date,
  effective_to date,
  change_summary text,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (dish_id, version_no)
);

create table recipe_detail (
  id uuid primary key default gen_random_uuid(),
  recipe_header_id uuid not null references recipe_header(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  quantity numeric(14,4) not null,
  uom_id uuid not null references uom_master(id),
  wastage_pct numeric(5,2) not null default 0,
  sequence integer not null default 1,
  notes text
);

-- ----------------------------------------------------------------------------
-- 9. MENU PLANNING
-- ----------------------------------------------------------------------------
create table menu_plan_header (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchen_master(id),
  customer_id uuid references customer_master(id),
  plan_date date not null,
  meal_period text not null default 'lunch' check (meal_period in ('breakfast','lunch','dinner','snack')),
  status text not null default 'draft' check (status in ('draft','confirmed','locked')),
  created_by uuid references profiles(id),
  created_at timestamptz not null default now(),
  unique (kitchen_id, plan_date, meal_period)
);

create table menu_plan_detail (
  id uuid primary key default gen_random_uuid(),
  menu_plan_header_id uuid not null references menu_plan_header(id) on delete cascade,
  dish_id uuid not null references dish_master(id),
  recipe_header_id uuid references recipe_header(id),
  planned_qty numeric(12,2) not null default 0,
  notes text
);

-- ----------------------------------------------------------------------------
-- 10. MATERIAL REQUIREMENT PLANNING
-- ----------------------------------------------------------------------------
create table mrp_run (
  id uuid primary key default gen_random_uuid(),
  run_name text not null,
  plan_date_from date not null,
  plan_date_to date not null,
  kitchen_id uuid references kitchen_master(id),
  status text not null default 'draft' check (status in ('draft','computed','released')),
  run_by uuid references profiles(id),
  run_at timestamptz not null default now()
);

create table mrp_detail (
  id uuid primary key default gen_random_uuid(),
  mrp_run_id uuid not null references mrp_run(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  gross_requirement_qty numeric(14,4) not null default 0,
  uom_id uuid not null references uom_master(id),
  unique (mrp_run_id, ingredient_id)
);

-- ----------------------------------------------------------------------------
-- 11. INVENTORY BALANCE
-- ----------------------------------------------------------------------------
create table inventory_balance (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchen_master(id),
  ingredient_id uuid not null references ingredient_master(id),
  on_hand_qty numeric(14,4) not null default 0,
  uom_id uuid not null references uom_master(id),
  as_of_date date not null default current_date,
  updated_at timestamptz not null default now(),
  unique (kitchen_id, ingredient_id)
);

create table inventory_transaction (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchen_master(id),
  ingredient_id uuid not null references ingredient_master(id),
  txn_type text not null check (txn_type in ('receipt','issue','adjustment','consumption')),
  qty numeric(14,4) not null,
  uom_id uuid not null references uom_master(id),
  ref_type text,
  ref_id uuid,
  txn_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 12. PURCHASE REQUIREMENT (net = gross MRP requirement − on-hand inventory)
-- ----------------------------------------------------------------------------
create table purchase_requirement (
  id uuid primary key default gen_random_uuid(),
  mrp_run_id uuid not null references mrp_run(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  kitchen_id uuid not null references kitchen_master(id),
  gross_requirement_qty numeric(14,4) not null default 0,
  on_hand_qty numeric(14,4) not null default 0,
  net_requirement_qty numeric(14,4) not null default 0,
  uom_id uuid not null references uom_master(id),
  status text not null default 'draft' check (status in ('draft','confirmed')),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 13. PURCHASE REQUEST + 14. APPROVAL WORKFLOW
-- ----------------------------------------------------------------------------
create table purchase_request_header (
  id uuid primary key default gen_random_uuid(),
  pr_no text not null unique,
  kitchen_id uuid not null references kitchen_master(id),
  requirement_period_from date not null,
  requirement_period_to date not null,
  status text not null default 'draft'
    check (status in ('draft','submitted','approved','rejected','purchasing','completed')),
  requested_by uuid references profiles(id),
  requested_at timestamptz not null default now(),
  approved_by uuid references profiles(id),
  approved_at timestamptz,
  notes text
);

create table purchase_request_detail (
  id uuid primary key default gen_random_uuid(),
  pr_header_id uuid not null references purchase_request_header(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  supplier_id uuid references supplier_master(id),
  quantity numeric(14,4) not null,
  uom_id uuid not null references uom_master(id),
  estimated_unit_cost numeric(14,2) not null default 0,
  estimated_total_cost numeric(14,2) generated always as (quantity * estimated_unit_cost) stored,
  purchase_requirement_id uuid references purchase_requirement(id)
);

create table approval_log (
  id uuid primary key default gen_random_uuid(),
  pr_header_id uuid not null references purchase_request_header(id) on delete cascade,
  action text not null check (action in ('submit','approve','reject','return')),
  actor_id uuid references profiles(id),
  actor_role text,
  comment text,
  acted_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- PURCHASING (Purchase Orders) + RECEIVING (Goods Receipts)
-- ----------------------------------------------------------------------------
create table purchase_order_header (
  id uuid primary key default gen_random_uuid(),
  po_no text not null unique,
  pr_header_id uuid references purchase_request_header(id),
  supplier_id uuid not null references supplier_master(id),
  status text not null default 'open'
    check (status in ('open','partially_received','received','closed','cancelled')),
  order_date date not null default current_date,
  expected_date date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

create table purchase_order_detail (
  id uuid primary key default gen_random_uuid(),
  po_header_id uuid not null references purchase_order_header(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  quantity numeric(14,4) not null,
  uom_id uuid not null references uom_master(id),
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as (quantity * unit_cost) stored
);

create table goods_receipt_header (
  id uuid primary key default gen_random_uuid(),
  grn_no text not null unique,
  po_header_id uuid not null references purchase_order_header(id),
  kitchen_id uuid not null references kitchen_master(id),
  received_date date not null default current_date,
  received_by uuid references profiles(id),
  status text not null default 'draft' check (status in ('draft','posted')),
  notes text
);

create table goods_receipt_detail (
  id uuid primary key default gen_random_uuid(),
  grn_header_id uuid not null references goods_receipt_header(id) on delete cascade,
  ingredient_id uuid not null references ingredient_master(id),
  po_qty numeric(14,4) not null default 0,
  received_qty numeric(14,4) not null default 0,
  uom_id uuid not null references uom_master(id),
  unit_cost numeric(14,2) not null default 0,
  total_cost numeric(14,2) generated always as (received_qty * unit_cost) stored,
  batch_no text,
  expiry_date date
);

-- ----------------------------------------------------------------------------
-- ACTUAL CONSUMPTION (drives food cost analysis)
-- ----------------------------------------------------------------------------
create table consumption_actual (
  id uuid primary key default gen_random_uuid(),
  kitchen_id uuid not null references kitchen_master(id),
  dish_id uuid not null references dish_master(id),
  menu_plan_detail_id uuid references menu_plan_detail(id),
  actual_meal_qty numeric(12,2) not null default 0,
  consumption_date date not null default current_date,
  created_by uuid references profiles(id),
  created_at timestamptz not null default now()
);

-- ----------------------------------------------------------------------------
-- 16. AUDIT LOG
-- ----------------------------------------------------------------------------
create table audit_log (
  id uuid primary key default gen_random_uuid(),
  table_name text not null,
  record_id uuid,
  action text not null check (action in ('insert','update','delete')),
  changed_by uuid references profiles(id),
  changed_at timestamptz not null default now(),
  old_data jsonb,
  new_data jsonb
);

-- ----------------------------------------------------------------------------
-- INDEXES
-- ----------------------------------------------------------------------------
create index idx_ingredient_master_category on ingredient_master(category_id);
create index idx_dish_master_category on dish_master(category_id);
create index idx_recipe_header_dish on recipe_header(dish_id);
create index idx_recipe_detail_header on recipe_detail(recipe_header_id);
create index idx_recipe_detail_ingredient on recipe_detail(ingredient_id);
create index idx_menu_plan_header_date on menu_plan_header(plan_date, kitchen_id);
create index idx_menu_plan_detail_header on menu_plan_detail(menu_plan_header_id);
create index idx_mrp_detail_run on mrp_detail(mrp_run_id);
create index idx_inventory_balance_kitchen on inventory_balance(kitchen_id, ingredient_id);
create index idx_inventory_txn_kitchen_ingredient on inventory_transaction(kitchen_id, ingredient_id, txn_date);
create index idx_purchase_requirement_run on purchase_requirement(mrp_run_id);
create index idx_pr_detail_header on purchase_request_detail(pr_header_id);
create index idx_approval_log_pr on approval_log(pr_header_id);
create index idx_po_detail_header on purchase_order_detail(po_header_id);
create index idx_grn_detail_header on goods_receipt_detail(grn_header_id);
create index idx_consumption_actual_dish_date on consumption_actual(dish_id, consumption_date);
create index idx_audit_log_table_record on audit_log(table_name, record_id);
