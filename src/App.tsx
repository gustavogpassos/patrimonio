import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { CategoriesPage } from '@/features/categories/CategoriesPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { EquipmentDetailPage } from '@/features/equipment/EquipmentDetailPage'
import { EquipmentFormPage } from '@/features/equipment/EquipmentFormPage'
import { EquipmentPage } from '@/features/equipment/EquipmentPage'
import { MaintenancePage } from '@/features/maintenance/MaintenancePage'
import { SectorsPage } from '@/features/sectors/SectorsPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="equipment" element={<EquipmentPage />} />
          <Route path="equipment/new" element={<EquipmentFormPage />} />
          <Route path="equipment/:id" element={<EquipmentDetailPage />} />
          <Route path="equipment/:id/edit" element={<EquipmentFormPage />} />
          <Route path="maintenance" element={<MaintenancePage />} />
          <Route path="sectors" element={<SectorsPage />} />
          <Route path="categories" element={<CategoriesPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster
        richColors
        position="bottom-center"
        offset={16}
        mobileOffset={{ bottom: 24 }}
      />
    </BrowserRouter>
  )
}
