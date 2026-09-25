import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router'
import Brand from '../ui/Brand.jsx'
import { useAuth } from '../../context/useAuth.js'

const navigation = [
  { to: '/dashboard', label: 'Overview', icon: '◫', end: true },
  { to: '/dashboard/transactions', label: 'Transactions', icon: '⇄' },
  { to: '/dashboard/categories', label: 'Categories', icon: '▦' },
  { to: '/dashboard/budgets', label: 'Budgets', icon: '◎' },
  { to: '/dashboard/analytics', label: 'Analytics', icon: '▥' },
  { to: '/dashboard/settings', label: 'Settings', icon: '⚙' },
]

export default function DashboardLayout() {
  const { signOut, user } = useAuth()
  const navigate = useNavigate()
  const [signOutError, setSignOutError] = useState('')

  async function handleSignOut() {
    setSignOutError('')
    try {
      await signOut()
      navigate('/login', { replace: true })
    } catch (error) {
      setSignOutError(error?.message || 'Could not sign out. Please try again.')
    }
  }

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
        <div className="sidebar-account">
          <span className="sidebar-user" title={user?.email}>{user?.email || 'Your account'}</span>
          <button className="sidebar-signout" type="button" onClick={handleSignOut}>Sign out</button>
        </div>
        <div className="sidebar-footer">PERSONAL FINANCE</div>
      </aside>
      <main className="workspace-main">
        <header className="workspace-topbar">
          <span>Personal workspace</span>
          <span className="connection-status"><span /> Signed in</span>
        </header>
        {signOutError && <p className="signout-error" role="alert">{signOutError}</p>}
        <div className="workspace-content"><Outlet /></div>
      </main>
    </div>
  )
}
