// src/pages/DashboardPage.jsx
/**
 * Dashboard page — redesigned to match the SwasthyaSeva design reference.
 *
 * Structure:
 *   [Sidebar]  [TopBar — date · heading · actions · profile chip]
 *              [content area]
 *                ├─ Overview tab  (DashboardOverview component)
 *                ├─ Reports tab
 *                ├─ History tab
 *                ├─ Vitals tab
 *                └─ Risk tab
 */
import { useState, useEffect, useCallback, useRef, memo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../hooks/useAuth'
import { useToast } from '../context/ToastContext'
import { userAPI, mlAPI } from '../services/api'
import { greeting, formatDate, getInitials } from '../utils/helpers'
import DashboardSidebar    from '../components/dashboard/DashboardSidebar'
import DashboardOverview   from '../components/dashboard/DashboardOverview'
import MobileBottomNav     from '../components/common/MobileBottomNav'
import {
  VitalsForm, ReportsSection, ChatHistory,
} from '../components/dashboard/DashboardWidgets'
import { Card, CardHeading, IconButton } from '../components/dashboard/_primitives'
import LoadingSpinner      from '../components/common/LoadingSpinner'
import {
  FiSearch, FiBell, FiPlus, FiBarChart2, FiChevronDown,
  FiUser, FiSettings, FiLogOut,
} from 'react-icons/fi'

/* ═══════════════════════════════════════════════════════════════════════════
   User profile chip in topbar (avatar + name + chevron + menu)
   ═══════════════════════════════════════════════════════════════════════ */
const ProfileChip = memo(function ProfileChip() {
  const { user, profile, logout } = useAuth()
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const ref = useRef(null)

  const displayName = profile?.name || user?.displayName || 'User'
  const email       = profile?.email || user?.email || ''
  const firstName   = displayName.split(' ')[0]
  const lastInitial = displayName.split(' ').slice(1, 2)[0]?.[0] || ''

  // Close on outside click
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

/* ═══════════════════════════════════════════════════════════════════════════
   Top bar — clean, premium, matches reference
   ═══════════════════════════════════════════════════════════════════════ */
const TopBar = memo(function TopBar({ displayName, onNewEntry }) {
  const today = formatDate(Date.now(), {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
  })
  return (
    <div
      className="sticky top-0 z-30 flex items-center justify-between px-6 lg:px-8 py-5"
      style={{ background: '#ffffff', borderBottom: '1px solid #E6EEF5' }}
    >
      <div className="min-w-0">
        <div
          className="text-[10px] font-bold uppercase tracking-[0.14em] mb-1"
          style={{ color: '#94a3b8' }}
        >
          {today}
        </div>
        <h1
          className="font-display text-[24px] sm:text-[28px] font-bold leading-tight tracking-tight truncate"
          style={{ color: '#0B1320' }}
        >
          {greeting(displayName)}
        </h1>
      </div>
      <div className="flex items-center gap-2.5 flex-shrink-0 ml-4">
        <button
          onClick={onNewEntry}
          className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-semibold text-[13px] transition-all hover:-translate-y-0.5"
          style={{
            background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
          }}
        >
          <FiPlus size={14} /> New entry
        </button>
        <IconButton label="Search"><FiSearch size={15} /></IconButton>
        <IconButton label="Notifications" badge><FiBell size={15} /></IconButton>
        <ProfileChip />
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Risk Assessment tab — redesigned to match the new system
   ═══════════════════════════════════════════════════════════════════════ */
function RiskAssessmentTab() {
  const toast    = useToast()
  const navigate = useNavigate()
  const [form, setForm] = useState({
    age: '', gender: 'male', bmi: '', glucose: '',
    blood_pressure: '', cholesterol: '', smoking: '0', family_history: '0',
  })
  const [result,  setResult]  = useState(null)
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    try {
      const { data } = await mlAPI.predictRisk(form)
      setResult(data)
    } catch (err) {
      toast.error(err.message)
    } finally {
      setLoading(false)
    }
  }

  const FIELDS_NUM = [
    { name: 'age',             label: 'Age',                        placeholder: '35'   },
    { name: 'bmi',             label: 'BMI',                         placeholder: '24.5' },
    { name: 'glucose',         label: 'Fasting glucose (mg/dL)',     placeholder: '100'  },
    { name: 'blood_pressure',  label: 'Blood pressure (systolic)',   placeholder: '120'  },
    { name: 'cholesterol',     label: 'Cholesterol (mg/dL)',         placeholder: '180'  },
  ]
  const FIELDS_SEL = [
    { name: 'gender',          label: 'Gender',          opts: [['male','Male'], ['female','Female']] },
    { name: 'smoking',         label: 'Smoker?',          opts: [['0','No'],     ['1','Yes']] },
    { name: 'family_history',  label: 'Family history?',  opts: [['0','No'],     ['1','Yes']] },
  ]

  return (
    <div className="max-w-3xl space-y-4">
      <Card className="p-6">
        <CardHeading kicker="Risk assessment" title="Disease risk prediction" />
        <p className="text-sm leading-relaxed mb-5" style={{ color: '#64748b' }}>
          We predict your risk for diabetes, heart disease, and liver disorders using
          clinically validated parameters. Results are an estimate, not a diagnosis.
        </p>
        <form onSubmit={handleSubmit} className="grid sm:grid-cols-2 gap-4">
          {FIELDS_NUM.map(f => (
            <div key={f.name}>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#475569' }}>
                {f.label}
              </label>
              <input
                required
                type="number"
                placeholder={f.placeholder}
                value={form[f.name]}
                onChange={e => setForm(v => ({ ...v, [f.name]: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-colors"
                style={{ border: '1px solid #E6EEF5', background: '#fff' }}
                onFocus={e => e.currentTarget.style.borderColor = '#0F4C81'}
                onBlur={e => e.currentTarget.style.borderColor = '#E6EEF5'}
              />
            </div>
          ))}
          {FIELDS_SEL.map(f => (
            <div key={f.name}>
              <label className="block text-[12px] font-semibold mb-1.5" style={{ color: '#475569' }}>
                {f.label}
              </label>
              <select
                value={form[f.name]}
                onChange={e => setForm(v => ({ ...v, [f.name]: e.target.value }))}
                className="w-full px-4 py-2.5 text-sm rounded-xl outline-none transition-colors bg-white"
                style={{ border: '1px solid #E6EEF5' }}
              >
                {f.opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
              </select>
            </div>
          ))}
          <div className="sm:col-span-2 pt-2">
            <button
              type="submit"
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-full text-white font-semibold text-[14px] transition-all hover:-translate-y-0.5 disabled:opacity-60"
              style={{
                background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
                boxShadow: '0 6px 18px rgba(15,76,129,0.22)',
              }}
            >
              {loading ? (
                <>
                  <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                  Analyzing…
                </>
              ) : (
                <>
                  <FiBarChart2 size={14} /> Predict my risk
                </>
              )}
            </button>
          </div>
        </form>
      </Card>

      {result && (
        <Card className="p-6">
          <CardHeading kicker="Result" title="Risk assessment" />
          <div className="space-y-4 mb-5">
            {Object.entries(result.risks || {}).map(([disease, risk]) => {
              const pct   = Math.round(risk * 100)
              const color = pct < 30 ? '#2ECC71' : pct < 60 ? '#FF9F43' : '#ef4444'
              const label = pct < 30 ? 'Low'      : pct < 60 ? 'Moderate' : 'High'
              return (
                <div key={disease}>
                  <div className="flex justify-between items-center mb-2">
                    <span className="text-sm font-semibold capitalize" style={{ color: '#0B1320' }}>
                      {disease.replace(/_/g, ' ')}
                    </span>
                    <span className="text-xs font-bold" style={{ color }}>
                      {pct}% · {label}
                    </span>
                  </div>
                  <div className="w-full h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                    <div
                      className="h-full rounded-full transition-all duration-700"
                      style={{ width: `${pct}%`, background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
          {result.recommendation && (
            <div
              className="p-4 rounded-xl text-sm leading-relaxed mb-4"
              style={{ background: '#F8FBFD', color: '#0B1320', border: '1px solid #E6EEF5' }}
            >
              <strong style={{ color: '#0F4C81' }}>Recommendation:</strong> {result.recommendation}
            </div>
          )}
          <div className="flex gap-3">
            <button
              onClick={() => navigate('/chat')}
              className="px-4 py-2 rounded-full text-[13px] font-semibold transition-all hover:-translate-y-0.5"
              style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)', color: '#fff' }}
            >
              Discuss with AI →
            </button>
            <button
              onClick={() => navigate('/symptoms')}
              className="px-4 py-2 rounded-full text-[13px] font-semibold transition-all hover:bg-slate-50"
              style={{ background: '#fff', color: '#0F4C81', border: '1.5px solid #0F4C81' }}
            >
              Check symptoms
            </button>
          </div>
          <p className="text-[11px] mt-4" style={{ color: '#94a3b8' }}>
            These predictions are AI-generated estimates from statistical models.
            They are NOT a medical diagnosis. Always consult a licensed physician.
          </p>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main Dashboard Page
   ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardPage() {
  const { user, profile } = useAuth()
  const toast    = useToast()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  /* Tab can be driven by the URL (?tab=vitals) so the sidebar's
     deep links work from any page. */
  const VALID_TABS = ['overview', 'reports', 'history', 'vitals', 'risk']
  const tabFromUrl = searchParams.get('tab')
  const initialTab = VALID_TABS.includes(tabFromUrl) ? tabFromUrl : 'overview'
  const [activeTab, setActiveTab] = useState(initialTab)

  /* Sync URL → state when navigating between sidebar tabs */
  useEffect(() => {
    const t = searchParams.get('tab')
    setActiveTab(VALID_TABS.includes(t) ? t : 'overview')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams])

  /* Sync state → URL when user changes tabs via internal UI */
  const changeTab = useCallback((next) => {
    setActiveTab(next)
    const params = new URLSearchParams(searchParams)
    if (next === 'overview') params.delete('tab')
    else                     params.set('tab', next)
    setSearchParams(params, { replace: true })
  }, [searchParams, setSearchParams])

  const [stats,     setStats]     = useState({})
  const [reports,   setReports]   = useState([])
  const [sessions,  setSessions]  = useState([])
  const [vitals,    setVitals]    = useState({})
  const [loading,   setLoading]   = useState(true)

  const displayName = profile?.name || user?.displayName || 'there'

  const loadData = useCallback(async () => {
    setLoading(true)
    try {
      const [statsRes, reportsRes] = await Promise.all([
        userAPI.getDashboardStats().catch(() => ({ data: {} })),
        userAPI.getReports().catch(()         => ({ data: [] })),
      ])
      setStats(statsRes.data)
      setReports(reportsRes.data)
      setSessions(statsRes.data?.recent_sessions || [])
      setVitals(statsRes.data?.vitals            || {})
    } catch (err) {
      console.error(err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadData() }, [loadData])

  const handleDeleteReport = async (id) => {
    try {
      await userAPI.deleteReport(id)
      setReports(prev => prev.filter(r => r.id !== id))
      toast.success('Report deleted')
    } catch (err) { toast.error(err.message) }
  }

  const handleOpenSession = (id) => navigate(`/chat?session=${id}`)

  if (loading) return <LoadingSpinner fullScreen />

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      {/* Sidebar */}
      <DashboardSidebar />

      {/* Main column */}
      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <TopBar
          displayName={displayName}
          onNewEntry={() => navigate('/symptoms')}
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          {activeTab === 'overview' && (
            <DashboardOverview stats={stats} reports={reports} />
          )}
          {activeTab === 'reports' && (
            <ReportsSection reports={reports} onDelete={handleDeleteReport} />
          )}
          {activeTab === 'history' && (
            <ChatHistory sessions={sessions} onOpen={handleOpenSession} />
          )}
          {activeTab === 'vitals' && (
            <VitalsForm initial={vitals} />
          )}
          {activeTab === 'risk' && (
            <RiskAssessmentTab />
          )}
        </div>
      </main>

      {/* Mobile bottom nav */}
      <MobileBottomNav activeTab={activeTab} setActiveTab={changeTab} />
    </div>
  )
}
