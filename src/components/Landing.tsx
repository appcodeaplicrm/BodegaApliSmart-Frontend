import { Hero } from './Hero'
import { ClientTicker } from './ClientTicker'
import { Features } from './Features'
import { HowItWorks } from './HowItWorks'
import { StatsBanner } from './StatsBanner'
import { Pricing } from './Pricing'
import { CTAFinal } from './CTAFinal'
import { Footer } from './Footer'

export function Landing() {
  return (
    <>
      <main>
        <Hero />
        <ClientTicker />
        <Features />
        <HowItWorks />
        <StatsBanner />
        <Pricing />
        <CTAFinal />
      </main>
      <Footer />
    </>
  )
}
