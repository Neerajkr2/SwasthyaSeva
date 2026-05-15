// frontend/src/components/common/Navbar.jsx
import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { FiMenu, FiX, FiGrid, FiLogOut, FiUser, FiArrowRight } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { getInitials } from '../../utils/helpers'
import { LogoFull } from './Logo'

export default function Navbar() {
  const { user, profile, isAuthenticated, openAuthModal, logout } = useAuth()
  const navigate  = useNavigate()
  const [scrolled, setScrolled] = useState(false)
  const [mobile,   setMobile]   = useState(false)
  const [userMenu, setUserMenu] = useState(false)

  const displayName = profile?.name || user?.displayName || 'User'
  const email       = profile?.email || user?.email || ''

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', fn)
    return () => window.removeEventListener('scroll', fn)
  }, [])

  const NAV_LINKS = [
    { label: 'What we do',   href: '#features'     },
    { label: 'How it works', href: '#how-it-works' },
    { label: 'Pricing',      href: '#pricing'      },
    { label: 'Questions',    href: '#faq'         },
  ]

  const PAGES = [
    { label: 'My Dashboard',     path: '/dashboard'       },
    { label: 'Ask the AI',        path: '/chat'            },
    { label: 'Symptom Check',     path: '/symptoms'        },
    { label: 'Report Help',       path: '/report-analyzer' },
    { label: 'Medicine Safety',   path: '/drugs'           },
    { label: 'Find a Doctor',     path: '/doctors'         },
  ]

  return (
    <>
      <nav
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
          scrolled ? 'py-2.5' : 'py-3.5'
        }`}
        style={{
          background: scrolled ? 'rgba(255,255,255,0.97)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderBottom: scrolled ? '1px solid #E6EEF5' : '1px solid transparent',
          boxShadow: scrolled ? '0 1px 12px rgba(15,76,129,0.06)' : 'none',
        }}
      >
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between">
          {/* Logo */}
          <button onClick={() => navigate('/')} className="select-none">
            <LogoFull height={30} />
          </button>

          {/* Desktop nav */}
          <div className="hidden lg:flex items-center gap-7">
            {NAV_LINKS.map(l => (
              <a
                key={l.label}
                href={l.href}
                className="text-slate-600 hover:text-brand-blue font-medium text-sm transition-colors"
              >
                {l.label}
              </a>
            ))}

          </div>

          {/* Auth area */}
          <div className="hidden lg:flex items-center gap-3">
            {isAuthenticated ? (
              <div className="relative">
                <button
                  onClick={() => setUserMenu(v => !v)}
                  className="flex items-center gap-2.5 px-4 py-2 rounded-full hover:bg-slate-50 transition-colors border border-brand-border"
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center text-white text-xs font-bold"
                    style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
                  >
                    {user?.photoURL
                      ? <img src={user.photoURL} className="w-full h-full rounded-full object-cover" referrerPolicy="no-referrer" alt="avatar" />
                      : getInitials(displayName)
                    }
                  </div>
                  <span className="text-sm font-semibold text-slate-700 max-w-24 truncate">
                    {displayName.split(' ')[0]}
                  </span>
                </button>
                <AnimatePresence>
                  {userMenu && (
                    <motion.div
                      initial={{ opacity: 0, scale: .95, y: -4 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: .95, y: -4 }}
                      transition={{ duration: .15 }}
                      className="absolute right-0 top-full mt-2 w-56 bg-white rounded-2xl shadow-xl border border-brand-border py-2 z-50"
                    >
                      <div className="px-4 py-3 border-b border-brand-border">
                        <p className="font-semibold text-brand-text text-sm truncate">{displayName}</p>
                        <p className="text-slate-400 text-xs truncate">{email}</p>
                      </div>
                      {PAGES.slice(0, 4).map(p => (
                        <button
                          key={p.label}
                          onClick={() => { navigate(p.path); setUserMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-brand-bg hover:text-brand-blue transition-colors"
                        >
                          {p.label}
                        </button>
                      ))}
                      <div className="border-t border-brand-border mt-1 pt-1">
                        <button
                          onClick={() => { navigate('/profile'); setUserMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-slate-600 hover:bg-brand-bg hover:text-brand-blue transition-colors"
                        >
                          <FiUser size={15} /> Profile & Settings
                        </button>
                        <button
                          onClick={() => { logout(); setUserMenu(false) }}
                          className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm text-red-400 hover:bg-red-50 hover:text-red-500 transition-colors"
                        >
                          <FiLogOut size={15} /> Logout
                        </button>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            ) : (
              <>
                <button
                  onClick={() => openAuthModal('login')}
                  className="text-slate-600 font-medium text-sm hover:text-brand-blue transition-colors px-4 py-2"
                >
                  Login
                </button>
                <button
                  onClick={() => openAuthModal('signup')}
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold text-sm transition-all duration-300 hover:-translate-y-0.5"
                  style={{
                    background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
                    boxShadow: '0 4px 15px rgba(15,76,129,0.25)',
                  }}
                >
                  Sign Up Free <FiArrowRight size={14} />
                </button>
              </>
            )}
          </div>

          {/* Mobile menu toggle */}
          <button onClick={() => setMobile(v => !v)} className="lg:hidden p-2 text-slate-600">
            {mobile ? <FiX size={22} /> : <FiMenu size={22} />}
          </button>
        </div>

        {/* Mobile menu */}
        <AnimatePresence>
          {mobile && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: .25 }}
              className="lg:hidden overflow-hidden bg-white border-t border-brand-border"
            >
              <div className="px-6 py-5 space-y-3">
                {NAV_LINKS.map(l => (
                  <a
                    key={l.label}
                    href={l.href}
                    onClick={() => setMobile(false)}
                    className="block text-slate-600 font-medium py-1.5"
                  >
                    {l.label}
                  </a>
                ))}
                <div className="border-t border-brand-border pt-3 space-y-2">
                  {PAGES.map(p => (
                    <button
                      key={p.label}
                      onClick={() => { isAuthenticated ? navigate(p.path) : openAuthModal(); setMobile(false) }}
                      className="block w-full text-left text-sm text-slate-600 py-1.5 hover:text-brand-blue"
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
                <div className="flex gap-3 pt-2">
                  {isAuthenticated ? (
                    <>
                      <button
                        onClick={() => { navigate('/dashboard'); setMobile(false) }}
                        className="btn-primary flex-1 justify-center !py-2.5 text-sm"
                      >
                        Dashboard
                      </button>
                      <button
                        onClick={() => { logout(); setMobile(false) }}
                        className="btn-secondary flex-1 justify-center !py-2.5 text-sm"
                      >
                        Logout
                      </button>
                    </>
                  ) : (
                    <>
                      <button
                        onClick={() => { openAuthModal('login'); setMobile(false) }}
                        className="btn-secondary flex-1 justify-center !py-2.5 text-sm"
                      >
                        Login
                      </button>
                      <button
                        onClick={() => { openAuthModal('signup'); setMobile(false) }}
                        className="btn-primary flex-1 justify-center !py-2.5 text-sm"
                      >
                        Sign Up
                      </button>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </nav>
      {/* Spacer */}
      <div className="h-16 lg:h-[68px]" />
    </>
  )
}
