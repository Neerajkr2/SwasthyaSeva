// src/components/dashboard/DashboardOverview.jsx
/**
 * Dashboard "Overview" tab — final refined revision.
 *
 * Key improvements:
 *   • Feature cards now use meaningful, feature-specific visuals
 *     (ECG pulse · document stack · chat-bubble preview) instead of
 *     abstract sparklines.
 *   • Today's Insight is now a LIGHT brand-tinted card (not dark)
 *     so it feels like part of the dashboard ecosystem.
 *   • Sparklines remain responsive (no overflow).
 *   • All cards share the same hairline, radius, shadow, and hover.
 */
import { useState, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  FiActivity, FiUpload, FiMessageSquare, FiArrowUp, FiArrowDown,
  FiCheck, FiChevronRight, FiShield, FiFileText, FiPlus, FiZap,
} from 'react-icons/fi'
import { Card, CardHeading, Kicker, Status, Sparkline, Ring } from './_primitives'
import { SymptomVisual, ReportVisual, AssistantVisual } from './_featureVisuals'

/* ═══════════════════════════════════════════════════════════════════════════
   1. Wellness + Quick action cards (top strip)
   ═══════════════════════════════════════════════════════════════════════ */
const QUICK_ACTIONS = [
  {
    id: 'symptom',
    icon: FiActivity,
    label: 'Symptom check',
    sub: 'Start a 2-min triage',
    path: '/symptoms',
    bg: 'rgba(15,76,129,0.08)',
    fg: '#0F4C81',
    statusLabel: '12 this month',
    visual: SymptomVisual,
    visualColor: '#0F4C81',
  },
  {
    id: 'upload',
    icon: FiUpload,
    label: 'Upload report',
    sub: 'PDF, JPG, lab printouts',
    path: '/report-analyzer',
    bg: 'rgba(0,194,255,0.12)',
    fg: '#0E7490',
    statusLabel: '5 analyzed',
    visual: ReportVisual,
    visualColor: '#0E7490',
  },
  {
    id: 'chat',
    icon: FiMessageSquare,
    label: 'Ask assistant',
    sub: 'Open chat with context',
    path: '/chat',
    bg: 'rgba(46,204,113,0.12)',
    fg: '#1f9d55',
    live: true,
    visual: AssistantVisual,
    visualColor: '#2ECC71',
  },
]

const QuickActionCard = memo(function QuickActionCard({ action, onClick }) {
  const Icon = action.icon
  const Visual = action.visual
  const [hover, setHover] = useState(false)

  return (
    <button
      onClick={onClick}
      onMouseEnter={() => setHover(true)}
      onMouseLeave={() => setHover(false)}
      className="group h-[180px] text-left rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 flex flex-col justify-between p-5 relative overflow-hidden"
      style={{
        border: '1px solid #E6EEF5',
        boxShadow: hover
          ? '0 12px 32px rgba(15,76,129,0.12)'
          : '0 1px 2px rgba(11,19,32,0.04)',
      }}
    >
      {/* Top row: icon + status */}
      <div className="flex items-start justify-between relative">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center transition-transform duration-300 group-hover:scale-110"
          style={{ background: action.bg, color: action.fg }}
        >
          <Icon size={18} />
        </div>
        {action.live ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-full" style={{ background: 'rgba(46,204,113,0.10)' }}>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
            <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600">Online</span>
          </div>
        ) : action.statusLabel ? (
          <span
            className="text-[10px] font-bold px-2 py-1 rounded-full"
            style={{ background: action.bg, color: action.fg }}
          >
            {action.statusLabel}
          </span>
        ) : null}
      </div>

      {/* Feature-specific visual (replaces abstract sparkline) */}
      <div className="absolute inset-x-5 top-[60px] pointer-events-none">
        <Visual color={action.visualColor} />
      </div>

      {/* Title + subtitle + arrow */}
      <div className="relative">
        <div
          className="font-display text-[18px] font-bold leading-tight mb-1"
          style={{ color: '#0B1320' }}
        >
          {action.label}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs" style={{ color: '#94a3b8' }}>
            {action.sub}
          </span>
          <FiChevronRight
            size={15}
            className="flex-shrink-0 transition-all duration-300"
            style={{
              color: action.fg,
              transform: hover ? 'translateX(2px)' : 'translateX(0)',
              opacity: hover ? 1 : 0.5,
            }}
          />
        </div>
      </div>
    </button>
  )
})

const WellnessCard = memo(function WellnessCard({ score, delta }) {
  return (
    <div
      className="h-[180px] rounded-2xl bg-white transition-all duration-300 hover:-translate-y-1 flex items-center gap-5 p-6 group"
      style={{
        border: '1px solid #E6EEF5',
        boxShadow: '0 1px 2px rgba(11,19,32,0.04)',
      }}
    >
      <div className="transition-transform duration-500 group-hover:scale-105 flex-shrink-0">
        <Ring value={score} size={108} stroke={9} color="#0F4C81" track="#E6EEF5">
          <div className="text-center">
            <div
              className="font-display tabular text-[34px] leading-none font-bold"
              style={{ color: '#0B1320' }}
            >
              {score}
            </div>
            <div
              className="text-[10px] font-bold uppercase tracking-[0.14em] mt-1"
              style={{ color: '#94a3b8' }}
            >
              Score
            </div>
          </div>
        </Ring>
      </div>
      <div className="flex-1 min-w-0">
        <Kicker>Your wellness</Kicker>
        <div
          className="font-display text-[20px] leading-tight mt-1 mb-2 font-bold"
          style={{ color: '#0B1320' }}
        >
          Trending up <span style={{ color: '#1f9d55' }} className="italic">{delta} pts</span>
        </div>
        <p
          className="text-[12.5px] leading-relaxed"
          style={{ color: '#64748b' }}
        >
          Sleep and steps improved. Glucose is still slightly elevated — check insights.
        </p>
      </div>
    </div>
  )
})

function WellnessRow({ score = 78, delta = '+4' }) {
  const navigate = useNavigate()
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr_1fr_1fr] gap-4">
      <WellnessCard score={score} delta={delta} />
      {QUICK_ACTIONS.map(a => (
        <QuickActionCard key={a.id} action={a} onClick={() => navigate(a.path)} />
      ))}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Vitals at a glance + Today's Insight
   ═══════════════════════════════════════════════════════════════════════ */
const PERIODS = ['Day', 'Week', 'Month', 'Year']

const VITALS = [
  { label: 'Resting HR',      value: '62',     unit: 'bpm',    trend: '-2',     tone: 'good', color: '#2ECC71', spark: [68,67,65,66,63,64,62] },
  { label: 'Blood pressure',  value: '118/76', unit: 'mmHg',   trend: 'stable', tone: 'good', color: '#2ECC71', spark: [120,118,119,117,118,118,118] },
  { label: 'Fasting glucose', value: '112',    unit: 'mg/dL',  trend: '+5',     tone: 'warn', color: '#FF9F43', spark: [104,106,108,109,110,111,112] },
  { label: 'SpO₂',            value: '98',     unit: '%',      trend: 'stable', tone: 'good', color: '#2ECC71', spark: [97,98,98,97,98,98,98] },
]

const VitalCard = memo(function VitalCard({ v }) {
  const isStable = v.trend === 'stable'
  const isUp     = !isStable && !v.trend.startsWith('-')
  return (
    <div
      className="p-4 rounded-xl overflow-hidden transition-colors hover:bg-[#FAFCFE]"
      style={{ border: '1px solid #E6EEF5' }}
    >
      <div className="text-[11px] font-medium mb-1.5" style={{ color: '#94a3b8' }}>
        {v.label}
      </div>
      <div className="flex items-baseline gap-1 mb-2.5">
        <span
          className="font-display tabular text-[26px] leading-none font-bold"
          style={{ color: '#0B1320' }}
        >
          {v.value}
        </span>
        <span className="text-[11px]" style={{ color: '#94a3b8' }}>{v.unit}</span>
      </div>
      <div className="w-full">
        <Sparkline data={v.spark} h={28} color={v.color} />
      </div>
      <div
        className="mt-2 text-[11px] font-medium flex items-center gap-1"
        style={{ color: v.tone === 'good' ? '#1f9d55' : '#b86b14' }}
      >
        {!isStable && (isUp ? <FiArrowUp size={11} /> : <FiArrowDown size={11} />)}
        {isStable ? 'Stable' : `${v.trend} vs last week`}
      </div>
    </div>
  )
})

function VitalsCard() {
  const [period, setPeriod] = useState('Week')
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-5 flex-wrap gap-3">
        <div>
          <Kicker>Vitals · last 7 days</Kicker>
          <h3 className="font-display font-bold text-[18px] mt-1" style={{ color: '#0B1320' }}>
            Vitals at a glance
          </h3>
        </div>
        <div
          className="flex gap-1 p-1 rounded-full"
          style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
        >
          {PERIODS.map(p => {
            const active = p === period
            return (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className="px-3 py-1 rounded-full text-[12px] font-semibold transition-all"
                style={{
                  background: active ? '#ffffff' : 'transparent',
                  color:      active ? '#0B1320' : '#64748b',
                  boxShadow:  active ? '0 1px 2px rgba(11,19,32,0.06)' : 'none',
                }}
              >
                {p}
              </button>
            )
          })}
        </div>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {VITALS.map(v => <VitalCard key={v.label} v={v} />)}
      </div>
    </Card>
  )
}

/* Today's Insight — LIGHT brand-tinted card (replaces dark variant) */
const TodaysInsight = memo(function TodaysInsight() {
  const navigate = useNavigate()
  return (
    <Card className="p-6 relative overflow-hidden h-full flex flex-col">
      {/* Subtle brand-blue accent strip at top */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: 'linear-gradient(90deg,#0F4C81,#00C2FF)' }}
      />
      {/* Soft brand ambient glow */}
      <div
        aria-hidden="true"
        className="absolute -right-16 -bottom-16 w-56 h-56 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(0,194,255,0.10),transparent 70%)' }}
      />

      <div className="relative flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(15,76,129,0.10)' }}
        >
          <FiZap size={13} style={{ color: '#0F4C81' }} />
        </div>
        <Kicker>Today's insight</Kicker>
      </div>

      <div
        className="relative font-display text-[22px] leading-snug font-bold mb-3"
        style={{ color: '#0B1320' }}
      >
        Your fasting glucose is{' '}
        <span style={{ color: '#b86b14' }} className="italic">creeping up.</span>
      </div>

      <p
        className="relative text-[13px] leading-relaxed mb-5 flex-1"
        style={{ color: '#64748b' }}
      >
        Five-day rise from 104 → 112 mg/dL. Cutting refined carbs at dinner
        and a 20-min evening walk usually bring this down within a week.
      </p>

      <div className="relative flex gap-2">
        <button
          onClick={() => navigate('/insights')}
          className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:-translate-y-0.5 text-white"
          style={{
            background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
          }}
        >
          Plan a routine
        </button>
        <button
          className="px-4 py-2 rounded-lg text-[13px] font-semibold transition-all hover:bg-[#F8FBFD]"
          style={{
            background: 'transparent',
            color: '#475569',
            border: '1px solid #E6EEF5',
          }}
        >
          Dismiss
        </button>
      </div>
    </Card>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   3. Medications + Recent Reports + Up Next
   ═══════════════════════════════════════════════════════════════════════ */
const MEDICATIONS = [
  { name: 'Metformin',    dose: '500 mg · 2× daily',  next: '8:00 PM',  taken: true  },
  { name: 'Atorvastatin', dose: '20 mg · 1× daily',   next: '10:00 PM', taken: false },
  { name: 'Vitamin D₃',    dose: '1000 IU · 1× daily', next: 'Morning',  taken: true  },
]

const REPORTS = [
  { name: 'Lipid Panel — Apollo',  date: '9 Nov 2025',  status: '2 abnormal', tone: 'warn' },
  { name: 'CBC — Manipal',          date: '22 Oct 2025', status: 'Normal',      tone: 'good' },
  { name: 'Thyroid Profile',        date: '14 Sep 2025', status: 'Normal',      tone: 'good' },
  { name: 'HbA1c',                  date: '30 Aug 2025', status: 'Borderline',  tone: 'warn' },
]

const UPCOMING = [
  { day: 'Tue', num: '11', title: 'GP follow-up',  meta: 'Dr. Mehra · 3:30 PM',  bg: 'rgba(15,76,129,0.10)',  fg: '#0F4C81' },
  { day: 'Thu', num: '13', title: 'Walk goal',     meta: '8,000 steps daily',     bg: 'rgba(46,204,113,0.12)', fg: '#1f9d55' },
  { day: 'Sun', num: '16', title: 'HbA1c retest',  meta: 'Apollo Labs · 9 AM',    bg: 'rgba(255,159,67,0.14)', fg: '#b86b14' },
]

const MedicationRow = memo(function MedicationRow({ med, isFirst }) {
  return (
    <div
      className="flex items-center gap-3 py-3 transition-colors hover:bg-[#FAFCFE] -mx-2 px-2 rounded-lg"
      style={{ borderTop: isFirst ? 'none' : '1px solid #E6EEF5' }}
    >
      <div
        className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
        style={{
          background: med.taken ? 'rgba(46,204,113,0.12)' : 'rgba(255,159,67,0.14)',
          color: med.taken ? '#1f9d55' : '#b86b14',
        }}
      >
        {med.taken ? <FiCheck size={15} /> : <span className="text-sm">💊</span>}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate" style={{ color: '#0B1320' }}>{med.name}</div>
        <div className="text-[11.5px]" style={{ color: '#94a3b8' }}>{med.dose}</div>
      </div>
      <div className="text-right">
        <div className="text-[10px]" style={{ color: '#94a3b8' }}>{med.taken ? 'Taken' : 'Next'}</div>
        <div className="text-[12px] font-bold" style={{ color: '#0B1320' }}>{med.next}</div>
      </div>
    </div>
  )
})

function MedicationsCard() {
  const navigate = useNavigate()
  return (
    <Card className="p-5">
      <CardHeading
        title="Medications"
        action={
          <button className="text-[12px] font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity" style={{ color: '#0F4C81' }}>
            See all <FiChevronRight size={12} />
          </button>
        }
      />
      <div>
        {MEDICATIONS.map((m, i) => <MedicationRow key={m.name} med={m} isFirst={i === 0} />)}
      </div>
      <button
        onClick={() => navigate('/drugs')}
        className="w-full mt-4 px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all hover:bg-[#F8FBFD]"
        style={{ border: '1px solid #E6EEF5', color: '#0F4C81' }}
      >
        <FiShield size={14} /> Check interactions
      </button>
    </Card>
  )
}

const ReportRow = memo(function ReportRow({ report, isFirst }) {
  return (
    <div
      className="flex items-center gap-3 py-3 transition-colors hover:bg-[#FAFCFE] -mx-2 px-2 rounded-lg"
      style={{ borderTop: isFirst ? 'none' : '1px solid #E6EEF5' }}
    >
      <div
        className="w-9 h-11 rounded-md flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
      >
        <FiFileText size={13} className="text-slate-400" />
        <div className="text-[8px] font-bold mt-0.5" style={{ color: '#94a3b8' }}>PDF</div>
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold truncate" style={{ color: '#0B1320' }}>{report.name}</div>
        <div className="text-[11.5px]" style={{ color: '#94a3b8' }}>{report.date}</div>
      </div>
      <Status tone={report.tone}>{report.status}</Status>
    </div>
  )
})

function ReportsCard({ reports = [] }) {
  const navigate = useNavigate()
  const items = reports.length ? reports : REPORTS
  return (
    <Card className="p-5">
      <CardHeading
        title="Recent reports"
        action={
          <button
            onClick={() => navigate('/report-analyzer')}
            className="text-[12px] font-semibold flex items-center gap-1 hover:opacity-80 transition-opacity"
            style={{ color: '#0F4C81' }}
          >
            Library <FiChevronRight size={12} />
          </button>
        }
      />
      <div>
        {items.slice(0, 4).map((r, i) => (
          <ReportRow
            key={r.name || r.id}
            report={r.name ? r : { name: r.original_name || 'Report', date: '—', status: 'Reviewed', tone: 'brand' }}
            isFirst={i === 0}
          />
        ))}
      </div>
    </Card>
  )
}

const UpcomingRow = memo(function UpcomingRow({ event, isFirst }) {
  return (
    <div
      className="flex gap-3 py-3 transition-colors hover:bg-[#FAFCFE] -mx-2 px-2 rounded-lg"
      style={{ borderTop: isFirst ? 'none' : '1px solid #E6EEF5' }}
    >
      <div
        className="w-11 h-12 rounded-xl flex flex-col items-center justify-center flex-shrink-0"
        style={{ background: event.bg, color: event.fg }}
      >
        <div className="text-[9px] font-bold uppercase tracking-wider">{event.day}</div>
        <div className="font-display tabular text-[20px] font-bold leading-none">{event.num}</div>
      </div>
      <div className="flex-1 min-w-0 pt-0.5">
        <div className="text-[13px] font-semibold truncate" style={{ color: '#0B1320' }}>{event.title}</div>
        <div className="text-[11.5px] truncate" style={{ color: '#94a3b8' }}>{event.meta}</div>
      </div>
    </div>
  )
})

function UpcomingCard() {
  return (
    <Card className="p-5">
      <CardHeading title="Up next" />
      <div>
        {UPCOMING.map((e, i) => <UpcomingRow key={e.title} event={e} isFirst={i === 0} />)}
      </div>
      <button
        className="w-full mt-4 px-4 py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all hover:bg-[#F8FBFD]"
        style={{ border: '1px solid #E6EEF5', color: '#475569' }}
      >
        <FiPlus size={14} /> Add reminder
      </button>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Main export
   ═══════════════════════════════════════════════════════════════════════ */
export default function DashboardOverview({ stats = {}, reports = [] }) {
  const score = Math.round(stats?.health_score ?? 78)
  return (
    <div className="space-y-4">
      <WellnessRow score={score} />

      <div className="grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-4">
        <VitalsCard />
        <TodaysInsight />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.2fr_0.9fr] gap-4">
        <MedicationsCard />
        <ReportsCard reports={reports} />
        <UpcomingCard />
      </div>
    </div>
  )
}
