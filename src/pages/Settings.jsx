import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { useAuth } from '../context/useAuth.js'
import { updateProfile, getProfile } from '../services/profileService.js'

const CURRENCY_OPTIONS = [
  { code: 'GHS', label: 'Ghanaian cedi (GH₵)' },
  { code: 'USD', label: 'US dollar ($)' },
  { code: 'EUR', label: 'Euro (€)' },
  { code: 'GBP', label: 'British pound (£)' },
]

export default function Settings() {
  const { user, updatePassword, updateEmail, resetPassword } = useAuth()
  const [searchParams] = useSearchParams()
  const [profile, setProfile] = useState({ fullName: '', currency: 'GHS' })
  const [email, setEmail] = useState(user?.email ?? '')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [loading, setLoading] = useState(true)
  const [refreshVersion, setRefreshVersion] = useState(0)
  const [savingProfile, setSavingProfile] = useState(false)
  const [savingEmail, setSavingEmail] = useState(false)
  const [savingPassword, setSavingPassword] = useState(false)
  const [profileError, setProfileError] = useState('')
  const [profileLoadError, setProfileLoadError] = useState('')
  const [accountError, setAccountError] = useState('')
  const [passwordError, setPasswordError] = useState('')
  const [profileNotice, setProfileNotice] = useState('')
  const [emailNotice, setEmailNotice] = useState('')
  const [passwordNotice, setPasswordNotice] = useState('')

  useEffect(() => {
    if (!user?.id) return undefined
    let active = true
    getProfile(user.id).then((row) => {
      if (active) setProfile({ fullName: row.full_name, currency: row.currency })
    }).catch((loadError) => {
      if (active) setProfileLoadError(loadError?.message || 'Could not load your profile.')
    }).finally(() => {
      if (active) setLoading(false)
    })
    return () => { active = false }
  }, [refreshVersion, user?.id])

  function retryProfile() {
    setLoading(true)
    setProfileLoadError('')
    setRefreshVersion((version) => version + 1)
  }

  async function saveProfile(event) {
    event.preventDefault()
    if (!user?.id) return
    setSavingProfile(true)
    setProfileError('')
    setProfileLoadError('')
    setProfileNotice('')
    try {
      const updated = await updateProfile(user.id, profile)
      setProfile({ fullName: updated.full_name, currency: updated.currency })
      setProfileNotice('Your profile has been updated.')
    } catch (saveError) {
      setProfileError(saveError?.message || 'Could not save your profile.')
    } finally {
      setSavingProfile(false)
    }
  }

  async function saveEmail(event) {
    event.preventDefault()
    setSavingEmail(true)
    setAccountError('')
    setEmailNotice('')
    try {
      await updateEmail(email.trim())
      setEmailNotice('Check your inbox to confirm the email address change. Your sign-in email changes after confirmation.')
    } catch (saveError) {
      setAccountError(saveError?.message || 'Could not request the email change.')
    } finally {
      setSavingEmail(false)
    }
  }

  async function sendPasswordReset() {
    if (!user?.email) return
    setSavingPassword(true)
    setPasswordError('')
    setPasswordNotice('')
    try {
      await resetPassword(user.email)
      setPasswordNotice('If an account uses this email, a password reset link is on its way.')
    } catch (resetError) {
      setPasswordError(resetError?.message || 'Could not send the password reset email.')
    } finally {
      setSavingPassword(false)
    }
  }

  async function changePassword(event) {
    event.preventDefault()
    setSavingPassword(true)
    setPasswordError('')
    setPasswordNotice('')
    try {
      if (newPassword.length < 8) throw new Error('Choose a password with at least 8 characters.')
      if (newPassword !== confirmPassword) throw new Error('The passwords do not match.')
      await updatePassword(newPassword)
      setNewPassword('')
      setConfirmPassword('')
      setPasswordNotice('Your password has been changed.')
    } catch (saveError) {
      setPasswordError(saveError?.message || 'Could not change your password.')
    } finally {
      setSavingPassword(false)
    }
  }

  return (
    <section className="settings-page">
      <div className="settings-heading">
        <p className="eyebrow">ACCOUNT PREFERENCES</p>
        <h1>Settings</h1>
        <p>Manage your profile, currency, and sign-in details.</p>
      </div>

      {loading && <div className="transaction-loading" role="status"><span className="auth-spinner" aria-hidden="true" /><span>Loading your settings…</span></div>}

      {!loading && (
        <div className="settings-grid">
          <section className="settings-card" aria-labelledby="settings-profile-title">
            <div className="settings-card-heading"><span className="settings-icon" aria-hidden="true">◉</span><div><h2 id="settings-profile-title">Your profile</h2><p>Your name and how amounts are displayed</p></div></div>
            {profileLoadError && <div className="settings-profile-error"><p className="inline-error" role="alert">{profileLoadError}</p><button className="row-action" type="button" onClick={retryProfile}>Reload profile</button></div>}
            {profileError && <p className="inline-error" role="alert">{profileError}</p>}
            {profileNotice && <p className="inline-notice" role="status">{profileNotice}</p>}
            <form className="settings-form" onSubmit={saveProfile}>
              <label className="data-field"><span>Full name</span><input type="text" maxLength={80} required value={profile.fullName} onChange={(event) => setProfile((current) => ({ ...current, fullName: event.target.value }))} placeholder="Your name" /></label>
              <label className="data-field"><span>Preferred currency</span><select value={profile.currency} onChange={(event) => setProfile((current) => ({ ...current, currency: event.target.value }))}>{CURRENCY_OPTIONS.map((option) => <option key={option.code} value={option.code}>{option.label}</option>)}</select></label>
              <button className="button button-primary" type="submit" disabled={savingProfile}>{savingProfile ? 'Saving…' : 'Save profile'}</button>
            </form>
          </section>

          <section className="settings-card" aria-labelledby="settings-email-title">
            <div className="settings-card-heading"><span className="settings-icon" aria-hidden="true">@</span><div><h2 id="settings-email-title">Sign-in email</h2><p>Supabase will ask you to confirm an email change</p></div></div>
            {accountError && <p className="inline-error" role="alert">{accountError}</p>}
            {emailNotice && <p className="inline-notice" role="status">{emailNotice}</p>}
            {searchParams.get('email-updated') === '1' && <p className="inline-notice" role="status">Your sign-in email has been confirmed.</p>}
            <form className="settings-form" onSubmit={saveEmail}>
              <label className="data-field"><span>Email address</span><input type="email" autoComplete="email" required value={email} onChange={(event) => setEmail(event.target.value)} /></label>
              <button className="button button-primary" type="submit" disabled={savingEmail || email.trim().toLowerCase() === (user?.email || '').toLowerCase()}>{savingEmail ? 'Sending…' : 'Request email change'}</button>
            </form>
          </section>

          <section className="settings-card settings-security-card" aria-labelledby="settings-password-title">
            <div className="settings-card-heading"><span className="settings-icon" aria-hidden="true">⌑</span><div><h2 id="settings-password-title">Password and security</h2><p>Credential changes are handled by Supabase Auth</p></div></div>
            {passwordError && <p className="inline-error" role="alert">{passwordError}</p>}
            {passwordNotice && <p className="inline-notice" role="status">{passwordNotice}</p>}
            <form className="settings-form settings-password-form" onSubmit={changePassword}>
              <label className="data-field"><span>New password</span><input type="password" autoComplete="new-password" minLength={8} required value={newPassword} onChange={(event) => setNewPassword(event.target.value)} placeholder="At least 8 characters" /></label>
              <label className="data-field"><span>Confirm new password</span><input type="password" autoComplete="new-password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} placeholder="Enter it again" /></label>
              <button className="button button-primary" type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change password'}</button>
            </form>
            <div className="settings-reset-row"><span>Prefer a password reset link?</span><button type="button" className="row-action" onClick={sendPasswordReset} disabled={savingPassword}>{savingPassword ? 'Sending…' : 'Email me a reset link'}</button></div>
          </section>
        </div>
      )}
    </section>
  )
}
