import { useEffect } from 'react'
import { Link, useNavigate } from 'react-router'
import Brand from '../components/ui/Brand.jsx'
import { useAuth } from '../context/useAuth.js'

export default function AuthCallback() {
  const { user, loading } = useAuth()
  const navigate = useNavigate()

  useEffect(() => {
    if (!loading && user) navigate('/dashboard', { replace: true })
  }, [loading, navigate, user])

  if (loading || user) {
    return (
      <main className="auth-state" role="status">
        <span className="auth-spinner" aria-hidden="true" />
        <p>Confirming your email and opening your workspace…</p>
      </main>
    )
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Brand compact />
        <p className="eyebrow auth-eyebrow">ACCOUNT CONFIRMATION</p>
        <h1 id="auth-title">We couldn’t confirm your email.</h1>
        <p className="auth-description">This link may have expired or already been used. If you’ve already confirmed your email, sign in to continue.</p>
        <Link className="button button-primary auth-submit" to="/login">Go to sign in</Link>
        <p className="auth-switch">New to SpendWise? <Link to="/register">Create an account</Link></p>
      </section>
    </main>
  )
}
