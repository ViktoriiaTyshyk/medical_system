import { NavLink, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, FolderOpen, ScanLine, User, Shield, LogOut,
} from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useAuth } from '@/store/auth'
import { api } from '@/services/api'
import { cn } from '@/lib/utils'
import { LungIcon } from '@/components/ui/lung-icon'
import type { Role, Case } from '@/types'

const ROLE_LABEL: Record<Role, string> = {
  PATIENT: 'Пацієнт', RADIOLOGIST: 'Рентгенолог',
  FAMILY_DOCTOR: 'Терапевт', ADMIN: 'Адміністратор',
}

function NavItem({ to, icon: Icon, label, badge }: { to: string; icon: React.ElementType; label: string; badge?: number }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) => cn(
        'flex items-center gap-3 px-3 py-2 rounded-[8px] text-[13.5px] font-medium transition-all duration-150 w-full',
        isActive
          ? 'bg-sky/12 text-sky'
          : 'text-ink-muted hover:bg-panel-50 hover:text-ink'
      )}
    >
      <Icon size={16} className="flex-shrink-0 opacity-80" />
      <span className="flex-1">{label}</span>
      {!!badge && (
        <span className="ml-auto text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-sky text-white min-w-[18px] text-center">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  )
}

function useOpenCasesCount(role: Role | null) {
  const fn = role === 'RADIOLOGIST' ? api.getRadiologistCases
           : role === 'FAMILY_DOCTOR' ? api.getDoctorCases
           : role === 'PATIENT' ? api.getMyCases
           : role === 'ADMIN' ? api.getCases
           : null

  const { data } = useQuery<Case[]>({
    queryKey: ['sidebar-cases', role],
    queryFn: fn!,
    enabled: !!fn,
    refetchInterval: 30_000,
    staleTime: 20_000,
  })

  return data?.filter(c =>
    c.status === 'OPEN' || c.status === 'IN_PROGRESS' || c.status === 'PENDING'
  ).length ?? 0
}

export function Sidebar() {
  const { user, role, clearAuth } = useAuth()
  const navigate = useNavigate()
  const openCount = useOpenCasesCount(role)

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase()

  async function handleLogout() {
    const rt = localStorage.getItem('refresh_token')
    try { if (rt) await api.logout(rt) } catch { /* ignore */ }
    clearAuth()
    navigate('/login')
  }

  return (
    <aside className="fixed top-0 left-0 bottom-0 w-[248px] bg-surface border-r border-line flex flex-col z-10">
      {/* Logo */}
      <div className="flex items-center gap-3 px-4 py-4 border-b border-line">
        <div className="w-8 h-8 rounded-[9px] bg-gradient-to-br from-sky to-jade flex items-center justify-center flex-shrink-0 shadow-md">
          <LungIcon size={16} className="text-white" />
        </div>
        <span className="text-[17px] font-bold text-ink tracking-tight">МедСкан АІ</span>
      </div>

      {/* Nav */}
      <nav className="flex-1 overflow-y-auto px-2 py-3 space-y-0.5">
        <NavItem to="/dashboard" icon={LayoutDashboard} label="Дашборд" />

        {role === 'PATIENT' && (
          <>
            <NavItem to="/cases"   icon={FolderOpen} label="Мої справи"  badge={openCount} />
            <NavItem to="/analyze" icon={ScanLine}   label="AI-аналіз" />
          </>
        )}
        {role === 'RADIOLOGIST' && (
          <NavItem to="/cases" icon={FolderOpen} label="Призначені справи" badge={openCount} />
        )}
        {role === 'FAMILY_DOCTOR' && (
          <NavItem to="/cases" icon={FolderOpen} label="Справи пацієнтів" badge={openCount} />
        )}
        {role === 'ADMIN' && (
          <>
            <NavItem to="/cases" icon={FolderOpen} label="Всі справи"     badge={openCount} />
            <NavItem to="/admin" icon={Shield}    label="Адміністрування" />
          </>
        )}

        <NavItem to="/profile" icon={User} label="Профіль" />
      </nav>

      {/* User */}
      <div className="px-3 py-3 border-t border-line">
        <div className="flex items-center gap-3 px-2 py-2 rounded-[8px] bg-panel-50">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-sky to-jade flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
            {initials || '?'}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-[13px] font-medium text-ink truncate">
              {user?.first_name} {user?.last_name}
            </p>
            <p className="text-[11px] text-ink-muted">{role ? ROLE_LABEL[role] : ''}</p>
          </div>
          <button
            onClick={handleLogout}
            className="p-1.5 rounded-[6px] text-ink-subtle hover:text-rose hover:bg-rose/10 transition-colors"
            title="Вийти"
          >
            <LogOut size={14} />
          </button>
        </div>
      </div>
    </aside>
  )
}
