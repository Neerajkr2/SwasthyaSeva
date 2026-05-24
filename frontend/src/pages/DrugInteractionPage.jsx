// src/pages/DrugInteractionPage.jsx
/**
 * Drug Safety — premium clinical medication interaction checker.
 *
 * Structure (matches design reference):
 *   [Sidebar] [Topbar — "Drug safety" · "Check what mixes safely" · Import prescription]
 *             [content max-w-1280]
 *
 *   PRE-RESULT mode:
 *     1. Hero pitch
 *     2. Search-and-add bar (with autocomplete)
 *     3. "Your stack" chip row
 *     4. Example presets
 *     5. Primary CTA (Check interactions)
 *
 *   ANALYZING mode:
 *     Premium scanning animation
 *
 *   RESULT mode:
 *     Tabs (Overview · Drug-Drug · Food & Drink · Timing · Alternatives)
 *     Grid: tab content (left, 1.6fr) | sticky safety summary (right, 1fr)
 *
 * All visuals follow brand: Sora display · Plus Jakarta body · #0F4C81 blue
 *   · #00C2FF cyan · #2ECC71 green · #FF9F43 orange · #ef4444 danger.
 */
import { useState, useCallback, useMemo, useRef, useEffect, memo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiSearch, FiPlus, FiX, FiAlertTriangle, FiCheckCircle,
  FiInfo, FiRefreshCw, FiClock, FiShield, FiZap, FiCoffee,
  FiUpload, FiArrowRight, FiShare2,
} from 'react-icons/fi'
import { mlAPI } from '../services/api'
import { useToast } from '../context/ToastContext'

import AppTopBar        from '../components/dashboard/AppTopBar'
import { Card, Kicker } from '../components/dashboard/_primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   Config
   ═══════════════════════════════════════════════════════════════════════ */
const SEV = {
  contraindicated: { color: '#7c3aed', bg: 'rgba(124,58,237,0.10)', border: 'rgba(124,58,237,0.25)', label: 'Contraindicated', icon: '⛔' },
  major:           { color: '#ef4444', bg: 'rgba(239,68,68,0.10)',   border: 'rgba(239,68,68,0.25)',  label: 'Major',           icon: '🚨' },
  moderate:        { color: '#FF9F43', bg: 'rgba(255,159,67,0.12)',  border: 'rgba(255,159,67,0.30)', label: 'Moderate',        icon: '⚠️' },
  minor:           { color: '#2ECC71', bg: 'rgba(46,204,113,0.10)',   border: 'rgba(46,204,113,0.25)', label: 'Minor',           icon: '💛' },
}

const COMMON_DRUGS = [
  'Aspirin', 'Metformin', 'Atorvastatin', 'Amlodipine', 'Lisinopril',
  'Warfarin', 'Ibuprofen', 'Paracetamol', 'Omeprazole', 'Amoxicillin',
  'Ciprofloxacin', 'Metronidazole', 'Sertraline', 'Diazepam', 'Tramadol',
  'Ramipril', 'Atenolol', 'Furosemide', 'Prednisolone', 'Clopidogrel',
  'Levothyroxine', 'Doxycycline', 'Iron', 'Calcium', 'Simvastatin',
]

const EXAMPLES = [
  { label: 'Blood thinner risk',    drugs: ['Warfarin', 'Aspirin', 'Ibuprofen'], icon: '🩸' },
  { label: 'Antibiotic + alcohol',  drugs: ['Metronidazole', 'Alcohol'],         icon: '🍺' },
  { label: 'SSRI + MAOI (danger)',  drugs: ['Sertraline', 'Phenelzine'],         icon: '⚡' },
  { label: 'Statin + antibiotic',   drugs: ['Simvastatin', 'Clarithromycin'],     icon: '💊' },
  { label: 'Diabetes combo',        drugs: ['Metformin', 'Glibenclamide'],        icon: '🧬' },
  { label: 'Safe pair',             drugs: ['Paracetamol', 'Amoxicillin'],        icon: '✅' },
]

const TABS = [
  { id: 'overview',    label: 'Overview',    icon: FiShield   },
  { id: 'drugs',       label: 'Drug-Drug',    icon: FiZap      },
  { id: 'food',        label: 'Food & Drink', icon: FiCoffee   },
  { id: 'timing',      label: 'Timing',       icon: FiClock    },
  { id: 'alternatives',label: 'Alternatives', icon: FiRefreshCw },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Capsule icon (inline SVG — feels more clinical than the 💊 emoji)
   ═══════════════════════════════════════════════════════════════════════ */
const CapsuleIcon = memo(function CapsuleIcon({ size = 16, color = '#0F4C81' }) {
  return (
    <svg width={size} height={size} viewBox="0 0 20 20" fill="none" aria-hidden="true">
      <path
        d="M3 10 a5 5 0 0 1 5 -5 h4 a5 5 0 0 1 0 10 h-4 a5 5 0 0 1 -5 -5 z"
        fill={color}
        opacity="0.18"
      />
      <path
        d="M3 10 a5 5 0 0 1 5 -5 h2 v10 h-2 a5 5 0 0 1 -5 -5 z"
        fill={color}
        opacity="0.7"
      />
      <path
        d="M3 10 a5 5 0 0 1 5 -5 h4 a5 5 0 0 1 5 5 a5 5 0 0 1 -5 5 h-4 a5 5 0 0 1 -5 -5 z"
        stroke={color}
        strokeWidth="1.2"
        fill="none"
      />
    </svg>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Search + Add bar with autocomplete
   ═══════════════════════════════════════════════════════════════════════ */
function SearchAddBar({ onAdd, stack }) {
  const [query, setQuery] = useState('')
  const [focused, setFocused] = useState(false)
  const wrapRef = useRef(null)

  const suggestions = useMemo(() => {
    if (!query.trim()) return []
    const q = query.toLowerCase()
    const inStack = new Set(stack.map(s => s.toLowerCase()))
    return COMMON_DRUGS
      .filter(d => d.toLowerCase().includes(q) && !inStack.has(d.toLowerCase()))
      .slice(0, 8)
  }, [query, stack])

  useEffect(() => {
    if (!focused) return
    const handler = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setFocused(false) }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [focused])

  const handleAdd = (drug) => {
    const d = (drug ?? query).trim()
    if (!d) return
    if (stack.some(s => s.toLowerCase() === d.toLowerCase())) return
    onAdd(d)
    setQuery('')
  }

  return (
    <Card className="p-3 relative">
      <div className="flex items-center gap-2" ref={wrapRef}>
        <div className="relative flex-1">
          <FiSearch
            size={15}
            className="absolute left-3.5 top-1/2 -translate-y-1/2"
            style={{ color: '#94a3b8' }}
          />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onFocus={() => setFocused(true)}
            onKeyDown={e => e.key === 'Enter' && handleAdd()}
            placeholder="Add a medication, supplement, or food (e.g. grapefruit)"
            className="w-full pl-10 pr-4 py-2.5 text-[14px] rounded-xl outline-none transition-colors"
            style={{ background: '#F8FBFD', border: '1px solid #E6EEF5', color: '#0B1320' }}
          />

          {/* Autocomplete dropdown */}
          {focused && suggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 top-full mt-2 bg-white rounded-xl shadow-xl py-1.5 z-30 max-h-72 overflow-y-auto"
              style={{ border: '1px solid #E6EEF5' }}
            >
              {suggestions.map(d => (
                <button
                  key={d}
                  onClick={() => handleAdd(d)}
                  className="w-full flex items-center gap-2.5 px-4 py-2 text-left text-[13px] transition-colors hover:bg-slate-50"
                  style={{ color: '#0B1320' }}
                >
                  <CapsuleIcon size={14} color="#0F4C81" /> {d}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={() => handleAdd()}
          disabled={!query.trim()}
          className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl text-white font-semibold text-[13px] transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:transform-none"
          style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
        >
          <FiPlus size={13} /> Add
        </button>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   "Your stack" — pretty pill chips
   ═══════════════════════════════════════════════════════════════════════ */
const StackPill = memo(function StackPill({ drug, onRemove }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.92 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.92 }}
      transition={{ duration: 0.18 }}
      className="flex items-center gap-2.5 pl-2 pr-3 py-2 rounded-xl bg-white"
      style={{ border: '1px solid #E6EEF5', boxShadow: '0 1px 2px rgba(11,19,32,0.04)' }}
    >
      <div
        className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
        style={{ background: 'rgba(15,76,129,0.08)' }}
      >
        <CapsuleIcon size={14} color="#0F4C81" />
      </div>
      <div>
        <div className="text-[13px] font-semibold capitalize" style={{ color: '#0B1320' }}>{drug}</div>
        <div className="text-[10.5px]" style={{ color: '#94a3b8' }}>Tap to manage</div>
      </div>
      <button
        onClick={onRemove}
        aria-label={`Remove ${drug}`}
        className="ml-1 w-6 h-6 rounded-full flex items-center justify-center transition-colors hover:bg-slate-100"
        style={{ color: '#94a3b8' }}
      >
        <FiX size={13} />
      </button>
    </motion.div>
  )
})

function YourStack({ stack, onRemove, onClear }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <Kicker>Your stack · {stack.length} {stack.length === 1 ? 'item' : 'items'}</Kicker>
        {stack.length > 0 && (
          <button
            onClick={onClear}
            className="text-[11.5px] font-semibold transition-colors hover:underline"
            style={{ color: '#ef4444' }}
          >
            Clear all
          </button>
        )}
      </div>

      {stack.length === 0 ? (
        <div
          className="rounded-xl p-5 text-center"
          style={{ background: '#F8FBFD', border: '1px dashed #CBD5E1' }}
        >
          <CapsuleIcon size={28} color="#94a3b8" />
          <p className="text-[12.5px] mt-2" style={{ color: '#94a3b8' }}>
            Add at least <strong>2 medications</strong> to check for interactions.
          </p>
        </div>
      ) : (
        <div className="flex flex-wrap gap-2">
          <AnimatePresence>
            {stack.map((drug, i) => (
              <StackPill key={`${drug}-${i}`} drug={drug} onRemove={() => onRemove(i)} />
            ))}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Premium analyzing animation
   ═══════════════════════════════════════════════════════════════════════ */
function AnalyzingAnimation() {
  const stages = [
    { label: 'Matching drug names',         icon: '🔍' },
    { label: 'Checking drug-drug pairs',     icon: '⚡' },
    { label: 'Scanning food interactions',   icon: '🥗' },
    { label: 'Computing safety score',       icon: '🛡️' },
    { label: 'Generating recommendations',   icon: '📋' },
  ]
  return (
    <Card className="p-10">
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
              <CapsuleIcon size={32} color="#ffffff" />
            </motion.div>
          </div>
        </div>

        <Kicker className="mb-2">Clinical Rule Engine</Kicker>
        <h3 className="font-display text-[24px] font-bold mb-6" style={{ color: '#0B1320' }}>
          Analyzing your medication stack…
        </h3>

        <div className="w-full max-w-sm space-y-2">
          {stages.map((s, i) => (
            <motion.div
              key={s.label}
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.3 }}
              className="flex items-center gap-3 px-3.5 py-2 rounded-lg"
              style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
            >
              <span className="text-base">{s.icon}</span>
              <span className="flex-1 text-[12.5px] font-medium" style={{ color: '#475569' }}>
                {s.label}
              </span>
              <motion.div
                initial={{ scale: 0 }}
                animate={{ scale: 1 }}
                transition={{ delay: i * 0.3 + 0.45 }}
                style={{ color: '#2ECC71' }}
              >
                <FiCheckCircle size={14} />
              </motion.div>
            </motion.div>
          ))}
        </div>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Safety summary — sticky right rail
   ═══════════════════════════════════════════════════════════════════════ */
function SafetySummary({ result }) {
  const score = result.safety_score ?? 100
  const counts = result.severity_counts || {}
  const total = (counts.contraindicated || 0) + (counts.major || 0) + (counts.moderate || 0) + (counts.minor || 0)

  const scoreColor =
    score >= 80 ? '#2ECC71'
    : score >= 50 ? '#FF9F43'
    : '#ef4444'
  const scoreLabel =
    score >= 80 ? 'Safe'
    : score >= 50 ? 'Caution'
    : score >= 25 ? 'Risky'
    : 'Dangerous'

  return (
    <Card
      className="p-6 relative overflow-hidden sticky top-[100px]"
      style={{
        background: 'linear-gradient(135deg,#0F4C81 0%,#1a6db5 100%)',
        borderColor: 'transparent',
        color: '#ffffff',
      }}
    >
      {/* Soft cyan glow */}
      <div
        aria-hidden="true"
        className="absolute -right-16 -top-16 w-48 h-48 rounded-full"
        style={{ background: 'radial-gradient(circle,rgba(0,194,255,0.18),transparent 70%)' }}
      />

      <div className="relative">
        <Kicker style={{ color: 'rgba(255,255,255,0.55)' }}>Overall safety</Kicker>
        <div className="flex items-baseline gap-2 mt-2 mb-2">
          <span
            className="font-display tabular text-[52px] leading-none font-bold"
            style={{ color: scoreColor }}
          >
            {score}
          </span>
          <span className="text-[13px]" style={{ color: 'rgba(255,255,255,0.65)' }}>
            / 100 · {scoreLabel}
          </span>
        </div>

        {/* Progress bar */}
        <div
          className="h-2 rounded-full overflow-hidden mb-4"
          style={{ background: 'rgba(255,255,255,0.12)' }}
        >
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${score}%` }}
            transition={{ duration: 0.8 }}
            className="h-full rounded-full"
            style={{ background: scoreColor }}
          />
        </div>

        <p
          className="text-[12.5px] leading-relaxed mb-5"
          style={{ color: 'rgba(255,255,255,0.75)' }}
        >
          {result.summary || (total === 0
            ? 'No known interactions detected for this combination. Keep this list updated.'
            : 'Review the findings below carefully. Always consult your doctor before changing medications.'
          )}
        </p>

        {/* Severity breakdown */}
        {total > 0 && (
          <div className="space-y-2.5 pt-4 mb-5" style={{ borderTop: '1px solid rgba(255,255,255,0.10)' }}>
            {[
              { key: 'contraindicated', label: 'Contraindicated', color: '#c4b5fd' },
              { key: 'major',           label: 'Major',           color: '#fca5a5' },
              { key: 'moderate',        label: 'Moderate',        color: '#fcd34d' },
              { key: 'minor',           label: 'Minor',           color: '#86efac' },
            ].map(s => (counts[s.key] > 0) && (
              <div key={s.key} className="flex items-center justify-between text-[12px]">
                <span className="flex items-center gap-2" style={{ color: 'rgba(255,255,255,0.65)' }}>
                  <span className="w-1.5 h-1.5 rounded-full" style={{ background: s.color }} />
                  {s.label}
                </span>
                <span className="font-display tabular font-bold" style={{ color: '#ffffff' }}>
                  {counts[s.key]}
                </span>
              </div>
            ))}
          </div>
        )}

        <button
          className="w-full inline-flex items-center justify-center gap-2 py-2.5 rounded-lg text-[13px] font-semibold transition-all hover:-translate-y-0.5"
          style={{ background: '#FF9F43', color: '#ffffff' }}
        >
          <FiShare2 size={13} /> Share with my doctor
        </button>
      </div>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Result tabs — content
   ═══════════════════════════════════════════════════════════════════════ */
const FindingCard = memo(function FindingCard({ finding, delay = 0 }) {
  const cfg = SEV[finding.severity] || SEV.minor
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="overflow-hidden" style={{ borderLeft: `4px solid ${cfg.color}` }}>
        <div className="p-5 flex items-start gap-3.5">
          <div
            className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: cfg.bg, color: cfg.color }}
          >
            <FiAlertTriangle size={18} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <span
                className="text-[10.5px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full"
                style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
              >
                {cfg.icon} {cfg.label}
              </span>
              {finding.short && (
                <span className="text-[11.5px]" style={{ color: '#94a3b8' }}>
                  {finding.short}
                </span>
              )}
            </div>
            <h4
              className="font-display text-[18px] font-bold mb-2 leading-tight"
              style={{ color: '#0B1320' }}
            >
              <span className="capitalize">{finding.drug1}</span>
              <span className="mx-2" style={{ color: '#94a3b8' }}>+</span>
              <span className="capitalize">{finding.drug2}</span>
            </h4>
            <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: '#475569' }}>
              {finding.description}
            </p>

            {finding.mechanism && (
              <div
                className="flex items-start gap-2 px-3 py-2 rounded-lg mb-3"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
              >
                <FiInfo size={12} className="flex-shrink-0 mt-0.5" style={{ color: '#94a3b8' }} />
                <p className="text-[11.5px]" style={{ color: '#64748b' }}>
                  <strong style={{ color: '#0B1320' }}>How it happens:</strong> {finding.mechanism}
                </p>
              </div>
            )}

            {finding.action && (
              <div
                className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                style={{ background: cfg.bg, border: `1px solid ${cfg.border}` }}
              >
                <FiShield size={14} className="flex-shrink-0 mt-0.5" style={{ color: cfg.color }} />
                <div className="flex-1">
                  <div className="text-[11px] font-bold uppercase tracking-wider mb-0.5" style={{ color: cfg.color }}>
                    What to do
                  </div>
                  <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: '#0B1320' }}>
                    {finding.action}
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>
      </Card>
    </motion.div>
  )
})

function OverviewTab({ result }) {
  const findings = result.interactions || []
  const food = result.food_interactions || []

  return (
    <div className="space-y-4">
      <Card className="p-5">
        <Kicker>Your medications</Kicker>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 mt-3">
          {(result.drug_info || []).map((d, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04 }}
              className="flex items-center gap-2.5 p-2.5 rounded-xl"
              style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
            >
              <div
                className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(15,76,129,0.08)' }}
              >
                <CapsuleIcon size={14} color="#0F4C81" />
              </div>
              <div className="min-w-0">
                <div className="text-[12.5px] font-semibold truncate capitalize" style={{ color: '#0B1320' }}>{d.name}</div>
                <div className="text-[10.5px] truncate" style={{ color: '#94a3b8' }}>
                  {d.drug_class || d.category || '—'}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </Card>

      <div>
        <Kicker className="mb-3 block">Findings · {findings.length + food.length} {(findings.length + food.length) === 1 ? 'item' : 'items'}</Kicker>
        {findings.length + food.length === 0 ? (
          <Card className="p-8 text-center">
            <div
              className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-3"
              style={{ background: 'rgba(46,204,113,0.10)' }}
            >
              <FiCheckCircle size={28} style={{ color: '#2ECC71' }} />
            </div>
            <h3 className="font-display font-bold text-[16px] mb-1" style={{ color: '#0B1320' }}>
              No interactions detected
            </h3>
            <p className="text-[13px]" style={{ color: '#64748b' }}>
              This combination appears safe based on our clinical database. Always verify with your pharmacist.
            </p>
          </Card>
        ) : (
          <div className="space-y-3">
            {findings.map((f, i) => <FindingCard key={i} finding={f} delay={i * 0.06} />)}
            {food.slice(0, 2).map((f, i) => (
              <FindingCard
                key={`food-${i}`}
                finding={{
                  severity: f.severity,
                  drug1: f.drug,
                  drug2: f.food,
                  description: f.effect,
                  action: f.advice,
                  short: 'Food interaction',
                }}
                delay={(findings.length + i) * 0.06}
              />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function DrugDrugTab({ interactions }) {
  if (!interactions?.length) return <EmptyState icon={FiCheckCircle} title="No drug-drug interactions" desc="Your combination doesn't have known interactions in our clinical database." />
  return (
    <div className="space-y-3">
      <Kicker>{interactions.length} drug-drug interaction{interactions.length > 1 ? 's' : ''}</Kicker>
      {interactions.map((ix, i) => <FindingCard key={i} finding={ix} delay={i * 0.06} />)}
    </div>
  )
}

function FoodTab({ foodInteractions }) {
  if (!foodInteractions?.length) {
    return <EmptyState icon={FiCoffee} title="No food interactions" desc="No specific food-drug conflicts detected. Maintain a balanced diet and stay hydrated." />
  }
  return (
    <div className="space-y-3">
      <Kicker>{foodInteractions.length} food &amp; drink alert{foodInteractions.length > 1 ? 's' : ''}</Kicker>
      {foodInteractions.map((fx, i) => {
        const cfg = SEV[fx.severity] || SEV.minor
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.05 }}
          >
            <Card className="p-5">
              <div className="flex items-center gap-2 mb-3 flex-wrap">
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white capitalize"
                  style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                >
                  <CapsuleIcon size={11} color="#ffffff" /> {fx.drug}
                </span>
                <FiX size={11} style={{ color: '#94a3b8' }} />
                <span
                  className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold capitalize"
                  style={{ background: '#fff3e6', color: '#b86b14' }}
                >
                  🥗 {fx.food}
                </span>
                <span
                  className="ml-auto inline-flex items-center gap-1 text-[10.5px] font-bold px-2.5 py-1 rounded-full"
                  style={{ background: cfg.bg, color: cfg.color, border: `1px solid ${cfg.border}` }}
                >
                  {cfg.icon} {cfg.label}
                </span>
              </div>

              {fx.examples?.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mb-3">
                  {fx.examples.map(e => (
                    <span
                      key={e}
                      className="text-[10.5px] px-2 py-0.5 rounded-full"
                      style={{ background: '#fff3e6', color: '#b86b14', border: '1px solid #fcd34d' }}
                    >
                      {e}
                    </span>
                  ))}
                </div>
              )}

              <p className="text-[13.5px] leading-relaxed mb-3" style={{ color: '#475569' }}>
                {fx.effect}
              </p>

              <div
                className="flex items-start gap-2.5 px-3.5 py-2.5 rounded-xl"
                style={{ background: 'rgba(0,194,255,0.06)', border: '1px solid rgba(0,194,255,0.18)' }}
              >
                <FiInfo size={14} className="flex-shrink-0 mt-0.5" style={{ color: '#0E7490' }} />
                <p className="text-[12.5px] font-medium leading-relaxed" style={{ color: '#0B1320' }}>
                  {fx.advice}
                </p>
              </div>
            </Card>
          </motion.div>
        )
      })}
    </div>
  )
}

const TIMING_GROUPS = [
  { id: 'morning',  label: 'Morning · Before breakfast', icon: '🌅', match: ['morning', 'before breakfast'], color: '#FF9F43' },
  { id: 'food',     label: 'With food / meals',           icon: '🍽️', match: ['with food', 'with meal'],     color: '#2ECC71' },
  { id: 'evening',  label: 'Evening',                      icon: '🌙', match: ['evening'],                    color: '#0F4C81' },
  { id: 'other',    label: 'As prescribed',                icon: '💊', match: [],                              color: '#475569' },
]

function TimingTab({ timing }) {
  if (!timing?.length) {
    return <EmptyState icon={FiClock} title="No specific timing data" desc="As a general rule, follow your label or doctor's guidance." />
  }
  const grouped = TIMING_GROUPS.map(g => ({
    ...g,
    items: timing.filter(t => g.id === 'other'
      ? !TIMING_GROUPS.slice(0, 3).some(gg => gg.match.some(kw => t.when.toLowerCase().includes(kw)))
      : g.match.some(kw => t.when.toLowerCase().includes(kw))
    ),
  })).filter(g => g.items.length > 0)

  return (
    <div className="space-y-5">
      <Card className="p-4 flex items-start gap-3" style={{ background: 'rgba(0,194,255,0.05)' }}>
        <FiInfo size={14} className="flex-shrink-0 mt-1" style={{ color: '#0E7490' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#475569' }}>
          Taking medications at the right time improves effectiveness and reduces side effects.
          Set phone reminders for consistency.
        </p>
      </Card>

      {grouped.map(group => (
        <div key={group.id}>
          <div className="flex items-center gap-2.5 mb-3">
            <div
              className="w-8 h-8 rounded-lg flex items-center justify-center text-base flex-shrink-0"
              style={{ background: `${group.color}1a`, color: group.color }}
            >
              {group.icon}
            </div>
            <span className="font-display font-bold text-[15px]" style={{ color: '#0B1320' }}>
              {group.label}
            </span>
          </div>
          <div className="space-y-2 ml-11">
            {group.items.map((t, i) => (
              <motion.div
                key={`${t.drug}-${i}`}
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="rounded-xl p-3.5"
                style={{ background: '#fff', border: '1px solid #E6EEF5' }}
              >
                <div className="flex items-center justify-between mb-1 gap-2">
                  <span className="font-semibold text-[13.5px] capitalize" style={{ color: '#0B1320' }}>{t.drug}</span>
                  <span
                    className="text-[10.5px] font-semibold px-2 py-0.5 rounded-full"
                    style={{ background: `${group.color}1a`, color: group.color }}
                  >
                    {t.when}
                  </span>
                </div>
                <p className="text-[12px] leading-relaxed" style={{ color: '#64748b' }}>{t.detail}</p>
              </motion.div>
            ))}
          </div>
        </div>
      ))}
    </div>
  )
}

function AlternativesTab({ alternatives, interactionCount }) {
  const entries = Object.entries(alternatives || {})
  if (!entries.length) {
    return <EmptyState
      icon={FiRefreshCw}
      title={interactionCount ? 'No alternatives in database' : 'No alternatives needed'}
      desc={interactionCount
        ? "We don't have specific substitutes for these. Ask your doctor for safer options."
        : 'No interactions detected, so your current stack is already balanced.'
      }
    />
  }
  return (
    <div className="space-y-4">
      <Card className="p-4 flex items-start gap-3" style={{ background: 'rgba(255,159,67,0.08)' }}>
        <FiAlertTriangle size={14} className="flex-shrink-0 mt-1" style={{ color: '#b86b14' }} />
        <p className="text-[12.5px] leading-relaxed" style={{ color: '#475569' }}>
          <strong style={{ color: '#0B1320' }}>Never switch medications on your own.</strong> These
          are informational suggestions — always consult your prescribing doctor first.
        </p>
      </Card>

      {entries.map(([drug, alts], i) => (
        <motion.div
          key={drug}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: i * 0.06 }}
        >
          <Card className="p-5">
            <div className="flex items-center gap-2 mb-4">
              <span
                className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[12px] font-semibold text-white capitalize"
                style={{ background: '#ef4444' }}
              >
                <FiX size={11} /> {drug}
              </span>
              <FiArrowRight size={12} style={{ color: '#94a3b8' }} />
              <span className="text-[12px] font-semibold" style={{ color: '#1f9d55' }}>Consider these</span>
            </div>

            <div className="space-y-2">
              {alts.map((alt, j) => (
                <div
                  key={j}
                  className="flex items-start gap-3 p-3 rounded-xl"
                  style={{ background: 'rgba(46,204,113,0.06)', border: '1px solid rgba(46,204,113,0.20)' }}
                >
                  <div
                    className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
                    style={{ background: 'rgba(46,204,113,0.15)' }}
                  >
                    <FiCheckCircle size={13} style={{ color: '#1f9d55' }} />
                  </div>
                  <div className="min-w-0">
                    <div className="text-[13.5px] font-semibold capitalize" style={{ color: '#0B1320' }}>{alt.name}</div>
                    <div className="text-[11.5px] mt-0.5 leading-relaxed" style={{ color: '#64748b' }}>{alt.reason}</div>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </motion.div>
      ))}
    </div>
  )
}

function EmptyState({ icon: Icon, title, desc }) {
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
export default function DrugInteractionPage() {
  const toast = useToast()
  const [stack,        setStack]        = useState([])  // ['Warfarin','Aspirin',...]
  const [result,       setResult]       = useState(null)
  const [loading,      setLoading]      = useState(false)
  const [activeTab,    setActiveTab]    = useState('overview')

  const addDrug = useCallback((drug) => {
    setResult(null)
    setStack(prev => prev.length < 10 ? [...prev, drug] : prev)
  }, [])

  const removeDrug = useCallback((i) => {
    setResult(null)
    setStack(prev => prev.filter((_, idx) => idx !== i))
  }, [])

  const clearStack = useCallback(() => {
    setResult(null)
    setStack([])
  }, [])

  const loadExample = useCallback((ex) => {
    setResult(null)
    setActiveTab('overview')
    setStack(ex.drugs)
  }, [])

  const handleCheck = async () => {
    if (stack.length < 2) {
      toast.error('Please add at least 2 medications.')
      return
    }
    setResult(null)
    setActiveTab('overview')
    setLoading(true)
    try {
      const { data } = await mlAPI.checkDrugInteraction(stack)
      setResult(data)
    } catch (err) {
      toast.error(err.message || 'Check failed. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  const handleReset = () => {
    setResult(null)
    setStack([])
    setActiveTab('overview')
  }

  /* Badge counts for tabs */
  const ddCount = result?.interactions?.length || 0
  const fdCount = result?.food_interactions?.length || 0
  const tmCount = result?.timing_advice?.length || 0
  const altCount = Object.keys(result?.alternatives || {}).length

  const view =
    loading ? 'analyzing'
    : result ? 'result'
    : 'input'

  return (
    <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="Drug safety"
          title={
            view === 'input'     ? 'Check what mixes safely'
            : view === 'analyzing' ? 'Checking your stack…'
            :                          'Your interaction report'
          }
          action={
            view === 'result' ? (
              <button
                onClick={handleReset}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
              >
                <FiRefreshCw size={13} /> New check
              </button>
            ) : (
              <button
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
              >
                <FiUpload size={13} /> Import prescription
              </button>
            )
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          <AnimatePresence mode="wait">
            {/* ─── INPUT MODE ─── */}
            {view === 'input' && (
              <motion.div
                key="input"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="max-w-3xl mx-auto space-y-5"
              >
                {/* Search bar */}
                <SearchAddBar onAdd={addDrug} stack={stack} />

                {/* Examples */}
                <div>
                  <Kicker className="mb-2 block">Try an example</Kicker>
                  <div className="flex flex-wrap gap-2">
                    {EXAMPLES.map(ex => (
                      <button
                        key={ex.label}
                        onClick={() => loadExample(ex)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium transition-all hover:-translate-y-0.5"
                        style={{
                          background: '#fff',
                          border: '1px solid #E6EEF5',
                          color: '#475569',
                        }}
                      >
                        <span>{ex.icon}</span> {ex.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Stack */}
                <YourStack stack={stack} onRemove={removeDrug} onClear={clearStack} />

                {/* Common drugs */}
                <div>
                  <Kicker className="mb-2 block">Common medications</Kicker>
                  <div className="flex flex-wrap gap-1.5">
                    {COMMON_DRUGS.map(d => {
                      const disabled = stack.some(s => s.toLowerCase() === d.toLowerCase())
                      return (
                        <button
                          key={d}
                          onClick={() => addDrug(d)}
                          disabled={disabled || stack.length >= 10}
                          className="text-[11.5px] px-2.5 py-1 rounded-full transition-all disabled:opacity-40 disabled:cursor-not-allowed hover:-translate-y-0.5"
                          style={{
                            background: '#fff',
                            border: '1px solid #E6EEF5',
                            color: '#475569',
                          }}
                        >
                          {d}
                        </button>
                      )
                    })}
                  </div>
                </div>

                {/* CTA */}
                <button
                  onClick={handleCheck}
                  disabled={stack.length < 2}
                  className="w-full py-4 rounded-2xl text-white font-semibold text-[14.5px] transition-all hover:-translate-y-0.5 disabled:opacity-40 disabled:hover:transform-none inline-flex items-center justify-center gap-2.5"
                  style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                >
                  <FiShield size={16} /> Check {stack.length} medication{stack.length === 1 ? '' : 's'}
                </button>

                {/* Trust note */}
                <p className="text-center text-[11px]" style={{ color: '#94a3b8' }}>
                  Powered by a curated clinical rule engine. Informational use only —
                  always consult a pharmacist or doctor for medical decisions.
                </p>
              </motion.div>
            )}

            {/* ─── ANALYZING MODE ─── */}
            {view === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="max-w-2xl mx-auto"
              >
                <AnalyzingAnimation />
              </motion.div>
            )}

            {/* ─── RESULT MODE ─── */}
            {view === 'result' && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-[1.6fr_1fr] gap-5"
              >
                {/* LEFT: tabs + content */}
                <div className="min-w-0">
                  {/* Tabs */}
                  <div className="flex items-center gap-1.5 overflow-x-auto pb-1 mb-4">
                    {TABS.map(t => {
                      const Icon = t.icon
                      const badge =
                        t.id === 'drugs' ? ddCount :
                        t.id === 'food' ? fdCount :
                        t.id === 'timing' ? tmCount :
                        t.id === 'alternatives' ? altCount : 0
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
                      {activeTab === 'overview'     && <OverviewTab result={result} />}
                      {activeTab === 'drugs'        && <DrugDrugTab interactions={result.interactions} />}
                      {activeTab === 'food'         && <FoodTab foodInteractions={result.food_interactions} />}
                      {activeTab === 'timing'       && <TimingTab timing={result.timing_advice} />}
                      {activeTab === 'alternatives' && <AlternativesTab alternatives={result.alternatives} interactionCount={ddCount} />}
                    </motion.div>
                  </AnimatePresence>
                </div>

                {/* RIGHT: sticky safety summary */}
                <div className="hidden lg:block">
                  <SafetySummary result={result} />
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </main>
  )
}
