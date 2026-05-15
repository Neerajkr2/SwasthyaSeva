// frontend/src/components/auth/SignupForm.jsx
import { useState, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import ReCAPTCHA from 'react-google-recaptcha'
import { FiEye, FiEyeOff, FiAlertCircle } from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import { useAuth } from '../../hooks/useAuth'
import { useToast } from '../../context/ToastContext'

function PasswordStrength({ password }) {
  if (!password) return null
  const score =
    (password.length >= 8  ? 1 : 0) +
    (/[A-Z]/.test(password)? 1 : 0) +
    (/[0-9]/.test(password)? 1 : 0) +
    (/[^A-Za-z0-9]/.test(password) ? 1 : 0)
  const colors = ['#ef4444','#f59e0b','#f59e0b','#10b981','#10b981']
  const labels = ['','Weak','Fair','Good','Strong']
  return (
    <div className="mt-2">
      <div className="flex gap-1 mb-1">
        {[1,2,3,4].map(i => (
          <div key={i} className="h-1 flex-1 rounded-full transition-colors duration-300"
            style={{ background: i <= score ? colors[score] : '#e2e8f0' }} />
        ))}
      </div>
      {score > 0 && (
        <p className="text-xs" style={{ color: colors[score] }}>{labels[score]} password</p>
      )}
    </div>
  )
}

export default function SignupForm() {
  const { registerEmail, loginGoogle, openAuthModal, closeAuthModal } = useAuth()
  const toast        = useToast()
  const navigate     = useNavigate()
  const recaptchaRef = useRef(null)

  const [form,        setForm]        = useState({ name:'', email:'', password:'', confirm:'' })
  const [showPass,    setShowPass]    = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [gLoading,    setGLoading]    = useState(false)
  const [error,       setError]       = useState('')
  const [captchaDone, setCaptchaDone] = useState(false)

  const set = (field) => (e) => setForm(v => ({ ...v, [field]: e.target.value }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')
    if (form.name.trim().length < 2)    { setError('Please enter your full name (at least 2 characters).'); return }
    if (form.password.length < 6)        { setError('Password must be at least 6 characters.'); return }
    if (form.password !== form.confirm)  { setError('Passwords do not match.'); return }
    if (!captchaDone)                    { setError('Please complete the CAPTCHA verification.'); return }

    setLoading(true)
    try {
      const captchaToken = recaptchaRef.current?.getValue()
      await registerEmail({ name: form.name.trim(), email: form.email, password: form.password, captchaToken })
      toast.success(`Welcome, ${form.name.split(' ')[0]}! Your health journey begins now 🌟`)
      closeAuthModal()
      navigate('/dashboard')
    } catch (err) {
      const msg = err.message || ''
      if (msg.includes('email-already-in-use'))
        setError('An account already exists with this email. Please login instead.')
      else if (msg.includes('invalid-email'))
        setError('Please enter a valid email address.')
      else if (msg.includes('weak-password'))
        setError('Password is too weak. Use at least 6 characters.')
      else
        setError(msg || 'Registration failed. Please try again.')
      recaptchaRef.current?.reset()
      setCaptchaDone(false)
    } finally { setLoading(false) }
  }

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

  const inputCls = "w-full px-4 py-3 text-sm border border-slate-200 rounded-2xl bg-white transition-all duration-200 outline-none focus:border-sky-400 focus:ring-2 focus:ring-sky-100 placeholder:text-slate-400"

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">

      {error && (
        <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-600 text-sm rounded-2xl px-4 py-3">
          <FiAlertCircle size={16} className="flex-shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Full Name */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Full Name</label>
        <input type="text" required placeholder="Arjun Sharma"
          value={form.name} onChange={set('name')} className={inputCls} />
      </div>

      {/* Email */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Email Address</label>
        <input type="email" required placeholder="hello@example.com"
          value={form.email} onChange={set('email')} className={inputCls} />
      </div>

      {/* Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Password</label>
        <div className="relative">
          <input
            type={showPass ? 'text' : 'password'} required
            placeholder="Min 6 characters"
            value={form.password} onChange={set('password')}
            className={`${inputCls} pr-12`}
          />
          <button type="button" onClick={() => setShowPass(v => !v)}
            className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 transition-colors">
            {showPass ? <FiEyeOff size={17} /> : <FiEye size={17} />}
          </button>
        </div>
        <PasswordStrength password={form.password} />
      </div>

      {/* Confirm Password */}
      <div>
        <label className="block text-xs font-semibold text-slate-600 mb-2">Confirm Password</label>
        <input
          type={showPass ? 'text' : 'password'} required
          placeholder="Repeat your password"
          value={form.confirm} onChange={set('confirm')}
          className={`${inputCls} ${form.confirm && form.confirm !== form.password ? 'border-red-300 focus:border-red-400 focus:ring-red-100' : ''}`}
        />
        {form.confirm && form.confirm !== form.password && (
          <p className="text-xs text-red-500 mt-1">Passwords don't match</p>
        )}
      </div>

      {/* reCAPTCHA */}
      <div className="flex justify-center mt-1">
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
          ? <><div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"/>Creating account…</>
          : 'Start Free Journey ❤️'
        }
      </button>

      <div className="flex items-center gap-3">
        <div className="flex-1 h-px bg-slate-200" />
        <span className="text-xs text-slate-400">or sign up with</span>
        <div className="flex-1 h-px bg-slate-200" />
      </div>

      <button
        type="button" onClick={handleGoogle} disabled={gLoading}
        className="w-full flex items-center justify-center gap-3 py-3.5 rounded-2xl border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-semibold text-slate-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
      >
        <FcGoogle size={20} />
        {gLoading ? 'Signing in…' : 'Continue with Google'}
      </button>

      <p className="text-center text-sm text-slate-500">
        Already have an account?{' '}
        <button type="button" onClick={() => openAuthModal('login')}
          className="text-sky-500 font-semibold hover:underline">
          Login here
        </button>
      </p>
    </form>
  )
}
