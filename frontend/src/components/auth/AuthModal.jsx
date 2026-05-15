// frontend/src/components/auth/AuthModal.jsx
import { motion, AnimatePresence } from 'framer-motion'
import { FiX } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import LoginForm  from './LoginForm'
import SignupForm from './SignupForm'
import { LogoFull } from '../common/Logo'

export default function AuthModal() {
  const { authModal, authTab, closeAuthModal, openAuthModal } = useAuth()

  if (!authModal) return null

  return (
    <AnimatePresence>
      <motion.div
        key="overlay"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.2 }}
        className="fixed inset-0 z-[100] flex items-center justify-center p-4"
        style={{ background: 'rgba(15,23,42,0.6)', backdropFilter: 'blur(8px)' }}
        onClick={closeAuthModal}
      >
        <motion.div
          key="modal"
          initial={{ opacity: 0, scale: 0.94, y: 16 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.94, y: 16 }}
          transition={{ type: 'spring', stiffness: 340, damping: 30 }}
          className="bg-white w-full max-w-md rounded-3xl overflow-hidden"
          style={{ boxShadow: '0 25px 60px rgba(0,0,0,0.25)' }}
          onClick={e => e.stopPropagation()}
        >
          {/* Header */}
          <div className="px-7 pt-6 pb-5 flex items-center justify-between border-b border-slate-100">
            <div>
              <LogoFull height={26} className="mb-1" />
              <p className="text-xs text-slate-400 mt-0.5">
                {authTab === 'login' ? 'Sign in to your health dashboard' : 'Create your free account'}
              </p>
            </div>
            <button
              onClick={closeAuthModal}
              className="w-9 h-9 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-all duration-200 hover:rotate-90 text-slate-500"
            >
              <FiX size={16} />
            </button>
          </div>

          {/* Tabs */}
          <div className="flex mx-7 mt-5 border-b border-slate-200">
            {['login', 'signup'].map(tab => (
              <button
                key={tab}
                onClick={() => openAuthModal(tab)}
                className={`flex-1 pb-3 text-sm font-semibold capitalize transition-all duration-200 border-b-2 ${
                  authTab === tab
                    ? 'text-brand-blue border-brand-blue'
                    : 'text-slate-400 border-transparent hover:text-slate-600'
                }`}
              >
                {tab === 'login' ? 'Login' : 'Sign Up'}
              </button>
            ))}
          </div>

          {/* Form area */}
          <div className="px-7 py-6 max-h-[75vh] overflow-y-auto">
            <AnimatePresence mode="wait">
              {authTab === 'login' ? (
                <motion.div key="login"
                  initial={{ opacity: 0, x: -12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 12 }}
                  transition={{ duration: 0.2 }}>
                  <LoginForm />
                </motion.div>
              ) : (
                <motion.div key="signup"
                  initial={{ opacity: 0, x: 12 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -12 }}
                  transition={{ duration: 0.2 }}>
                  <SignupForm />
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}
