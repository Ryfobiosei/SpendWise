import { useEffect, useState } from 'react'
import { Link, useLocation, useNavigate, useSearchParams } from 'react-router'
import Brand from '../components/ui/Brand.jsx'
import { useAuth } from '../context/useAuth.js'
import { readableAuthError } from '../lib/authErrors.js'

export default function Login() {
  const { signIn, resendSignupConfirmation, resetPassword, updatePassword, user, isConfigured, configurationError } = useAuth()
  const location = useLocation()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const recoveryLink = searchParams.get('password-reset') === '1'
  const [mode, setMode] = useState(recoveryLink ? 'new-password' : 'sign-in')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')
  const [canResendConfirmation, setCanResendConfirmation] = useState(false)

  useEffect(() => {
    if (user && mode !== 'new-password') navigate('/dashboard', { replace: true })
  }, [mode, navigate, user])

  const changeMode = (nextMode) => {
    setMode(nextMode)
    setError('')
    setMessage('')
    setCanResendConfirmation(false)
  }

  async function handleResendConfirmation() {
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (!email.trim()) throw new Error('Enter your email address first.')
      await resendSignupConfirmation(email.trim())
      setMessage('If this account still needs confirmation, a new email is on its way. Check your spam folder too.')
      setCanResendConfirmation(false)
    } catch (resendError) {
      setError(readableAuthError(resendError, 'We could not resend the confirmation email. Please try again.'))
    } finally {
      setBusy(false)
    }
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setBusy(true)
    setError('')
    setMessage('')

    try {
      if (!isConfigured) throw new Error(configurationError || 'Supabase is not configured.')

      if (mode === 'forgot') {
        await resetPassword(email.trim())
        setMessage('If an account uses that email, a password reset link is on its way.')
      } else if (mode === 'new-password') {
        if (password.length < 8) throw new Error('Choose a password with at least 8 characters.')
        if (password !== confirmation) throw new Error('The passwords do not match.')
        await updatePassword(password)
        setMessage('Your password has been updated. You can now sign in.')
        setMode('sign-in')
        setSearchParams({}, { replace: true })
        setPassword('')
        setConfirmation('')
      } else {
        await signIn({ email: email.trim(), password })
        const destination = location.state?.from
        navigate(destination ? `${destination.pathname}${destination.search || ''}${destination.hash || ''}` : '/dashboard', { replace: true })
      }
    } catch (submitError) {
      setCanResendConfirmation(mode === 'sign-in' && /email not confirmed/i.test(submitError?.message || ''))
      setError(readableAuthError(submitError))
    } finally {
      setBusy(false)
    }
  }

  const title = mode === 'forgot' ? 'Reset your password' : mode === 'new-password' ? 'Choose a new password' : 'Welcome back.'
  const description = mode === 'forgot'
    ? 'Enter your account email and we’ll send a reset link if it matches an account.'
    : mode === 'new-password'
      ? 'Set a new password for your SpendWise account.'
      : 'Sign in to pick up where you left off.'

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <Brand compact />
        <p className="eyebrow auth-eyebrow">YOUR MONEY, IN VIEW</p>
        <h1 id="auth-title">{title}</h1>
        <p className="auth-description">{description}</p>

        {!isConfigured && <div className="form-alert form-alert-error" role="alert">{configurationError} Add it to <code>.env.local</code> and restart the development server.</div>}
        {recoveryLink && mode === 'new-password' && !user && <div className="form-alert form-alert-info" role="status">Open this page using the password reset link from your email. If you already did, request a fresh link.</div>}
        {error && <div className="form-alert form-alert-error" role="alert">{error}</div>}
        {message && <div className="form-alert form-alert-success" role="status">{message}</div>}
        {canResendConfirmation && mode === 'sign-in' && <button type="button" className="auth-inline-link" onClick={handleResendConfirmation} disabled={busy}>{busy ? 'Sending…' : 'Resend confirmation email'}</button>}

        <form className="auth-form" onSubmit={handleSubmit}>
          {mode !== 'new-password' && (
            <label className="form-field">
              <span>Email address</span>
              <input type="email" name="email" autoComplete="email" required value={email} onChange={(event) => { setEmail(event.target.value); setCanResendConfirmation(false) }} placeholder="you@example.com" />
            </label>
          )}
          {mode !== 'forgot' && (
            <label className="form-field">
              <span>{mode === 'new-password' ? 'New password' : 'Password'}</span>
              <input type="password" name="password" autoComplete={mode === 'new-password' ? 'new-password' : 'current-password'} minLength={8} required value={password} onChange={(event) => setPassword(event.target.value)} placeholder="At least 8 characters" />
            </label>
          )}
          {mode === 'new-password' && (
            <label className="form-field">
              <span>Confirm new password</span>
              <input type="password" name="password-confirmation" autoComplete="new-password" minLength={8} required value={confirmation} onChange={(event) => setConfirmation(event.target.value)} placeholder="Enter it again" />
            </label>
          )}
          {mode === 'sign-in' && <button type="button" className="auth-inline-link" onClick={() => changeMode('forgot')}>Forgot password?</button>}
          <button className="button button-primary auth-submit" type="submit" disabled={busy || !isConfigured || (mode === 'new-password' && !user)}>
            {busy ? 'Please wait…' : mode === 'forgot' ? 'Send reset link' : mode === 'new-password' ? 'Update password' : 'Sign in'}
          </button>
        </form>

        <p className="auth-switch">
          {mode === 'sign-in' ? <>New to SpendWise? <Link to="/register">Create an account</Link></> : <button type="button" className="auth-inline-link" onClick={() => changeMode('sign-in')}>Back to sign in</button>}
        </p>
        <Link className="auth-home-link" to="/">← Back to home</Link>
      </section>
    </main>
  )
}
