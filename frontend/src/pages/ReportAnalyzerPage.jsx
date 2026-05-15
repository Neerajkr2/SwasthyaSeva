// src/pages/ReportAnalyzerPage.jsx
/**
 * Report Analyzer — premium clinical report intelligence.
 *
 * Three modes:
 *   1. 'upload'    — premium dropzone, supported types, privacy reassurance, CTA
 *   2. 'analyzing' — concentric scanning rings + 5-stage progress
 *   3. 'result'    — hero verdict card + tab dashboard:
 *                      Overview · Lab Values · Conditions · Medicines ·
 *                      Diet · Recovery · Follow-up
 *
 * Layout (matches design reference):
 *   [Sidebar] [Topbar — kicker · title · Download/Ask actions]
 *             [content max-w-1280]
 *
 * Brand: Sora display · Plus Jakarta body · #0F4C81 / #00C2FF / #2ECC71 / #FF9F43.
 */
import { useState, useCallback, useMemo, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiUploadCloud, FiFile, FiX, FiAlertTriangle, FiCheckCircle, FiInfo,
  FiHeart, FiActivity, FiShield, FiTrendingUp, FiClock, FiRefreshCw,
  FiChevronRight, FiZap, FiDownload, FiMessageSquare, FiUser,
} from 'react-icons/fi'
import { mlAPI } from '../services/api'
import { useToast } from '../context/ToastContext'
import { formatBytes } from '../utils/helpers'

import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import MobileBottomNav  from '../components/common/MobileBottomNav'
import AppTopBar        from '../components/dashboard/AppTopBar'
import { Card, CardHeading, Kicker, Status, Ring } from '../components/dashboard/_primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   Config
   ═══════════════════════════════════════════════════════════════════════ */
const STATUS_CFG = {
  normal:  { color: '#1f9d55', bg: 'rgba(46,204,113,0.10)',  border: 'rgba(46,204,113,0.25)', label: 'Normal',  tone: 'good'   },
  low:     { color: '#0E7490', bg: 'rgba(0,194,255,0.10)',    border: 'rgba(0,194,255,0.22)',  label: 'Low',     tone: 'cyan'   },
  high:    { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.22)',  label: 'High',    tone: 'danger' },
  borderline: { color: '#FF9F43', bg: 'rgba(255,159,67,0.12)', border: 'rgba(255,159,67,0.28)', label: 'Borderline', tone: 'warn' },
  unknown: { color: '#94a3b8', bg: 'rgba(148,163,184,0.10)', border: 'rgba(148,163,184,0.22)', label: 'Unknown', tone: 'slate'  },
}

const SEVERITY_CFG = {
  mild:     { color: '#1f9d55', bg: 'rgba(46,204,113,0.08)', border: 'rgba(46,204,113,0.22)', label: 'Mild'     },
  moderate: { color: '#FF9F43', bg: 'rgba(255,159,67,0.10)',  border: 'rgba(255,159,67,0.28)', label: 'Moderate' },
  severe:   { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',    border: 'rgba(239,68,68,0.25)', label: 'Severe'   },
  critical: { color: '#7c3aed', bg: 'rgba(124,58,237,0.10)',   border: 'rgba(124,58,237,0.25)', label: 'Critical' },
}

const REPORT_TYPE_LABELS = {
  blood_test:   'Blood Test',
  liver_panel:  'Liver Panel',
  kidney_panel: 'Kidney Panel',
  ecg:          'ECG Report',
  prescription: 'Prescription',
  discharge:    'Discharge Summary',
  xray:         'X-Ray Report',
  urine:        'Urine Test',
  general:      'Medical Report',
}

const PROCESSING_STAGES = [
  { icon: '🔍', label: 'Document recognition',  desc: 'Identifying report type'         },
  { icon: '📄', label: 'OCR text extraction',    desc: 'Reading every value & label'     },
  { icon: '🧪', label: 'Lab value analysis',     desc: 'Comparing to clinical ranges'    },
  { icon: '💊', label: 'Medicine detection',     desc: 'Spotting prescribed drugs'       },
  { icon: '✨', label: 'AI interpretation',      desc: 'Generating personalized insights' },
]

const SUPPORTED_TYPES = [
  { icon: '🩸', label: 'Blood tests',   desc: 'CBC, lipids, glucose, thyroid'  },
  { icon: '🫀', label: 'ECG reports',   desc: 'Cardiac rhythm analysis'        },
  { icon: '💊', label: 'Prescriptions', desc: 'Medicine & dosage detection'    },
  { icon: '🏥', label: 'Discharge',     desc: 'Hospital discharge summaries'    },
]

const TABS = [
  { id: 'overview',   label: 'Overview',     icon: FiHeart         },
  { id: 'lab',        label: 'Lab values',   icon: FiActivity      },
  { id: 'conditions', label: 'Conditions',   icon: FiAlertTriangle },
  { id: 'medicines',  label: 'Medicines',    icon: FiShield        },
  { id: 'guidance',   label: 'Diet & care',  icon: FiTrendingUp    },
  { id: 'recovery',   label: 'Recovery',     icon: FiClock         },
  { id: 'followup',   label: 'Follow-up',    icon: FiCheckCircle   },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Capsule icon (inline SVG)
   ═══════════════════════════════════════════════════════════════════════ */
const CapsuleIcon = memo(function CapsuleIcon({ size = 16, color = '#0F4C81' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path d="M3 10 a5 5 0 0 1 5 -5 h4 a5 5 0 0 1 0 10 h-4 a5 5 0 0 1 -5 -5 z" fill={color} opacity="0.18" />
      <path d="M3 10 a5 5 0 0 1 5 -5 h2 v10 h-2 a5 5 0 0 1 -5 -5 z" fill={color} opacity="0.7" />
      <path d="M3 10 a5 5 0 0 1 5 -5 h4 a5 5 0 0 1 5 5 a5 5 0 0 1 -5 5 h-4 a5 5 0 0 1 -5 -5 z" stroke={color} strokeWidth="1.2" fill="none" />
    </svg>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Range bar — shows where a lab value sits within its reference range
   ═══════════════════════════════════════════════════════════════════════ */
const RangeBar = memo(function RangeBar({ value, low, high, tone = 'good' }) {
  if (value == null || low == null || high == null) return null
  // Domain extends 30% outside the reference range to give visual headroom
  const span = high - low || 1
  const dMin = low - span * 0.3
  const dMax = high + span * 0.3
  const pct = (v) => Math.min(100, Math.max(0, ((v - dMin) / (dMax - dMin)) * 100))
  const valPct = pct(value)
  const cfg = STATUS_CFG[tone] || STATUS_CFG.unknown

  return (
    <div className="w-full">
      {/* Track with zones */}
      <div className="relative w-full h-2 rounded-full" style={{ background: '#F1F5F9' }}>
        {/* Low danger zone */}
        <div
          className="absolute top-0 left-0 h-full rounded-l-full"
          style={{
            width: `${pct(low)}%`,
            background: 'rgba(239,68,68,0.20)',
          }}
        />
        {/* Normal zone */}
        <div
          className="absolute top-0 h-full"
          style={{
            left: `${pct(low)}%`,
            width: `${pct(high) - pct(low)}%`,
            background: 'rgba(46,204,113,0.25)',
          }}
        />
        {/* High danger zone */}
        <div
          className="absolute top-0 right-0 h-full rounded-r-full"
          style={{
            width: `${100 - pct(high)}%`,
            background: 'rgba(255,159,67,0.25)',
          }}
        />
        {/* Marker */}
        <motion.div
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.2, duration: 0.4 }}
          className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3 h-3 rounded-full ring-2 ring-white shadow-sm"
          style={{ left: `${valPct}%`, background: cfg.color }}
        />
      </div>
      {/* Range labels */}
      <div className="flex justify-between text-[10px] mt-1.5" style={{ color: '#94a3b8' }}>
        <span>{low}</span>
        <span>{high}</span>
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Upload mode
   ═══════════════════════════════════════════════════════════════════════ */
function UploadView({ file, setFile, onAnalyze, getRootProps, getInputProps, isDragActive }) {
  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="text-center">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-4"
          style={{ background: 'linear-gradient(135deg,rgba(15,76,129,0.10),rgba(0,194,255,0.10))' }}
        >
          <FiUploadCloud size={28} style={{ color: '#0F4C81' }} />
        </div>
        <h2 className="font-display text-[26px] font-bold mb-2" style={{ color: '#0B1320' }}>
          Upload your medical report
        </h2>
        <p className="text-[14px] max-w-lg mx-auto leading-relaxed" style={{ color: '#64748b' }}>
          Drop a PDF or photo of your lab report, prescription, or discharge summary —
          we'll explain every value in plain language and give you a clear next-step plan.
        </p>
      </div>

      {/* Dropzone */}
      <div
        {...getRootProps()}
        className="rounded-2xl p-10 text-center cursor-pointer transition-all"
        style={{
          background: isDragActive ? 'rgba(15,76,129,0.06)' : '#ffffff',
          border: `2px dashed ${isDragActive ? '#0F4C81' : '#CBD5E1'}`,
          transform: isDragActive ? 'scale(1.005)' : 'scale(1)',
        }}
      >
        <input {...getInputProps()} />
        {file ? (
          <div className="flex flex-col items-center gap-3">
            <div
              className="w-16 h-16 rounded-2xl flex items-center justify-center"
              style={{ background: 'rgba(15,76,129,0.08)' }}
            >
              <FiFile size={28} style={{ color: '#0F4C81' }} />
            </div>
            <div>
              <div className="font-semibold text-[14px]" style={{ color: '#0B1320' }}>{file.name}</div>
              <div className="text-[12px] mt-0.5" style={{ color: '#94a3b8' }}>
                {formatBytes(file.size)} · ready to analyze
              </div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); setFile(null) }}
              className="inline-flex items-center gap-1.5 text-[12px] font-semibold transition-colors hover:underline"
              style={{ color: '#ef4444' }}
            >
              <FiX size={12} /> Remove file
            </button>
          </div>
        ) : (
          <div>
            <FiUploadCloud size={44} className="mx-auto mb-3" style={{ color: '#CBD5E1' }} />
            <p className="font-semibold text-[14px] mb-1" style={{ color: '#0B1320' }}>
              {isDragActive ? 'Drop your file here…' : 'Drag & drop or click to browse'}
            </p>
            <p className="text-[12px]" style={{ color: '#94a3b8' }}>
              PDF · JPG · PNG · WEBP &middot; max 10 MB
            </p>
          </div>
        )}
      </div>

      {/* Supported report types */}
      <div>
        <Kicker className="block mb-3">Works with</Kicker>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SUPPORTED_TYPES.map(t => (
            <Card key={t.label} className="p-4 text-center transition-all hover:-translate-y-0.5">
              <div className="text-2xl mb-2">{t.icon}</div>
              <div className="font-semibold text-[12.5px] mb-0.5" style={{ color: '#0B1320' }}>{t.label}</div>
              <div className="text-[11px]" style={{ color: '#94a3b8' }}>{t.desc}</div>
            </Card>
          ))}
        </div>
      </div>

      {/* Privacy callout */}
      <Card
        className="p-4 flex items-start gap-3"
        style={{ background: 'rgba(0,194,255,0.05)', borderColor: 'rgba(0,194,255,0.20)' }}
      >
        <FiShield size={16} className="flex-shrink-0 mt-0.5" style={{ color: '#0E7490' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#475569' }}>
          <strong style={{ color: '#0B1320' }}>Encrypted and private.</strong>{' '}
          Your reports are processed securely, stored only in your account, and never shared with anyone.
        </p>
      </Card>

      <button
        onClick={onAnalyze}
        disabled={!file}
        className="w-full py-4 rounded-2xl text-white font-semibold text-[14.5px] transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:transform-none inline-flex items-center justify-center gap-2.5"
        style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
      >
        <FiZap size={16} /> Analyze report with AI
      </button>

      <p className="text-center text-[11px]" style={{ color: '#94a3b8' }}>
        Powered by OCR + AI. Informational use only — always discuss findings with a licensed doctor.
      </p>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Analyzing mode
   ═══════════════════════════════════════════════════════════════════════ */
function AnalyzingView({ stage }) {
  return (
    <Card className="p-10 max-w-2xl mx-auto">
      <div className="flex flex-col items-center">
        <div className="relative w-32 h-32 mb-6">
          <motion.div
            animate={{ scale: [1, 1.15, 1], opacity: [0.5, 0.15, 0.5] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid #0F4C81' }}
          />
          <motion.div
            animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
            transition={{ duration: 2, repeat: Infinity, delay: 0.4 }}
            className="absolute inset-0 rounded-full"
            style={{ border: '2px solid #00C2FF' }}
          />
          <div
            className="absolute inset-3 rounded-full flex items-center justify-center"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
          >
            <motion.div animate={{ rotate: 360 }} transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}>
              <FiFile size={32} className="text-white" />
            </motion.div>
          </div>
        </div>

        <Kicker className="mb-2">OCR + AI Engine</Kicker>
        <h3 className="font-display text-[24px] font-bold mb-6" style={{ color: '#0B1320' }}>
          Reading your report…
        </h3>

        <div className="w-full max-w-sm space-y-2">
          {PROCESSING_STAGES.map((s, i) => {
            const isActive = i === stage
            const isDone   = i < stage
            return (
              <motion.div
                key={s.label}
                initial={{ opacity: 0.4 }}
                animate={{ opacity: (isActive || isDone) ? 1 : 0.4 }}
                className="flex items-center gap-3 px-3.5 py-2.5 rounded-lg"
                style={{
                  background: isActive ? 'rgba(15,76,129,0.06)' : isDone ? 'rgba(46,204,113,0.06)' : '#F8FBFD',
                  border: `1px solid ${isActive ? 'rgba(15,76,129,0.20)' : isDone ? 'rgba(46,204,113,0.20)' : '#E6EEF5'}`,
                }}
              >
                <span className="text-lg">{s.icon}</span>
                <div className="flex-1 min-w-0">
                  <div
                    className="text-[12.5px] font-semibold"
                    style={{ color: isActive ? '#0F4C81' : isDone ? '#1f9d55' : '#94a3b8' }}
                  >
                    {s.label}
                  </div>
                  {isActive && (
                    <div className="text-[10.5px]" style={{ color: '#64748b' }}>{s.desc}</div>
                  )}
                </div>
                {isDone && <FiCheckCircle size={14} style={{ color: '#1f9d55' }} />}
                {isActive && (
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 1.5, repeat: Infinity, ease: 'linear' }}
                    className="w-3.5 h-3.5 border-2 border-t-transparent rounded-full"
                    style={{ borderColor: '#0F4C81', borderTopColor: 'transparent' }}
                  />
                )}
              </motion.div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Hero result card
   ═══════════════════════════════════════════════════════════════════════ */
function HeroVerdictCard({ result, stats }) {
  const score = Math.round(result.health_score ?? 75)
  const color =
    score >= 75 ? '#2ECC71'
    : score >= 50 ? '#FF9F43'
    : '#ef4444'
  const grade =
    score >= 90 ? 'A'
    : score >= 80 ? 'B+'
    : score >= 70 ? 'B'
    : score >= 60 ? 'B-'
    : score >= 50 ? 'C'
    : score >= 40 ? 'C-'
    : 'D'
  const verdict =
    stats.abnormalCount === 0 ? 'All values look healthy.'
    : stats.abnormalCount === 1 ? 'Mostly OK, one value to watch.'
    : `Mostly OK, ${stats.abnormalCount} values to watch.`
  const tone = stats.abnormalCount === 0 ? 'good' : stats.abnormalCount <= 2 ? 'warn' : 'danger'

  return (
    <Card className="p-7">
      <div className="grid grid-cols-1 lg:grid-cols-[auto_1fr] gap-7 items-center">
        <div className="flex items-center gap-5">
          <Ring value={score} size={120} stroke={10} color={color} track="#E6EEF5">
            <div className="text-center">
              <div
                className="font-display tabular text-[38px] font-bold leading-none"
                style={{ color: '#0B1320' }}
              >
                {grade}
              </div>
              <div
                className="text-[9px] font-bold uppercase tracking-[0.18em] mt-1"
                style={{ color: '#94a3b8' }}
              >
                Overall
              </div>
            </div>
          </Ring>
          <div>
            <Kicker>Verdict</Kicker>
            <h2
              className="font-display text-[24px] sm:text-[26px] font-bold leading-tight mt-1 mb-2"
              style={{ color: '#0B1320' }}
            >
              {verdict}
            </h2>
            <Status tone={tone}>
              {stats.abnormalCount} of {stats.totalValues} {stats.totalValues === 1 ? 'value' : 'values'} flagged
            </Status>
          </div>
        </div>

        <p className="text-[14.5px] leading-relaxed" style={{ color: '#475569' }}>
          {result.summary || result.ai_interpretation?.slice(0, 280) || (
            stats.abnormalCount === 0
              ? "Your values are all within healthy ranges. Maintain your current routine — diet, exercise, sleep — and retest as advised by your doctor."
              : "Some values need attention. The pattern often responds to small habit changes before medication. See the recovery roadmap and follow-up plan below."
          )}
        </p>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Plain-language explanation card (right-rail in Overview)
   ═══════════════════════════════════════════════════════════════════════ */
function PlainLanguageCard({ text }) {
  if (!text) return null
  return (
    <Card className="p-6 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="absolute top-0 left-0 right-0 h-1"
        style={{ background: 'linear-gradient(90deg,#0F4C81,#00C2FF)' }}
      />
      <div className="flex items-center gap-2 mb-3">
        <div
          className="w-7 h-7 rounded-lg flex items-center justify-center"
          style={{ background: 'rgba(15,76,129,0.10)' }}
        >
          <FiZap size={13} style={{ color: '#0F4C81' }} />
        </div>
        <Kicker>In plain language</Kicker>
      </div>
      <p
        className="text-[13.5px] leading-relaxed whitespace-pre-wrap"
        style={{ color: '#475569' }}
      >
        {text}
      </p>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Next-steps card (right-rail in Overview)
   ═══════════════════════════════════════════════════════════════════════ */
function NextStepsCard({ result }) {
  // Try to harvest 3-5 actionable items from various result fields
  const items = useMemo(() => {
    const ax = []
    const r = result || {}
    if (r.recommendations?.length) ax.push(...r.recommendations)
    else if (r.diet_plan?.foods_to_eat?.[0])  ax.push(`Add ${r.diet_plan.foods_to_eat[0]} to your meals`)
    if (r.exercise_plan?.duration)            ax.push(`${r.exercise_plan.type || 'Move'} for ${r.exercise_plan.duration}`)
    if (r.follow_up?.timeline)                ax.push(`Next checkup: ${r.follow_up.timeline}`)
    if (ax.length < 3 && r.recovery_roadmap?.week_1?.actions?.[0]) {
      ax.push(r.recovery_roadmap.week_1.actions[0])
    }
    return ax.slice(0, 4)
  }, [result])

  if (!items.length) return null

  return (
    <Card
      className="p-6 relative overflow-hidden"
      style={{ background: 'rgba(255,159,67,0.06)', borderColor: 'rgba(255,159,67,0.22)' }}
    >
      <Kicker style={{ color: '#b86b14' }}>Next steps</Kicker>
      <h3 className="font-display font-bold text-[16px] mt-1 mb-4" style={{ color: '#0B1320' }}>
        Your personalised plan
      </h3>
      <div className="space-y-3">
        {items.map((step, i) => (
          <div
            key={i}
            className="flex items-start gap-3"
            style={{
              paddingTop: i ? 12 : 0,
              borderTop: i ? '1px solid rgba(255,159,67,0.18)' : 'none',
            }}
          >
            <div
              className="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold flex-shrink-0 mt-0.5 text-white"
              style={{ background: '#FF9F43' }}
            >
              {i + 1}
            </div>
            <p className="text-[13px] leading-relaxed" style={{ color: '#0B1320' }}>{step}</p>
          </div>
        ))}
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Overview tab
   ═══════════════════════════════════════════════════════════════════════ */
function OverviewTab({ result, stats }) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4">
      {/* Left: condition cards summary */}
      <div className="space-y-4">
        {/* Quick stats */}
        <Card className="p-5">
          <Kicker className="block mb-3">Quick view</Kicker>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Values',     value: stats.totalValues,     color: '#0F4C81' },
              { label: 'Abnormal',   value: stats.abnormalCount,    color: '#ef4444' },
              { label: 'Conditions', value: stats.conditionCount,   color: '#FF9F43' },
              { label: 'Medicines',  value: stats.medicineCount,    color: '#2ECC71' },
            ].map(s => (
              <div
                key={s.label}
                className="rounded-xl p-3 text-center"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <div
                  className="font-display tabular text-[28px] font-bold leading-none"
                  style={{ color: s.color }}
                >
                  {s.value}
                </div>
                <div className="text-[10.5px] mt-1.5" style={{ color: '#94a3b8' }}>{s.label}</div>
              </div>
            ))}
          </div>
        </Card>

        {/* Detected conditions */}
        {result.conditions?.length > 0 ? (
          <Card className="p-5">
            <CardHeading kicker="What we noticed" title="Detected conditions" />
            <div className="space-y-3">
              {result.conditions.slice(0, 4).map((c, i) => {
                const cfg = SEVERITY_CFG[c.severity] || SEVERITY_CFG.mild
                const pct = Math.round((c.confidence ?? 0) * 100)
                return (
                  <motion.div
                    key={c.name}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.06 }}
                    className="p-4 rounded-xl"
                    style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                  >
                    <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                      <h4 className="font-display font-bold text-[15px]" style={{ color: '#0B1320' }}>
                        {c.name}
                      </h4>
                      <span
                        className="text-[10.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: '#fff', color: cfg.color, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.label} · {pct}%
                      </span>
                    </div>
                    <div className="h-1.5 rounded-full overflow-hidden mb-2" style={{ background: 'rgba(255,255,255,0.5)' }}>
                      <motion.div
                        initial={{ width: 0 }}
                        animate={{ width: `${pct}%` }}
                        transition={{ duration: 0.7, delay: 0.15 + i * 0.05 }}
                        className="h-full rounded-full"
                        style={{ background: cfg.color }}
                      />
                    </div>
                    {c.related_markers?.length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {c.related_markers.map((m, j) => (
                          <span
                            key={j}
                            className="text-[10.5px] px-2 py-0.5 rounded-full"
                            style={{ background: '#fff', color: '#475569', border: '1px solid #E6EEF5' }}
                          >
                            {m}
                          </span>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )
              })}
            </div>
          </Card>
        ) : (
          <Card className="p-7 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(46,204,113,0.10)' }}
            >
              <FiCheckCircle size={26} style={{ color: '#2ECC71' }} />
            </div>
            <h3 className="font-display font-bold text-[16px] mb-1" style={{ color: '#0B1320' }}>
              No conditions detected
            </h3>
            <p className="text-[13px]" style={{ color: '#64748b' }}>
              All extracted values look healthy. Maintain your current habits and recheck as scheduled.
            </p>
          </Card>
        )}
      </div>

      {/* Right: plain-language + next steps */}
      <div className="space-y-4">
        <PlainLanguageCard text={result.ai_interpretation} />
        <NextStepsCard result={result} />
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Lab values tab
   ═══════════════════════════════════════════════════════════════════════ */
function LabValuesTab({ values = [] }) {
  if (!values.length) {
    return <EmptyTab icon={FiActivity} title="No lab values extracted" desc="This report doesn't seem to contain numeric lab values." />
  }
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <CardHeading title="All values" />
          <div className="flex gap-3 text-[10.5px]" style={{ color: '#94a3b8' }}>
            {[
              { l: 'Normal',     c: '#2ECC71' },
              { l: 'Borderline', c: '#FF9F43' },
              { l: 'High / Low', c: '#ef4444' },
            ].map(s => (
              <span key={s.l} className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full" style={{ background: s.c }} /> {s.l}
              </span>
            ))}
          </div>
        </div>

        <div>
          {values.map((v, i) => {
            const cfg = STATUS_CFG[v.status] || STATUS_CFG.unknown
            return (
              <motion.div
                key={`${v.parameter}-${i}`}
                initial={{ opacity: 0, y: 4 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.025 }}
                className="grid grid-cols-1 sm:grid-cols-[1.4fr_1fr_1.6fr_auto] gap-4 items-center py-4"
                style={{ borderTop: i ? '1px solid #E6EEF5' : 'none' }}
              >
                <div>
                  <div className="text-[13.5px] font-semibold capitalize" style={{ color: '#0B1320' }}>
                    {v.parameter}
                  </div>
                  <div className="text-[11px] mt-0.5" style={{ color: '#94a3b8' }}>
                    {v.reference_low != null
                      ? `Reference: ${v.reference_low}–${v.reference_high} ${v.unit || ''}`
                      : v.category || '—'}
                  </div>
                </div>
                <div className="flex items-baseline gap-1">
                  <span
                    className="font-display tabular text-[22px] font-bold leading-none"
                    style={{ color: v.status === 'normal' || v.status === 'unknown' ? '#0B1320' : cfg.color }}
                  >
                    {v.value}
                  </span>
                  <span className="text-[11px]" style={{ color: '#94a3b8' }}>{v.unit}</span>
                </div>
                <RangeBar
                  value={v.value}
                  low={v.reference_low}
                  high={v.reference_high}
                  tone={v.status}
                />
                <span
                  className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full self-center sm:self-auto whitespace-nowrap"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                >
                  {cfg.label}
                </span>
              </motion.div>
            )
          })}
        </div>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Conditions tab
   ═══════════════════════════════════════════════════════════════════════ */
function ConditionsTab({ conditions = [], abnormalValues = [] }) {
  if (!conditions.length && !abnormalValues.length) {
    return <EmptyTab icon={FiCheckCircle} title="No conditions detected" desc="All values appear within healthy ranges." />
  }
  return (
    <div className="space-y-4">
      {conditions.length > 0 && (
        <Card className="p-5">
          <CardHeading kicker={`${conditions.length} detected`} title="Condition analysis" />
          <div className="space-y-3">
            {conditions.map((c, i) => {
              const cfg = SEVERITY_CFG[c.severity] || SEVERITY_CFG.mild
              const pct = Math.round((c.confidence ?? 0) * 100)
              return (
                <motion.div
                  key={c.name}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.06 }}
                  className="p-4 rounded-xl"
                  style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
                >
                  <div className="flex items-center justify-between mb-2 flex-wrap gap-2">
                    <h4 className="font-display font-bold text-[17px]" style={{ color: '#0B1320' }}>{c.name}</h4>
                    <div className="flex items-center gap-2 text-[11px]">
                      <span
                        className="font-bold uppercase tracking-wider px-2 py-0.5 rounded-full"
                        style={{ background: '#fff', color: cfg.color, border: `1px solid ${cfg.border}` }}
                      >
                        {cfg.label}
                      </span>
                      <span className="font-semibold" style={{ color: '#64748b' }}>
                        {pct}% confidence
                      </span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden mb-3" style={{ background: 'rgba(255,255,255,0.5)' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.8, delay: 0.2 + i * 0.05 }}
                      className="h-full rounded-full"
                      style={{ background: cfg.color }}
                    />
                  </div>
                  {c.related_markers?.length > 0 && (
                    <div className="flex flex-wrap gap-1.5 items-center">
                      <span className="text-[11px] font-semibold" style={{ color: '#64748b' }}>Related markers:</span>
                      {c.related_markers.map((m, j) => (
                        <span
                          key={j}
                          className="text-[10.5px] px-2 py-0.5 rounded-full font-medium"
                          style={{ background: '#fff', color: '#475569', border: '1px solid #E6EEF5' }}
                        >
                          {m}
                        </span>
                      ))}
                    </div>
                  )}
                </motion.div>
              )
            })}
          </div>
        </Card>
      )}

      {abnormalValues.length > 0 && (
        <Card className="p-5" style={{ borderLeft: '4px solid #ef4444' }}>
          <CardHeading kicker="Out-of-range" title="Abnormal values" />
          <div className="grid sm:grid-cols-2 gap-2.5">
            {abnormalValues.map((v, i) => {
              const cfg = STATUS_CFG[v.status] || STATUS_CFG.unknown
              return (
                <div
                  key={i}
                  className="flex items-center justify-between rounded-xl p-3"
                  style={{ background: '#fff', border: '1px solid #E6EEF5' }}
                >
                  <div className="min-w-0">
                    <div className="text-[13px] font-semibold capitalize truncate" style={{ color: '#0B1320' }}>
                      {v.parameter}
                    </div>
                    <div className="text-[10.5px]" style={{ color: '#94a3b8' }}>
                      {v.category || 'Lab value'}
                    </div>
                  </div>
                  <span
                    className="font-display tabular text-[15px] font-bold ml-3 flex-shrink-0"
                    style={{ color: cfg.color }}
                  >
                    {v.value} {v.unit}
                  </span>
                </div>
              )
            })}
          </div>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Medicines tab
   ═══════════════════════════════════════════════════════════════════════ */
const SLOT_META = [
  { slot: 'morning',   icon: '🌅', label: 'Morning'   },
  { slot: 'afternoon', icon: '☀️', label: 'Afternoon' },
  { slot: 'evening',   icon: '🌆', label: 'Evening'   },
  { slot: 'night',     icon: '🌙', label: 'Night'     },
]

function MedicinesTab({ medicines = [] }) {
  if (!medicines.length) {
    return <EmptyTab icon={FiShield} title="No medicines detected" desc="Upload a prescription or discharge summary for medicine extraction." />
  }
  const scheduleMap = { morning: [], afternoon: [], evening: [], night: [] }
  medicines.forEach(m => {
    const slots = (m.schedule || 'morning').split(',')
    slots.forEach(s => {
      const slot = s.trim().toLowerCase()
      if (scheduleMap[slot]) scheduleMap[slot].push(m.name)
    })
  })

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {medicines.map((m, i) => (
          <motion.div
            key={m.name + i}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.06 }}
          >
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
                  style={{ background: 'rgba(15,76,129,0.08)' }}
                >
                  <CapsuleIcon size={18} color="#0F4C81" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <h4 className="font-display font-bold text-[15px] capitalize" style={{ color: '#0B1320' }}>{m.name}</h4>
                    {m.purpose && (
                      <span
                        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                        style={{ background: 'rgba(15,76,129,0.08)', color: '#0F4C81' }}
                      >
                        {m.purpose}
                      </span>
                    )}
                  </div>
                  {m.dosage && (
                    <div className="text-[12.5px] font-semibold" style={{ color: '#0F4C81' }}>{m.dosage}</div>
                  )}
                  {m.frequency && (
                    <div className="text-[11.5px] mt-0.5" style={{ color: '#64748b' }}>
                      <span className="font-semibold">Frequency:</span> {m.frequency}
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </motion.div>
        ))}
      </div>

      <Card className="p-5">
        <CardHeading kicker="Take it on time" title="Daily medicine schedule" />
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {SLOT_META.map(({ slot, icon, label }) => (
            <div
              key={slot}
              className="rounded-xl p-3 text-center"
              style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
            >
              <div className="text-2xl mb-1.5">{icon}</div>
              <div className="text-[11.5px] font-bold uppercase tracking-wider mb-2" style={{ color: '#0B1320' }}>{label}</div>
              {scheduleMap[slot].length > 0 ? (
                <div className="space-y-1">
                  {scheduleMap[slot].map((name, j) => (
                    <div
                      key={j}
                      className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full capitalize"
                      style={{ background: 'rgba(15,76,129,0.10)', color: '#0F4C81' }}
                    >
                      {name}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-[11px]" style={{ color: '#CBD5E1' }}>—</p>
              )}
            </div>
          ))}
        </div>
      </Card>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Diet & exercise tab
   ═══════════════════════════════════════════════════════════════════════ */
function GuidanceTab({ dietPlan, exercisePlan }) {
  const hasDiet = dietPlan && Object.keys(dietPlan).length > 0
  const hasEx   = exercisePlan && Object.keys(exercisePlan).length > 0
  if (!hasDiet && !hasEx) {
    return <EmptyTab icon={FiTrendingUp} title="Diet & care plan not available" desc="Personalized guidance will appear once the AI engine analyzes your full report." />
  }
  return (
    <div className="space-y-4">
      {hasDiet && (
        <Card className="p-5">
          <CardHeading kicker="Eat well, heal faster" title="Personalised diet plan" />
          <div className="grid sm:grid-cols-2 gap-3 mb-4">
            {dietPlan.foods_to_eat?.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(46,204,113,0.05)', border: '1px solid rgba(46,204,113,0.22)' }}
              >
                <h4 className="font-display font-bold text-[14px] mb-3 flex items-center gap-2" style={{ color: '#1f9d55' }}>
                  ✓ Foods to eat
                </h4>
                <ul className="space-y-1.5">
                  {dietPlan.foods_to_eat.map((f, i) => (
                    <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: '#1f9d55' }}>
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#2ECC71' }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
            {dietPlan.foods_to_avoid?.length > 0 && (
              <div
                className="rounded-xl p-4"
                style={{ background: 'rgba(239,68,68,0.04)', border: '1px solid rgba(239,68,68,0.22)' }}
              >
                <h4 className="font-display font-bold text-[14px] mb-3 flex items-center gap-2" style={{ color: '#b8463a' }}>
                  ✕ Foods to avoid
                </h4>
                <ul className="space-y-1.5">
                  {dietPlan.foods_to_avoid.map((f, i) => (
                    <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: '#b8463a' }}>
                      <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#ef4444' }} />
                      {f}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
          {dietPlan.sample_meal && (
            <div
              className="rounded-xl p-4"
              style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
            >
              <Kicker>Sample meal plan</Kicker>
              <p className="text-[13px] leading-relaxed whitespace-pre-wrap mt-2" style={{ color: '#475569' }}>
                {dietPlan.sample_meal}
              </p>
            </div>
          )}
        </Card>
      )}

      {hasEx && (
        <Card className="p-5">
          <CardHeading kicker="Move more, feel better" title="Exercise recommendations" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-4">
            {[
              { label: 'Type',      value: exercisePlan.type        },
              { label: 'Duration',  value: exercisePlan.duration    },
              { label: 'Frequency', value: exercisePlan.frequency   },
              { label: 'Caution',   value: exercisePlan.precautions },
            ].filter(x => x.value).map(({ label, value }) => (
              <div
                key={label}
                className="rounded-xl p-3"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <div
                  className="text-[10px] font-bold uppercase tracking-wider mb-1"
                  style={{ color: '#0F4C81' }}
                >
                  {label}
                </div>
                <div className="text-[13px] font-semibold" style={{ color: '#0B1320' }}>{value}</div>
              </div>
            ))}
          </div>
          {exercisePlan.activities?.length > 0 && (
            <div>
              <Kicker className="block mb-2">Recommended activities</Kicker>
              <div className="flex flex-wrap gap-2">
                {exercisePlan.activities.map((a, i) => (
                  <span
                    key={i}
                    className="px-3 py-1.5 rounded-full text-[12px] font-medium"
                    style={{ background: 'rgba(0,194,255,0.08)', color: '#0E7490', border: '1px solid rgba(0,194,255,0.22)' }}
                  >
                    {a}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Recovery roadmap tab
   ═══════════════════════════════════════════════════════════════════════ */
const PHASES = [
  { key: 'week_1',  label: '7-Day plan',    short: '1W', color: '#0F4C81' },
  { key: 'month_1', label: '30-Day plan',   short: '1M', color: '#00C2FF' },
  { key: 'month_6', label: '6-Month plan',  short: '6M', color: '#FF9F43' },
  { key: 'year_1',  label: '1-Year plan',   short: '1Y', color: '#2ECC71' },
]

function RecoveryTab({ roadmap }) {
  if (!roadmap || Object.keys(roadmap).length === 0) {
    return <EmptyTab icon={FiClock} title="Recovery roadmap not available" desc="A multi-phase recovery plan will appear here once the AI engine analyzes your report." />
  }
  const phases = PHASES.filter(p => roadmap[p.key])
  return (
    <Card className="p-6">
      <CardHeading kicker="Your healing timeline" title="Recovery roadmap" />
      <div className="relative">
        <div className="absolute left-3 top-3 bottom-3 w-0.5" style={{ background: '#E6EEF5' }} />
        <div className="space-y-4">
          {phases.map((phase, idx) => {
            const data = roadmap[phase.key]
            return (
              <motion.div
                key={phase.key}
                initial={{ opacity: 0, x: -8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.1 }}
                className="relative pl-12"
              >
                <div
                  className="absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shadow"
                  style={{ background: phase.color }}
                >
                  {phase.short}
                </div>
                <Card className="p-4">
                  <h4 className="font-display font-bold text-[15px] mb-2" style={{ color: phase.color }}>
                    {phase.label}
                  </h4>
                  {data.goals?.length > 0 && (
                    <div className="mb-3">
                      <Kicker>Goals</Kicker>
                      <ul className="space-y-1 mt-1.5">
                        {data.goals.map((g, i) => (
                          <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: '#475569' }}>
                            <span style={{ color: '#94a3b8' }}>○</span> {g}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                  {data.actions?.length > 0 && (
                    <div>
                      <Kicker>Actions</Kicker>
                      <ul className="space-y-1 mt-1.5">
                        {data.actions.map((a, i) => (
                          <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: '#475569' }}>
                            <span style={{ color: phase.color }}>→</span> {a}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </Card>
              </motion.div>
            )
          })}
        </div>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Follow-up tab
   ═══════════════════════════════════════════════════════════════════════ */
function FollowUpTab({ followUp }) {
  if (!followUp || Object.keys(followUp).length === 0) {
    return <EmptyTab icon={FiCheckCircle} title="Follow-up plan not available" desc="The AI engine will recommend specialists and follow-up tests based on your report." />
  }
  const navigate = useNavigate()
  return (
    <div className="space-y-4">
      {followUp.specialists?.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(15,76,129,0.08)' }}
            >
              <FiUser size={16} style={{ color: '#0F4C81' }} />
            </div>
            <div>
              <Kicker>Who to see</Kicker>
              <h4 className="font-display font-bold text-[16px] mt-0.5" style={{ color: '#0B1320' }}>
                Recommended specialists
              </h4>
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            {followUp.specialists.map((s, i) => (
              <button
                key={i}
                onClick={() => navigate(`/doctors?specialty=${encodeURIComponent(s)}`)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12.5px] font-semibold transition-all hover:-translate-y-0.5"
                style={{
                  background: 'rgba(15,76,129,0.06)',
                  color: '#0F4C81',
                  border: '1px solid rgba(15,76,129,0.20)',
                }}
              >
                {s} <FiChevronRight size={11} />
              </button>
            ))}
          </div>
        </Card>
      )}

      {followUp.tests?.length > 0 && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-3">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(255,159,67,0.12)' }}
            >
              <FiActivity size={16} style={{ color: '#b86b14' }} />
            </div>
            <div>
              <Kicker>Worth rechecking</Kicker>
              <h4 className="font-display font-bold text-[16px] mt-0.5" style={{ color: '#0B1320' }}>
                Recommended follow-up tests
              </h4>
            </div>
          </div>
          <ul className="space-y-2">
            {followUp.tests.map((t, i) => (
              <li key={i} className="flex items-start gap-3 text-[13px]" style={{ color: '#475569' }}>
                <span
                  className="w-6 h-6 rounded-full flex items-center justify-center text-[10.5px] font-bold flex-shrink-0"
                  style={{ background: 'rgba(255,159,67,0.14)', color: '#b86b14' }}
                >
                  {i + 1}
                </span>
                {t}
              </li>
            ))}
          </ul>
        </Card>
      )}

      {followUp.timeline && (
        <Card className="p-5">
          <div className="flex items-center gap-3 mb-2">
            <div
              className="w-10 h-10 rounded-xl flex items-center justify-center"
              style={{ background: 'rgba(46,204,113,0.10)' }}
            >
              <FiClock size={16} style={{ color: '#1f9d55' }} />
            </div>
            <div>
              <Kicker>When to recheck</Kicker>
              <h4 className="font-display font-bold text-[16px] mt-0.5" style={{ color: '#0B1320' }}>
                Next checkup
              </h4>
            </div>
          </div>
          <p className="text-[13.5px] leading-relaxed ml-13" style={{ color: '#475569', marginLeft: 52 }}>
            {followUp.timeline}
          </p>
        </Card>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Empty tab placeholder
   ═══════════════════════════════════════════════════════════════════════ */
function EmptyTab({ icon: Icon, title, desc }) {
  return (
    <Card className="p-10 text-center">
      <div
        className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
        style={{ background: '#F8FBFD' }}
      >
        <Icon size={26} style={{ color: '#94a3b8' }} />
      </div>
      <h3 className="font-display font-bold text-[16px] mb-1.5" style={{ color: '#0B1320' }}>{title}</h3>
      <p className="text-[13px] max-w-md mx-auto" style={{ color: '#64748b' }}>{desc}</p>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */
export default function ReportAnalyzerPage() {
  const navigate = useNavigate()
  const toast    = useToast()

  const [file,            setFile]            = useState(null)
  const [result,          setResult]          = useState(null)
  const [loading,         setLoading]         = useState(false)
  const [step,            setStep]            = useState('upload')   // 'upload' | 'analyzing' | 'result'
  const [activeTab,       setActiveTab]       = useState('overview')
  const [processingStage, setProcessingStage] = useState(0)

  const onDrop = useCallback((accepted, rejected) => {
    if (rejected.length > 0) {
      toast.error('Invalid file. Please upload a PDF or image (max 10 MB).')
      return
    }
    if (accepted.length > 0) setFile(accepted[0])
  }, [toast])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: { 'application/pdf': [], 'image/jpeg': [], 'image/png': [], 'image/webp': [] },
    maxSize: 10 * 1024 * 1024,
    maxFiles: 1,
  })

  const handleAnalyze = async () => {
    if (!file) { toast.error('Please select a file first.'); return }
    setLoading(true)
    setStep('analyzing')
    setProcessingStage(0)
    const stageInterval = setInterval(() => {
      setProcessingStage(prev => Math.min(prev + 1, PROCESSING_STAGES.length - 1))
    }, 1500)
    try {
      const formData = new FormData()
      formData.append('file', file)
      const { data } = await mlAPI.analyzeReport(formData)
      setResult(data)
      setStep('result')
      setActiveTab('overview')
    } catch (err) {
      toast.error(err.message || 'Analysis failed. Please try again.')
      setStep('upload')
    } finally {
      clearInterval(stageInterval)
      setLoading(false)
    }
  }

  const reset = () => {
    setFile(null)
    setResult(null)
    setStep('upload')
    setActiveTab('overview')
    setProcessingStage(0)
  }

  const stats = useMemo(() => {
    if (!result) return { totalValues: 0, abnormalCount: 0, conditionCount: 0, medicineCount: 0 }
    return {
      totalValues:    result.lab_values?.length      || 0,
      abnormalCount:  result.abnormal_values?.length  || 0,
      conditionCount: result.conditions?.length       || 0,
      medicineCount:  result.medicines?.length        || 0,
    }
  }, [result])

  const reportTypeLabel = result ? REPORT_TYPE_LABELS[result.report_type] || 'Medical report' : ''

  /* Topbar copy adapts to step */
  const topbarKicker =
    step === 'upload'    ? 'Report analyzer'
    : step === 'analyzing' ? 'Analyzing your report'
    :                          `${reportTypeLabel} · ${new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
  const topbarTitle =
    step === 'upload'    ? 'Upload a report to begin'
    : step === 'analyzing' ? 'Reading your report carefully…'
    :                          'Your report, explained.'

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      <DashboardSidebar />

      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker={topbarKicker}
          title={topbarTitle}
          action={
            step === 'result' ? (
              <div className="hidden sm:flex items-center gap-2">
                <button
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                  style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
                >
                  <FiDownload size={13} /> Download summary
                </button>
                <button
                  onClick={() => navigate('/chat')}
                  className="inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-white font-semibold text-[13px] transition-all hover:-translate-y-0.5"
                  style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                >
                  <FiMessageSquare size={13} /> Ask about this
                </button>
              </div>
            ) : (
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(15,76,129,0.08)', color: '#0F4C81' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#2ECC71', animation: 'pulse 2s ease-in-out infinite' }}
                />
                OCR + AI Engine
              </span>
            )
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          <AnimatePresence mode="wait">
            {/* ─── UPLOAD ─── */}
            {step === 'upload' && (
              <motion.div
                key="upload"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
              >
                <UploadView
                  file={file}
                  setFile={setFile}
                  onAnalyze={handleAnalyze}
                  getRootProps={getRootProps}
                  getInputProps={getInputProps}
                  isDragActive={isDragActive}
                />
              </motion.div>
            )}

            {/* ─── ANALYZING ─── */}
            {step === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              >
                <AnalyzingView stage={processingStage} />
              </motion.div>
            )}

            {/* ─── RESULT ─── */}
            {step === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Hero verdict */}
                <HeroVerdictCard result={result} stats={stats} />

                {/* Tabs */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {TABS.map(t => {
                    const Icon = t.icon
                    const badge =
                      t.id === 'lab'        ? stats.totalValues :
                      t.id === 'conditions' ? stats.conditionCount :
                      t.id === 'medicines'  ? stats.medicineCount :
                      0
                    const isActive = activeTab === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all"
                        style={isActive ? {
                          background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
                          color: '#ffffff',
                        } : {
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #E6EEF5',
                        }}
                      >
                        <Icon size={13} /> {t.label}
                        {badge > 0 && (
                          <span
                            className="ml-1 px-1.5 py-0.5 rounded-full text-[10px] font-bold"
                            style={{
                              background: isActive ? 'rgba(255,255,255,0.2)' : 'rgba(15,76,129,0.10)',
                              color: isActive ? '#ffffff' : '#0F4C81',
                            }}
                          >
                            {badge}
                          </span>
                        )}
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'overview'   && <OverviewTab result={result} stats={stats} />}
                    {activeTab === 'lab'        && <LabValuesTab values={result.lab_values || []} />}
                    {activeTab === 'conditions' && <ConditionsTab conditions={result.conditions || []} abnormalValues={result.abnormal_values || []} />}
                    {activeTab === 'medicines'  && <MedicinesTab medicines={result.medicines || []} />}
                    {activeTab === 'guidance'   && <GuidanceTab dietPlan={result.diet_plan} exercisePlan={result.exercise_plan} />}
                    {activeTab === 'recovery'   && <RecoveryTab roadmap={result.recovery_roadmap} />}
                    {activeTab === 'followup'   && <FollowUpTab followUp={result.follow_up} />}
                  </motion.div>
                </AnimatePresence>

                {/* Raw OCR text */}
                {result.extracted_text && (
                  <details className="group">
                    <summary
                      className="cursor-pointer text-[12.5px] font-semibold inline-flex items-center gap-1.5 px-3.5 py-2 rounded-full transition-colors hover:bg-slate-50"
                      style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
                    >
                      <FiChevronRight size={12} className="group-open:rotate-90 transition-transform" />
                      View extracted OCR text
                    </summary>
                    <Card className="mt-2 p-4">
                      <pre
                        className="text-[11.5px] leading-relaxed font-mono overflow-x-auto whitespace-pre-wrap"
                        style={{ color: '#64748b' }}
                      >
                        {result.extracted_text}
                      </pre>
                    </Card>
                  </details>
                )}

                {/* Cross-module shortcuts */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Ask AI about results',  icon: '💬', onClick: () => navigate('/chat')  },
                    { label: 'Check drug interactions', icon: '💊', onClick: () => navigate('/drugs') },
                    { label: 'Analyze new report',     icon: '🔁', onClick: reset                       },
                  ].map(a => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className="text-center transition-all hover:-translate-y-0.5"
                    >
                      <Card className="p-4">
                        <div className="text-2xl mb-1.5">{a.icon}</div>
                        <div className="text-[12.5px] font-semibold" style={{ color: '#0B1320' }}>{a.label}</div>
                      </Card>
                    </button>
                  ))}
                </div>

                {/* Disclaimer */}
                <Card className="p-4" style={{ background: '#F8FBFD' }}>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: '#64748b' }}>
                    {result.disclaimer || 'AI-generated interpretation for informational purposes only. Always discuss your report and any concerns with a licensed medical professional.'}
                  </p>
                </Card>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>

      <MobileBottomNav />
    </div>
  )
}
