import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from '../../context/useAuth.js'

export default function ProtectedRoute() {
  const { user, loading, isConfigured, configurationError } = useAuth()
  const location = useLocation()

  if (loading) {
    return <main className="auth-state"><div className="auth-spinner" aria-hidden="true" /><p>Checking your session…</p></main>
  }

  if (!isConfigured) {
    return (
      <main className="auth-state">
        <section className="auth-config-card">
          <span className="eyebrow">ACCOUNT SETUP</span>
          <h1>Connect Supabase to continue.</h1>
          <p>{configurationError} Add the value to <code>.env.local</code>, then restart the development server.</p>
        </section>
      </main>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
