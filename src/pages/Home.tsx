import Layout from '../components/layout/Layout'
import StickyBookBar from '../components/layout/StickyBookBar'
import Hero from '../components/home/Hero'
import RatesSection from '../components/home/RatesSection'
import HowToBook from '../components/home/HowToBook'
import WhyPlayWithUs from '../components/home/WhyPlayWithUs'
import LocationSection from '../components/home/LocationSection'
import ContactSection from '../components/home/ContactSection'
import BookingWidget from '../components/booking/BookingWidget'

export default function Home() {
  return (
    <Layout>
      <Hero />

      <section id="book" className="scroll-mt-20 px-4 py-10 sm:px-6 sm:py-14">
        <div className="mx-auto max-w-xl">
          <div className="mb-6 text-center">
            <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Book Your Court</h2>
            <p className="mt-2 text-cream-dim">Choose your date, time, and playing duration.</p>
          </div>
          <BookingWidget />
        </div>
      </section>

      <RatesSection />
      <HowToBook />
      <WhyPlayWithUs />
      <LocationSection />
      <ContactSection />

      <div className="h-4 sm:hidden" />
      <StickyBookBar />
    </Layout>
  )
}
