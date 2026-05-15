// src/components/landing/Hero.jsx
import { memo } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { FiArrowRight, FiPlay, FiStar } from 'react-icons/fi'
import { useAuth } from '../../hooks/useAuth'
import { fadeUp } from './_shared'

/* ───────────────────────────────────────────────────────────────────────────
   Hero quick-action cards (data-driven, easy to maintain)
   ─────────────────────────────────────────────────────────────────────── */
const QUICK_ACTIONS = [
  { emoji: '🤒', label: 'I feel sick',           desc: 'Tell us what hurts',  color: '#0F4C81', bg: '#e8f0f8' },
  { emoji: '📋', label: 'Read my report',        desc: 'We explain it simply',color: '#2ECC71', bg: '#e8f8ef' },
  { emoji: '💊', label: 'Check my medicine',     desc: 'Safe to take?',       color: '#FF9F43', bg: '#fff3e6' },
]

const TRUST_INDICATORS = [
  { emoji: '⚡', strong: 'Free to create an account',  rest: '— no credit card needed.' },
  { emoji: '⏱️', strong: 'Sign up in 30 seconds',      rest: '— just your email.'       },
  { emoji: '🔒', strong: '100% private',                rest: '— your data stays yours.' },
]

const SOCIAL_AVATARS = [
  { emoji: '👩',   bg: '#e8f0f8' },
  { emoji: '👨',   bg: '#e6f9ff' },
  { emoji: '👵',   bg: '#e8f8ef' },
  { emoji: '👨‍⚕️', bg: '#fff3e6' },
]

/* ───────────────────────────────────────────────────────────────────────────
   Friendly mockup — phone-like preview of the product
   ─────────────────────────────────────────────────────────────────────── */
const FriendlyMockup = memo(function FriendlyMockup() {
  return (
    <div className="relative">
      {/* Floating "Safe to take" chip */}
      <motion.div
        animate={{ y: [0, -10, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        className="absolute -top-5 -left-5 bg-white rounded-2xl px-4 py-2.5 shadow-xl border border-brand-border z-20 hidden sm:flex items-center gap-2.5"
      >
        <span className="text-2xl">💊</span>
        <div>
          <div className="text-[11px] font-bold text-brand-green leading-tight">Safe to take</div>
          <div className="text-[10px] text-slate-400 leading-tight">No bad mix</div>
        </div>
      </motion.div>

      {/* Floating "All clear" chip */}
      <motion.div
        animate={{ y: [0, 10, 0] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1.5 }}
        className="absolute -bottom-4 -right-3 bg-white rounded-2xl px-4 py-2.5 shadow-xl border border-brand-border z-20 hidden sm:flex items-center gap-2.5"
      >
        <span className="text-2xl">❤️</span>
        <div>
          <div className="text-[11px] font-bold text-brand-blue leading-tight">All clear!</div>
          <div className="text-[10px] text-slate-400 leading-tight">Heart healthy</div>
        </div>
      </motion.div>

      {/* Main mockup */}
      <div
        className="bg-white rounded-[2rem] p-2 border border-brand-border"
        style={{ boxShadow: '0 30px 80px rgba(15,76,129,0.15)' }}
      >
        <div className="bg-gradient-to-br from-[#F8FBFD] to-[#e8f0f8] rounded-[1.65rem] p-6 min-h-[480px]">
          {/* Greeting */}
          <div className="flex items-center gap-3 mb-6">
            <div
              className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
              style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
            >
              👋
            </div>
            <div>
              <div className="text-xs text-slate-400 font-medium">Hi Neeraj,</div>
              <div className="font-display font-bold text-brand-text text-base">How can we help today?</div>
            </div>
          </div>

          {/* Big friendly action rows */}
          <div className="space-y-2.5 mb-5">
            {QUICK_ACTIONS.map((a, i) => (
              <motion.div
                key={a.label}
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.5 + i * 0.15 }}
                className="bg-white rounded-2xl p-3.5 flex items-center gap-3 shadow-sm border border-brand-border/60"
              >
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center text-2xl flex-shrink-0"
                  style={{ background: a.bg }}
                >
                  {a.emoji}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-bold text-sm truncate" style={{ color: a.color }}>{a.label}</div>
                  <div className="text-[11px] text-slate-400 truncate">{a.desc}</div>
                </div>
                <FiArrowRight size={14} className="text-slate-300 flex-shrink-0" />
              </motion.div>
            ))}
          </div>

          {/* AI message card */}
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 1.1 }}
            className="bg-white rounded-2xl p-4 shadow-sm border border-brand-border/60"
          >
            <div className="flex items-start gap-3">
              <div
                className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0 text-white text-sm font-bold"
                style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
              >
                AI
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-xs font-bold text-brand-text mb-1">Your Health Friend</div>
                <div className="text-xs text-slate-500 leading-relaxed">
                  Hi! Ask me anything — no question is too small.
                </div>
                <div className="flex items-center gap-1.5 mt-2">
                  <div className="w-1.5 h-1.5 rounded-full bg-brand-green animate-pulse" />
                  <span className="text-[10px] text-brand-green font-semibold">Online &amp; ready</span>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      </div>
    </div>
  )
})

/* ───────────────────────────────────────────────────────────────────────────
   Main Hero
   ─────────────────────────────────────────────────────────────────────── */
export default function Hero() {
  const { isAuthenticated, openAuthModal } = useAuth()
  const navigate = useNavigate()

  const handlePrimaryCTA = () =>
    isAuthenticated ? navigate('/symptoms') : openAuthModal('signup')

  const handleSecondaryCTA = () =>
    document.getElementById('how-it-works')?.scrollIntoView({ behavior: 'smooth' })

  return (
    <section className="relative overflow-hidden" style={{ background: '#F8FBFD' }}>
      {/* Soft background bloom */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div
          className="absolute -top-40 -right-40 w-[600px] h-[600px] rounded-full opacity-[0.05]"
          style={{ background: 'radial-gradient(circle,#0F4C81,transparent)' }}
        />
        <div
          className="absolute bottom-0 left-0 w-[400px] h-[400px] rounded-full opacity-[0.04]"
          style={{ background: 'radial-gradient(circle,#00C2FF,transparent)' }}
        />
      </div>

      <div className="relative max-w-7xl mx-auto px-6 pt-16 lg:pt-24 pb-20 lg:pb-28 w-full">
        <div className="grid lg:grid-cols-[1.05fr_1fr] gap-10 lg:gap-20 items-center">

          {/* ── Left Column — Content ─────────────────────────────────── */}
          <div className="max-w-[640px]">
            {/* Trust pill — single line, tight */}
            <motion.div
              {...fadeUp(0.05)}
              className="inline-flex items-center gap-2.5 px-4 py-2 rounded-full mb-7 bg-white"
              style={{
                border: '1px solid #E6EEF5',
                boxShadow: '0 2px 8px rgba(15,76,129,0.05)',
              }}
            >
              <span className="text-base" aria-hidden="true">👨‍⚕️</span>
              <span className="text-[13px] font-semibold" style={{ color: '#0F4C81' }}>
                Reviewed by real doctors
              </span>
              <span className="w-1 h-1 rounded-full bg-slate-300" aria-hidden="true" />
              <span className="text-[13px] text-slate-500">10,000+ families trust us</span>
            </motion.div>

            {/* Headline — clean forced line breaks, balanced rhythm */}
            <motion.h1
              {...fadeUp(0.12)}
              className="font-display font-bold mb-6"
              style={{
                color: '#0B1320',
                letterSpacing: '-0.025em',
                fontSize: 'clamp(2.5rem, 5vw, 4rem)',
                lineHeight: 1.05,
              }}
            >
              <span className="block">Understand your health.</span>
              <span
                className="block mt-1"
                style={{
                  background: 'linear-gradient(135deg,#0F4C81 0%,#00C2FF 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                }}
              >
                In simple words.
              </span>
            </motion.h1>

            {/* Subhead — tighter measure for readability */}
            <motion.p
              {...fadeUp(0.18)}
              className="text-lg leading-[1.65] mb-10 max-w-[520px]"
              style={{ color: '#4a5568' }}
            >
              Feeling unwell? Confused by a report? Worried about a medicine?
              Just ask. We&rsquo;ll explain it like a friend would — in plain English.
            </motion.p>

            {/* CTAs — equal visual weight, polished */}
            <motion.div {...fadeUp(0.24)} className="flex flex-wrap items-center gap-3 mb-10">
              <button
                onClick={handlePrimaryCTA}
                className="group inline-flex items-center gap-2.5 px-7 py-4 rounded-full text-white font-semibold text-[15px] transition-all duration-300 hover:-translate-y-0.5 active:scale-[0.98]"
                style={{
                  background: 'linear-gradient(135deg,#0F4C81,#1a6db5)',
                  boxShadow: '0 12px 28px rgba(15,76,129,0.28)',
                }}
              >
                Try now
                <FiArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
              </button>
              <button
                onClick={handleSecondaryCTA}
                className="inline-flex items-center gap-2.5 px-6 py-4 rounded-full font-semibold text-[15px] transition-all duration-300 hover:-translate-y-0.5 bg-white"
                style={{ border: '1.5px solid #E6EEF5', color: '#0B1320' }}
              >
                <span
                  className="w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0"
                  style={{ background: '#e8f0f8' }}
                >
                  <FiPlay size={12} className="text-brand-blue fill-brand-blue ml-0.5" />
                </span>
                See how it works
              </button>
            </motion.div>

            {/* Trust indicators — tight rhythm, consistent baseline */}
            <motion.ul {...fadeUp(0.3)} className="space-y-2.5 mb-8">
              {TRUST_INDICATORS.map(item => (
                <li key={item.strong} className="flex items-center gap-3 text-[15px]" style={{ color: '#4a5568' }}>
                  <span className="text-lg leading-none flex-shrink-0 w-5 text-center" aria-hidden="true">
                    {item.emoji}
                  </span>
                  <span>
                    <strong className="text-brand-text font-semibold">{item.strong}</strong>{' '}
                    {item.rest}
                  </span>
                </li>
              ))}
            </motion.ul>

            {/* Social proof — anchored at bottom of column */}
            <motion.div
              {...fadeUp(0.36)}
              className="flex items-center gap-4 pt-6 border-t"
              style={{ borderColor: '#E6EEF5' }}
            >
              <div className="flex -space-x-2">
                {SOCIAL_AVATARS.map((a, i) => (
                  <div
                    key={i}
                    className="w-10 h-10 rounded-full border-2 border-white flex items-center justify-center text-lg shadow-sm"
                    style={{ background: a.bg }}
                  >
                    {a.emoji}
                  </div>
                ))}
              </div>
              <div className="leading-tight">
                <div className="flex items-center gap-1 mb-0.5">
                  {[1,2,3,4,5].map(i => (
                    <FiStar key={i} size={13} className="text-amber-400 fill-amber-400" />
                  ))}
                  <span className="text-sm font-bold text-brand-text ml-1.5">4.9</span>
                </div>
                <div className="text-xs text-slate-500">
                  Loved by <strong className="text-brand-text">10,000+ families</strong> across India
                </div>
              </div>
            </motion.div>
          </div>

          {/* ── Right Column — Mockup ─────────────────────────────────── */}
          <motion.div
            initial={{ opacity: 0, y: 32 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.9, delay: 0.3, ease: [0.22, 1, 0.36, 1] }}
            className="hidden lg:block"
          >
            <FriendlyMockup />
          </motion.div>
        </div>
      </div>
    </section>
  )
}
