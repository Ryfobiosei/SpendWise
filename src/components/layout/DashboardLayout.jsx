import { NavLink, Outlet } from 'react-router'
import Brand from '../ui/Brand.jsx'

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: '◫', end: true },
  { to: '/dashboard/transactions', label: 'Transactions', icon: '⇄' },
  { to: '/dashboard/budgets', label: 'Budgets', icon: '◎' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: '▥' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardLayout() {
  return (
    <div className="workspace-shell">
      <aside className="sidebar">
        <Brand />
        <p className="sidebar-label">WORKSPACE</p>
        <nav className="sidebar-nav" aria-label="Dashboard navigation">
          {navigation.map(({ to, label, icon, end }) => (
            <NavLink key={to} to={to} end={end} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
              <span className="sidebar-icon" aria-hidden="true">{icon}</span>
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="sidebar-note">
          <span className="note-mark" aria-hidden="true">✳</span>
          <p>Your finances, with more clarity.</p>
        </div>
        <div className="sidebar-footer">PERSONAL FINANCE · GHANA</div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <span>Personal workspace</span>
          <span className="connection-status"><span /> Setup in progress</span>
        </header>
        <div className="workspace-content"><Outlet /></div>
      </main>
    </div>
  )
}
