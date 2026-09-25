import { useState } from 'react'
import { Link, useNavigate } from 'react-router'
import Brand from '../components/ui/Brand.jsx'
import { useAuth } from '../context/useAuth.js'

export default function Register() {
  const { signUp, isConfigured, configurationError } = useAuth()
  const navigate = useNavigate()
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (!isConfigured) throw new Error(configurationError || 'Supabase is not configured.')
      if (password.length < 8) throw new Error('Choose a password with at least 8 characters.')
      if (password !== confirmation) throw new Error('The passwords do not match.')
      const { session } = await signUp({ email: email.trim(), password, fullName: fullName.trim() })
      if (session) navigate('/dashboard', { replace: true })
      else setMessage('Check your inbox for a confirmation link to finish creating your account.')
    } catch (submitError) {
      setError(submitError?.message || 'We could not create your account. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Brand compact />
        <p className="eyebrow auth-eyebrow">A CLEARER MONEY ROUTINE</p>
        <h1 id="auth-title">Start with a plan.</h1>
        <p className="auth-description">Create your account and bring your finances into focus.</p>

        {!isConfigured && <div className="form-alert form-alert-error" role="alert">{configurationError} Add it to <code>.env.local</code> and restart the development server.</div>}
        {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
        {message && <div className="form-alert form-alert-success" role="status">{message}</div>}

        <form className="auth-form" onSubmit={handleSubmit}>
          <label className="form-field">
            <span>Your name</span>
            <input type="text" name="name" autoComplete="name" required maxLength={80} value={fullName} onChange={(event) => setFullName(event.target.value)} placeholder="Ama Mensah" />
          </label>
          <label className="form-field">
            <span>Email address</span>
            <input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} placeholder="you@example.com" />
          </label>
          <label className="form-field">
            <span>Password</span>
            <input type="password" name="password" autoComplete="new-password" minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
          </label>
          <label className="form-field">
            <span>Confirm password</span>
            <input type="password" name="password-confirmation" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again" />
          </label>
          <button className="button button-primary auth-submit" type="submit" disabled={busy || !isConfigured}>{busy ? 'Creating account…' : 'Create account'}</button>
        </form>

        <p className="auth-switch">Already have an account? <Link to="/login">Sign in</Link></p>
        <Link className="auth-home-link" to="/">← Back to home</Link>
      </section>
    </main>
  )
}
