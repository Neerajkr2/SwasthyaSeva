// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
} from 'firebase/auth'
import { auth, signInWithGoogle, signInWithGoogleRedirect, getGoogleRedirectResult, signOutUser } from '../services/firebase'
import { authAPI, storeToken, clearToken, getStoredToken } from '../services/api'

const AuthContext = createContext(null)
export const useAuthContext = () => useContext(AuthContext)

export function AuthProvider({ children }) {
  const [user,      setUser]      = useState(null)   // Firebase user object
  const [profile,   setProfile]   = useState(null)   // Our backend profile
  const [loading,   setLoading]   = useState(true)

  // ── Auth modal state ──────────────────────────────────────────────────────
  const [authModal, setAuthModal] = useState(false)
  const [authTab,   setAuthTab]   = useState('login')

  // ── On mount: sync Firebase auth state ───────────────────────────────────
  // If a stored backend token exists, try to load the profile silently.
  // If the Firebase session also exists, we're fully authenticated.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser)
        // Try to load profile using stored backend token
        const stored = getStoredToken()
        if (stored) {
          try {
            const { data } = await authAPI.getProfile()
            setProfile(data)
          } catch {
            // Token expired or invalid — clear it; user stays logged in via Firebase
            clearToken()
          }
        }
      } else {
        setUser(null)
        setProfile(null)
        clearToken()
      }
      setLoading(false)
    })
    return unsub
  }, [])

  // ── Helper: save JWT + profile from any auth response ────────────────────
  const handleAuthResponse = useCallback((data) => {
    if (data?.access_token) storeToken(data.access_token)
    if (data?.user)         setProfile(data.user)
    return data
  }, [])

  // ── Finish Google sign-in when returning from a redirect fallback ─────────
  // Runs once on mount. If the user was sent to Google via signInWithRedirect
  // (because the popup was blocked), this completes the login on return.
  useEffect(() => {
    getGoogleRedirectResult()
      .then(async (result) => {
        if (!result?.user) return
        const idToken = await result.user.getIdToken()
        let captchaToken = ''
        try {
          captchaToken = sessionStorage.getItem('ss_pending_captcha') || ''
          sessionStorage.removeItem('ss_pending_captcha')
        } catch { /* ignore */ }
        const { data } = await authAPI.loginWithGoogle(idToken, captchaToken)
        handleAuthResponse(data)
        if (data?.access_token) window.location.replace('/dashboard')
      })
      .catch((e) => console.warn('Google redirect sign-in did not complete:', e?.code || e))
  }, [handleAuthResponse])

  // ── Email/Password Sign-up ────────────────────────────────────────────────
  const registerEmail = useCallback(async ({ name, email, password, captchaToken }) => {
    // 1. Create Firebase user
    const cred = await createUserWithEmailAndPassword(auth, email, password)
    await updateProfile(cred.user, { displayName: name })

    // 2. Exchange Firebase token for our backend JWT
    const idToken = await cred.user.getIdToken()
    const { data } = await authAPI.registerWithEmail({
      id_token: idToken, name, email, captcha_token: captchaToken,
    })
    handleAuthResponse(data)
    return data
  }, [handleAuthResponse])

  // ── Email/Password Login ──────────────────────────────────────────────────
  const loginEmail = useCallback(async ({ email, password, captchaToken }) => {
    // 1. Authenticate with Firebase
    const cred    = await signInWithEmailAndPassword(auth, email, password)
    const idToken = await cred.user.getIdToken()

    // 2. Exchange for our backend JWT
    const { data } = await authAPI.loginWithEmail({
      id_token: idToken, captcha_token: captchaToken,
    })
    handleAuthResponse(data)
    return data
  }, [handleAuthResponse])

  // ── Google Sign-in ────────────────────────────────────────────────────────
  const loginGoogle = useCallback(async (captchaToken) => {
    try {
      const result  = await signInWithGoogle()
      const idToken = await result.user.getIdToken()
      const { data } = await authAPI.loginWithGoogle(idToken, captchaToken)
      handleAuthResponse(data)
      return data
    } catch (err) {
      // If the browser/extension blocked the popup, fall back to a full-page
      // redirect (no popup needed). Stash the captcha token so it survives the
      // round-trip; the redirect-result effect above finishes the login.
      const code = err?.code || ''
      if (['auth/popup-blocked', 'auth/cancelled-popup-request',
           'auth/operation-not-supported-in-this-environment'].includes(code)) {
        try { sessionStorage.setItem('ss_pending_captcha', captchaToken || '') } catch { /* ignore */ }
        await signInWithGoogleRedirect()
        return  // page navigates to Google; result handled on return
      }
      throw err
    }
  }, [handleAuthResponse])

  // ── Logout ────────────────────────────────────────────────────────────────
  const logout = useCallback(async () => {
    clearToken()
    await signOutUser()
    setUser(null)
    setProfile(null)
  }, [])

  // ── Modal helpers ─────────────────────────────────────────────────────────
  const openAuthModal  = (tab = 'login') => { setAuthTab(tab); setAuthModal(true) }
  const closeAuthModal = () => setAuthModal(false)

  return (
    <AuthContext.Provider value={{
      user, profile, loading,
      authModal, authTab,
      openAuthModal, closeAuthModal,
      registerEmail, loginEmail, loginGoogle,
      logout,
      isAuthenticated: !!user && !!getStoredToken(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
