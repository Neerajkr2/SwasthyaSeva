// src/components/auth/GoogleButton.jsx
import { FcGoogle } from 'react-icons/fc'

export default function GoogleButton({ onClick, loading }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={loading}
      className="w-full flex items-center justify-center gap-3 px-4 py-3 rounded-full border-2 border-slate-200 bg-white hover:bg-slate-50 hover:border-slate-300 transition-all duration-200 font-semibold text-slate-700 text-sm disabled:opacity-60 disabled:cursor-not-allowed"
    >
      <FcGoogle size={20} />
      {loading ? 'Signing in…' : 'Continue with Google'}
    </button>
  )
}
