import { useSettings } from '../../context/SettingsContext'
import Button from '../ui/Button'
import Card from '../ui/Card'

export default function LocationSection() {
  const { settings } = useSettings()

  const directionsUrl =
    settings.mapsUrl.trim() ||
    `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(settings.address)}`

  return (
    <section className="bg-court-900/50 px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Court Location</h2>
        </div>

        <Card className="mt-8 overflow-hidden p-0">
          <div className="flex aspect-video w-full flex-col items-center justify-center gap-2 bg-court-800 text-cream-dim">
            <span className="text-4xl">🗺️</span>
            <p className="text-sm">Google Maps preview</p>
          </div>
          <div className="p-6">
            <p className="font-display font-bold text-cream">{settings.address}</p>
            <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <Button as="a" href={directionsUrl} target="_blank" rel="noreferrer" fullWidth>
                GET DIRECTIONS
              </Button>
              <Button
                variant="secondary"
                fullWidth
                onClick={() => document.getElementById('contact')?.scrollIntoView({ behavior: 'smooth' })}
              >
                CONTACT US
              </Button>
            </div>
          </div>
        </Card>
      </div>
    </section>
  )
}
