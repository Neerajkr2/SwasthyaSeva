// src/components/common/MobileBottomNav.jsx
// Fixed bottom navigation for mobile screens (hidden on lg+).
// All routes are path-based and work from any page.

import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiHome, FiMessageSquare, FiActivity, FiMoreHorizontal,
  FiBarChart2, FiShield, FiFileText, FiStar, FiUser, FiLogOut, FiX,
  FiUserPlus, FiHeart, FiClock,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'

// Drawer items — every item is path-based for consistent navigation
const DRAWER_ITEMS = [
  { icon: FiBarChart2, label: 'Risk Assessment',  path: '/dashboard?tab=risk',    color: '#0F4C81' },
  { icon: FiShield,    label: 'Drug Safety',       path: '/drugs',                 color: '#FF9F43' },
  { icon: FiFileText,  label: 'Report Analyzer',   path: '/report-analyzer',       color: '#2ECC71' },
  { icon: FiStar,      label: 'Health Insights',   path: '/insights',              color: '#0F4C81' },
  { icon: FiUserPlus,  label: 'Doctor Portal',     path: '/doctors',               color: '#00C2FF' },
  { icon: FiHeart,     label: 'Vitals',            path: '/dashboard?tab=vitals',  color: '#ef4444' },
  { icon: FiFileText,  label: 'My Reports',        path: '/dashboard?tab=reports', color: '#0F4C81' },
  { icon: FiClock,     label: 'Chat History',      path: '/dashboard?tab=history', color: '#94a3b8' },
  { icon: FiUser,      label: 'Profile',           path: '/profile',                color: '#475569' },
]

export default function MobileBottomNav() {
  const navigate  = useNavigate()
  const { logout } = useAuth()
  const [drawerOpen, setDrawerOpen] = useState(false)

  const handleDrawerNav = (item) => {
    setDrawerOpen(false)
    navigate(item.path)
  }

  /* Primary bottom-nav items */
  const NAV_ITEMS = [
    { icon: FiHome,            label: 'Home',     action: () => navigate('/dashboard') },
    { icon: FiMessageSquare,   label: 'Chat',     action: () => navigate('/chat')      },
    { icon: FiActivity,        label: 'Symptoms', action: () => navigate('/symptoms')  },
    { icon: FiMoreHorizontal,  label: 'More',     action: () => setDrawerOpen(v => !v) },
  ]

  return (
    <>
      {/* ── Slide-up Drawer ───────────────────────────────────────── */}
      <AnimatePresence>
        {drawerOpen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm lg:hidden"
              onClick={() => setDrawerOpen(false)}
            />

            <motion.div
              key="drawer"
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 30, stiffness: 320 }}
              className="fixed bottom-16 left-0 right-0 z-50 bg-white rounded-t-3xl shadow-2xl lg:hidden"
            >
              <div className="px-5 pt-5 pb-6">
                <div className="w-10 h-1 bg-slate-200 rounded-full mx-auto mb-5" />

                <div className="flex items-center justify-between mb-5">
                  <h3 className="font-display font-bold text-[18px]" style={{ color: '#0B1320' }}>
                    More Tools
                  </h3>
                  <button
                    onClick={() => setDrawerOpen(false)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center transition-colors"
                    aria-label="Close drawer"
                  >
                    <FiX size={16} className="text-slate-500" />
                  </button>
                </div>

                <div className="grid grid-cols-3 gap-3 mb-5 max-h-[60vh] overflow-y-auto">
                  {DRAWER_ITEMS.map(item => {
                    const Icon  = item.icon
                    const color = item.color
                    return (
                      <button
                        key={item.label}
                        onClick={() => handleDrawerNav(item)}
                        className="flex flex-col items-center gap-2 p-3 rounded-2xl transition-all active:scale-95"
                        style={{ background: `${color}10` }}
                      >
                        <div
                          className="w-11 h-11 rounded-xl flex items-center justify-center flex-shrink-0"
                          style={{ background: `${color}1a` }}
                        >
                          <Icon size={18} style={{ color }} />
                        </div>
                        <span
                          className="text-[11px] font-semibold text-center leading-tight"
                          style={{ color: '#475569' }}
                        >
                          {item.label}
                        </span>
                      </button>
                    )
                  })}
                </div>

                <div className="border-t border-slate-100 pt-4">
                  <button
                    onClick={() => { logout(); setDrawerOpen(false) }}
                    className="w-full flex items-center justify-center gap-2 py-3 text-sm font-semibold text-red-400 hover:text-red-500 hover:bg-red-50 rounded-2xl transition-colors"
                  >
                    <FiLogOut size={16} />
                    Log out
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* ── Bottom Nav Bar ────────────────────────────────────────── */}
      <nav
        className="lg:hidden fixed bottom-0 left-0 right-0 z-30 bg-white border-t"
        style={{ borderColor: '#E6EEF5', boxShadow: '0 -4px 24px rgba(0,0,0,0.05)' }}
      >
        <div className="flex items-center justify-around px-2 py-2">
          {NAV_ITEMS.map(item => {
            const Icon       = item.icon
            const isMoreOpen = item.label === 'More' && drawerOpen
            return (
              <button
                key={item.label}
                onClick={item.action}
                className="flex flex-col items-center gap-1 px-4 py-2 rounded-xl min-w-[60px] transition-colors"
                style={{
                  color: isMoreOpen ? '#0F4C81' : '#94a3b8',
                }}
              >
                <Icon size={22} />
                <span className="text-[10px] font-semibold">{item.label}</span>
              </button>
            )
          })}
        </div>
        <div className="h-safe-area-inset-bottom" />
      </nav>
    </>
  )
}
