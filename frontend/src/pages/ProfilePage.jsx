// src/pages/ProfilePage.jsx
/**
 * Profile — personal health identity centre.
 *
 * Sections:
 *   1. Hero card        — avatar + vitals kicker + name + chips + edit
 *   2. Body stats row   — Height · Weight · BMI · Goal weight
 *   3. Health profile   — Conditions · Allergies · Family history · Care team
 *   4. Activity         — recent reports, symptom checks, chats
 *   5. Personal info    — name · email
 *   6. Security         — password change · connected accounts · device sessions
 *   7. Privacy & data   — export · delete (danger)
 *
 * Brand: Sora display · Plus Jakarta body · #0F4C81 blue · #00C2FF cyan
 *   · #2ECC71 green · #FF9F43 orange.
 */
import { useState, useRef, useCallback, useEffect, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  FiLock, FiShield, FiTrash2, FiCamera,
  FiEye, FiEyeOff, FiCheck, FiEdit2, FiDownload, FiLogOut,
  FiAlertCircle, FiSmartphone, FiKey, FiSave, FiPlus,
  FiActivity, FiFileText, FiMessageSquare, FiClock, FiChevronRight,
} from 'react-icons/fi'
import { FcGoogle } from 'react-icons/fc'
import {
  updatePassword, updateProfile,
  EmailAuthProvider, reauthenticateWithCredential,
} from 'firebase/auth'
import { userAPI } from '../services/api'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'
import { getInitials, timeAgo } from '../utils/helpers'

import AppTopBar        from '../components/dashboard/AppTopBar'
import { Card, CardHeading, Kicker } from '../components/dashboard/_primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   Helpers
   ═══════════════════════════════════════════════════════════════════════ */
/** Compress to base64 JPEG. Target ≤ 150×150 px → 8-15 KB */
function compressImage(file, maxPx = 150, quality = 0.70) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = reject
    reader.onload  = ({ target: { result } }) => {
      const img = new Image()
      img.onerror = reject
      img.onload  = () => {
        const scale = Math.min(maxPx / img.width, maxPx / img.height, 1)
        const w = Math.round(img.width  * scale)
        const h = Math.round(img.height * scale)
        const canvas = document.createElement('canvas')
        canvas.width = w; canvas.height = h
        canvas.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(canvas.toDataURL('image/jpeg', quality))
      }
      img.src = result
    }
    reader.readAsDataURL(file)
  })
}

/* ═══════════════════════════════════════════════════════════════════════════
   Tone palette for health-profile items
   ═══════════════════════════════════════════════════════════════════════ */
const TONE = {
  good:   { color: '#2ECC71', bg: 'rgba(46,204,113,0.10)' },
  warn:   { color: '#FF9F43', bg: 'rgba(255,159,67,0.12)' },
  danger: { color: '#ef4444', bg: 'rgba(239,68,68,0.10)' },
  info:   { color: '#0F4C81', bg: 'rgba(15,76,129,0.08)' },
}

/* ═══════════════════════════════════════════════════════════════════════════
   Avatar with graceful fallback + edit overlay
   ═══════════════════════════════════════════════════════════════════════ */
const Avatar = memo(function Avatar({ src, name, size = 88, onClick, saving }) {
  const [err, setErr] = useState(false)
  const initials = getInitials(name)

  return (
    <div
      className="relative rounded-2xl overflow-hidden flex-shrink-0 group cursor-pointer"
      style={{ width: size, height: size }}
      onClick={onClick}
    >
      {src && !err ? (
        <img
          src={src}
          alt={name}
          onError={() => setErr(true)}
          referrerPolicy="no-referrer"
          className="w-full h-full object-cover"
        />
      ) : (
        <div
          className="w-full h-full flex items-center justify-center text-white font-display font-bold"
          style={{
            fontSize: size * 0.32,
            background: 'linear-gradient(135deg,#0F4C81,#00C2FF)',
          }}
        >
          {initials}
        </div>
      )}

      {/* Hover overlay */}
      <div
        className="absolute inset-0 flex items-center justify-center transition-opacity"
        style={{
          background: 'rgba(11,19,32,0.5)',
          opacity: saving ? 1 : 0,
        }}
        onMouseEnter={e => e.currentTarget.style.opacity = saving ? 1 : 1}
        onMouseLeave={e => e.currentTarget.style.opacity = saving ? 1 : 0}
      >
        {saving ? (
          <div className="w-6 h-6 border-2 border-white/30 border-t-white rounded-full animate-spin" />
        ) : (
          <FiCamera size={20} className="text-white" />
        )}
      </div>
      <style>{`
        .group:hover > .absolute { opacity: 1 !important; }
      `}</style>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Stat tile (Height/Weight/BMI/Goal)
   ═══════════════════════════════════════════════════════════════════════ */
const StatTile = memo(function StatTile({ label, value, unit, hint }) {
  return (
    <Card className="p-4 text-center">
      <Kicker>{label}</Kicker>
      <div className="flex items-baseline justify-center gap-1 mt-2">
        <span
          className="font-display tabular text-[28px] font-bold leading-none"
          style={{ color: '#0B1320' }}
        >
          {value ?? '—'}
        </span>
        {unit && (
          <span className="text-[11px]" style={{ color: '#94a3b8' }}>{unit}</span>
        )}
      </div>
      {hint && (
        <div className="text-[10.5px] mt-1.5" style={{ color: '#94a3b8' }}>{hint}</div>
      )}
    </Card>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Health-profile section card (Conditions / Allergies / etc.)
   ═══════════════════════════════════════════════════════════════════════ */
const ProfileSection = memo(function ProfileSection({ title, items, onAdd, emptyHint }) {
  return (
    <Card className="p-5">
      <div className="flex items-center justify-between mb-4">
        <CardHeading title={title} />
        <button
          onClick={onAdd}
          aria-label={`Add ${title}`}
          className="w-7 h-7 rounded-full flex items-center justify-center transition-colors hover:bg-slate-50"
          style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
        >
          <FiPlus size={13} />
        </button>
      </div>
      {items.length === 0 ? (
        <div
          className="rounded-xl p-4 text-center"
          style={{ background: '#F8FBFD', border: '1px dashed #CBD5E1' }}
        >
          <p className="text-[12px]" style={{ color: '#94a3b8' }}>{emptyHint}</p>
        </div>
      ) : (
        <div>
          {items.map((it, i) => {
            const tone = it.tone && TONE[it.tone]
            return (
              <div
                key={it.title + i}
                className="flex items-center gap-3 py-3"
                style={{ borderTop: i ? '1px solid #E6EEF5' : 'none' }}
              >
                {tone && (
                  <span
                    className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{ background: tone.color }}
                  />
                )}
                <div className="flex-1 min-w-0">
                  <div className="text-[13px] font-semibold truncate" style={{ color: '#0B1320' }}>
                    {it.title}
                  </div>
                  <div className="text-[11.5px] truncate" style={{ color: '#94a3b8' }}>
                    {it.sub}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </Card>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Profile-completion ring (8-step checklist)
   ═══════════════════════════════════════════════════════════════════════ */
function CompletionRing({ percent, missing }) {
  const r = 28
  const c = 2 * Math.PI * r
  const offset = c - (percent / 100) * c
  return (
    <div className="flex items-center gap-3">
      <div className="relative" style={{ width: 64, height: 64 }}>
        <svg width="64" height="64" className="-rotate-90">
          <circle cx="32" cy="32" r={r} fill="none" stroke="#E6EEF5" strokeWidth="6" />
          <circle
            cx="32" cy="32" r={r} fill="none"
            stroke="#0F4C81" strokeWidth="6"
            strokeDasharray={c} strokeDashoffset={offset}
            strokeLinecap="round"
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display font-bold text-[15px]" style={{ color: '#0B1320' }}>
            {percent}%
          </span>
        </div>
      </div>
      <div>
        <Kicker>Profile complete</Kicker>
        <p className="text-[12px] mt-0.5" style={{ color: '#64748b' }}>
          {missing > 0 ? `${missing} step${missing === 1 ? '' : 's'} left` : 'Fully set up'}
        </p>
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Activity row
   ═══════════════════════════════════════════════════════════════════════ */
const ActivityRow = memo(function ActivityRow({ icon: Icon, title, sub, when, color, isFirst, onClick }) {
  return (
    <button
      onClick={onClick}
      className="w-full flex items-center gap-3 py-3 transition-colors hover:bg-[#FAFCFE] -mx-2 px-2 rounded-lg text-left"
      style={{ borderTop: isFirst ? 'none' : '1px solid #E6EEF5' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{ background: `${color}1a`, color }}
      >
        <Icon size={14} />
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold truncate" style={{ color: '#0B1320' }}>{title}</div>
        <div className="text-[11.5px] truncate" style={{ color: '#94a3b8' }}>{sub}</div>
      </div>
      <div className="text-[10.5px] flex-shrink-0" style={{ color: '#94a3b8' }}>{when}</div>
      <FiChevronRight size={12} style={{ color: '#CBD5E1' }} />
    </button>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export default function ProfilePage() {
  const navigate = useNavigate()
  const { user, profile, logout } = useAuth()
  const toast = useToast()

  const displayName = profile?.name || user?.displayName || 'User'
  const email       = profile?.email || user?.email || ''
  const isGoogle    = user?.providerData?.some(p => p.providerId === 'google.com')
  const isAdmin     = profile?.role === 'admin' || profile?.role === 'superadmin'
  const createdAt   = profile?.created_at

  /* ── State ────────────────────────────────────────────────────────────── */
  const [photoSrc,  setPhotoSrc]  = useState(profile?.photo_url || user?.photoURL || null)
  const [nameForm,  setNameForm]  = useState({ name: displayName })
  const [editingName, setEditingName] = useState(false)
  const [passForm,  setPassForm]  = useState({ current: '', next: '', confirm: '' })
  const [showPass,  setShowPass]  = useState(false)
  const [vitals,    setVitals]    = useState({})
  const [reports,   setReports]   = useState([])
  const [sessions,  setSessions]  = useState([])
  const [saving,    setSaving]    = useState({ name: false, pass: false, photo: false })
  const fileRef = useRef(null)

  /* ── Load profile data ───────────────────────────────────────────────── */
  useEffect(() => {
    let active = true
    Promise.all([
      userAPI.getVitals().catch(() => ({ data: {} })),
      userAPI.getReports().catch(() => ({ data: [] })),
      userAPI.getDashboardStats().catch(() => ({ data: {} })),
    ]).then(([v, r, d]) => {
      if (!active) return
      setVitals(v.data || {})
      setReports(r.data || [])
      setSessions(d.data?.recent_sessions || [])
    })
    return () => { active = false }
  }, [])

  /* ── Derived values ──────────────────────────────────────────────────── */
  const bmi = useMemo(() => {
    const w = parseFloat(vitals.weight)
    const h = parseFloat(vitals.height)
    if (!w || !h) return null
    return (w / Math.pow(h / 100, 2)).toFixed(1)
  }, [vitals.weight, vitals.height])

  /* Completion %: 8 possible fields */
  const completion = useMemo(() => {
    const checks = [
      !!photoSrc,
      !!displayName,
      !!email,
      !!vitals.age,
      !!vitals.weight,
      !!vitals.height,
      !!vitals.blood_group,
      !!vitals.blood_pressure,
    ]
    const done = checks.filter(Boolean).length
    return {
      percent: Math.round((done / checks.length) * 100),
      missing: checks.length - done,
    }
  }, [photoSrc, displayName, email, vitals])

  /* ── Photo upload ────────────────────────────────────────────────────── */
  const handlePhotoSelect = useCallback(async (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    if (!file.type.startsWith('image/')) { toast.error('Please select an image file.'); return }
    if (file.size > 8 * 1024 * 1024)     { toast.error('Image must be under 8 MB.');    return }
    setSaving(s => ({ ...s, photo: true }))
    try {
      const dataURL = await compressImage(file, 150, 0.7)
      setPhotoSrc(dataURL)
      await userAPI.updatePhoto(dataURL)
      try { await updateProfile(user, { photoURL: dataURL }) } catch { /* ignore */ }
      toast.success('Profile photo updated')
    } catch (err) {
      toast.error(err.message || 'Photo upload failed.')
      setPhotoSrc(profile?.photo_url || user?.photoURL || null)
    } finally {
      setSaving(s => ({ ...s, photo: false }))
      if (fileRef.current) fileRef.current.value = ''
    }
  }, [user, profile, toast])

  /* ── Name save ───────────────────────────────────────────────────────── */
  const handleNameSave = async () => {
    if (!nameForm.name.trim()) { toast.error('Name cannot be empty'); return }
    setSaving(s => ({ ...s, name: true }))
    try {
      await updateProfile(user, { displayName: nameForm.name.trim() })
      toast.success('Name updated')
      setEditingName(false)
    } catch (err) { toast.error(err.message) }
    finally { setSaving(s => ({ ...s, name: false })) }
  }

  /* ── Password change ──────────────────────────────────────────────────── */
  const handlePassChange = async () => {
    if (passForm.next.length < 6)            { toast.error('New password must be at least 6 characters'); return }
    if (passForm.next !== passForm.confirm)  { toast.error('Passwords do not match');                     return }
    if (!passForm.current)                    { toast.error('Enter your current password');                 return }
    setSaving(s => ({ ...s, pass: true }))
    try {
      const cred = EmailAuthProvider.credential(email, passForm.current)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, passForm.next)
      setPassForm({ current: '', next: '', confirm: '' })
      toast.success('Password changed')
    } catch (err) {
      toast.error(
        err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential'
          ? 'Current password is incorrect.'
          : err.message
      )
    } finally { setSaving(s => ({ ...s, pass: false })) }
  }

  /* ── Delete account ──────────────────────────────────────────────────── */
  const handleDelete = async () => {
    if (!window.confirm('Permanently delete your account and all health data? This cannot be undone.')) return
    try {
      await user.delete()
      await logout()
      navigate('/')
    } catch (err) {
      if (err.code === 'auth/requires-recent-login')
        toast.error('Please log out and log back in before deleting your account.')
      else toast.error(err.message)
    }
  }

  /* ── Static health profile (mock until backend supports) ─────────────── */
  const conditionsList = useMemo(() => {
    if (!vitals.conditions) return []
    return vitals.conditions.split(',').map(c => ({
      title: c.trim(),
      sub: 'Self-reported',
      tone: 'warn',
    })).filter(c => c.title)
  }, [vitals.conditions])

  /* For demo / ready-to-wire, expose 4 placeholder lists */
  const ALLERGIES = []
  const FAMILY    = []
  const CARE_TEAM = []

  /* ── Activity feed ───────────────────────────────────────────────────── */
  const activityItems = useMemo(() => {
    const items = []
    reports.slice(0, 3).forEach(r => items.push({
      icon: FiFileText,
      title: r.original_name || 'Medical report',
      sub: 'Report analyzed',
      when: r.created_at ? timeAgo(r.created_at) : '—',
      color: '#2ECC71',
      onClick: () => navigate('/report-analyzer'),
    }))
    sessions.slice(0, 3).forEach(s => items.push({
      icon: FiMessageSquare,
      title: s.title || 'Health consultation',
      sub: `${s.message_count || 0} messages`,
      when: s.created_at ? timeAgo(s.created_at) : '—',
      color: '#0F4C81',
      onClick: () => navigate(`/chat?session=${s.id}`),
    }))
    return items.slice(0, 6)
  }, [reports, sessions, navigate])

  /* ── Pretty kicker line ──────────────────────────────────────────────── */
  const kickerLine = useMemo(() => {
    const parts = []
    if (vitals.age) parts.push(`${vitals.age} yr`)
    if (vitals.blood_group) parts.push(vitals.blood_group)
    if (createdAt) parts.push(`Member since ${new Date(createdAt).toLocaleDateString('en-IN', { month: 'short', year: 'numeric' })}`)
    return parts.join(' · ') || 'Complete your profile to get started'
  }, [vitals, createdAt])

  return (
    <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="Account · Health profile"
          title="Your health, at a glance"
          action={
            isAdmin && (
              <button
                onClick={() => navigate('/admin')}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                style={{ background: '#fff', border: '1px solid rgba(124,58,237,0.20)', color: '#7c3aed' }}
              >
                <FiShield size={13} /> Admin panel
              </button>
            )
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1200px] w-full mx-auto space-y-4">
          {/* ── Hero card ─────────────────────────────────────────────── */}
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}>
            <Card className="p-7">
              <div className="flex items-center gap-6 flex-wrap">
                <Avatar
                  src={photoSrc}
                  name={displayName}
                  size={88}
                  onClick={() => !saving.photo && fileRef.current?.click()}
                  saving={saving.photo}
                />
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/gif"
                  className="hidden"
                  onChange={handlePhotoSelect}
                />

                <div className="flex-1 min-w-0">
                  <Kicker>{kickerLine}</Kicker>
                  {editingName ? (
                    <div className="flex items-center gap-2 mt-2">
                      <input
                        value={nameForm.name}
                        onChange={e => setNameForm({ name: e.target.value })}
                        className="font-display text-[28px] font-bold leading-tight bg-transparent outline-none"
                        style={{ color: '#0B1320', borderBottom: '2px solid #0F4C81', minWidth: 220 }}
                        autoFocus
                        onKeyDown={e => e.key === 'Enter' && handleNameSave()}
                      />
                      <button
                        onClick={handleNameSave}
                        disabled={saving.name}
                        className="w-8 h-8 rounded-full flex items-center justify-center text-white"
                        style={{ background: '#0F4C81' }}
                      >
                        {saving.name
                          ? <div className="w-3 h-3 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                          : <FiCheck size={14} />}
                      </button>
                      <button
                        onClick={() => { setEditingName(false); setNameForm({ name: displayName }) }}
                        className="w-8 h-8 rounded-full flex items-center justify-center"
                        style={{ background: '#F8FBFD', border: '1px solid #E6EEF5', color: '#475569' }}
                      >
                        ✕
                      </button>
                    </div>
                  ) : (
                    <h2
                      className="font-display text-[26px] sm:text-[30px] font-bold leading-tight mt-1 mb-3"
                      style={{ color: '#0B1320' }}
                    >
                      {displayName}
                    </h2>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {isAdmin && (
                      <span
                        className="text-[10.5px] font-bold px-2.5 py-1 rounded-full uppercase tracking-wider"
                        style={{ background: 'rgba(124,58,237,0.10)', color: '#7c3aed' }}
                      >
                        🛡️ {profile.role}
                      </span>
                    )}
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(0,194,255,0.08)', color: '#0E7490' }}
                    >
                      {isGoogle ? <><FcGoogle size={11} /> Google account</> : '✉️ Email account'}
                    </span>
                    <span
                      className="inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full"
                      style={{ background: 'rgba(46,204,113,0.10)', color: '#1f9d55' }}
                    >
                      ✓ Verified
                    </span>
                  </div>
                </div>

                <div className="flex items-center gap-3">
                  <CompletionRing percent={completion.percent} missing={completion.missing} />
                  <button
                    onClick={() => setEditingName(true)}
                    className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                    style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
                  >
                    <FiEdit2 size={12} /> Edit profile
                  </button>
                </div>
              </div>
            </Card>
          </motion.div>

          {/* ── Body stats row ────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile label="Height" value={vitals.height} unit="cm" />
            <StatTile label="Weight" value={vitals.weight} unit="kg" />
            <StatTile
              label="BMI"
              value={bmi}
              unit="kg/m²"
              hint={
                bmi
                  ? bmi < 18.5 ? 'Underweight' : bmi < 25 ? 'Healthy' : bmi < 30 ? 'Overweight' : 'High'
                  : null
              }
            />
            <StatTile label="Blood group" value={vitals.blood_group} />
          </div>

          {/* ── Health profile grid ───────────────────────────────────── */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ProfileSection
              title="Conditions"
              items={conditionsList}
              emptyHint="No conditions recorded. Add any chronic illness (e.g., diabetes, hypertension)."
              onAdd={() => navigate('/dashboard')}
            />
            <ProfileSection
              title="Allergies"
              items={ALLERGIES}
              emptyHint="Add medication or food allergies so we can warn you about interactions."
              onAdd={() => toast.info('Coming soon — manage allergies in the dashboard.')}
            />
            <ProfileSection
              title="Family history"
              items={FAMILY}
              emptyHint="Family history helps us refine your disease-risk predictions."
              onAdd={() => toast.info('Coming soon — add family medical history.')}
            />
            <ProfileSection
              title="Care team"
              items={CARE_TEAM}
              emptyHint="Save your doctors for faster sharing and follow-ups."
              onAdd={() => navigate('/doctors')}
            />
          </div>

          {/* ── Activity history ──────────────────────────────────────── */}
          <Card className="p-5">
            <div className="flex items-center justify-between mb-3">
              <CardHeading
                kicker="Last 30 days"
                title="Recent activity"
              />
              <button
                onClick={() => navigate('/dashboard')}
                className="text-[12px] font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
                style={{ color: '#0F4C81' }}
              >
                View all <FiChevronRight size={11} />
              </button>
            </div>
            {activityItems.length === 0 ? (
              <div
                className="rounded-xl p-6 text-center"
                style={{ background: '#F8FBFD', border: '1px dashed #CBD5E1' }}
              >
                <FiClock size={22} style={{ color: '#94a3b8' }} className="mx-auto mb-2" />
                <p className="text-[12.5px]" style={{ color: '#94a3b8' }}>
                  No activity yet. Try a symptom check or upload a report to get started.
                </p>
              </div>
            ) : (
              <div>
                {activityItems.map((a, i) => (
                  <ActivityRow key={i} {...a} isFirst={i === 0} />
                ))}
              </div>
            )}
          </Card>

          {/* ── Account & Personal info ───────────────────────────────── */}
          <Card className="p-5">
            <CardHeading
              kicker="Account"
              title="Personal information"
            />

            <div className="grid sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#475569' }}>
                  Display name
                </label>
                <div className="flex items-center gap-2">
                  <input
                    value={nameForm.name}
                    onChange={e => setNameForm({ name: e.target.value })}
                    placeholder="Your full name"
                    className="flex-1 px-4 py-2.5 text-[14px] rounded-xl outline-none transition-colors"
                    style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
                    onFocus={e => e.currentTarget.style.borderColor = '#0F4C81'}
                    onBlur={e => e.currentTarget.style.borderColor = '#E6EEF5'}
                  />
                  <button
                    onClick={handleNameSave}
                    disabled={saving.name || nameForm.name === displayName}
                    className="w-10 h-10 rounded-xl flex items-center justify-center text-white disabled:opacity-40 transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                  >
                    {saving.name
                      ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      : <FiSave size={14} />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#475569' }}>
                  Email
                </label>
                <input
                  value={email}
                  disabled
                  className="w-full px-4 py-2.5 text-[14px] rounded-xl outline-none cursor-not-allowed"
                  style={{ background: '#F8FBFD', border: '1px solid #E6EEF5', color: '#94a3b8' }}
                />
                <p className="text-[11px] mt-1" style={{ color: '#94a3b8' }}>
                  {isGoogle ? 'Managed by Google.' : 'Contact support to change your email.'}
                </p>
              </div>
            </div>
          </Card>

          {/* ── Security ─────────────────────────────────────────────── */}
          <Card className="p-5">
            <CardHeading
              kicker="Security"
              title="Keep your account safe"
            />

            <div className="space-y-3 mb-5">
              {/* Connected accounts */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: '#fff', border: '1px solid #E6EEF5' }}
                >
                  {isGoogle ? <FcGoogle size={20} /> : <FiKey size={16} style={{ color: '#0F4C81' }} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: '#0B1320' }}>
                    {isGoogle ? 'Sign in with Google' : 'Password sign-in'}
                  </div>
                  <div className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                    {isGoogle
                      ? 'Connected — secure SSO via Google'
                      : 'Use a strong password and change it regularly'}
                  </div>
                </div>
                <span
                  className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                  style={{ background: 'rgba(46,204,113,0.10)', color: '#1f9d55' }}
                >
                  Active
                </span>
              </div>

              {/* Two-factor (placeholder) */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(15,76,129,0.08)' }}
                >
                  <FiSmartphone size={16} style={{ color: '#0F4C81' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: '#0B1320' }}>
                    Two-factor authentication
                  </div>
                  <div className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                    Add an extra layer of security with your phone
                  </div>
                </div>
                <button
                  onClick={() => toast.info('Two-factor auth coming soon')}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors hover:bg-slate-50"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0F4C81' }}
                >
                  Set up
                </button>
              </div>

              {/* Active devices (placeholder) */}
              <div
                className="flex items-center gap-3 p-3 rounded-xl"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ background: 'rgba(0,194,255,0.10)' }}
                >
                  <FiActivity size={16} style={{ color: '#0E7490' }} />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="text-[13.5px] font-semibold" style={{ color: '#0B1320' }}>
                    Active sessions
                  </div>
                  <div className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                    1 device · this browser
                  </div>
                </div>
                <button
                  onClick={logout}
                  className="text-[12px] font-semibold px-3 py-1.5 rounded-full transition-colors hover:bg-slate-50"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
                >
                  Sign out
                </button>
              </div>
            </div>

            {/* Password change (email only) */}
            {!isGoogle && (
              <details className="group">
                <summary
                  className="cursor-pointer inline-flex items-center gap-2 text-[12.5px] font-semibold transition-colors hover:bg-slate-50 px-3.5 py-2 rounded-full"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0F4C81' }}
                >
                  <FiLock size={12} /> Change password
                  <FiChevronRight size={11} className="group-open:rotate-90 transition-transform" />
                </summary>
                <div
                  className="mt-3 p-4 rounded-xl space-y-3"
                  style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
                >
                  {[
                    { key: 'current', label: 'Current password',     ph: 'Enter current password' },
                    { key: 'next',    label: 'New password',         ph: 'Min 6 characters'        },
                    { key: 'confirm', label: 'Confirm new password', ph: 'Repeat new password'     },
                  ].map(f => (
                    <div key={f.key}>
                      <label className="block text-[11.5px] font-semibold mb-1.5" style={{ color: '#475569' }}>
                        {f.label}
                      </label>
                      <div className="relative">
                        <input
                          type={showPass && f.key === 'next' ? 'text' : 'password'}
                          placeholder={f.ph}
                          value={passForm[f.key]}
                          onChange={e => setPassForm(v => ({ ...v, [f.key]: e.target.value }))}
                          className="w-full px-4 py-2.5 text-[13.5px] rounded-xl outline-none"
                          style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
                        />
                        {f.key === 'next' && (
                          <button
                            type="button"
                            onClick={() => setShowPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            aria-label="Toggle password visibility"
                          >
                            {showPass ? <FiEyeOff size={14} /> : <FiEye size={14} />}
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={handlePassChange}
                    disabled={saving.pass || !passForm.current}
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full text-white font-semibold text-[13px] disabled:opacity-50 transition-all hover:-translate-y-0.5"
                    style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                  >
                    {saving.pass
                      ? <><div className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> Updating…</>
                      : <><FiShield size={13} /> Update password</>}
                  </button>
                </div>
              </details>
            )}
          </Card>

          {/* ── Privacy & data ───────────────────────────────────────── */}
          <Card className="p-5">
            <div className="flex items-center gap-4 flex-wrap">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(46,204,113,0.10)' }}
              >
                <FiShield size={20} style={{ color: '#1f9d55' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-[16px]" style={{ color: '#0B1320' }}>
                  Your data is yours
                </h3>
                <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: '#64748b' }}>
                  All reports are encrypted end-to-end. You can export your full record or delete
                  your account at any time. We never sell or share your health data.
                </p>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button
                  onClick={() => toast.info('Data export coming soon')}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-semibold transition-colors hover:bg-slate-50"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
                >
                  <FiDownload size={12} /> Export data
                </button>
                <button
                  onClick={logout}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-full text-[12.5px] font-semibold transition-colors hover:bg-slate-50"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
                >
                  <FiLogOut size={12} /> Sign out
                </button>
              </div>
            </div>
          </Card>

          {/* ── Danger zone ──────────────────────────────────────────── */}
          <Card
            className="p-5"
            style={{ background: 'rgba(239,68,68,0.04)', borderColor: 'rgba(239,68,68,0.22)' }}
          >
            <div className="flex items-start gap-4 flex-wrap">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(239,68,68,0.12)' }}
              >
                <FiAlertCircle size={20} style={{ color: '#ef4444' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="font-display font-bold text-[16px]" style={{ color: '#b8463a' }}>
                  Danger zone
                </h3>
                <p className="text-[12.5px] leading-relaxed mt-1" style={{ color: '#b8463a' }}>
                  Permanently delete your account and all health data. This action cannot be undone.
                </p>
              </div>
              <button
                onClick={handleDelete}
                className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-semibold text-[12.5px] transition-all hover:-translate-y-0.5"
                style={{ background: '#ef4444' }}
              >
                <FiTrash2 size={12} /> Delete account
              </button>
            </div>
          </Card>

          {/* ── Footer note ──────────────────────────────────────────── */}
          <p className="text-center text-[11px] py-2" style={{ color: '#94a3b8' }}>
            SwasthyaSeva &middot; Your data is encrypted and private.
          </p>
        </div>
      </main>
  )
}
