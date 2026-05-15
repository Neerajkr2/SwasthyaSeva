// src/components/landing/HowItWorks.jsx
import { memo } from 'react'
import { motion } from 'framer-motion'
import { useInView } from 'react-intersection-observer'
import { Section, SectionHeading, fadeUp } from './_shared'

/* ───────────────────────────────────────────────────────────────────────────
   Data
   ─────────────────────────────────────────────────────────────────────── */
const SCENARIOS = [
  {
    emoji: '🤔',
    situation: 'Have a headache for 3 days?',
    thought: '"Should I worry?"',
    solution: 'Tell us. We&rsquo;ll explain what it could be.',
    color: '#0F4C81',
    bg: '#e8f0f8',
  },
  {
    emoji: '😰',
    situation: 'Got a blood test report?',
    thought: '"What do these numbers mean?"',
    solution: 'Show us. We&rsquo;ll read it for you &mdash; simply.',
    color: '#2ECC71',
    bg: '#e8f8ef',
  },
  {
    emoji: '💊',
    situation: 'Taking 2 different medicines?',
    thought: '"Is it safe together?"',
    solution: 'Just ask. We&rsquo;ll warn you if it&rsquo;s risky.',
    color: '#FF9F43',
    bg: '#fff3e6',
  },
]

const STEPS = [
  { num: 1, emoji: '💬', title: 'Tell us what&rsquo;s wrong',     subtitle: 'Type or talk — in your own words',     example: '"I have a sore throat and fever since yesterday..."', color: '#0F4C81', bg: '#e8f0f8' },
  { num: 2, emoji: '📸', title: 'Show us your report',            subtitle: 'Snap a photo or upload a file',         example: '"Here\'s my blood test from last week"',              color: '#00C2FF', bg: '#e6f9ff' },
  { num: 3, emoji: '💡', title: 'Get easy answers',                subtitle: 'Simple advice you can actually use',    example: '"Drink water, rest, and see a doctor if fever stays."', color: '#2ECC71', bg: '#e8f8ef' },
]

/* ───────────────────────────────────────────────────────────────────────────
   Components
   ─────────────────────────────────────────────────────────────────────── */
const ScenarioCard = memo(function ScenarioCard({ scenario, delay, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.5, delay, ease: [0.22, 1, 0.36, 1] }}
      whileHover={{ y: -6 }}
      className="bg-white rounded-3xl p-7 border border-brand-border transition-all duration-300"
      style={{ boxShadow: '0 8px 30px rgba(0,0,0,0.04)' }}
    >
      <div
        className="w-20 h-20 rounded-2xl flex items-center justify-center text-5xl mb-5"
        style={{ background: scenario.bg }}
        aria-hidden="true"
      >
        {scenario.emoji}
      </div>
      <h3 className="font-display text-xl font-bold mb-3" style={{ color: '#0B1320' }}>
        {scenario.situation}
      </h3>
      <div className="bg-slate-50 rounded-2xl px-4 py-2.5 mb-4 inline-block">
        <p className="text-sm italic text-slate-500">{scenario.thought}</p>
      </div>
      <div className="flex items-start gap-2">
        <span className="text-lg leading-tight" aria-hidden="true">👉</span>
        <p
          className="text-sm font-medium leading-relaxed flex-1"
          style={{ color: scenario.color }}
          dangerouslySetInnerHTML={{ __html: scenario.solution }}
        />
      </div>
    </motion.div>
  )
})

const StepCard = memo(function StepCard({ step, delay, inView }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={inView ? { opacity: 1, y: 0 } : {}}
      transition={{ duration: 0.6, delay, ease: [0.22, 1, 0.36, 1] }}
      className="flex flex-col items-center text-center relative z-10"
    >
      <div className="relative mb-6">
        <div
          className="w-28 h-28 rounded-full flex items-center justify-center text-6xl shadow-xl border-4 border-white"
          style={{ background: step.bg }}
          aria-hidden="true"
        >
          {step.emoji}
        </div>
        <div
          className="absolute -top-2 -right-2 w-10 h-10 rounded-full text-white font-bold flex items-center justify-center text-lg shadow-md"
          style={{ background: step.color }}
        >
          {step.num}
        </div>
      </div>
      <h3
        className="font-display text-2xl font-bold mb-2"
        style={{ color: '#0B1320' }}
        dangerouslySetInnerHTML={{ __html: step.title }}
      />
      <p className="text-base text-slate-500 mb-4 max-w-[260px]">{step.subtitle}</p>
      <div
        className="rounded-2xl px-4 py-3 max-w-[260px] border bg-white"
        style={{ borderColor: step.color + '20' }}
      >
        <p className="text-sm italic" style={{ color: step.color }}>{step.example}</p>
      </div>
    </motion.div>
  )
})

/* ───────────────────────────────────────────────────────────────────────────
   Main
   ─────────────────────────────────────────────────────────────────────── */
export default function HowItWorks() {
  const [ref, inView] = useInView({ triggerOnce: true, threshold: 0.05 })

  return (
    <Section id="how-it-works" background="#F8FBFD" innerRef={ref}>
      {/* ── Real-life scenarios ─────────────────────────────────────────── */}
      <SectionHeading
        eyebrow="🧐 We get it"
        eyebrowColor="orange"
        title="Health stuff is confusing."
        subtitle="You're not alone. Here's what most people worry about — and how we help."
        inView={inView}
      />

      <div className="grid md:grid-cols-3 gap-6 mb-12">
        {SCENARIOS.map((s, i) => (
          <ScenarioCard key={s.situation} scenario={s} delay={i * 0.12} inView={inView} />
        ))}
      </div>

      <motion.div
        {...fadeUp(0.6)}
        animate={inView ? fadeUp(0.6).animate : undefined}
        className="text-center mb-24"
      >
        <div className="inline-flex items-center gap-3 bg-white rounded-full px-6 py-3 border border-brand-border shadow-sm">
          <span className="text-2xl" aria-hidden="true">✨</span>
          <p className="text-base font-semibold" style={{ color: '#0B1320' }}>
            We make healthcare simple. For everyone.
          </p>
        </div>
      </motion.div>

      {/* ── How it works steps ──────────────────────────────────────────── */}
      <SectionHeading
        eyebrow="🚀 Super easy"
        eyebrowColor="cyan"
        title="Just 3 steps. That's it."
        subtitle="Sign up in 30 seconds. No long forms. No medical degree needed."
        inView={inView}
      />

      <div className="grid md:grid-cols-3 gap-8 lg:gap-12 items-start relative">
        {/* Dotted connector line */}
        <div
          className="hidden md:block absolute top-[56px] left-[18%] right-[18%] h-1"
          style={{ background: 'repeating-linear-gradient(90deg,#b8d5ee 0,#b8d5ee 8px,transparent 8px,transparent 16px)' }}
          aria-hidden="true"
        />
        {STEPS.map((step, i) => (
          <StepCard key={step.num} step={step} delay={0.3 + i * 0.2} inView={inView} />
        ))}
      </div>

      <motion.div
        {...fadeUp(1.1)}
        animate={inView ? fadeUp(1.1).animate : undefined}
        className="text-center mt-14"
      >
        <div
          className="inline-flex items-center gap-3 rounded-full px-6 py-3 shadow-md"
          style={{ background: 'linear-gradient(135deg,#2ECC71,#20B2AA)' }}
        >
          <span className="text-2xl" aria-hidden="true">⏱️</span>
          <p className="text-base font-bold text-white">All in less than 2 minutes</p>
        </div>
      </motion.div>
    </Section>
  )
}
