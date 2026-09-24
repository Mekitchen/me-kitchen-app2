import { Navigate, Route, Routes } from 'react-router-dom'
import { useAuth } from './lib/auth'
import { AppLayout } from './components/layout/AppLayout'
import Login from './pages/Login'
import Dashboard from './pages/Dashboard'
import IngredientMasterPage from './pages/masters/IngredientMasterPage'
import DishMasterPage from './pages/masters/DishMasterPage'
import KitchenMasterPage from './pages/masters/KitchenMasterPage'
import CustomerMasterPage from './pages/masters/CustomerMasterPage'
import SupplierMasterPage from './pages/masters/SupplierMasterPage'
import RecipeBomPage from './pages/recipe/RecipeBomPage'
import RecipeVersionsPage from './pages/recipe/RecipeVersionsPage'
import MenuPlanningPage from './pages/planning/MenuPlanningPage'
import MrpPage from './pages/planning/MrpPage'
import InventoryBalancePage from './pages/planning/InventoryBalancePage'
import PurchaseRequirementPage from './pages/planning/PurchaseRequirementPage'
import PurchaseRequestPage from './pages/procurement/PurchaseRequestPage'
import ApprovalWorkflowPage from './pages/procurement/ApprovalWorkflowPage'
import PurchaseOrderPage from './pages/procurement/PurchaseOrderPage'
import ReceivingPage from './pages/procurement/ReceivingPage'
import FoodCostAnalysisPage from './pages/FoodCostAnalysisPage'
import AuditLogPage from './pages/AuditLogPage'

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth()
  if (loading) {
    return <div className="flex h-screen items-center justify-center text-ink-400">Đang tải…</div>
  }
  if (!session) return <Navigate to="/login" replace />
  return <>{children}</>
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        element={
          <RequireAuth>
            <AppLayout />
          </RequireAuth>
        }
      >
        <Route path="/" element={<Dashboard />} />
        <Route path="/ingredients" element={<IngredientMasterPage />} />
        <Route path="/dishes" element={<DishMasterPage />} />
        <Route path="/kitchens" element={<KitchenMasterPage />} />
        <Route path="/customers" element={<CustomerMasterPage />} />
        <Route path="/suppliers" element={<SupplierMasterPage />} />
        <Route path="/recipes" element={<RecipeBomPage />} />
        <Route path="/recipes/versions" element={<RecipeVersionsPage />} />
        <Route path="/menu-planning" element={<MenuPlanningPage />} />
        <Route path="/mrp" element={<MrpPage />} />
        <Route path="/inventory" element={<InventoryBalancePage />} />
        <Route path="/purchase-requirement" element={<PurchaseRequirementPage />} />
        <Route path="/purchase-requests" element={<PurchaseRequestPage />} />
        <Route path="/approvals" element={<ApprovalWorkflowPage />} />
        <Route path="/purchase-orders" element={<PurchaseOrderPage />} />
        <Route path="/receiving" element={<ReceivingPage />} />
        <Route path="/food-cost" element={<FoodCostAnalysisPage />} />
        <Route path="/audit-log" element={<AuditLogPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
