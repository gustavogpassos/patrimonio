import { AppShell } from '@/components/layout/AppShell'
import { Toaster } from '@/components/ui/sonner'
import { CategoriasPage } from '@/features/categorias/CategoriasPage'
import { DashboardPage } from '@/features/dashboard/DashboardPage'
import { EquipamentoDetailPage } from '@/features/equipamentos/EquipamentoDetailPage'
import { EquipamentoFormPage } from '@/features/equipamentos/EquipamentoFormPage'
import { EquipamentosPage } from '@/features/equipamentos/EquipamentosPage'
import { ManutencoesPage } from '@/features/manutencoes/ManutencoesPage'
import { SetoresPage } from '@/features/setores/SetoresPage'
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom'

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="equipamentos" element={<EquipamentosPage />} />
          <Route path="equipamentos/novo" element={<EquipamentoFormPage />} />
          <Route path="equipamentos/:id" element={<EquipamentoDetailPage />} />
          <Route path="equipamentos/:id/editar" element={<EquipamentoFormPage />} />
          <Route path="manutencoes" element={<ManutencoesPage />} />
          <Route path="setores" element={<SetoresPage />} />
          <Route path="categorias" element={<CategoriasPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
      <Toaster richColors position="top-right" />
    </BrowserRouter>
  )
}
