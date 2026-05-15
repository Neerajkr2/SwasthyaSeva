// src/pages/LandingPage.jsx
import Navbar     from '../components/common/Navbar'
import AuthModal  from '../components/auth/AuthModal'
import Hero       from '../components/landing/Hero'
import HowItWorks from '../components/landing/HowItWorks'
import Features   from '../components/landing/Features'
import {
  TrustBadges, Testimonials, Stats, Pricing, FAQ, CTA, Footer,
} from '../components/landing/Sections'

export default function LandingPage() {
  return (
    <>
      <Navbar />
      <AuthModal />
      <main>
        {/* 1. Hero */}
        <Hero />
        {/* 2-3. Pain Points + How It Works */}
        <HowItWorks />
        {/* 4-5. Product Experience + Why We're Different */}
        <Features />
        {/* 6. Trust & Security */}
        <TrustBadges />
        {/* 7. Testimonials */}
        <Testimonials />
        {/* 8. Impact Numbers */}
        <Stats />
        {/* 9. Pricing */}
        <Pricing />
        {/* 10. FAQ */}
        <FAQ />
        {/* 11. Final CTA */}
        <CTA />
      </main>
      <Footer />
    </>
  )
}
