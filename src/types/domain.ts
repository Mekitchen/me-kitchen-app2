// Domain types mirroring the PostgreSQL schema in supabase/migrations.
// Kept hand-written (rather than codegen'd) per the "don't over-engineer" brief —
// regenerate with `supabase gen types typescript` once the project is live if preferred.

export type UserRole = 'admin' | 'planner' | 'kitchen_manager' | 'purchasing' | 'approver' | 'viewer'

export interface Profile {
  id: string
  full_name: string
  email: string
  role: UserRole
  kitchen_id: string | null
  active: boolean
  created_at: string
}

export interface UomMaster {
  id: string
  code: string
  name: string
}

export interface KitchenMaster {
  id: string
  code: string
  name: string
  address: string | null
  city: string | null
  capacity_meals: number | null
  active: boolean
  created_at: string
}

export interface CustomerMaster {
  id: string
  code: string
  name: string
  contract_type: string | null
  contact_person: string | null
  contact_phone: string | null
  contact_email: string | null
  active: boolean
  created_at: string
}

export interface SupplierMaster {
  id: string
  code: string
  name: string
  tax_code: string | null
  contact_person: string | null
  phone: string | null
  email: string | null
  address: string | null
  payment_terms: string | null
  active: boolean
  created_at: string
}

export interface IngredientCategory {
  id: string
  name: string
}

export interface IngredientMaster {
  id: string
  code: string
  name: string
  category_id: string | null
  category?: IngredientCategory
  uom_id: string
  uom?: UomMaster
  standard_cost: number
  last_purchase_cost: number | null
  shelf_life_days: number | null
  storage_type: 'dry' | 'chilled' | 'frozen' | 'other'
  default_supplier_id: string | null
  min_stock_qty: number | null
  active: boolean
  created_at: string
  updated_at: string
}

export interface DishCategory {
  id: string
  name: string
}

export interface DishMaster {
  id: string
  code: string
  name: string
  category_id: string | null
  category?: DishCategory
  description: string | null
  portion_size: number
  portion_uom_id: string
  portion_uom?: UomMaster
  standard_selling_price: number | null
  image_url: string | null
  active: boolean
  created_at: string
}

export type RecipeStatus = 'draft' | 'active' | 'archived'

export interface RecipeHeader {
  id: string
  dish_id: string
  dish?: DishMaster
  version_no: number
  status: RecipeStatus
  yield_qty: number
  yield_uom_id: string
  effective_from: string
  effective_to: string | null
  change_summary: string | null
  created_by: string | null
  created_at: string
}

export interface RecipeDetail {
  id: string
  recipe_header_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  quantity: number
  uom_id: string
  wastage_pct: number
  sequence: number
  notes: string | null
}

export type MealPeriod = 'breakfast' | 'lunch' | 'dinner' | 'snack'
export type MenuPlanStatus = 'draft' | 'confirmed' | 'locked'

export interface MenuPlanHeader {
  id: string
  kitchen_id: string
  kitchen?: KitchenMaster
  customer_id: string | null
  customer?: CustomerMaster
  plan_date: string
  meal_period: MealPeriod
  status: MenuPlanStatus
  created_by: string | null
  created_at: string
}

export interface MenuPlanDetail {
  id: string
  menu_plan_header_id: string
  dish_id: string
  dish?: DishMaster
  recipe_header_id: string | null
  planned_qty: number
  notes: string | null
}

export type MrpStatus = 'draft' | 'computed' | 'released'

export interface MrpRun {
  id: string
  run_name: string
  plan_date_from: string
  plan_date_to: string
  kitchen_id: string | null
  kitchen?: KitchenMaster
  status: MrpStatus
  run_by: string | null
  run_at: string
}

export interface MrpDetail {
  id: string
  mrp_run_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  gross_requirement_qty: number
  uom_id: string
}

export interface InventoryBalance {
  id: string
  kitchen_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  on_hand_qty: number
  uom_id: string
  as_of_date: string
  updated_at: string
}

export type InventoryTxnType = 'receipt' | 'issue' | 'adjustment' | 'consumption'

export interface InventoryTransaction {
  id: string
  kitchen_id: string
  ingredient_id: string
  txn_type: InventoryTxnType
  qty: number
  uom_id: string
  ref_type: string | null
  ref_id: string | null
  txn_date: string
  created_by: string | null
  created_at: string
}

export interface PurchaseRequirement {
  id: string
  mrp_run_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  kitchen_id: string
  kitchen?: KitchenMaster
  gross_requirement_qty: number
  on_hand_qty: number
  net_requirement_qty: number
  uom_id: string
  status: 'draft' | 'confirmed'
  created_at: string
}

export type PrStatus = 'draft' | 'submitted' | 'approved' | 'rejected' | 'purchasing' | 'completed'

export interface PurchaseRequestHeader {
  id: string
  pr_no: string
  kitchen_id: string
  kitchen?: KitchenMaster
  requirement_period_from: string
  requirement_period_to: string
  status: PrStatus
  requested_by: string | null
  requested_at: string
  approved_by: string | null
  approved_at: string | null
  notes: string | null
}

export interface PurchaseRequestDetail {
  id: string
  pr_header_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  supplier_id: string | null
  supplier?: SupplierMaster
  quantity: number
  uom_id: string
  estimated_unit_cost: number
  estimated_total_cost: number
  purchase_requirement_id: string | null
}

export type ApprovalAction = 'submit' | 'approve' | 'reject' | 'return'

export interface ApprovalLog {
  id: string
  pr_header_id: string
  action: ApprovalAction
  actor_id: string | null
  actor_name?: string
  actor_role: string | null
  comment: string | null
  acted_at: string
}

export type PoStatus = 'open' | 'partially_received' | 'received' | 'closed' | 'cancelled'

export interface PurchaseOrderHeader {
  id: string
  po_no: string
  pr_header_id: string | null
  supplier_id: string
  supplier?: SupplierMaster
  status: PoStatus
  order_date: string
  expected_date: string | null
  created_by: string | null
  created_at: string
}

export interface PurchaseOrderDetail {
  id: string
  po_header_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  quantity: number
  uom_id: string
  unit_cost: number
  total_cost: number
}

export type GrnStatus = 'draft' | 'posted'

export interface GoodsReceiptHeader {
  id: string
  grn_no: string
  po_header_id: string
  po?: PurchaseOrderHeader
  kitchen_id: string
  received_date: string
  received_by: string | null
  status: GrnStatus
  notes: string | null
}

export interface GoodsReceiptDetail {
  id: string
  grn_header_id: string
  ingredient_id: string
  ingredient?: IngredientMaster
  po_qty: number
  received_qty: number
  uom_id: string
  unit_cost: number
  total_cost: number
  batch_no: string | null
  expiry_date: string | null
}

export interface ConsumptionActual {
  id: string
  kitchen_id: string
  dish_id: string
  menu_plan_detail_id: string | null
  actual_meal_qty: number
  consumption_date: string
  created_by: string | null
  created_at: string
}

export interface FoodCostRow {
  dish_id: string
  dish_code: string
  dish_name: string
  consumption_date: string
  planned_qty: number
  actual_qty: number
  standard_unit_cost: number
  actual_unit_cost: number
  standard_total_cost: number
  actual_total_cost: number
  variance: number
  variance_pct: number
}

export interface AuditLogRow {
  id: string
  table_name: string
  record_id: string
  action: 'insert' | 'update' | 'delete'
  changed_by: string | null
  changed_by_name?: string
  changed_at: string
  old_data: Record<string, unknown> | null
  new_data: Record<string, unknown> | null
}
