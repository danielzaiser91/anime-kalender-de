import { useState } from 'react'
import type { DataMeta, PlatformId } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { absoluteFeedUrl } from '../lib/data.ts'
import { Button, SectionTitle } from './ui.tsx'

const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 font-mono text-xs dark:border-white/15 dark:bg-black/30"
      />
      <Button
        size="sm"
        onClick={() => {
          navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            setTimeout(() => setCopied(false), 1500)
          })
        }}
      >
        {copied ? '✓ kopiert' : 'kopieren'}
      </Button>
    </div>
  )
}

export function SubscribeView({ meta }: { meta: DataMeta }) {
  const [platform, setPlatform] = useState<PlatformId | 'all'>('all')
  const feed = platform === 'all' ? 'all.ics' : `platform-${platform}.ics`
  const url = absoluteFeedUrl(feed)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Kalender abonnieren</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Ein Abo statt vieler Einzelklicks: Die Feeds unten aktualisieren sich mit jedem Daten-Update
          von selbst. Kein Konto, kein Login, keine Freigabe an uns nötig.
        </p>
      </div>

      <Card>
        <SectionTitle>Feed wählen</SectionTitle>
        <div className="mb-3 flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setPlatform('all')}
            className={[
              'rounded-full border px-3 py-1 text-xs font-medium transition',
              platform === 'all'
                ? 'border-transparent bg-slate-100 text-slate-900'
                : 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300',
            ].join(' ')}
          >
            Alles
          </button>
          {meta.platforms.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPlatform(p)}
              className={[
                'rounded-full border px-3 py-1 text-xs font-medium transition',
                platform === p
                  ? 'border-transparent bg-slate-100 text-slate-900'
                  : 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300',
              ].join(' ')}
            >
              {PLATFORMS[p].name}
            </button>
          ))}
        </div>
        <CopyField value={url} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button href={url} download={feed} size="sm">
            ⬇ Datei laden
          </Button>
          <Button href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" size="sm">
            In Google Calendar einfügen
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>So geht's</SectionTitle>
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          <li>Adresse oben kopieren.</li>
          <li>
            Google Calendar öffnen → links bei „Weitere Kalender" auf <strong>+</strong> → „Per URL".
          </li>
          <li>Adresse einfügen, „Kalender hinzufügen".</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Google holt sich abonnierte Feeds nur alle paar Stunden bis Tage. Wer Termine sofort
          braucht, nutzt beim einzelnen Eintrag den Knopf „Google Calendar" — der legt den Termin
          direkt an. Apple Kalender und Outlook lesen dieselbe Adresse.
        </p>
      </Card>
    </div>
  )
}

type FormState = 'idle' | 'sending' | 'ok' | 'error'

export function NewsletterView({ meta }: { meta: DataMeta }) {
  const [email, setEmail] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [platforms, setPlatforms] = useState<PlatformId[]>([])
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [message, setMessage] = useState('')

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) return
    if (!WORKER_URL) {
      setState('error')
      setMessage(
        'Der Newsletter-Dienst ist in dieser Installation noch nicht verbunden (VITE_NEWSLETTER_API fehlt).',
      )
      return
    }
    setState('sending')
    try {
      const res = await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency, platforms }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Unbekannter Fehler')
      setState('ok')
      setMessage('Fast geschafft: Bestätigungsmail ist unterwegs. Erst der Klick darin aktiviert das Abo.')
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Newsletter</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
          Täglich oder wöchentlich per Mail, was mit deutscher Synchro erscheint. Kein Tracking, keine
          Werbung, Abmelden mit einem Klick aus jeder Mail.
        </p>
      </div>

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">E-Mail-Adresse</span>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="du@beispiel.de"
              className="rounded-lg border border-slate-300 bg-white px-3 py-2 dark:border-white/15 dark:bg-white/5"
            />
          </label>

          <fieldset className="flex flex-col gap-1 text-sm">
            <legend className="mb-1 font-medium text-slate-700 dark:text-slate-200">Rhythmus</legend>
            <div className="flex gap-2">
              {(
                [
                  ['weekly', 'Wöchentlich', 'montags 07:00, alles der kommenden Woche'],
                  ['daily', 'Täglich', '07:00, alles des Tages'],
                ] as const
              ).map(([value, label, hint]) => (
                <label
                  key={value}
                  className={[
                    'flex-1 cursor-pointer rounded-lg border p-3 transition',
                    frequency === value
                      ? 'border-sky-400 bg-sky-400/10'
                      : 'border-slate-300 hover:border-slate-400 dark:border-white/15',
                  ].join(' ')}
                >
                  <input
                    type="radio"
                    name="frequency"
                    className="sr-only"
                    checked={frequency === value}
                    onChange={() => setFrequency(value)}
                  />
                  <span className="block font-medium text-slate-800 dark:text-slate-100">{label}</span>
                  <span className="block text-xs text-slate-500 dark:text-slate-400">{hint}</span>
                </label>
              ))}
            </div>
          </fieldset>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              Nur diese Plattformen <span className="font-normal text-slate-400">(leer = alle)</span>
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {meta.platforms.map((p) => {
                const active = platforms.includes(p)
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() =>
                      setPlatforms(active ? platforms.filter((x) => x !== p) : [...platforms, p])
                    }
                    className={[
                      'rounded-full border px-3 py-1 text-xs font-medium transition',
                      active
                        ? 'border-transparent bg-slate-100 text-slate-900'
                        : 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300',
                    ].join(' ')}
                  >
                    {PLATFORMS[p].name}
                  </button>
                )
              })}
            </div>
          </fieldset>

          <label className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5"
              required
            />
            <span>
              Ich möchte den Newsletter erhalten und bin damit einverstanden, dass meine Adresse dafür
              gespeichert wird. Die Einwilligung kann ich jederzeit über den Abmeldelink widerrufen.
              Näheres in der <a className="underline" href="#/datenschutz">Datenschutzerklärung</a>.
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={state === 'sending' || !consent}>
              {state === 'sending' ? 'sendet …' : 'Anmelden'}
            </Button>
            {state !== 'idle' && (
              <span
                className={[
                  'text-sm',
                  state === 'ok' ? 'text-emerald-500' : state === 'error' ? 'text-red-400' : 'text-slate-400',
                ].join(' ')}
              >
                {message}
              </span>
            )}
          </div>
        </form>
      </Card>

      <Card>
        <SectionTitle>Wie das technisch läuft</SectionTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">
          Die Anmeldung ist ein Double-Opt-in: Wir schicken erst eine Bestätigungsmail, gespeichert
          wird das Abo erst nach deinem Klick. Adresse, Rhythmus und Plattformwahl liegen in einer
          Cloudflare-D1-Datenbank in der EU. Der Versand läuft über einen Cron-Job, der die
          Termine aus genau diesem Kalender zieht.
        </p>
      </Card>
    </div>
  )
}

export function ImpressumView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Impressum</h1>
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
        Platzhalter — vor der Veröffentlichung mit den echten Angaben nach § 5 DDG füllen. Ohne
        vollständiges Impressum ist ein deutscher Newsletter-Betrieb angreifbar.
      </p>
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Angaben gemäß § 5 DDG</h2>
        <p>
          Daniel Zaiser
          <br />
          [Straße und Hausnummer]
          <br />
          [PLZ Ort]
          <br />
          Deutschland
        </p>
      </div>
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Kontakt</h2>
        <p>E-Mail: [Kontaktadresse]</p>
      </div>
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Haftung für Inhalte</h2>
        <p>
          Dieses Projekt ist ein privates, nicht kommerzielles Fan-Projekt. Alle Termine sind ohne
          Gewähr; maßgeblich sind die Angaben der jeweiligen Anbieter. Für Inhalte verlinkter Seiten
          sind ausschließlich deren Betreiber verantwortlich.
        </p>
      </div>
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Datenquellen</h2>
        <ul className="ml-4 list-disc">
          <li>Dub-Daten: MyDubList (CC BY 4.0)</li>
          <li>Metadaten: AniList</li>
          <li>FSK und Anbieter: TMDB — dieses Projekt nutzt die TMDB-API, ist aber weder von TMDB unterstützt noch zertifiziert</li>
          <li>Termine: aniSearch, Anime2You — Quelle je Eintrag im Detail-Panel</li>
        </ul>
      </div>
    </div>
  )
}

export function DatenschutzView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Datenschutzerklärung</h1>
      <p className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-amber-700 dark:text-amber-300">
        Entwurf. Vor dem Livegang von einer fachkundigen Person prüfen lassen, insbesondere die
        Angaben zu Hosting und Auftragsverarbeitung.
      </p>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Aufruf der Seite</h2>
        <p>
          Die Seite ist statisch und setzt keine Cookies, kein Tracking und keine Analyse-Werkzeuge
          ein. Beim Abruf verarbeitet der Hoster (GitHub Pages, GitHub Inc.) technisch notwendige
          Server-Logdaten wie IP-Adresse und Zeitpunkt.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Bilder von Drittanbietern</h2>
        <p>
          Cover-Bilder werden direkt von den Servern von AniList geladen. Dabei wird deine IP-Adresse
          an AniList übertragen.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Newsletter</h2>
        <p>
          Für den Newsletter speichern wir E-Mail-Adresse, gewählten Rhythmus, Plattformauswahl sowie
          Zeitpunkt und IP-Adresse von Anmeldung und Bestätigung — Letzteres, um die Einwilligung
          nachweisen zu können. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO (Einwilligung).
          Die Anmeldung erfolgt im Double-Opt-in-Verfahren.
        </p>
        <p className="mt-2">
          Die Daten liegen in einer Cloudflare-D1-Datenbank; der Versand erfolgt über einen
          E-Mail-Dienstleister. Mit beiden besteht ein Auftragsverarbeitungsvertrag. Ein Widerruf ist
          jederzeit über den Abmeldelink in jeder Mail möglich; die Daten werden dann gelöscht.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Deine Rechte</h2>
        <p>
          Auskunft, Berichtigung, Löschung, Einschränkung der Verarbeitung, Datenübertragbarkeit und
          Widerspruch nach Art. 15–21 DSGVO, außerdem das Recht auf Beschwerde bei einer
          Aufsichtsbehörde.
        </p>
      </div>
    </div>
  )
}

export function Footer({ meta }: { meta: DataMeta }) {
  const generated = new Date(meta.generatedAt)
  return (
    <footer className="mt-10 border-t border-slate-200 py-6 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
      <div className="mx-auto flex max-w-[1600px] flex-wrap items-start gap-x-8 gap-y-3 px-4">
        <div className="min-w-56 flex-1">
          <p className="font-semibold text-slate-700 dark:text-slate-200">Anime-Kalender DE</p>
          <p className="mt-1">
            {meta.titleCount.toLocaleString('de-DE')} Anime mit belegter deutscher Synchro ·{' '}
            {meta.releaseCount} erfasste Releases · {meta.eventCount} Termine
          </p>
          <p>
            Daten zuletzt aktualisiert:{' '}
            <time dateTime={meta.generatedAt}>
              {generated.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
            </time>
          </p>
        </div>
        <div>
          <p className="font-semibold text-slate-700 dark:text-slate-200">Quellen</p>
          <ul className="mt-1 space-y-0.5">
            {meta.attribution.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        </div>
        <div className="flex flex-col gap-0.5">
          <a className="hover:underline" href="#/impressum">
            Impressum
          </a>
          <a className="hover:underline" href="#/datenschutz">
            Datenschutz
          </a>
          <a className="hover:underline" href="#/abo">
            Kalender-Abo
          </a>
          <a
            className="hover:underline"
            href="https://github.com/danielzaiser91/anime-kalender-de"
            target="_blank"
            rel="noreferrer noopener"
          >
            Quellcode
          </a>
        </div>
      </div>
    </footer>
  )
}
