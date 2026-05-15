// frontend/src/components/auth/LoginForm.jsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../context/ToastContext'

export default function LoginForm() {
  const { loginEmail, loginGoogle, openAuthModal, closeAuthModal } = useAuth()
  const toast        = useToast()
  const navigate     = useNavigate()
  const recaptchaRef = useRef(null)

  const [email,       setEmail]       = useState('')
  const [password,    setPassword]    = useState('')
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [gLoading,    setGLoading]    = useState(false)
  const [error,       setError]       = useState('')
  const [captchaDone, setCaptchaDone] = useState(false)

  // ── Email login ─────────────────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (!captchaDone) { setError('Please complete the CAPTCHA verification.'); return }

    setLoading(true)
    try {
      const captchaToken = recaptchaRef.current?.getValue()
      await loginEmail({ email, password, captchaToken })
      toast.success('Welcome back! 🎉')
      closeAuthModal()
      navigate('/dashboard')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('user-not-found') || msg.includes('wrong-password') || msg.includes('invalid-credential'))
        setError('Incorrect email or password. Please try again.')
      else if (msg.includes('too-many-requests'))
        setError('Too many attempts. Please wait a moment and try again.')
      else
        setError(msg || 'Login failed. Please try again.')
      recaptchaRef.current?.reset()
      setCaptchaDone(false)
    } finally { setLoading(false) }
  }

  // ── Google login ────────────────────────────────────────────────────────
  const handleGoogle = async () => {
    if (!captchaDone) { setError('Please complete the CAPTCHA before signing in with Google.'); return }
    setGLoading(true)
    setError('')
    try {
      const captchaToken = recaptchaRef.current?.getValue()
      await loginGoogle(captchaToken)
      toast.success('Welcome to SwasthyaSeva! 🌟')
      closeAuthModal()
      navigate('/dashboard')
    } catch (err) {
      setError(err.message?.includes('popup-closed') ? 'Google sign-in was cancelled.' : (err.message || 'Google sign-in failed.'))
      recaptchaRef.current?.reset()
      setCaptchaDone(false)
    } finally { setGLoading(false) }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">

      {/* Error banner */}
      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
          <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">
          Email Address
        </label>
        <input
          type="email"
          required
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="hello@example.com"
          className="w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl bg-white transition-all duration-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400"
        />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">
          Password
        </label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'}
            required
            value={password}
            onChange={e => setPassword(e.target.value)}
            placeholder="Enter your password"
            className="w-full px-4 py-3 pr-12 text-sm border border-slate-200 rounded-2xl bg-white transition-all duration-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400"
          />
          <button
            type="button"
            onClick={() => setShowPass(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors"
          >
            {showPass ? <FiEyeOff size={17} /> : <FiEye size={17} />}
          </button>
        </div>
      </div>

      {/* reCAPTCHA */}
      <div className="flex justify-center">
        <ReCAPTCHA
          ref={recaptchaRef}
          sitekey={import.meta.env.VITE_RECAPTCHA_SITE_KEY}
          onChange={v => setCaptchaDone(!!v)}
          onExpired={() => setCaptchaDone(false)}
        />
      </div>

      {/* Submit */}
      <button
        type="submit"
        disabled={loading || !captchaDone}
        className="w-full py-3.5 rounded-2xl text-white font-semibold text-sm transition-all duration-200 disabled:opacity-60 disabled:cursor-not-allowed flex items-center justify-center gap-2"
        style={{ background: 'linear-gradient(135deg, #0ea5e9, #0284c7)' }}
      >
        {loading
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Logging in…</>
          : 'Login to Dashboard →'
        }
      </button>

      {/* Divider */}
      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or continue with</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      {/* Google */}
      <button
        type="button"
        onClick={handleGoogle}
        disabled={gLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-semibold text-slate-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <FcGoogle size={20} />
        {gLoading ? 'Signing in…' : 'Continue with Google'}
      </button>

      <p className="text-center text-sm text-slate-500">
        New to SwasthyaSeva?{' '}
        <button
          type="button"
          onClick={() => openAuthModal('signup')}
          className="text-sky-500 font-semibold hover:underline"
        >
          Create account
        </button>
      </p>
    </form>
  )
}
