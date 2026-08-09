import { useSettings } from '../../context/SettingsContext'
import Button from '../ui/Button'
import Card from '../ui/Card'

function toUrl(value: string) {
  if (!value) return '#'
  return value.startsWith('http') ? value : `https://${value}`
}

export default function ContactSection() {
  const { settings } = useSettings()

  return (
    <section id="contact" className="px-4 py-14 sm:px-6 sm:py-20">
      <div className="mx-auto max-w-md">
        <div className="text-center">
          <h2 className="font-display text-3xl font-extrabold text-cream sm:text-4xl">Get In Touch</h2>
          <p className="mt-2 text-cream-dim">Questions about your booking? We're here to help.</p>
        </div>

        <Card className="mt-8 divide-y divide-white/5 p-2">
          <ContactRow icon="📞" label="Mobile Number" value={settings.phone} href={`tel:${settings.phone.replace(/\s/g, '')}`} />
          <ContactRow icon="📘" label="Facebook Page" value="PickleYard Compostela" href={toUrl(settings.facebook)} />
          <ContactRow icon="💬" label="Messenger" value={settings.messenger} href={toUrl(settings.messenger)} />
        </Card>

        <Button as="a" href={toUrl(settings.messenger)} target="_blank" rel="noreferrer" fullWidth size="lg" className="mt-6">
          💬 MESSAGE US
        </Button>
      </div>
    </section>
  )
}

function ContactRow({ icon, label, value, href }: { icon: string; label: string; value: string; href: string }) {
  return (
    <a href={href} target="_blank" rel="noreferrer" className="flex items-center gap-4 px-4 py-4 hover:bg-white/5">
      <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-white/5 text-xl">{icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block text-xs font-semibold uppercase tracking-widest text-cream-dim">{label}</span>
        <span className="block truncate font-medium text-cream">{value}</span>
      </span>
      <span className="text-cream-dim">›</span>
    </a>
  )
}
