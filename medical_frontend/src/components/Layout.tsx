import { Outlet } from 'react-router-dom'
import { Sidebar } from './Sidebar'

export function Layout() {
  return (
    <div className="flex min-h-screen bg-base">
      <Sidebar />
      <main className="ml-[248px] flex-1 p-8 min-h-screen">
        <div className="max-w-[1200px] mx-auto animate-slide-up">
          <Outlet />
        </div>
      </main>
    </div>
  )
}
