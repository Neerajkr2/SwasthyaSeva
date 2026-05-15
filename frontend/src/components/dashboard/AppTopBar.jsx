// src/components/dashboard/AppTopBar.jsx
/**
 * Shared in-app top bar — used across Dashboard, Health Insights, etc.
 *
 * Provides the common chrome: kicker + display heading on the left,
 * a custom action slot, then Search · Bell · Profile chip on the right.
 */
import { memo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiSearch, FiBell, FiChevronDown, FiUser, FiSettings, FiLogOut,
} from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { getInitials } from '../../utils/helpers'
import { IconButton } from './_primitives'

/* ── Profile chip dropdown ───────────────────────────────────────────────── */
export const ProfileChip = memo(function ProfileChip() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const displayName = profile?.name || user?.displayName || 'User'
  const email       = profile?.email || user?.email || ''
  const firstName   = displayName.split(' ')[0]
  const lastInitial = displayName.split(' ').slice(1, 2)[0]?.[0] || ''

  useEffect(() => {
    if (!open) return
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(v => !v)}
        className="flex items-center gap-2 pl-1 pr-3 py-1 rounded-full transition-colors hover:bg-slate-50"
        style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
      >
        <div
          className="w-7 h-7 rounded-full flex items-center justify-center text-white text-[11px] font-bold overflow-hidden flex-shrink-0"
          style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
        >
          {user?.photoURL
            ? <img src={user.photoURL} alt="" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            : <span>{getInitials(displayName)}</span>
          }
        </div>
        <span className="text-[13px] font-semibold whitespace-nowrap" style={{ color: '#0B1320' }}>
          {firstName}{lastInitial && ` ${lastInitial}.`}
        </span>
        <FiChevronDown size={13} className="text-slate-400" />
      </button>

      {open && (
        <div
          className="absolute right-0 top-full mt-2 w-60 bg-white rounded-2xl shadow-xl py-2 z-50"
          style={{ border: '1px solid #E6EEF5' }}
        >
          <div className="px-4 py-3 border-b" style={{ borderColor: '#E6EEF5' }}>
            <p className="text-sm font-semibold truncate" style={{ color: '#0B1320' }}>{displayName}</p>
            <p className="text-xs truncate" style={{ color: '#94a3b8' }}>{email}</p>
          </div>
          <button
            onClick={() => { navigate('/profile'); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
            style={{ color: '#475569' }}
          >
            <FiUser size={14} /> Profile
          </button>
          <button
            onClick={() => { navigate('/profile'); setOpen(false) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-slate-50 transition-colors"
            style={{ color: '#475569' }}
          >
            <FiSettings size={14} /> Settings
          </button>
          <div className="border-t mt-1 pt-1" style={{ borderColor: '#E6EEF5' }}>
            <button
              onClick={() => { logout(); setOpen(false) }}
              className="w-full flex items-center gap-2.5 px-4 py-2.5 text-sm hover:bg-red-50 transition-colors"
              style={{ color: '#ef4444' }}
            >
              <FiLogOut size={14} /> Log out
            </button>
          </div>
        </div>
      )}
    </div>
  )
})

/* ── Main top bar ────────────────────────────────────────────────────────── */
const AppTopBar = memo(function AppTopBar({ kicker, title, action }) {
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 py-5"
      style={{ background: '#ffffff', borderBottom: '1px solid #E6EEF5' }}
    >
      <div className="min-w-0">
        {kicker && (
          <div
            className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
            style={{ color: '#94a3b8' }}
          >
            {kicker}
          </div>
        )}
        <h1
          className="font-display text-[24px] sm:text-[28px] font-bold leading-tight tracking-tight truncate"
          style={{ color: '#0B1320' }}
        >
          {title}
        </h1>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
        {action}
        <IconButton label="Search"><FiSearch size={15} /></IconButton>
        <IconButton label="Notifications" badge><FiBell size={15} /></IconButton>
        <ProfileChip />
      </div>
    </div>
  )
})

export default AppTopBar
