// frontend/src/context/AuthContext.jsx
import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
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

  const navigate = useNavigate()

  // True only while we're finishing a Google *redirect* sign-in on return to
  // the app (the path LinkedIn / in-app browsers take). Initialised
  // synchronously from a marker set just before redirecting, so the landing
  // page never flashes — we show a "Completing sign-in…" loader instead.
  const [finishingOAuth, setFinishingOAuth] = useState(() => {
    try { return sessionStorage.getItem('ss_oauth_pending') === '1' } catch { return false }
  })

  // ── Auth modal state ──────────────────────────────────────────────────────
  const [authModal, setAuthModal] = useState(false)
  const [authTab,   setAuthTab]   = useState('login')

  // ── On mount: sync Firebase auth state ───────────────────────────────────
  // If a stored backend token exists, try to load the profile silently.
  // If the Firebase session also exists, we're fully authenticated.
  // ── The backend JWT (localStorage) is the REAL session ───────────────────
  // On mount, if a token exists we validate it by loading the profile. This is
  // what keeps the user logged in across refreshes and after a redirect sign-in,
  // independent of Firebase's cross-domain persistence quirks.
  useEffect(() => {
    let active = true
    if (!getStoredToken()) { setLoading(false); return }
    authAPI.getProfile()
      .then(({ data }) => { if (active) setProfile(data) })
      .catch(() => { clearToken() })            // token expired/invalid → logged out
      .finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  }, [])

  // ── Track the Firebase user separately (used only for token exchange) ─────
  // IMPORTANT: never clear the backend token here. A redirect sign-in can
  // briefly report a null Firebase user, and clearing the token on that event
  // is exactly what bounced the user back to the landing page. Logout() is the
  // only place that clears the session.
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => setUser(firebaseUser || null))
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
        // Client-side navigation (NOT window.location.replace) — avoids a full
        // page reload AND a redundant /auth/me round-trip. The profile is
        // already in state from the response above, so the dashboard renders
        // immediately. This is the main win against the post-login delay.
        if (data?.access_token) navigate('/dashboard', { replace: true })
      })
      .catch((e) => console.warn('Google redirect sign-in did not complete:', e?.code || e))
      .finally(() => {
        try { sessionStorage.removeItem('ss_oauth_pending') } catch { /* ignore */ }
        setFinishingOAuth(false)
      })
  }, [handleAuthResponse, navigate])

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
        try {
          sessionStorage.setItem('ss_pending_captcha', captchaToken || '')
          sessionStorage.setItem('ss_oauth_pending', '1')  // → show "Completing sign-in…" on return
        } catch { /* ignore */ }
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
      finishingOAuth,
      authModal, authTab,
      openAuthModal, closeAuthModal,
      registerEmail, loginEmail, loginGoogle,
      logout,
      isAuthenticated: !!getStoredToken(),
    }}>
      {children}
    </AuthContext.Provider>
  )
}

export default AuthContext
