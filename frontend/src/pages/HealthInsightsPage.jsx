// src/pages/HealthInsightsPage.jsx
/**
 * Health Insights — redesigned to match SwasthyaSeva design system.
 *
 * Structure (matches design reference, in brand colors):
 *   1. Top bar — kicker + display heading + period selector
 *   2. Risk forecasts (3 cards: Cardiovascular · Diabetes · Liver)
 *   3. Main biomarker chart (Fasting glucose · 26 weeks) with stats header
 *   4. Two-column bottom:
 *        • Drivers — "What's moving the needle" (correlation list)
 *        • Modeled effects — "If you change one thing" (light brand-blue card)
 *
 * Brand consistency:
 *   • Same Sora/Plus Jakarta typography as landing & dashboard
 *   • Same brand palette (#0F4C81 blue, #00C2FF cyan, #2ECC71 green, #FF9F43 orange)
 *   • Same card primitives (rounded-2xl, hairline border, subtle shadow)
 *   • Same hover/transition language
 */
import { memo, useState } from 'react'
import {
  FiCalendar, FiArrowUp, FiArrowDown, FiArrowRight, FiZap,
} from 'react-icons/fi'
import AppTopBar         from '../components/dashboard/AppTopBar'
import { Card, CardHeading, Kicker, Status, Ring } from '../components/dashboard/_primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   1. Risk forecast cards
   ═══════════════════════════════════════════════════════════════════════ */
const RISK_FORECASTS = [
  {
    name:  'Cardiovascular',
    value: 18,
    unit:  '% / 10 yr',
    tone:  'warn',
    label: 'Watch',
    note:  'Borderline. LDL is the main driver — fiber + cardio will move this.',
  },
  {
    name:  'Type 2 Diabetes',
    value: 24,
    unit:  '% / 5 yr',
    tone:  'warn',
    label: 'Watch',
    note:  'Fasting glucose drifting up. Reversible with diet + daily walking.',
  },
  {
    name:  'Liver disease',
    value: 6,
    unit:  '% / 10 yr',
    tone:  'good',
    label: 'Low',
    note:  'Low risk. Keep alcohol minimal and stay hydrated.',
  },
]

const TONE_COLOR = {
  good:   '#2ECC71',
  warn:   '#FF9F43',
  danger: '#ef4444',
}

const RiskCard = memo(function RiskCard({ risk }) {
  const color = TONE_COLOR[risk.tone] ?? TONE_COLOR.good
  return (
    <Card className="p-6 transition-all duration-300 hover:-translate-y-0.5 hover:shadow-md">
      <Kicker>{risk.name} risk</Kicker>
      <div className="flex items-end gap-4 mt-3 mb-4">
        <Ring
          value={Math.min(risk.value * 3, 100)}
          size={72}
          stroke={7}
          color={color}
          track="#E6EEF5"
        >
          <span
            className="font-display tabular text-[22px] font-bold leading-none"
            style={{ color }}
          >
            {risk.value}%
          </span>
        </Ring>
        <div className="flex-1 pb-1.5">
          <div className="text-[11.5px] mb-2" style={{ color: '#94a3b8' }}>{risk.unit}</div>
          <Status tone={risk.tone}>{risk.label}</Status>
        </div>
      </div>
      <p className="text-[12.5px] leading-relaxed" style={{ color: '#64748b' }}>
        {risk.note}
      </p>
    </Card>
  )
})

function RiskForecasts() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
      {RISK_FORECASTS.map(r => <RiskCard key={r.name} risk={r} />)}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   2. Glucose chart (responsive SVG)
   ═══════════════════════════════════════════════════════════════════════ */
const GLUCOSE_DATA = [98,101,99,103,105,104,107,106,108,109,107,110,108,111,110,112,109,113,111,112,114,111,113,112,113,112]

const GlucoseChart = memo(function GlucoseChart() {
  const W = 1200, H = 220, PAD_X = 30, PAD_Y = 26
  const MIN = 90, MAX = 130
  const step  = (W - PAD_X * 2) / (GLUCOSE_DATA.length - 1)
  const yFor  = v => H - PAD_Y - ((v - MIN) / (MAX - MIN)) * (H - PAD_Y * 2)

  const pts   = GLUCOSE_DATA.map((v, i) => [PAD_X + i * step, yFor(v)])
  const dLine = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join(' ')
  const dArea = `${dLine} L${W - PAD_X},${H - PAD_Y} L${PAD_X},${H - PAD_Y} Z`
  const last  = pts[pts.length - 1]

  /* Week labels — pick 5 evenly-spaced indexes */
  const ticks = [
    { i: 0,  l: 'Wk 1'  },
    { i: 6,  l: 'Wk 7'  },
    { i: 13, l: 'Wk 14' },
    { i: 19, l: 'Wk 20' },
    { i: 25, l: 'Wk 26' },
  ]

  return (
    <div className="w-full overflow-hidden">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="xMidYMid meet"
        className="w-full"
        style={{ height: 240, display: 'block' }}
      >
        <defs>
          <linearGradient id="glucose-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"  stopColor="#0F4C81" stopOpacity="0.18" />
            <stop offset="100%" stopColor="#0F4C81" stopOpacity="0" />
          </linearGradient>
        </defs>

        {/* Reference bands */}
        <rect
          x={PAD_X} y={yFor(100)}
          width={W - PAD_X * 2} height={yFor(70) - yFor(100)}
          fill="rgba(46,204,113,0.10)"
        />
        <rect
          x={PAD_X} y={yFor(125)}
          width={W - PAD_X * 2} height={yFor(100) - yFor(125)}
          fill="rgba(255,159,67,0.12)"
        />

        {/* Grid lines */}
        {[100, 110, 120].map(v => (
          <g key={v}>
            <line
              x1={PAD_X} y1={yFor(v)} x2={W - PAD_X} y2={yFor(v)}
              stroke="#E6EEF5" strokeDasharray="3 5"
            />
            <text
              x={PAD_X - 6} y={yFor(v) + 4}
              fontSize="10" fill="#94a3b8" textAnchor="end"
            >
              {v}
            </text>
          </g>
        ))}

        {/* Area + line */}
        <path d={dArea} fill="url(#glucose-area)" />
        <path
          d={dLine}
          stroke="#0F4C81"
          strokeWidth="2"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Latest point marker */}
        <circle cx={last[0]} cy={last[1]} r="6" fill="white" stroke="#0F4C81" strokeWidth="2" />
        <circle cx={last[0]} cy={last[1]} r="2.5" fill="#0F4C81" />

        {/* Annotation callout */}
        <g transform={`translate(${last[0] - 142}, ${last[1] - 56})`}>
          <rect
            x="0" y="0" width="130" height="44" rx="10"
            fill="#0B1320"
          />
          <text x="14" y="18" fontSize="10" fill="rgba(255,255,255,0.55)">Today</text>
          <text x="14" y="34" fontSize="13" fontWeight="700" fill="#ffffff" fontFamily="Sora, sans-serif">
            112 mg/dL · Borderline
          </text>
        </g>

        {/* X axis labels */}
        {ticks.map(t => (
          <text
            key={t.i}
            x={PAD_X + t.i * step}
            y={H - 8}
            fontSize="10"
            fill="#94a3b8"
            textAnchor="middle"
          >
            {t.l}
          </text>
        ))}
      </svg>
    </div>
  )
})

function GlucoseChartCard() {
  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-6 flex-wrap gap-4">
        <div>
          <Kicker>Fasting glucose · 26 weeks</Kicker>
          <h3 className="font-display font-bold text-[22px] mt-1.5 leading-tight" style={{ color: '#0B1320' }}>
            A gentle climb, then a plateau.
          </h3>
        </div>
        <div className="flex gap-5 text-[11.5px]">
          {[
            { l: 'Average', v: '108', unit: 'mg/dL', color: '#0B1320' },
            { l: 'Latest',  v: '112',  unit: '',       color: '#b86b14' },
            { l: 'Change',  v: '+8',   unit: '',       color: '#b86b14' },
          ].map(s => (
            <div key={s.l}>
              <div style={{ color: '#94a3b8' }} className="mb-1">{s.l}</div>
              <div
                className="font-display tabular text-[22px] leading-none font-bold"
                style={{ color: s.color }}
              >
                {s.v}
                {s.unit && (
                  <span className="text-[11px] font-normal ml-1" style={{ color: '#94a3b8' }}>
                    {s.unit}
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
      <GlucoseChart />
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   3. Drivers — "What's moving the needle"
   ═══════════════════════════════════════════════════════════════════════ */
const DRIVERS = [
  { factor: 'Late dinner (after 9 PM)', corr: 0.82, dir: 'up',      tone: 'danger', detail: '+11 mg/dL avg next-morning glucose' },
  { factor: 'Step count > 8,000',        corr: 0.71, dir: 'down',    tone: 'good',   detail: '-7 mg/dL on average'                  },
  { factor: 'Sleep < 6 hours',           corr: 0.58, dir: 'up',      tone: 'warn',   detail: '+5 mg/dL fasting'                     },
  { factor: 'Coffee in afternoon',       corr: 0.34, dir: 'neutral', tone: 'info',   detail: 'No clear effect'                       },
]

const TONE_BAR = {
  good:   '#2ECC71',
  warn:   '#FF9F43',
  danger: '#ef4444',
  info:   '#0F4C81',
}

const DriverRow = memo(function DriverRow({ driver, isFirst }) {
  const color = TONE_BAR[driver.tone]
  const pct   = Math.round(driver.corr * 100)
  return (
    <div
      className="grid grid-cols-[1.5fr_1fr_1fr] gap-3 items-center py-3.5 transition-colors hover:bg-[#FAFCFE] -mx-2 px-2 rounded-lg"
      style={{ borderTop: isFirst ? 'none' : '1px solid #E6EEF5' }}
    >
      <div className="min-w-0">
        <div className="text-[13.5px] font-semibold truncate" style={{ color: '#0B1320' }}>
          {driver.factor}
        </div>
        <div className="text-[11.5px] mt-0.5" style={{ color: '#94a3b8' }}>
          {driver.detail}
        </div>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
      <div className="flex items-center justify-end gap-1.5">
        {driver.dir === 'up'   && <FiArrowUp size={13} style={{ color: '#ef4444' }} />}
        {driver.dir === 'down' && <FiArrowDown size={13} style={{ color: '#2ECC71' }} />}
        <span className="font-display tabular text-[16px] font-bold" style={{ color: '#0B1320' }}>
          {pct}%
        </span>
        <span className="text-[10px]" style={{ color: '#94a3b8' }}>corr.</span>
      </div>
    </div>
  )
})

function DriversCard() {
  return (
    <Card className="p-6">
      <CardHeading
        kicker="Drivers"
        title="What's moving the needle"
      />
      <p className="text-[13px] leading-relaxed -mt-3 mb-4" style={{ color: '#64748b' }}>
        The correlations we've found in your data — strongest at the top.
      </p>
      <div>
        {DRIVERS.map((d, i) => <DriverRow key={d.factor} driver={d} isFirst={i === 0} />)}
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   4. Modeled effects — "If you change one thing"
   ═══════════════════════════════════════════════════════════════════════ */
const MODELED_EFFECTS = [
  { metric: 'Fasting glucose',    value: '-9 mg/dL', tone: 'good' },
  { metric: 'Cardiovascular risk', value: '-3 pp',    tone: 'good' },
  { metric: 'Sleep quality',       value: '+12%',     tone: 'good' },
]

const ModeledEffectsCard = memo(function ModeledEffectsCard() {
  return (
    <Card className="p-6 relative overflow-hidden flex flex-col">
      {/* Top brand accent strip */}
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: 'linear-gradient(90deg,#0F4C81,#00C2FF)' }}
      />
      {/* Soft brand ambient glow */}
      <div
        aria-hidden="true"
        className="absolute -right-20 -bottom-20 w-64 h-64 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(0,194,255,0.08),transparent 70%)' }}
      />

      <div className="relative flex items-center gap-2 mb-4">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(255,159,67,0.14)' }}
        >
          <FiZap size={13} style={{ color: '#b86b14' }} />
        </div>
        <Kicker>If you change one thing</Kicker>
      </div>

      <div
        className="relative font-display text-[22px] leading-snug font-bold mb-3"
        style={{ color: '#0B1320' }}
      >
        Move dinner to before{' '}
        <span style={{ color: '#0F4C81' }} className="italic">8 PM.</span>
      </div>
      <p className="relative text-[13px] leading-relaxed mb-5" style={{ color: '#64748b' }}>
        Modeled effect over 8 weeks, based on your patterns:
      </p>

      <div className="relative flex flex-col gap-3 mb-6">
        {MODELED_EFFECTS.map((effect, i) => (
          <div
            key={effect.metric}
            className="flex items-center justify-between pb-3"
            style={{ borderBottom: i < MODELED_EFFECTS.length - 1 ? '1px solid #E6EEF5' : 'none' }}
          >
            <span className="text-[13px]" style={{ color: '#64748b' }}>{effect.metric}</span>
            <span
              className="font-display tabular text-[17px] font-bold"
              style={{ color: '#2ECC71' }}
            >
              {effect.value}
            </span>
          </div>
        ))}
      </div>

      <button
        className="relative w-full inline-flex items-center justify-center gap-2 py-3 rounded-xl text-white font-semibold text-[13.5px] transition-all hover:-translate-y-0.5"
        style={{
          background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
        }}
      >
        Start the plan <FiArrowRight size={14} />
      </button>
    </Card>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   5. Period selector — used in topbar
   ═══════════════════════════════════════════════════════════════════════ */
const PeriodSelector = memo(function PeriodSelector({ value, onChange }) {
  const [open, setOpen] = useState(false)
  const options = ['7 days', '30 days', '3 months', '6 months', '1 year']

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(v => !v)}
        className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
        style={{
          background: '#F8FBFD',
          border: '1px solid #E6EEF5',
          color: '#0B1320',
        }}
      >
        <FiCalendar size={13} /> {value}
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 top-full mt-2 w-44 bg-white rounded-2xl shadow-xl py-2 z-50"
            style={{ border: '1px solid #E6EEF5' }}
          >
            {options.map(opt => (
              <button
                key={opt}
                onClick={() => { onChange(opt); setOpen(false) }}
                className="w-full text-left px-4 py-2 text-[13px] font-medium transition-colors hover:bg-slate-50"
                style={{
                  color: opt === value ? '#0F4C81' : '#475569',
                  fontWeight: opt === value ? 600 : 500,
                }}
              >
                {opt}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Main page
   ═══════════════════════════════════════════════════════════════════════ */
export default function HealthInsightsPage() {
  const [period,    setPeriod]    = useState('6 months')

  return (
    <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker={`Health insights · last ${period}`}
          title="The shape of you, over time"
          action={<PeriodSelector value={period} onChange={setPeriod} />}
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto space-y-4">
          {/* 1. Risk forecasts */}
          <RiskForecasts />

          {/* 2. Main biomarker chart */}
          <GlucoseChartCard />

          {/* 3. Drivers + Modeled effects */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-4">
            <DriversCard />
            <ModeledEffectsCard />
          </div>
        </div>
      </main>
  )
}
