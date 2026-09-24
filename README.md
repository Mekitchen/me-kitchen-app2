# ME Kitchen — Menu & Procurement Planning System

An internal web application for industrial catering operations that eliminates
manual Excel work in converting daily menus and meal quantities into
purchasing requirements.

**Workflow modeled end-to-end:**

Menu → Recipe/BOM → Meal Quantity → Material Requirement (MRP) → Inventory
Reconciliation → Net Purchase Requirement → Purchase Request → Approval →
Purchasing → Receiving → Actual Consumption → Food Cost Analysis

**Stack:** React + TypeScript + Tailwind CSS · Supabase (Postgres + Auth) ·
Recharts · React Query · React Router

---

## 1. Project layout

```
src/
  components/
    layout/        Sidebar, Topbar, AppLayout
    ui/            DataTable, Modal, FormField, Badge, StatCard, PageHeader
  hooks/
    useCrud.ts      Generic Supabase CRUD hook (list/create/update/delete)
    useLookups.ts   UoM / category / supplier / kitchen dropdown data
  lib/
    supabase.ts     Supabase client (reads VITE_SUPABASE_URL / ANON_KEY)
    auth.tsx        Auth context (session, profile, role helper)
    chartColors.ts  Validated categorical/sequential/diverging palette
    utils.ts        Formatters (currency, date, number)
  pages/
    Dashboard.tsx
    masters/        Ingredient, Dish, Kitchen, Customer, Supplier
    recipe/          Recipe/BOM, Recipe Version Control
    planning/        Menu Planning, MRP, Inventory Balance, Purchase Requirement
    procurement/     Purchase Request, Approval Workflow, Purchasing, Receiving
    FoodCostAnalysisPage.tsx
    AuditLogPage.tsx
  types/domain.ts   Hand-written domain types mirroring the SQL schema
supabase/
  migrations/
    0001_schema.sql              All tables for the 16 modules
    0002_functions_triggers.sql  Audit log, single-active-recipe, inventory ledger
    0003_views_procedures.sql    compute_mrp(), generate_purchase_requirement(),
                                 v_food_cost_analysis view, document numbering
    0004_rls.sql                 Row Level Security policies (role-based)
    0005_seed.sql                Reference/demo data (kitchens, suppliers,
                                 ~20 ingredients, 10 dishes with recipes)
```

## 2. First-run setup

### a. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New Project.
2. In **Project Settings → API**, copy the **Project URL** and **anon public key**.
3. Copy `.env.example` to `.env` and fill both values:

   ```
   VITE_SUPABASE_URL=https://xxxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=xxxxx
   ```

### b. Run the migrations

In the Supabase Dashboard → **SQL Editor**, run the five files in
`supabase/migrations/` **in order** (0001 → 0005), or use the Supabase CLI:

```bash
supabase link --project-ref <your-project-ref>
supabase db push
```

### c. Create your first user & profile

Supabase Auth users can't be created via plain SQL, so:

1. Dashboard → **Authentication → Users → Add user** (set an email + password).
2. Copy the generated user UUID.
3. In the SQL Editor, run:

   ```sql
   insert into profiles (id, full_name, email, role, kitchen_id)
   values (
     '<paste-user-uuid>',
     'Your Name',
     'you@company.com',
     'admin',
     (select id from kitchen_master where code = 'KIT-01')
   );
   ```

   Roles available: `admin`, `planner`, `kitchen_manager`, `purchasing`,
   `approver`, `viewer`. `admin` has full access everywhere and is the
   simplest choice to start with — see `0004_rls.sql` for the exact
   per-role write permissions.

### d. Install & run

```bash
npm install
npm run dev
```

Open the printed local URL and sign in with the account you created.

## 3. How the calculation engine works (the Excel replacement)

1. **Menu Planning** — for each kitchen + date + meal period, planners add
   dishes with a planned meal quantity.
2. **Recipe / BOM** — each dish has one *active* recipe version defining
   ingredient quantities per yield (e.g. per 100 portions), with a wastage %.
3. **Material Requirement Planning** — creating an MRP run over a date range
   (optionally scoped to one kitchen) and clicking **Compute** calls the
   `compute_mrp()` Postgres function, which explodes every confirmed/locked
   menu line through its dish's active recipe, scales by planned quantity,
   grosses up for wastage, and aggregates into `mrp_detail` — one row per
   ingredient with the total gross requirement.
4. **Inventory Reconciliation → Net Purchase Requirement** — clicking
   **Reconcile Inventory** on the Purchase Requirement page calls
   `generate_purchase_requirement()`, which subtracts current
   `inventory_balance.on_hand_qty` from the gross requirement per ingredient
   (never going below zero) to produce the net quantity to buy.
5. **Purchase Request → Approval → Purchasing → Receiving** — net
   requirement lines become a Purchase Request (grouped by kitchen), which is
   submitted, approved/rejected (logged in `approval_log`), converted into
   one Purchase Order per supplier, and received via a Goods Receipt Note.
   Posting a GRN automatically inserts an `inventory_transaction` (receipt)
   which the `apply_inventory_transaction()` trigger folds into
   `inventory_balance` — no manual stock updates required.
6. **Actual Consumption → Food Cost Analysis** — recording actual meals
   served (`consumption_actual`) posts a matching *consumption* inventory
   transaction (negative) using the dish's active recipe, and the
   `v_food_cost_analysis` view compares standard (recipe-costed) vs. actual
   (last-purchase-costed) cost per dish per day, surfaced with variance %.

Every insert/update/delete on the key business tables is captured
automatically in `audit_log` via a generic trigger — no application code
needs to remember to log anything.

## 4. Roles & permissions (RLS)

| Role | Can write |
|---|---|
| `admin` | everything |
| `planner` | recipes, menu planning, MRP |
| `kitchen_manager` | menu planning (own kitchen), inventory adjustments, consumption actuals, receiving |
| `purchasing` | suppliers, purchase requirement, purchase requests, purchase orders, receiving |
| `approver` | approve/reject purchase requests |
| `viewer` | read-only everywhere |

All authenticated users can **read** all planning data — cross-kitchen
visibility is normal for a central procurement team. Only the tables above
are write-restricted.

## 5. Notes & deliberate simplifications

- No microservices — this is a single Vite/React SPA talking directly to
  Supabase (Postgres + PostgREST + Auth). Business logic that must be
  transactional/atomic (MRP explosion, net requirement calculation, document
  numbering, inventory posting) lives in Postgres functions/triggers, not
  client-side code, so it can't be bypassed or duplicated.
- `ingredient_master.last_purchase_cost` is updated automatically whenever a
  goods receipt is posted, and is what "actual cost" in Food Cost Analysis
  is based on.
- The domain types in `src/types/domain.ts` are hand-written rather than
  generated. Once your project is live, you can switch to generated types
  with `npx supabase gen types typescript --project-id <ref> > src/types/database.ts`.
- Recipe Version Control does not duplicate `recipe_header` — each row *is*
  a version. Only one version per dish may be `active` at a time (enforced
  by a trigger); creating a new version starts as `draft` until activated.
