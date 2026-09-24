-- ============================================================================
-- 0005_seed.sql — reference/demo data
-- Run this after creating at least one auth user, then update the profiles
-- insert at the bottom with that user's real UUID (see README).
-- ============================================================================

insert into uom_master (code, name) values
  ('KG', 'Kilogram'),
  ('G', 'Gram'),
  ('L', 'Liter'),
  ('ML', 'Milliliter'),
  ('PC', 'Piece'),
  ('PORTION', 'Portion'),
  ('PACK', 'Pack'),
  ('BOX', 'Box')
on conflict (code) do nothing;

insert into ingredient_category (name) values
  ('Meat & Poultry'), ('Seafood'), ('Vegetables'), ('Rice & Grains'),
  ('Condiments & Sauces'), ('Dairy & Eggs'), ('Dry Goods'), ('Beverages')
on conflict (name) do nothing;

insert into dish_category (name) values
  ('Main Course'), ('Soup'), ('Vegetable Dish'), ('Rice/Noodle'), ('Dessert'), ('Beverage')
on conflict (name) do nothing;

insert into kitchen_master (code, name, address, city, capacity_meals) values
  ('KIT-01', 'Central Kitchen - Binh Duong', 'VSIP II-A, Tan Uyen', 'Binh Duong', 15000),
  ('KIT-02', 'Kitchen - Long An IZ', 'Duc Hoa Industrial Zone', 'Long An', 8000),
  ('KIT-03', 'Kitchen - Dong Nai IZ', 'Nhon Trach Industrial Zone', 'Dong Nai', 6000)
on conflict (code) do nothing;

insert into customer_master (code, name, contract_type, contact_person, contact_phone, contact_email) values
  ('CUST-01', 'Suntech Electronics Co., Ltd.', 'Per-meal fixed price', 'Ms. Lan', '0909 123 456', 'lan@suntech-electronics.example'),
  ('CUST-02', 'Golden Textile JSC', 'Cost-plus management fee', 'Mr. Hung', '0912 456 789', 'hung@goldentextile.example')
on conflict (code) do nothing;

insert into supplier_master (code, name, tax_code, contact_person, phone, email, payment_terms) values
  ('SUP-01', 'Fresh Farm Produce Co.', '0301234567', 'Mr. Tuan', '0938 111 222', 'sales@freshfarm.example', 'Net 15'),
  ('SUP-02', 'Ocean Seafood Trading', '0309876543', 'Ms. Mai', '0938 333 444', 'sales@oceanseafood.example', 'Net 30'),
  ('SUP-03', 'Golden Rice Distributors', '0312345678', 'Mr. Phong', '0938 555 666', 'sales@goldenrice.example', 'Net 30'),
  ('SUP-04', 'Sunrise Condiments Supply', '0323456789', 'Ms. Thu', '0938 777 888', 'sales@sunrisecondiments.example', 'Net 15')
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Ingredients
-- ----------------------------------------------------------------------------
insert into ingredient_master (code, name, category_id, uom_id, standard_cost, storage_type, default_supplier_id, min_stock_qty)
select v.code, v.name,
  (select id from ingredient_category where name = v.cat),
  (select id from uom_master where code = v.uom),
  v.cost, v.storage,
  (select id from supplier_master where code = v.sup),
  v.min_stock
from (values
  ('ING-001','Pork Shoulder','Meat & Poultry','KG', 145000,'chilled','SUP-01', 30),
  ('ING-002','Chicken Thigh','Meat & Poultry','KG', 65000,'chilled','SUP-01', 40),
  ('ING-003','Beef Sirloin','Meat & Poultry','KG', 280000,'chilled','SUP-01', 15),
  ('ING-004','Tilapia Fillet','Seafood','KG', 95000,'frozen','SUP-02', 20),
  ('ING-005','Shrimp (medium)','Seafood','KG', 180000,'frozen','SUP-02', 10),
  ('ING-006','Jasmine Rice','Rice & Grains','KG', 22000,'dry','SUP-03', 200),
  ('ING-007','Rice Noodle','Rice & Grains','KG', 18000,'dry','SUP-03', 50),
  ('ING-008','Cabbage','Vegetables','KG', 12000,'chilled','SUP-01', 40),
  ('ING-009','Morning Glory','Vegetables','KG', 15000,'chilled','SUP-01', 30),
  ('ING-010','Tomato','Vegetables','KG', 18000,'chilled','SUP-01', 25),
  ('ING-011','Onion','Vegetables','KG', 16000,'dry','SUP-01', 30),
  ('ING-012','Garlic','Vegetables','KG', 45000,'dry','SUP-01', 10),
  ('ING-013','Fish Sauce','Condiments & Sauces','L', 35000,'dry','SUP-04', 20),
  ('ING-014','Soy Sauce','Condiments & Sauces','L', 28000,'dry','SUP-04', 20),
  ('ING-015','Cooking Oil','Condiments & Sauces','L', 42000,'dry','SUP-04', 40),
  ('ING-016','Sugar','Dry Goods','KG', 20000,'dry','SUP-04', 30),
  ('ING-017','Salt','Dry Goods','KG', 6000,'dry','SUP-04', 20),
  ('ING-018','Chicken Egg','Dairy & Eggs','PC', 3200,'chilled','SUP-01', 500),
  ('ING-019','Tofu','Dairy & Eggs','KG', 22000,'chilled','SUP-01', 25),
  ('ING-020','Bean Sprout','Vegetables','KG', 14000,'chilled','SUP-01', 15)
) as v(code, name, cat, uom, cost, storage, sup, min_stock)
on conflict (code) do nothing;

update ingredient_master set last_purchase_cost = standard_cost where last_purchase_cost is null;

-- ----------------------------------------------------------------------------
-- Dishes
-- ----------------------------------------------------------------------------
insert into dish_master (code, name, category_id, portion_size, portion_uom_id, standard_selling_price)
select v.code, v.name, (select id from dish_category where name = v.cat), 1,
  (select id from uom_master where code = 'PORTION'), v.price
from (values
  ('DISH-001','Braised Pork with Egg','Main Course', 18000),
  ('DISH-002','Grilled Chicken Thigh','Main Course', 20000),
  ('DISH-003','Stir-fried Beef with Onion','Main Course', 25000),
  ('DISH-004','Fried Tilapia Fillet','Main Course', 21000),
  ('DISH-005','Sweet & Sour Shrimp','Main Course', 28000),
  ('DISH-006','Steamed Jasmine Rice','Rice/Noodle', 4000),
  ('DISH-007','Stir-fried Cabbage','Vegetable Dish', 6000),
  ('DISH-008','Boiled Morning Glory','Vegetable Dish', 6000),
  ('DISH-009','Tomato Egg Soup','Soup', 7000),
  ('DISH-010','Tofu & Bean Sprout Stir-fry','Vegetable Dish', 8000)
) as v(code, name, cat, price)
on conflict (code) do nothing;

-- ----------------------------------------------------------------------------
-- Active recipes (BOM) for each dish, yield = 100 portions
-- ----------------------------------------------------------------------------
do $$
declare
  d record;
  rh_id uuid;
  kg uuid := (select id from uom_master where code = 'KG');
  l uuid := (select id from uom_master where code = 'L');
  pc uuid := (select id from uom_master where code = 'PC');
begin
  for d in select id, code from dish_master loop
    insert into recipe_header (dish_id, version_no, status, yield_qty, yield_uom_id, effective_from, change_summary)
    values (d.id, 1, 'active', 100, (select id from uom_master where code = 'PORTION'), current_date - interval '30 days', 'Initial standard recipe')
    returning id into rh_id;

    case d.code
      when 'DISH-001' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-001'), 12, kg, 5, 1),
          (rh_id, (select id from ingredient_master where code='ING-018'), 100, pc, 2, 2),
          (rh_id, (select id from ingredient_master where code='ING-013'), 1.5, l, 0, 3),
          (rh_id, (select id from ingredient_master where code='ING-016'), 1.2, kg, 0, 4);
      when 'DISH-002' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-002'), 14, kg, 8, 1),
          (rh_id, (select id from ingredient_master where code='ING-012'), 0.6, kg, 2, 2),
          (rh_id, (select id from ingredient_master where code='ING-014'), 1.0, l, 0, 3);
      when 'DISH-003' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-003'), 10, kg, 6, 1),
          (rh_id, (select id from ingredient_master where code='ING-011'), 3, kg, 3, 2),
          (rh_id, (select id from ingredient_master where code='ING-015'), 1.5, l, 0, 3);
      when 'DISH-004' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-004'), 13, kg, 10, 1),
          (rh_id, (select id from ingredient_master where code='ING-015'), 1.2, l, 0, 2);
      when 'DISH-005' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-005'), 9, kg, 8, 1),
          (rh_id, (select id from ingredient_master where code='ING-010'), 2, kg, 2, 2),
          (rh_id, (select id from ingredient_master where code='ING-016'), 0.8, kg, 0, 3);
      when 'DISH-006' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-006'), 18, kg, 1, 1);
      when 'DISH-007' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-008'), 15, kg, 10, 1),
          (rh_id, (select id from ingredient_master where code='ING-015'), 0.6, l, 0, 2);
      when 'DISH-008' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-009'), 14, kg, 12, 1);
      when 'DISH-009' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-010'), 6, kg, 5, 1),
          (rh_id, (select id from ingredient_master where code='ING-018'), 60, pc, 2, 2);
      when 'DISH-010' then
        insert into recipe_detail (recipe_header_id, ingredient_id, quantity, uom_id, wastage_pct, sequence) values
          (rh_id, (select id from ingredient_master where code='ING-019'), 10, kg, 5, 1),
          (rh_id, (select id from ingredient_master where code='ING-020'), 6, kg, 8, 2);
      else null;
    end case;
  end loop;
end $$;

-- ----------------------------------------------------------------------------
-- Opening inventory balances at KIT-01
-- ----------------------------------------------------------------------------
insert into inventory_transaction (kitchen_id, ingredient_id, txn_type, qty, uom_id, ref_type, txn_date)
select (select id from kitchen_master where code='KIT-01'), im.id, 'adjustment', v.qty, im.uom_id, 'opening_balance', current_date - 1
from ingredient_master im
join (values
  ('ING-001', 40),('ING-002', 60),('ING-003', 20),('ING-004', 25),('ING-005', 12),
  ('ING-006', 350),('ING-007', 60),('ING-008', 50),('ING-009', 35),('ING-010', 30),
  ('ING-011', 40),('ING-012', 15),('ING-013', 25),('ING-014', 25),('ING-015', 50),
  ('ING-016', 35),('ING-017', 25),('ING-018', 800),('ING-019', 30),('ING-020', 20)
) as v(code, qty) on v.code = im.code;

-- ----------------------------------------------------------------------------
-- NOTE ON AUTH USERS / PROFILES
-- Supabase auth.users cannot be seeded via plain SQL migration (requires the
-- GoTrue API or the dashboard). After creating your first user:
--   1. In Supabase Studio -> Authentication -> Users -> "Add user"
--   2. Copy the generated user UUID
--   3. Run:
--      insert into profiles (id, full_name, email, role, kitchen_id)
--      values ('<uuid>', 'Julie Nguyen', 'thuy.juliepartners@gmail.com', 'admin',
--              (select id from kitchen_master where code = 'KIT-01'));
-- See README.md for the full first-run checklist.
