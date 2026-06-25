// frontend/src/components/landing/Sections.jsx
import { memo, useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { FiChevronDown, FiCheck, FiStar, FiArrowRight } from 'react-icons/fi'
import { FaFacebookF, FaInstagram, FaLinkedinIn, FaYoutube } from 'react-icons/fa'
import { useAuth } from '../../hooks/useAuth'
import { LogoFullWhite, LogoIcon } from '../common/Logo'
import { Section, SectionHeading, fadeUp, popIn } from './_shared'

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 6 — Why Families Trust Us
   ═══════════════════════════════════════════════════════════════════════ */
const TRUST_BADGES = [
  { emoji: '👨‍⚕️', label: 'Doctors checked',     desc: 'Real doctors review what we tell you' },
  { emoji: '🔒', label: 'Your secret stays safe', desc: 'No one sees your info except you'   },
  { emoji: '🏥', label: 'Used by labs',           desc: 'Trusted by 50+ labs across India'    },
  { emoji: '✅', label: 'Free to sign up',         desc: 'No credit card. No tricks. Just help.' },
  { emoji: '❤️', label: 'Made for families',      desc: 'Parents, kids, grandparents welcome' },
]

const TrustBadgeCard = memo(function TrustBadgeCard({ badge, delay, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -4 }}
      className="flex flex-col items-center text-center p-5 rounded-2xl bg-white border border-brand-border transition-all duration-300"
      style={{ boxShadow: '0 4px 16px rgba(0,0,0,0.03)' }}
    >
      <div className="text-4xl mb-3" aria-hidden="true">{badge.emoji}</div>
      <h4 className="text-sm font-bold mb-1" style={{ color: '#0B1320' }}>{badge.label}</h4>
      <p className="text-xs text-slate-500 leading-relaxed">{badge.desc}</p>
    </motion.div>
  )
})

export function TrustBadges() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 })
  return (
    <Section innerRef={ref}>
      <SectionHeading
        eyebrow="🛡️ You're in safe hands"
        eyebrowColor="green"
        title="Why families trust us"
        subtitle="We take your health seriously. Here's our promise to you."
        inView={inView}
      />
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
        {TRUST_BADGES.map((b, i) => (
          <TrustBadgeCard key={b.label} badge={b} delay={i * 0.08} inView={inView} />
        ))}
      </div>
    </Section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 7 — Real Stories (Testimonials)
   ═══════════════════════════════════════════════════════════════════════ */
const TESTIMONIALS = [
  { name: 'Priya, 34',       role: 'Working mother',      avatar: '👩', bg: '#e8f0f8', quote: 'I caught my sugar problem 4 months before the doctor did. This app saved my health.', highlight: 'Caught diabetes early' },
  { name: 'Rohit, 45',       role: 'School teacher',      avatar: '👨', bg: '#e6f9ff', quote: 'For the first time, I actually understood my blood test. No more guessing!',          highlight: 'Finally understood my reports' },
  { name: 'Mrs. Sharma, 68', role: 'Grandmother of 3',    avatar: '👵', bg: '#e8f8ef', quote: 'Easy enough for me to use! I check my medicines every time before taking.',         highlight: 'Safe with my medicines' },
]

const TestimonialCard = memo(function TestimonialCard({ t, delay, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="bg-white rounded-3xl p-7 border border-brand-border transition-all duration-300 flex flex-col"
      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}
    >
      <div
        className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold mb-4 self-start"
        style={{ background: t.bg, color: '#0F4C81' }}
      >
        ✨ {t.highlight}
      </div>
      <p className="text-base leading-relaxed mb-5 flex-1" style={{ color: '#0B1320' }}>
        &ldquo;{t.quote}&rdquo;
      </p>
      <div className="flex gap-0.5 mb-4">
        {[1,2,3,4,5].map(s => (
          <FiStar key={s} size={14} className="text-amber-400 fill-amber-400" />
        ))}
      </div>
      <div className="flex items-center gap-3 pt-4 border-t border-brand-border">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-2xl"
          style={{ background: t.bg }}
        >
          {t.avatar}
        </div>
        <div>
          <div className="text-sm font-bold" style={{ color: '#0B1320' }}>{t.name}</div>
          <div className="text-xs text-slate-400">{t.role}</div>
        </div>
      </div>
    </motion.div>
  )
})

export function Testimonials() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <Section background="#F8FBFD" innerRef={ref}>
      <SectionHeading
        eyebrow="💛 Real people, real stories"
        eyebrowColor="orange"
        title="Stories that matter"
        subtitle="Hear from real users whose lives changed for the better."
        inView={inView}
      />
      <div className="grid md:grid-cols-3 gap-6">
        {TESTIMONIALS.map((t, i) => (
          <TestimonialCard key={t.name} t={t} delay={i * 0.15} inView={inView} />
        ))}
      </div>
    </Section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 8 — Animated Stats Counter
   ═══════════════════════════════════════════════════════════════════════ */
const AnimatedCounter = memo(function AnimatedCounter({ end, suffix = '', inView }) {
  const [count, setCount] = useState(0)
  const hasAnimated = useRef(false)

  useEffect(() => {
    if (!inView || hasAnimated.current) return
    hasAnimated.current = true
    const duration = 2000
    const steps = 60
    const increment = end / steps
    let current = 0
    const timer = setInterval(() => {
      current += increment
      if (current >= end) {
        setCount(end)
        clearInterval(timer)
      } else {
        setCount(Math.floor(current))
      }
    }, duration / steps)
    return () => clearInterval(timer)
  }, [inView, end])

  return <span>{count.toLocaleString()}{suffix}</span>
})

const STATS_ITEMS = [
  { emoji: '👨‍👩‍👧‍👦', value: 10000, suffix: '+', label: 'Happy families',     color: '#0F4C81', bg: '#e8f0f8' },
  { emoji: '📋',          value: 50000, suffix: '+', label: 'Reports explained',  color: '#2ECC71', bg: '#e8f8ef' },
  { emoji: '💊',          value: 125,   suffix: '+', label: 'Medicines checked',  color: '#FF9F43', bg: '#fff3e6' },
  { emoji: '⭐',          value: 98,    suffix: '%', label: 'Would recommend',    color: '#00C2FF', bg: '#e6f9ff' },
]

const StatCard = memo(function StatCard({ s, delay, inView }) {
  return (
    <motion.div
      {...popIn(delay)}
      animate={inView ? popIn(delay).animate : undefined}
      className="text-center py-6 px-3 sm:py-8 sm:px-4 rounded-3xl"
      style={{ background: s.bg }}
    >
      <div className="text-4xl sm:text-5xl mb-2 sm:mb-3" aria-hidden="true">{s.emoji}</div>
      <div className="text-2xl sm:text-4xl lg:text-5xl font-bold mb-1 sm:mb-2 font-display leading-none tabular-nums" style={{ color: s.color }}>
        <AnimatedCounter end={s.value} suffix={s.suffix} inView={inView} />
      </div>
      <div className="text-xs sm:text-sm font-medium" style={{ color: '#4a5568' }}>{s.label}</div>
    </motion.div>
  )
})

export function Stats() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.2 })
  return (
    <Section innerRef={ref} containerClassName="max-w-6xl">
      <SectionHeading
        title={<>Join thousands who feel <span style={{ color: '#0F4C81' }}>healthier &amp; happier</span></>}
        inView={inView}
      />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
        {STATS_ITEMS.map((s, i) => (
          <StatCard key={s.label} s={s} delay={i * 0.1} inView={inView} />
        ))}
      </div>
    </Section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 9 — Pricing
   ═══════════════════════════════════════════════════════════════════════ */
const PRICING_PLANS = [
  {
    name: 'Free', emoji: '🌱', price: '₹0', period: 'Always free',
    desc: 'Perfect to try it out',
    features: ['5 questions per month', 'Basic symptom check', 'Read 1 report a month', 'Use on any phone'],
    cta: 'Sign up free', popular: false,
  },
  {
    name: 'Family', emoji: '👨‍👩‍👧', price: '₹299', period: 'per month',
    desc: 'Best for whole families',
    features: ['Ask anything, anytime', 'Unlimited reports', 'Check all your medicines', 'Health forecast', 'Help in 24 hours', 'Easy account for elders'],
    cta: 'Try 7 days free', popular: true,
  },
  {
    name: 'Clinic', emoji: '🏥', price: '₹999', period: 'per month',
    desc: 'For doctors & clinics',
    features: ['Everything in Family', 'Manage many patients', 'Easy data sharing', 'Custom setup help', 'Direct phone support'],
    cta: 'Talk to us', popular: false,
  },
]

const PricingCard = memo(function PricingCard({ plan, delay, inView, onCTA }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      className={`relative flex flex-col rounded-3xl p-8 transition-all duration-300 bg-white ${
        plan.popular ? 'border-2 scale-[1.03] z-10' : 'border border-brand-border hover:shadow-lg'
      }`}
      style={plan.popular ? { borderColor: '#0F4C81', boxShadow: '0 20px 60px rgba(15,76,129,0.15)' } : {}}
    >
      {plan.popular && (
        <div className="absolute -top-4 left-1/2 -translate-x-1/2 whitespace-nowrap">
          <span
            className="inline-flex items-center gap-1 px-4 py-1.5 rounded-full text-white text-xs font-bold"
            style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
          >
            ⭐ Most loved
          </span>
        </div>
      )}
      <div className="text-5xl mb-4">{plan.emoji}</div>
      <h3 className="font-display text-2xl font-bold mb-1" style={{ color: '#0B1320' }}>{plan.name}</h3>
      <p className="text-sm text-slate-500 mb-6">{plan.desc}</p>
      <div className="mb-6 pb-6 border-b border-brand-border">
        <span className="font-display text-5xl font-bold" style={{ color: '#0F4C81' }}>{plan.price}</span>
        <div className="text-sm text-slate-400 mt-1">{plan.period}</div>
      </div>
      <ul className="flex-1 space-y-3 mb-8">
        {plan.features.map(f => (
          <li key={f} className="flex items-start gap-3 text-sm" style={{ color: '#0B1320' }}>
            <span className="mt-0.5 w-5 h-5 rounded-full bg-green-50 text-green-500 flex items-center justify-center flex-shrink-0">
              <FiCheck size={12} />
            </span>
            {f}
          </li>
        ))}
      </ul>
      <button
        onClick={onCTA}
        className={`w-full py-4 rounded-2xl font-bold text-base transition-all duration-200 hover:-translate-y-0.5 ${
          plan.popular ? 'text-white' : 'bg-white border-2 hover:bg-[#F8FBFD]'
        }`}
        style={plan.popular
          ? { background: 'linear-gradient(135deg,#0F4C81,#1a6db5)', boxShadow: '0 8px 20px rgba(15,76,129,0.25)' }
          : { borderColor: '#0F4C81', color: '#0F4C81' }
        }
      >
        {plan.cta} {plan.popular ? '→' : ''}
      </button>
    </motion.div>
  )
})

export function Pricing() {
  const { openAuthModal } = useAuth()
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <Section id="pricing" innerRef={ref} containerClassName="max-w-6xl">
      <SectionHeading
        eyebrow="💰 No hidden costs"
        eyebrowColor="green"
        title="Pick what works for you"
        subtitle="Sign up free, then upgrade anytime. Cancel whenever you want."
        inView={inView}
      />
      <div className="grid lg:grid-cols-3 gap-6 items-stretch">
        {PRICING_PLANS.map((plan, i) => (
          <PricingCard
            key={plan.name}
            plan={plan}
            delay={i * 0.12}
            inView={inView}
            onCTA={() => openAuthModal('signup')}
          />
        ))}
      </div>
      <p className="text-center text-slate-400 text-sm mt-10">
        💳 No credit card needed &middot; ✅ Cancel anytime &middot; 🔒 Money-back in 30 days
      </p>
    </Section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 10 — FAQ
   ═══════════════════════════════════════════════════════════════════════ */
const FAQ_ITEMS = [
  { q: 'Do I need to create an account?',         a: 'Yes — a free account is needed so we can keep your reports, chats, and health history safe and private. Signing up takes about 30 seconds with just your email or Google login. No credit card needed.' },
  { q: 'Will this work for my grandma?',          a: 'Yes! Our app is super easy to use. Big buttons, simple words, and clear pictures. Many seniors love it because it just makes sense. They can even type their question in Hindi or English.' },
  { q: 'Is it safe? Where does my info go?',      a: 'Your info is safe with us. Only you can see your reports. We use bank-level security to protect everything. We never sell your data — ever.' },
  { q: 'Does it replace going to a doctor?',      a: "No, we don't replace your doctor. Think of us as a helpful friend who explains things. For serious problems, always see a real doctor. We help you understand what's going on in the meantime." },
  { q: 'How much does it cost?',                  a: "The Free plan is free forever — sign up once and use it as long as you like. Want more features? Our Family plan is ₹299 per month with a 7-day free trial. No credit card needed to start." },
  { q: 'Can my whole family use one account?',    a: "Yes! Add up to 5 family members on the Family plan. Everyone gets their own private space. Perfect for parents, kids, and grandparents." },
  { q: 'Will the AI give me the wrong advice?',   a: "Real doctors check our system regularly. It's right about 98% of the time. But for anything serious, we always say 'please see a doctor' — your safety comes first." },
]

const FAQItem = memo(function FAQItem({ item, isOpen, onToggle, delay, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.4, delay, ease: [0.22, 1, 0.36, 1] }}
      className="bg-white border border-brand-border rounded-2xl overflow-hidden"
      style={{ boxShadow: '0 2px 8px rgba(0,0,0,0.02)' }}
    >
      <button
        className="w-full flex items-center justify-between px-6 py-5 text-left font-bold text-base hover:text-brand-blue transition-colors gap-3"
        style={{ color: '#0B1320' }}
        onClick={onToggle}
        aria-expanded={isOpen}
      >
        <span className="flex items-start gap-3">
          <span className="text-xl flex-shrink-0" aria-hidden="true">{isOpen ? '💭' : '💬'}</span>
          <span>{item.q}</span>
        </span>
        <FiChevronDown
          size={20}
          className={`flex-shrink-0 transition-transform duration-200 ${isOpen ? 'rotate-180' : ''}`}
          style={{ color: isOpen ? '#0F4C81' : '#94a3b8' }}
        />
      </button>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          transition={{ duration: 0.25 }}
          className="px-6 pb-5 pl-[60px] text-base text-slate-600 leading-relaxed"
        >
          {item.a}
        </motion.div>
      )}
    </motion.div>
  )
})

export function FAQ() {
  const [open, setOpen] = useState(null)
  const [ref, inView]   = useInView({ triggerOnce: true, threshold: 0.1 })
  return (
    <Section id="faq" background="#F8FBFD" innerRef={ref} containerClassName="max-w-3xl">
      <SectionHeading
        eyebrow="🤔 Got questions?"
        eyebrowColor="cyan"
        title="We've got answers"
        subtitle="Everything you want to know — in simple words."
        inView={inView}
      />
      <div className="space-y-3">
        {FAQ_ITEMS.map((item, i) => (
          <FAQItem
            key={i}
            item={item}
            isOpen={open === i}
            onToggle={() => setOpen(open === i ? null : i)}
            delay={i * 0.07}
            inView={inView}
          />
        ))}
      </div>
      <motion.div
        {...fadeUp(0.5)}
        animate={inView ? fadeUp(0.5).animate : undefined}
        className="text-center mt-10 p-6 bg-white rounded-2xl border border-brand-border"
      >
        <p className="text-base mb-3" style={{ color: '#0B1320' }}>
          <span className="text-2xl mr-2" aria-hidden="true">💌</span>
          <strong>Still have a question?</strong>
        </p>
        <p className="text-sm text-slate-500 mb-4">We&rsquo;re here to help &mdash; just ask!</p>
        <a
          href="mailto:hello@swasthyaseva.com"
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all hover:-translate-y-0.5"
          style={{ background: '#F8FBFD', border: '2px solid #0F4C81', color: '#0F4C81' }}
        >
          Send us a message
        </a>
      </motion.div>
    </Section>
  )
}

/* ═══════════════════════════════════════════════════════════════════════════
   SECTION 11 — Final CTA
   ═══════════════════════════════════════════════════════════════════════ */
export function CTA() {
  const { openAuthModal, isAuthenticated } = useAuth()
  const navigate = useNavigate()
  const handleClick = () => isAuthenticated ? navigate('/dashboard') : openAuthModal('signup')

  return (
    <section className="relative py-20 lg:py-28 overflow-hidden" style={{ background: 'linear-gradient(135deg,#0B1320,#0F4C81)' }}>
      <div className="absolute inset-0 pointer-events-none overflow-hidden" aria-hidden="true">
        <div className="absolute top-10 left-10 text-6xl opacity-10">❤️</div>
        <div className="absolute bottom-10 right-10 text-6xl opacity-10">🩺</div>
        <div className="absolute top-1/2 left-1/4 text-5xl opacity-10">✨</div>
        <div className="absolute top-1/3 right-1/4 text-5xl opacity-10">💚</div>
      </div>
      <div className="relative max-w-3xl mx-auto px-6 text-center">
        <motion.div initial={{ opacity: 0, y: 20 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true }} transition={{ duration: 0.6 }}>
          <div className="text-6xl mb-6" aria-hidden="true">🌟</div>
          <h2 className="font-display text-3xl sm:text-5xl font-bold text-white mb-5 leading-[1.1]">
            Your health is too important{' '}
            <span style={{ background: 'linear-gradient(135deg,#00C2FF,#2EC4B6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              to wait
            </span>
          </h2>
          <p className="text-blue-100/80 text-lg sm:text-xl mb-10 max-w-xl mx-auto leading-relaxed">
            Create your free account in 30 seconds. No credit card needed.
            Just your health questions and our friendly help.
          </p>
          <button
            onClick={handleClick}
            className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-full font-bold text-lg transition-all hover:-translate-y-1 active:scale-[0.98]"
            style={{ background: '#fff', color: '#0F4C81', boxShadow: '0 12px 40px rgba(0,0,0,0.3)' }}
          >
            Try now <FiArrowRight size={20} />
          </button>
          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 mt-8 text-sm text-blue-100/60">
            <span className="flex items-center gap-1.5"><span className="text-base">⚡</span> Free forever</span>
            <span className="flex items-center gap-1.5"><span className="text-base">⏱️</span> 30-second signup</span>
            <span className="flex items-center gap-1.5"><span className="text-base">💳</span> No credit card</span>
            <span className="flex items-center gap-1.5"><span className="text-base">🔒</span> 100% private</span>
          </div>
        </motion.div>
      </div>
    </section>
  )
}

export const Contact = () => null

/* ═══════════════════════════════════════════════════════════════════════════
   FOOTER — Premium, enterprise-grade layout
   ═══════════════════════════════════════════════════════════════════════ */
const FOOTER_PLATFORM = [
  { label: 'Symptom check',  path: '/symptoms'        },
  { label: 'Report help',    path: '/report-analyzer' },
  { label: 'Medicine safety', path: '/drugs'           },
  { label: 'Find a doctor',  path: '/doctors'         },
  { label: 'AI Chat',         path: '/chat'            },
]

const FOOTER_ABOUT = [
  { label: 'About us' },
  { label: 'Our story' },
  { label: 'Contact us' },
  { label: 'Help center' },
]

const FOOTER_LEGAL = [
  { label: 'Privacy promise' },
  { label: 'Terms of use' },
  { label: 'How we use data' },
]

const SOCIAL_LINKS = [
  { Icon: FaFacebookF,   label: 'Facebook',  href: '#' },
  { Icon: FaInstagram,   label: 'Instagram', href: '#' },
  { Icon: FaLinkedinIn,  label: 'LinkedIn',  href: '#' },
  { Icon: FaYoutube,     label: 'YouTube',   href: '#' },
]

const FooterColumn = memo(function FooterColumn({ heading, children }) {
  return (
    <div>
      <h4
        className="text-[11px] font-bold text-white uppercase tracking-[0.14em] mb-5"
        style={{ color: 'rgba(255,255,255,0.95)' }}
      >
        {heading}
      </h4>
      {children}
    </div>
  )
})

const FooterLink = memo(function FooterLink({ children, onClick, href }) {
  const className = 'text-blue-100/55 text-sm hover:text-white transition-colors text-left'
  if (onClick) {
    return <button onClick={onClick} className={className}>{children}</button>
  }
  return <a href={href || '#'} className={className}>{children}</a>
})

export function Footer() {
  const navigate = useNavigate()
  const { isAuthenticated, openAuthModal } = useAuth()
  const goTo = (path) => isAuthenticated ? navigate(path) : openAuthModal()

  return (
    <footer
      className="relative pt-20 pb-10"
      style={{ background: 'linear-gradient(180deg,#0B1320 0%,#070d16 100%)' }}
    >
      {/* Subtle top divider glow */}
      <div
        className="absolute top-0 left-0 right-0 h-px"
        style={{ background: 'linear-gradient(90deg,transparent,rgba(0,194,255,0.4),transparent)' }}
        aria-hidden="true"
      />

      <div className="max-w-7xl mx-auto px-6">
        {/* ── Top: Brand + Link Columns ─────────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 pb-12">
          {/* Brand block (spans wider on lg) */}
          <div className="lg:col-span-5">
            <button
              onClick={() => navigate('/')}
              className="block mb-5"
              aria-label="Back to SwasthyaSeva home"
            >
              <LogoFullWhite height={30} />
            </button>
            <p className="text-blue-100/55 text-sm leading-relaxed mb-6 max-w-sm">
              Making healthcare simple for every family. One question at a time —
              answered with care, clarity, and compassion.
            </p>

            {/* Newsletter inline */}
            <form
              onSubmit={(e) => { e.preventDefault() }}
              className="flex items-center gap-2 mb-6 max-w-sm"
              aria-label="Subscribe to health tips"
            >
              <input
                type="email"
                placeholder="Your email"
                aria-label="Email address"
                className="flex-1 bg-white/[0.04] border border-white/10 rounded-full px-4 py-2.5 text-sm text-white placeholder:text-blue-100/30 outline-none focus:border-cyan-400/50 transition"
              />
              <button
                type="submit"
                className="px-5 py-2.5 rounded-full text-sm font-semibold text-white transition-all hover:-translate-y-0.5 flex-shrink-0"
                style={{ background: 'linear-gradient(135deg,#0F4C81,#00C2FF)' }}
              >
                Subscribe
              </button>
            </form>

            {/* Social icons */}
            <div className="flex items-center gap-2.5">
              {SOCIAL_LINKS.map(({ Icon, label, href }) => (
                <a
                  key={label}
                  href={href}
                  aria-label={label}
                  className="w-9 h-9 rounded-full flex items-center justify-center text-blue-100/50 hover:text-white hover:bg-white/10 transition-all"
                  style={{ border: '1px solid rgba(255,255,255,0.08)' }}
                >
                  <Icon size={13} />
                </a>
              ))}
            </div>
          </div>

          {/* Link columns — perfectly aligned via grid */}
          <div className="lg:col-span-7 grid grid-cols-2 sm:grid-cols-3 gap-8">
            <FooterColumn heading="What we do">
              <ul className="space-y-3">
                {FOOTER_PLATFORM.map(l => (
                  <li key={l.label}>
                    <FooterLink onClick={() => goTo(l.path)}>{l.label}</FooterLink>
                  </li>
                ))}
              </ul>
            </FooterColumn>

            <FooterColumn heading="Company">
              <ul className="space-y-3">
                {FOOTER_ABOUT.map(l => (
                  <li key={l.label}><FooterLink>{l.label}</FooterLink></li>
                ))}
              </ul>
            </FooterColumn>

            <FooterColumn heading="Legal">
              <ul className="space-y-3">
                {FOOTER_LEGAL.map(l => (
                  <li key={l.label}><FooterLink>{l.label}</FooterLink></li>
                ))}
              </ul>
            </FooterColumn>
          </div>
        </div>

        {/* ── Middle divider ────────────────────────────────────────────── */}
        <div className="border-t border-white/[0.06]" />

        {/* ── Bottom: Copyright + Status + Contact ──────────────────────── */}
        <div className="pt-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-5">
          <div className="flex items-center gap-3 text-xs text-blue-100/40">
            <LogoIcon size={18} />
            <span>&copy; 2026 SwasthyaSeva</span>
            <span className="hidden sm:inline text-blue-100/20">•</span>
            <span className="hidden sm:inline">Made with ❤️ in India</span>
          </div>

          <div className="flex flex-wrap items-center gap-5 text-xs text-blue-100/40">
            {/* Status indicator */}
            <span className="flex items-center gap-2">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              All systems operational
            </span>
            <span className="hidden sm:inline text-blue-100/20">•</span>
            {/* Contact */}
            <a
              href="mailto:hello@swasthyaseva.com"
              className="hover:text-white transition-colors"
            >
              hello@swasthyaseva.com
            </a>
          </div>
        </div>
      </div>
    </footer>
  )
}
