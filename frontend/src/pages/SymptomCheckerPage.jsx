// src/pages/SymptomCheckerPage.jsx
/**
 * Symptom Checker — premium redesign.
 *
 * Three modes (`step` state):
 *   1. 'chat'      — conversational input with a live analysis sidebar
 *   2. 'analyzing' — full-width AI scanning animation
 *   3. 'result'    — tabbed diagnostic dashboard (Severity, Conditions,
 *                    Self-care, Food, Recovery, Doctors)
 *
 * All visuals, typography, and interactions follow the SwasthyaSeva
 * design system (Sora display · Plus Jakarta body · #0F4C81 / #00C2FF /
 * #2ECC71 / #FF9F43 brand palette · rounded-2xl cards · soft hairline).
 */
import { useState, useRef, useEffect, memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FiAlertTriangle, FiZap, FiSend, FiHeart, FiActivity, FiShield,
  FiClock, FiUser, FiChevronRight, FiRefreshCw, FiMic,
} from 'react-icons/fi'
import { mlAPI } from '../services/api'
import { useToast } from '../context/ToastContext'

import DashboardSidebar from '../components/dashboard/DashboardSidebar'
import MobileBottomNav  from '../components/common/MobileBottomNav'
import AppTopBar        from '../components/dashboard/AppTopBar'
import { Card, CardHeading, Kicker } from '../components/dashboard/_primitives'

/* ═══════════════════════════════════════════════════════════════════════════
   Config
   ═══════════════════════════════════════════════════════════════════════ */
const URGENCY_CONFIG = {
  emergency: { color: '#ef4444', bg: 'rgba(239,68,68,0.08)',   border: 'rgba(239,68,68,0.25)',  label: 'Emergency',     tone: 'danger', icon: '🚨' },
  high:      { color: '#FF9F43', bg: 'rgba(255,159,67,0.10)',  border: 'rgba(255,159,67,0.30)', label: 'High priority', tone: 'warn',   icon: '⚠️' },
  medium:    { color: '#FF9F43', bg: 'rgba(255,159,67,0.06)',  border: 'rgba(255,159,67,0.20)', label: 'Moderate',       tone: 'warn',   icon: '💛' },
  low:       { color: '#2ECC71', bg: 'rgba(46,204,113,0.08)',   border: 'rgba(46,204,113,0.20)', label: 'Routine',        tone: 'good',   icon: '✅' },
}

const BODY_SYSTEM_ICONS = {
  Respiratory: '🫁', Cardiovascular: '🫀', Neurological: '🧠',
  Digestive: '🩺', Endocrine: '🧬', Urinary: '💧',
  Hematological: '🩸', Musculoskeletal: '🦴', 'Mental Health': '🧘',
  Immune: '🛡️', Skin: '🧴', Eyes: '👁️',
  Infectious: '🦠', General: '🩺',
}

const QUICK_SYMPTOMS = [
  'Fever with headache and body ache for 3 days',
  'Chest pain and shortness of breath when climbing stairs',
  'Burning sensation during urination with lower back pain',
  'Persistent cough for 2 weeks with mild fever at night',
  'Increased thirst, frequent urination, and fatigue',
  'Rash on skin with itching and swelling',
]

const RESULT_TABS = [
  { id: 'severity',   label: 'Severity',    icon: FiAlertTriangle },
  { id: 'conditions', label: 'Conditions',   icon: FiActivity      },
  { id: 'selfcare',   label: 'Self-care',    icon: FiShield        },
  { id: 'food',       label: 'Food',         icon: FiHeart         },
  { id: 'recovery',   label: 'Recovery',     icon: FiClock         },
  { id: 'doctors',    label: 'Doctors',      icon: FiUser          },
]

/* ═══════════════════════════════════════════════════════════════════════════
   Chat primitives
   ═══════════════════════════════════════════════════════════════════════ */
const AIAvatar = memo(function AIAvatar() {
  return (
    <div
      className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-[11px] font-bold"
      style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
    >
      AI
    </div>
  )
})

const ChatBubble = memo(function ChatBubble({ role, content, animate = true }) {
  const isUser = role === 'user'
  const Wrapper = animate ? motion.div : 'div'
  const props = animate ? {
    initial: { opacity: 0, y: 8 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.25 },
  } : {}
  return (
    <Wrapper {...props} className={`flex ${isUser ? 'justify-end' : 'gap-3'} mb-4`}>
      {!isUser && <AIAvatar />}
      <div
        className="max-w-[78%] rounded-2xl px-4 py-2.5 text-[14px] leading-relaxed"
        style={isUser ? {
          background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
          color: '#fff',
          borderTopRightRadius: 4,
        } : {
          background: '#F8FBFD',
          color: '#0B1320',
          border: '1px solid #E6EEF5',
          borderTopLeftRadius: 4,
        }}
      >
        {content}
      </div>
    </Wrapper>
  )
})

const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex gap-3 mb-4">
      <AIAvatar />
      <div
        className="rounded-2xl px-4 py-3 flex gap-1.5"
        style={{
          background: '#F8FBFD',
          border: '1px solid #E6EEF5',
          borderTopLeftRadius: 4,
        }}
      >
        {[0, 1, 2].map(i => (
          <span
            key={i}
            className="w-1.5 h-1.5 rounded-full"
            style={{
              background: '#0F4C81',
              animation: `bounceDot 1.4s ease-in-out infinite`,
              animationDelay: `${i * 0.18}s`,
            }}
          />
        ))}
      </div>
    </div>
  )
})

const QuickReplyChips = memo(function QuickReplyChips({ options, onSelect }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex flex-wrap gap-2 ml-12 mb-4"
    >
      {options.map((opt, i) => (
        <motion.button
          key={opt}
          initial={{ opacity: 0, scale: 0.92 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.05 }}
          onClick={() => onSelect(opt)}
          className="px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all hover:-translate-y-0.5"
          style={{
            background: 'rgba(15,76,129,0.06)',
            color: '#0F4C81',
            border: '1px solid rgba(15,76,129,0.18)',
          }}
        >
          {opt}
        </motion.button>
      ))}
    </motion.div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Severity meter — 4-segment gradient bar
   ═══════════════════════════════════════════════════════════════════════ */
const SeverityMeter = memo(function SeverityMeter({ urgency }) {
  const LEVELS = ['low', 'medium', 'high', 'emergency']
  const COLORS = { low: '#2ECC71', medium: '#FF9F43', high: '#FF9F43', emergency: '#ef4444' }
  const activeIdx = LEVELS.indexOf(urgency)
  return (
    <div>
      <div className="flex items-center gap-1.5 mb-2">
        {LEVELS.map((lvl, i) => (
          <motion.div
            key={lvl}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            transition={{ delay: i * 0.12, duration: 0.4 }}
            className="h-2.5 flex-1 rounded-full origin-left"
            style={{
              background: i <= activeIdx ? COLORS[lvl] : '#E6EEF5',
              opacity: i <= activeIdx ? 1 : 0.6,
            }}
          />
        ))}
      </div>
      <div
        className="flex justify-between text-[10px] font-medium"
        style={{ color: '#94a3b8' }}
      >
        <span>Low</span><span>Moderate</span><span>High</span><span>Emergency</span>
      </div>
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Body system badge
   ═══════════════════════════════════════════════════════════════════════ */
const BodySystemBadges = memo(function BodySystemBadges({ systems }) {
  if (!systems?.length) return null
  return (
    <div className="flex flex-wrap gap-2">
      {systems.map((sys, i) => (
        <motion.div
          key={sys}
          initial={{ opacity: 0, scale: 0.85 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: i * 0.07 }}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
          style={{ background: '#F8FBFD', border: '1px solid #E6EEF5' }}
        >
          <span className="text-base">{BODY_SYSTEM_ICONS[sys] || '🩺'}</span>
          <span className="text-[12px] font-semibold" style={{ color: '#0B1320' }}>{sys}</span>
        </motion.div>
      ))}
    </div>
  )
})

/* ═══════════════════════════════════════════════════════════════════════════
   Live analysis sidebar (during chat mode)
   ═══════════════════════════════════════════════════════════════════════ */
function LiveAnalysisSidebar({ symptomText, partialResult }) {
  const hasContent = symptomText.trim().length > 0
  const hasPartial = partialResult?.conditions?.length > 0

  return (
    <Card className="p-6 sticky top-[100px]">
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center gap-1.5">
          <span
            className="w-1.5 h-1.5 rounded-full"
            style={{ background: '#2ECC71', animation: 'pulse 2s ease-in-out infinite' }}
          />
          <Kicker style={{ color: '#0F4C81' }}>Live analysis</Kicker>
        </div>
      </div>

      {!hasContent && (
        <>
          <h3 className="font-display text-[18px] font-bold mb-2" style={{ color: '#0B1320' }}>
            Tell us what's bothering you.
          </h3>
          <p className="text-[13px] leading-relaxed mb-5" style={{ color: '#64748b' }}>
            We'll match your symptoms across <strong>14 body systems</strong> and 37 conditions in real time.
          </p>

          <Kicker className="block mb-3">What we check</Kicker>
          <div className="flex flex-wrap gap-2 mb-5">
            {['Respiratory','Cardiovascular','Neurological','Digestive','Endocrine','Skin'].map(s => (
              <span
                key={s}
                className="flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px]"
                style={{ background: '#F8FBFD', border: '1px solid #E6EEF5', color: '#475569' }}
              >
                <span>{BODY_SYSTEM_ICONS[s]}</span> {s}
              </span>
            ))}
          </div>

          <div
            className="rounded-xl p-3 flex items-start gap-2.5"
            style={{ background: 'rgba(46,204,113,0.08)', border: '1px solid rgba(46,204,113,0.20)' }}
          >
            <FiShield size={14} style={{ color: '#1f9d55', marginTop: 2 }} className="flex-shrink-0" />
            <p className="text-[11.5px] leading-relaxed" style={{ color: '#1f9d55' }}>
              <strong>Private & safe.</strong> Your descriptions are never shared with third parties.
            </p>
          </div>
        </>
      )}

      {hasContent && !hasPartial && (
        <>
          <h3 className="font-display text-[18px] font-bold mb-2" style={{ color: '#0B1320' }}>
            Listening for clues…
          </h3>
          <p className="text-[13px] leading-relaxed mb-4" style={{ color: '#64748b' }}>
            Keep going — the more detail you share (when it started, how it feels,
            what makes it better or worse), the more accurate our match.
          </p>

          <div className="space-y-2">
            {['Onset & duration', 'Intensity & quality', 'Associated symptoms', 'Triggers & relief'].map((tip, i) => (
              <div key={tip} className="flex items-center gap-2.5">
                <span
                  className="w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold flex-shrink-0"
                  style={{ background: 'rgba(15,76,129,0.10)', color: '#0F4C81' }}
                >
                  {i + 1}
                </span>
                <span className="text-[12.5px]" style={{ color: '#475569' }}>{tip}</span>
              </div>
            ))}
          </div>
        </>
      )}

      {hasPartial && (
        <>
          <h3 className="font-display text-[17px] font-bold leading-snug mb-4" style={{ color: '#0B1320' }}>
            Based on what you've shared so far, these conditions look most consistent.
          </h3>
          <div className="space-y-3">
            {partialResult.conditions.slice(0, 3).map((c, i) => {
              const pct = Math.round((c.score || 0) * 100)
              const color = i === 0 ? '#0F4C81' : i === 1 ? '#00C2FF' : '#94a3b8'
              return (
                <div
                  key={c.label}
                  className="p-3 rounded-xl"
                  style={{
                    background: i === 0 ? '#ffffff' : 'transparent',
                    border: '1px solid #E6EEF5',
                  }}
                >
                  <div className="flex items-baseline justify-between mb-1.5">
                    <div className="text-[13px] font-semibold truncate" style={{ color: '#0B1320' }}>
                      {c.label}
                    </div>
                    <div
                      className="font-display tabular text-[18px] font-bold leading-none ml-2"
                      style={{ color }}
                    >
                      {pct}
                      <span className="text-[10px] ml-0.5" style={{ color: '#94a3b8' }}>%</span>
                    </div>
                  </div>
                  <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${pct}%` }}
                      transition={{ duration: 0.6 }}
                      className="h-full rounded-full"
                      style={{ background: color }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </>
      )}
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Premium analyzing animation
   ═══════════════════════════════════════════════════════════════════════ */
function AnalyzingAnimation() {
  const systems = ['Neurological', 'Cardiovascular', 'Respiratory', 'Digestive', 'Endocrine', 'Urinary', 'Musculoskeletal', 'Immune']
  const [idx, setIdx] = useState(0)

  useEffect(() => {
    const id = setInterval(() => setIdx(i => (i + 1) % systems.length), 500)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center py-16">
      {/* Concentric scanning rings */}
      <div className="relative w-44 h-44 mb-8">
        <motion.div
          animate={{ scale: [1, 1.15, 1], opacity: [0.6, 0.2, 0.6] }}
          transition={{ duration: 2.4, repeat: Infinity }}
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid #0F4C81' }}
        />
        <motion.div
          animate={{ scale: [1, 1.3, 1], opacity: [0.4, 0.1, 0.4] }}
          transition={{ duration: 2.4, repeat: Infinity, delay: 0.4 }}
          className="absolute inset-0 rounded-full"
          style={{ border: '2px solid #00C2FF' }}
        />
        <div
          className="absolute inset-4 rounded-full flex items-center justify-center"
          style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: 'linear' }}
          >
            <FiActivity size={36} className="text-white" />
          </motion.div>
        </div>
      </div>

      <Kicker className="mb-2">AI Diagnostic Engine</Kicker>
      <h3
        className="font-display text-[26px] font-bold text-center mb-2"
        style={{ color: '#0B1320' }}
      >
        Analyzing your symptoms…
      </h3>
      <p className="text-sm mb-7 text-center max-w-md" style={{ color: '#64748b' }}>
        Cross-referencing across body systems and 37 conditions.
      </p>

      <div className="flex flex-wrap gap-2 justify-center max-w-md">
        {systems.map((sys, i) => (
          <motion.span
            key={sys}
            animate={{
              background: i === idx ? '#0F4C81' : '#F8FBFD',
              color:      i === idx ? '#ffffff' : '#64748b',
              borderColor: i === idx ? '#0F4C81' : '#E6EEF5',
              scale:      i === idx ? 1.05 : 1,
            }}
            transition={{ duration: 0.3 }}
            className="px-3 py-1.5 rounded-full text-[12px] font-semibold border"
          >
            {BODY_SYSTEM_ICONS[sys] || '🩺'} {sys}
          </motion.span>
        ))}
      </div>
    </div>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   Result tabs content
   ═══════════════════════════════════════════════════════════════════════ */
function SeverityTab({ result, urgencyCfg, allSymptomText }) {
  return (
    <div className="space-y-4">
      <Card className="p-6">
        <CardHeading kicker="Triage outcome" title="Severity assessment" />
        <SeverityMeter urgency={result.urgency} />
        <div
          className="mt-5 p-4 rounded-xl flex items-start gap-3"
          style={{ background: urgencyCfg.bg, border: `1px solid ${urgencyCfg.border}` }}
        >
          <span className="text-xl">{urgencyCfg.icon}</span>
          <p className="text-sm font-medium leading-relaxed" style={{ color: urgencyCfg.color }}>
            {result.recommendation}
          </p>
        </div>
      </Card>

      {result.body_systems?.length > 0 && (
        <Card className="p-6">
          <CardHeading kicker="Where it lives" title="Affected body systems" />
          <BodySystemBadges systems={result.body_systems} />
        </Card>
      )}

      <Card className="p-5 relative overflow-hidden">
        <div
          aria-hidden="true"
          className="absolute left-0 top-0 bottom-0 w-1"
          style={{ background: 'linear-gradient(180deg,#0F4C81,#00C2FF)' }}
        />
        <div className="pl-3">
          <Kicker>Your symptoms</Kicker>
          <p
            className="text-[14px] leading-relaxed italic mt-2"
            style={{ color: '#475569' }}
          >
            "{allSymptomText.trim()}"
          </p>
        </div>
      </Card>
    </div>
  )
}

function ConditionsTab({ result }) {
  return (
    <Card className="p-6">
      <CardHeading
        kicker="Ranked by AI confidence"
        title="Possible conditions"
      />
      <div className="space-y-4">
        {result.conditions.map((c, i) => {
          const pct = Math.round(c.score * 100)
          const color = pct > 70 ? '#0F4C81' : pct > 45 ? '#00C2FF' : '#94a3b8'
          return (
            <motion.div
              key={c.label}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.07 }}
            >
              <div className="flex items-center justify-between mb-1.5 flex-wrap gap-2">
                <div className="flex items-center gap-2 min-w-0">
                  {i === 0 && (
                    <span
                      className="text-[10px] font-bold px-2 py-0.5 rounded-full whitespace-nowrap"
                      style={{ background: 'rgba(15,76,129,0.10)', color: '#0F4C81' }}
                    >
                      Top match
                    </span>
                  )}
                  <span className="text-sm font-semibold truncate" style={{ color: '#0B1320' }}>
                    {c.label}
                  </span>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  <span className="text-[11px] flex items-center gap-1" style={{ color: '#94a3b8' }}>
                    {BODY_SYSTEM_ICONS[c.body_system] || '🩺'} {c.body_system}
                  </span>
                  <span
                    className="font-display tabular text-[16px] font-bold"
                    style={{ color }}
                  >
                    {pct}%
                  </span>
                </div>
              </div>
              <div className="h-2 rounded-full overflow-hidden" style={{ background: '#F1F5F9' }}>
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${pct}%` }}
                  transition={{ duration: 0.7, delay: i * 0.08 }}
                  className="h-full rounded-full"
                  style={{ background: color }}
                />
              </div>
            </motion.div>
          )
        })}
      </div>
    </Card>
  )
}

function SelfCareTab({ selfCare }) {
  if (!selfCare || Object.keys(selfCare).length === 0) {
    return <EmptyTab message="Self-care guidance not available for this analysis." />
  }
  return (
    <div className="space-y-4">
      {selfCare.immediate?.length > 0 && (
        <Card className="p-5">
          <h4 className="font-display text-[16px] font-bold mb-3 flex items-center gap-2" style={{ color: '#0F4C81' }}>
            <FiZap size={16} /> Immediate actions
          </h4>
          <ul className="space-y-2">
            {selfCare.immediate.map((a, i) => (
              <li key={i} className="text-[13.5px] flex items-start gap-2" style={{ color: '#475569' }}>
                <FiChevronRight size={14} className="mt-1 flex-shrink-0" style={{ color: '#0F4C81' }} /> {a}
              </li>
            ))}
          </ul>
        </Card>
      )}
      {selfCare.otc_meds?.length > 0 && (
        <Card className="p-5">
          <h4 className="font-display text-[16px] font-bold mb-3 flex items-center gap-2" style={{ color: '#0B1320' }}>
            <FiShield size={16} /> Over-the-counter options
          </h4>
          <ul className="space-y-2">
            {selfCare.otc_meds.map((m, i) => (
              <li key={i} className="text-[13.5px] flex items-start gap-2" style={{ color: '#475569' }}>
                <span className="mt-1 w-1 h-1 rounded-full flex-shrink-0" style={{ background: '#94a3b8' }} /> {m}
              </li>
            ))}
          </ul>
          <p className="text-[11px] mt-3 italic" style={{ color: '#94a3b8' }}>
            Always consult a pharmacist or doctor before taking medications.
          </p>
        </Card>
      )}
      {selfCare.warning_signs?.length > 0 && (
        <Card
          className="p-5"
          style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(239,68,68,0.04)' }}
        >
          <h4 className="font-display text-[16px] font-bold mb-3 flex items-center gap-2" style={{ color: '#ef4444' }}>
            <FiAlertTriangle size={16} /> Seek emergency care if
          </h4>
          <ul className="space-y-2">
            {selfCare.warning_signs.map((s, i) => (
              <li key={i} className="text-[13.5px] flex items-start gap-2" style={{ color: '#b8463a' }}>
                <FiAlertTriangle size={12} className="mt-1 flex-shrink-0" /> {s}
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}

function FoodTab({ foodGuidance }) {
  if (!foodGuidance || Object.keys(foodGuidance).length === 0) {
    return <EmptyTab message="Food guidance not available." />
  }
  return (
    <div className="space-y-4">
      <div className="grid md:grid-cols-2 gap-4">
        {foodGuidance.healing_foods?.length > 0 && (
          <Card
            className="p-5"
            style={{ borderColor: 'rgba(46,204,113,0.25)', background: 'rgba(46,204,113,0.04)' }}
          >
            <h4 className="font-display text-[15px] font-bold mb-3" style={{ color: '#1f9d55' }}>Recommended foods</h4>
            <ul className="space-y-1.5">
              {foodGuidance.healing_foods.map((f, i) => (
                <li key={i} className="text-[13px] flex items-start gap-2" style={{ color: '#1f9d55' }}>
                  ✓ {f}
                </li>
              ))}
            </ul>
          </Card>
        )}
        {foodGuidance.avoid_foods?.length > 0 && (
          <Card
            className="p-5"
            style={{ borderColor: 'rgba(239,68,68,0.20)', background: 'rgba(239,68,68,0.04)' }}
          >
            <h4 className="font-display text-[15px] font-bold mb-3" style={{ color: '#b8463a' }}>Foods to avoid</h4>
            <ul className="space-y-1.5">
              {foodGuidance.avoid_foods.map((f, i) => (
                <li key={i} className="text-[13px] flex items-start gap-2" style={{ color: '#b8463a' }}>
                  ✕ {f}
                </li>
              ))}
            </ul>
          </Card>
        )}
      </div>
      {foodGuidance.hydration && (
        <Card className="p-5" style={{ background: 'rgba(0,194,255,0.04)' }}>
          <h4 className="font-display text-[15px] font-bold mb-2 flex items-center gap-2" style={{ color: '#0E7490' }}>
            💧 Hydration
          </h4>
          <p className="text-[13px] leading-relaxed" style={{ color: '#475569' }}>
            {foodGuidance.hydration}
          </p>
        </Card>
      )}
    </div>
  )
}

function RecoveryTab({ recoveryPlan }) {
  if (!recoveryPlan || Object.keys(recoveryPlan).length === 0) {
    return <EmptyTab message="Recovery plan not available." />
  }
  const phases = [
    { key: 'week_1',  label: '7-Day plan',   color: '#0F4C81' },
    { key: 'month_1', label: '30-Day plan',  color: '#00C2FF' },
    { key: 'month_6', label: '6-Month plan', color: '#FF9F43' },
    { key: 'year_1',  label: '1-Year plan',  color: '#2ECC71' },
  ]
  return (
    <div className="relative">
      <div className="absolute left-3 top-3 bottom-3 w-0.5" style={{ background: '#E6EEF5' }} />
      <div className="space-y-4">
        {phases.map((phase, idx) => {
          const data = recoveryPlan[phase.key]
          if (!data) return null
          return (
            <motion.div
              key={phase.key}
              initial={{ opacity: 0, x: -12 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: idx * 0.1 }}
              className="relative pl-12"
            >
              <div
                className="absolute left-0 top-0 w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold shadow"
                style={{ background: phase.color }}
              >
                {idx + 1}
              </div>
              <Card className="p-4">
                <h4 className="font-display text-[15px] font-bold mb-2" style={{ color: phase.color }}>{phase.label}</h4>
                {data.goals?.length > 0 && (
                  <div className="mb-3">
                    <Kicker>Goals</Kicker>
                    <ul className="space-y-1 mt-1.5">
                      {data.goals.map((g, i) => (
                        <li key={i} className="text-[12.5px] flex items-start gap-2" style={{ color: '#475569' }}>
                          ○ {g}
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
  )
}

function DoctorsTab({ specialists, urgency }) {
  const navigate = useNavigate()
  if (!specialists?.length) return <EmptyTab message="No specialist recommendations available." />
  const urgencyCfg = URGENCY_CONFIG[urgency] || URGENCY_CONFIG.low
  const timing =
    urgency === 'emergency' ? 'Immediately — visit the ER now'
    : urgency === 'high'    ? 'Within 24 hours'
    : urgency === 'medium'  ? 'Within 1–2 days'
    :                          'Within 1 week if symptoms persist'

  return (
    <div className="space-y-4">
      <Card
        className="p-5"
        style={{ background: urgencyCfg.bg, borderColor: urgencyCfg.border }}
      >
        <Kicker style={{ color: urgencyCfg.color }}>When to see a doctor</Kicker>
        <p className="text-[15px] font-semibold mt-1.5" style={{ color: urgencyCfg.color }}>
          {timing}
        </p>
      </Card>
      <div className="grid md:grid-cols-2 gap-3">
        {specialists.map((spec, i) => (
          <motion.button
            key={spec}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.08 }}
            onClick={() => navigate(`/doctors?specialty=${encodeURIComponent(spec)}`)}
            className="text-left transition-all hover:-translate-y-0.5"
          >
            <Card className="p-4 flex items-center gap-3">
              <div
                className="w-11 h-11 rounded-full flex items-center justify-center flex-shrink-0"
                style={{ background: 'rgba(15,76,129,0.08)' }}
              >
                <FiUser size={18} style={{ color: '#0F4C81' }} />
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="font-semibold text-[13.5px] truncate" style={{ color: '#0B1320' }}>{spec}</h4>
                <p className="text-[11.5px]" style={{ color: '#94a3b8' }}>Recommended specialist</p>
              </div>
              <FiChevronRight size={15} style={{ color: '#94a3b8' }} />
            </Card>
          </motion.button>
        ))}
      </div>
      <p className="text-[11.5px]" style={{ color: '#94a3b8' }}>
        Tap a specialist to browse verified doctors in your area.
      </p>
    </div>
  )
}

function EmptyTab({ message }) {
  return (
    <Card className="p-10 text-center">
      <p className="text-[14px] font-medium" style={{ color: '#94a3b8' }}>{message}</p>
    </Card>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   MAIN PAGE
   ═══════════════════════════════════════════════════════════════════════ */
const INITIAL_MESSAGE = {
  role: 'assistant',
  content: "Hi! I'm your AI health assistant. What symptoms are you experiencing? Describe them in your own words — I'll match them across body systems and help you understand what's going on.",
}

export default function SymptomCheckerPage() {
  const navigate = useNavigate()
  const toast    = useToast()
  const chatEndRef = useRef(null)

  const [step,         setStep]         = useState('chat')        // 'chat' | 'analyzing' | 'result'
  const [messages,     setMessages]     = useState([INITIAL_MESSAGE])
  const [inputText,    setInputText]    = useState('')
  const [loading,      setLoading]      = useState(false)
  const [result,       setResult]       = useState(null)
  const [partialResult, setPartialResult] = useState(null)
  const [activeTab,    setActiveTab]    = useState('severity')
  const [allSymptomText, setAllSymptomText] = useState('')
  const [followUpQ,    setFollowUpQ]    = useState(null)
  const [followUpStep, setFollowUpStep] = useState(0)
  const [isTyping,     setIsTyping]     = useState(false)

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, isTyping])

  const addMessage = (role, content) => setMessages(prev => [...prev, { role, content }])

  const handleSend = async (text = inputText) => {
    const msg = text.trim()
    if (!msg) return

    addMessage('user', msg)
    setInputText('')

    const combined = allSymptomText + ' ' + msg
    setAllSymptomText(combined)

    if (followUpStep > 0 && followUpStep < 3 && followUpQ && followUpStep < followUpQ.length) {
      setIsTyping(true)
      setTimeout(() => {
        setIsTyping(false)
        const nextQ = followUpQ[followUpStep]
        addMessage('assistant', nextQ.question)
        setFollowUpStep(prev => prev + 1)
      }, 700)
      return
    }

    if (followUpStep >= 2 || combined.length > 60) {
      await runAnalysis(combined)
      return
    }

    if (msg.length >= 10) {
      setLoading(true)
      setIsTyping(true)

      setTimeout(async () => {
        try {
          const { data } = await mlAPI.analyzeSymptoms(msg)
          setIsTyping(false)
          setPartialResult(data)

          if (data.follow_up_questions?.length > 0) {
            setFollowUpQ(data.follow_up_questions)
            addMessage('assistant', data.follow_up_questions[0].question)
            setFollowUpStep(1)
            setResult(data)
          } else {
            setResult(data)
            setStep('result')
          }
        } catch (err) {
          setIsTyping(false)
          toast.error(err.message || 'Analysis failed. Please try again.')
        } finally {
          setLoading(false)
        }
      }, 500)
      return
    }

    setIsTyping(true)
    setTimeout(() => {
      setIsTyping(false)
      addMessage('assistant', "Could you describe your symptoms in more detail? Include how long you've had them, severity, and any other symptoms.")
    }, 600)
  }

  const runAnalysis = async (symptomText) => {
    setStep('analyzing')
    setLoading(true)
    try {
      const { data } = await mlAPI.analyzeSymptoms(symptomText)
      setResult(data)
      setTimeout(() => {
        setStep('result')
        setActiveTab('severity')
      }, 2600)
    } catch (err) {
      toast.error(err.message || 'Analysis failed. Please try again.')
      setStep('chat')
    } finally {
      setLoading(false)
    }
  }

  const handleQuickReply = (reply) => handleSend(reply)

  const handleAnalyzeNow = () => {
    if (allSymptomText.trim().length >= 10) {
      addMessage('user', '(Analyze my symptoms now)')
      runAnalysis(allSymptomText)
    }
  }

  const reset = () => {
    setStep('chat')
    setMessages([INITIAL_MESSAGE])
    setInputText('')
    setResult(null)
    setPartialResult(null)
    setAllSymptomText('')
    setFollowUpQ(null)
    setFollowUpStep(0)
    setActiveTab('severity')
  }

  const urgencyCfg = result ? (URGENCY_CONFIG[result.urgency] || URGENCY_CONFIG.low) : null

  return (
    <div className="flex min-h-screen" style={{ background: '#F8FBFD' }}>
      <DashboardSidebar />

      <main className="flex-1 min-h-screen flex flex-col overflow-x-hidden pb-20 lg:pb-0">
        <AppTopBar
          kicker="Symptom check"
          title={
            step === 'chat'      ? "Tell us what's bothering you"
            : step === 'analyzing' ? 'Analyzing your symptoms…'
            :                         'Your symptom analysis'
          }
          action={
            step === 'result' ? (
              <button
                onClick={reset}
                className="hidden sm:inline-flex items-center gap-2 px-4 py-2.5 rounded-full text-[13px] font-semibold transition-colors hover:bg-slate-50"
                style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#0B1320' }}
              >
                <FiRefreshCw size={13} /> New check
              </button>
            ) : (
              <span
                className="hidden sm:inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-bold uppercase tracking-wider"
                style={{ background: 'rgba(15,76,129,0.08)', color: '#0F4C81' }}
              >
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ background: '#2ECC71', animation: 'pulse 2s ease-in-out infinite' }}
                />
                AI Engine Active
              </span>
            )
          }
        />

        <div className="flex-1 p-6 lg:p-8 max-w-[1280px] w-full mx-auto">
          <AnimatePresence mode="wait">
            {/* ─── CHAT MODE ─── */}
            {step === 'chat' && (
              <motion.div
                key="chat"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-4"
              >
                {/* LEFT — chat conversation */}
                <div className="flex flex-col gap-4">
                  <Card className="p-6 flex-1 flex flex-col" style={{ minHeight: 480 }}>
                    <div className="flex-1 overflow-y-auto pr-1" style={{ maxHeight: 520 }}>
                      {messages.map((m, i) => (
                        <div key={i}>
                          <ChatBubble role={m.role} content={m.content} animate={i > 0} />
                          {m.role === 'assistant' && followUpQ && followUpStep > 0 && i === messages.length - 1 && (
                            <QuickReplyChips
                              options={followUpQ[Math.min(followUpStep - 1, followUpQ.length - 1)]?.quick_replies || []}
                              onSelect={handleQuickReply}
                            />
                          )}
                        </div>
                      ))}
                      {isTyping && <TypingIndicator />}
                      <div ref={chatEndRef} />
                    </div>

                    {/* Quick symptom examples — initial state only */}
                    {messages.length <= 1 && (
                      <div className="pt-3 border-t" style={{ borderColor: '#E6EEF5' }}>
                        <Kicker className="mb-2 block">Try an example</Kicker>
                        <div className="flex flex-wrap gap-2">
                          {QUICK_SYMPTOMS.map(s => (
                            <button
                              key={s}
                              onClick={() => setInputText(s)}
                              className="text-[12px] px-3 py-1.5 rounded-full transition-all hover:-translate-y-0.5"
                              style={{
                                background: '#F8FBFD',
                                border: '1px solid #E6EEF5',
                                color: '#475569',
                              }}
                            >
                              {s.length > 60 ? s.slice(0, 60) + '…' : s}
                            </button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Analyze-now CTA after follow-ups */}
                    {followUpStep >= 1 && allSymptomText.length >= 10 && (
                      <button
                        onClick={handleAnalyzeNow}
                        className="mt-4 w-full py-2.5 rounded-xl text-[13px] font-semibold flex items-center justify-center gap-2 transition-all hover:-translate-y-0.5"
                        style={{
                          background: 'rgba(15,76,129,0.06)',
                          border: '1px solid rgba(15,76,129,0.20)',
                          color: '#0F4C81',
                        }}
                      >
                        <FiZap size={14} /> Analyze my symptoms now
                      </button>
                    )}
                  </Card>

                  {/* Input bar */}
                  <Card className="p-3 flex items-center gap-2">
                    <input
                      type="text"
                      value={inputText}
                      onChange={e => setInputText(e.target.value)}
                      onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                      placeholder="Describe your symptoms — when, where, how it feels…"
                      disabled={loading}
                      className="flex-1 px-4 py-2.5 text-[14px] rounded-full outline-none transition-colors"
                      style={{
                        background: '#F8FBFD',
                        border: '1px solid #E6EEF5',
                        color: '#0B1320',
                      }}
                      onFocus={e => e.currentTarget.style.borderColor = '#0F4C81'}
                      onBlur={e => e.currentTarget.style.borderColor = '#E6EEF5'}
                    />
                    <button
                      aria-label="Voice input"
                      className="w-10 h-10 rounded-full flex items-center justify-center transition-colors hover:bg-slate-50"
                      style={{ background: '#fff', border: '1px solid #E6EEF5', color: '#475569' }}
                    >
                      <FiMic size={16} />
                    </button>
                    <button
                      onClick={() => handleSend()}
                      disabled={loading || !inputText.trim()}
                      aria-label="Send"
                      className="w-10 h-10 rounded-full flex items-center justify-center text-white disabled:opacity-40 transition-all hover:-translate-y-0.5"
                      style={{ background: 'linear-gradient(135deg,#0F4C81,#1a6db5)' }}
                    >
                      <FiSend size={16} />
                    </button>
                  </Card>

                  <p className="text-[10.5px] text-center" style={{ color: '#94a3b8' }}>
                    AI analysis for informational purposes only. Not a substitute for professional medical advice.
                  </p>
                </div>

                {/* RIGHT — sticky live analysis */}
                <div className="lg:block">
                  <LiveAnalysisSidebar symptomText={allSymptomText} partialResult={partialResult} />
                </div>
              </motion.div>
            )}

            {/* ─── ANALYZING MODE ─── */}
            {step === 'analyzing' && (
              <motion.div
                key="analyzing"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="flex justify-center"
              >
                <Card className="w-full max-w-2xl">
                  <AnalyzingAnimation />
                </Card>
              </motion.div>
            )}

            {/* ─── RESULT MODE ─── */}
            {step === 'result' && result && (
              <motion.div
                key="result"
                initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}
                className="space-y-4"
              >
                {/* Emergency banner */}
                {(result.urgency === 'emergency' || result.urgency === 'high') && (
                  <Card
                    className="p-5"
                    style={{ background: urgencyCfg.bg, borderColor: urgencyCfg.border }}
                  >
                    <div className="flex items-start gap-4">
                      <span className="text-3xl">{urgencyCfg.icon}</span>
                      <div className="flex-1">
                        <div className="font-display font-bold text-[18px] mb-1" style={{ color: urgencyCfg.color }}>
                          {urgencyCfg.label}
                        </div>
                        <p className="text-[13.5px] font-medium leading-relaxed" style={{ color: urgencyCfg.color }}>
                          {result.recommendation}
                        </p>
                        {result.urgency === 'emergency' && (
                          <a
                            href="tel:112"
                            className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-full text-white font-bold text-[13px]"
                            style={{ background: '#ef4444' }}
                          >
                            📞 Call emergency services (112)
                          </a>
                        )}
                      </div>
                    </div>
                  </Card>
                )}

                {/* Tab nav */}
                <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
                  {RESULT_TABS.map(t => {
                    const Icon = t.icon
                    const isActive = activeTab === t.id
                    return (
                      <button
                        key={t.id}
                        onClick={() => setActiveTab(t.id)}
                        className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-[13px] font-semibold whitespace-nowrap transition-all"
                        style={isActive ? {
                          background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
                          color: '#ffffff',
                        } : {
                          background: '#ffffff',
                          color: '#475569',
                          border: '1px solid #E6EEF5',
                        }}
                      >
                        <Icon size={14} /> {t.label}
                      </button>
                    )
                  })}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  <motion.div
                    key={activeTab}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.2 }}
                  >
                    {activeTab === 'severity'   && <SeverityTab result={result} urgencyCfg={urgencyCfg} allSymptomText={allSymptomText} />}
                    {activeTab === 'conditions' && <ConditionsTab result={result} />}
                    {activeTab === 'selfcare'   && <SelfCareTab selfCare={result.self_care} />}
                    {activeTab === 'food'       && <FoodTab foodGuidance={result.food_guidance} />}
                    {activeTab === 'recovery'   && <RecoveryTab recoveryPlan={result.recovery_plan} />}
                    {activeTab === 'doctors'    && <DoctorsTab specialists={result.specialists} urgency={result.urgency} />}
                  </motion.div>
                </AnimatePresence>

                {/* Bottom action row */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {[
                    { label: 'Ask AI',         icon: '💬', onClick: () => navigate('/chat')             },
                    { label: 'Upload report',  icon: '📋', onClick: () => navigate('/report-analyzer')  },
                    { label: 'New check',      icon: '🔁', onClick: reset                                 },
                  ].map(a => (
                    <button
                      key={a.label}
                      onClick={a.onClick}
                      className="text-center transition-all hover:-translate-y-0.5"
                    >
                      <Card className="p-4">
                        <div className="text-2xl mb-1">{a.icon}</div>
                        <div className="text-[12.5px] font-semibold" style={{ color: '#0B1320' }}>{a.label}</div>
                      </Card>
                    </button>
                  ))}
                </div>

                <Card className="p-4" style={{ background: '#F8FBFD' }}>
                  <p className="text-[11.5px] leading-relaxed" style={{ color: '#64748b' }}>
                    {result.disclaimer || 'This AI analysis is for informational purposes only and does not replace consultation with a qualified medical professional. Always seek medical advice for serious or persistent symptoms.'}
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
