import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useAuth } from '@/store/auth'
import { Layout } from '@/components/Layout'
import { Login }        from '@/pages/Login'
import { Register }     from '@/pages/Register'
import { Dashboard }    from '@/pages/Dashboard'
import { Cases }        from '@/pages/Cases'
import { CaseDetail }   from '@/pages/CaseDetail'
import { LungAnalysis } from '@/pages/LungAnalysis'
import { Profile }      from '@/pages/Profile'
import { Admin }        from '@/pages/Admin'

const qc = new QueryClient({
  defaultOptions: { queries: { retry: 1, staleTime: 30_000 } },
})

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { token } = useAuth()
  return token ? <>{children}</> : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <QueryClientProvider client={qc}>
      <BrowserRouter>
        <Routes>
          <Route path="/login"    element={<Login />} />
          <Route path="/register" element={<Register />} />
          <Route path="/" element={<RequireAuth><Layout /></RequireAuth>}>
            <Route index element={<Navigate to="/dashboard" replace />} />
            <Route path="dashboard" element={<Dashboard />} />
            <Route path="cases"     element={<Cases />} />
            <Route path="cases/:id" element={<CaseDetail />} />
            <Route path="analyze"   element={<LungAnalysis />} />
            <Route path="profile"   element={<Profile />} />
            <Route path="admin"     element={<Admin />} />
          </Route>
          <Route path="*" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
