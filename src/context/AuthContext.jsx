import { useEffect, useMemo, useState } from 'react'
import { AuthContext } from './authContextValue.js'
import { isSupabaseConfigured, requireSupabase, supabaseConfigError } from '../lib/supabaseClient.js'

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [user, setUser] = useState(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined

    const client = requireSupabase()
    const { data: { subscription } } = client.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo(() => ({
    user,
    session,
    loading,
    isConfigured: isSupabaseConfigured,
    configurationError: supabaseConfigError,
    signUp: async ({ email, password, fullName }) => {
      const client = requireSupabase()
      const { data, error } = await client.auth.signUp({
        email,
        password,
        options: {
          data: { full_name: fullName },
          emailRedirectTo: `${window.location.origin}/login`,
        },
      })

      if (error) throw error
      return data
    },
    signIn: async ({ email, password }) => {
      const client = requireSupabase()
      const { data, error } = await client.auth.signInWithPassword({ email, password })

      if (error) throw error
      return data
    },
    signOut: async () => {
      const client = requireSupabase()
      const { error } = await client.auth.signOut({ scope: 'local' })

      if (error) throw error
    },
    resetPassword: async (email) => {
      const client = requireSupabase()
      const { data, error } = await client.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/login?password-reset=1`,
      })

      if (error) throw error
      return data
    },
  }), [user, session, loading])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
