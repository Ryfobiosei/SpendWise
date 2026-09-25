export function readableAuthError(error, fallback = 'Something went wrong. Please try again.') {
  const message = error?.message || ''

  if (/email address not authorized/i.test(message)) {
    return 'Supabase’s built-in email sender only delivers to project team addresses. Configure a custom SMTP provider in Supabase Auth settings.'
  }
  if (/email rate limit|over_email_send_rate_limit|too many requests/i.test(message)) {
    return 'Email delivery is temporarily rate limited. Wait before trying again, or configure a custom SMTP provider in Supabase Auth settings.'
  }
  if (/invalid login credentials/i.test(message)) {
    return 'That email and password do not match. Check them and try again.'
  }
  if (/email not confirmed/i.test(message)) {
    return 'Please confirm your email before signing in. If the link did not arrive, request another confirmation email below.'
  }

  return message || fallback
}
