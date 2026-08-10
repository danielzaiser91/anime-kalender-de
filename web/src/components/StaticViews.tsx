import { useEffect, useState } from 'react'
import type { DataMeta, PlatformId } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { absoluteFeedUrl } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { useFavorites } from '../lib/favorites.ts'
import { getSyncToken, pushFavorites, setSyncToken } from '../lib/newsletterSync.ts'
import { AdminPanel, readAdminToken } from './AdminPanel.tsx'
import { InstallFooterOffer } from './InstallPrompt.tsx'
import { Button, SectionTitle } from './ui.tsx'

const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''
const CONTACT_EMAIL = 'danielzaiser91@googlemail.com'

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white/70 p-5 dark:border-white/10 dark:bg-white/[0.03]">
      {children}
    </div>
  )
}

function CopyField({ value }: { value: string }) {
  const { t } = useLang()
  const [copied, setCopied] = useState(false)
  return (
    <div className="flex gap-2">
      <input
        readOnly
        value={value}
        onFocus={(e) => e.currentTarget.select()}
        className="min-w-0 flex-1 cursor-text rounded-lg border border-slate-300 bg-slate-100 px-2 py-1.5 font-mono text-xs dark:border-white/15 dark:bg-black/30"
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
        {copied ? t('sub.copied') : t('sub.copy')}
      </Button>
    </div>
  )
}

function PlatformToggleList({
  platforms,
  selected,
  onToggle,
  allLabel,
  onAll,
}: {
  platforms: PlatformId[]
  selected: PlatformId[] | 'all'
  onToggle: (p: PlatformId) => void
  allLabel?: string
  onAll?: () => void
}) {
  const isAll = selected === 'all'
  return (
    <div className="flex flex-wrap gap-1.5">
      {allLabel && onAll && (
        <button
          type="button"
          onClick={onAll}
          className={[
            'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition',
            isAll
              ? 'border-transparent bg-slate-100 text-slate-900'
              : 'border-slate-300/70 text-slate-600 dark:border-white/15 dark:text-slate-300',
          ].join(' ')}
        >
          {allLabel}
        </button>
      )}
      {platforms.map((p) => {
        const active = !isAll && selected.includes(p)
        return (
          <button
            key={p}
            type="button"
            onClick={() => onToggle(p)}
            className={[
              'cursor-pointer rounded-full border px-3 py-1 text-xs font-medium transition',
              active
                ? 'border-transparent bg-slate-100 text-slate-900'
                : 'border-slate-300/70 text-slate-600 hover:border-slate-400 dark:border-white/15 dark:text-slate-300',
            ].join(' ')}
          >
            {PLATFORMS[p].name}
          </button>
        )
      })}
    </div>
  )
}

export function SubscribeView({ meta }: { meta: DataMeta }) {
  const { t } = useLang()
  const [platform, setPlatform] = useState<PlatformId | 'all'>('all')
  const feed = platform === 'all' ? 'all.ics' : `platform-${platform}.ics`
  const url = absoluteFeedUrl(feed)

  return (
    <div className="mx-auto flex max-w-3xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('sub.title')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('sub.intro')}</p>
      </div>

      <Card>
        <SectionTitle>{t('sub.pick')}</SectionTitle>
        <div className="mb-3">
          <PlatformToggleList
            platforms={meta.platforms}
            selected={platform === 'all' ? 'all' : [platform]}
            onToggle={(p) => setPlatform(p)}
            allLabel={t('sub.all')}
            onAll={() => setPlatform('all')}
          />
        </div>
        <CopyField value={url} />
        <div className="mt-3 flex flex-wrap gap-2">
          <Button href={url} download={feed} size="sm">
            ⬇ {t('sub.download')}
          </Button>
          <Button href="https://calendar.google.com/calendar/u/0/r/settings/addbyurl" size="sm">
            {t('sub.insert')}
          </Button>
        </div>
      </Card>

      <Card>
        <SectionTitle>{t('sub.how')}</SectionTitle>
        <ol className="ml-4 list-decimal space-y-1.5 text-sm text-slate-600 dark:text-slate-300">
          <li>{t('sub.step1')}</li>
          <li>{t('sub.step2')}</li>
          <li>{t('sub.step3')}</li>
        </ol>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">{t('sub.note')}</p>
      </Card>
    </div>
  )
}

type FormState = 'idle' | 'sending' | 'ok' | 'error'

export function NewsletterView({ meta }: { meta: DataMeta }) {
  const { t } = useLang()
  const { favorites } = useFavorites()
  const [email, setEmail] = useState('')
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [platforms, setPlatforms] = useState<PlatformId[]>([])
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [message, setMessage] = useState('')
  const [syncState, setSyncState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [welcome, setWelcome] = useState(false)
  const autoSync = !!getSyncToken()
  const adminToken = readAdminToken()

  /**
   * Zwei Wege führen hierher: die Bestätigungsmail (`welcome=1`) und der
   * Abgleich-Link aus jeder Digest-Mail. Beide bringen den Schlüssel mit.
   *
   * Er wird im Browser hinterlegt — ab da meldet jede Änderung an den
   * Favoriten sich von selbst, ohne dass jemand einen Link anklicken muss.
   */
  useEffect(() => {
    const params = new URLSearchParams(window.location.hash.split('?')[1] ?? '')
    const token = params.get('sync')
    setWelcome(params.get('welcome') === '1')
    if (!token || !WORKER_URL) return

    setSyncToken(token)
    setSyncState('sending')
    pushFavorites(token, [...favorites])
      .then((count) => {
        setSyncState('ok')
        setSyncMessage(t('news.syncOk', { count }))
      })
      .catch((err: Error) => {
        setSyncState('error')
        setSyncMessage(err.message)
      })
    // Nur beim Öffnen. Spätere Änderungen übernimmt der Abgleich in App.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!consent) return
    if (!WORKER_URL) {
      setState('error')
      setMessage(t('news.notConnected'))
      return
    }
    setState('sending')
    try {
      const res = await fetch(`${WORKER_URL}/subscribe`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, frequency, platforms, favorites: [...favorites] }),
      })
      const body = (await res.json()) as { ok?: boolean; error?: string }
      if (!res.ok || !body.ok) throw new Error(body.error ?? 'Unbekannter Fehler')
      setState('ok')
      setMessage(t('news.ok'))
    } catch (err) {
      setState('error')
      setMessage((err as Error).message)
    }
  }

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">{t('news.title')}</h1>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">{t('news.intro')}</p>
      </div>

      {adminToken && <AdminPanel token={adminToken} />}

      {welcome && (
        <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-500">
          <strong className="block">{t('news.welcomeTitle')}</strong>
          {t('news.welcomeBody')}
        </div>
      )}

      {syncState !== 'idle' && (
        <div
          className={[
            'rounded-xl border px-4 py-3 text-sm',
            syncState === 'ok'
              ? 'border-emerald-500/40 bg-emerald-500/10 text-emerald-500'
              : syncState === 'error'
                ? 'border-red-500/40 bg-red-500/10 text-red-400'
                : 'border-slate-300 text-slate-500 dark:border-white/15',
          ].join(' ')}
        >
          {syncState === 'sending' ? t('news.syncRunning') : syncMessage}
        </div>
      )}

      <Card>
        <form onSubmit={submit} className="flex flex-col gap-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-200">{t('news.email')}</span>
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
            <legend className="mb-1 font-medium text-slate-700 dark:text-slate-200">{t('news.frequency')}</legend>
            <div className="flex gap-2">
              {(
                [
                  ['weekly', t('news.weekly'), t('news.weeklyHint')],
                  ['daily', t('news.daily'), t('news.dailyHint')],
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

          <div className="rounded-lg border border-slate-300 px-3 py-2.5 text-sm dark:border-white/15">
            <p className="font-medium text-slate-700 dark:text-slate-200">
              ★ {t('news.favorites', { count: favorites.size })}
            </p>
            <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400">
              {favorites.size > 0 ? t('news.favoritesHint') : t('news.favoritesNone')}
            </p>
            {autoSync && (
              <p className="mt-1 text-xs text-emerald-500">✓ {t('news.autoSync')}</p>
            )}
          </div>

          <fieldset>
            <legend className="mb-1.5 text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('news.platforms')} <span className="font-normal text-slate-400">{t('news.platformsHint')}</span>
            </legend>
            <PlatformToggleList
              platforms={meta.platforms}
              selected={platforms}
              onToggle={(p) =>
                setPlatforms(platforms.includes(p) ? platforms.filter((x) => x !== p) : [...platforms, p])
              }
            />
          </fieldset>

          <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-600 dark:text-slate-300">
            <input
              type="checkbox"
              checked={consent}
              onChange={(e) => setConsent(e.target.checked)}
              className="mt-0.5 cursor-pointer"
              required
            />
            <span>
              {t('news.consent')}{' '}
              <a className="underline" href="#/datenschutz">
                {t('news.privacy')}
              </a>
            </span>
          </label>

          <div className="flex items-center gap-3">
            <Button variant="primary" type="submit" disabled={state === 'sending' || !consent}>
              {state === 'sending' ? t('news.sending') : t('news.submit')}
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
        <SectionTitle>{t('news.howTitle')}</SectionTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('news.how')}</p>
      </Card>
    </div>
  )
}

/* Rechtstexte bleiben bewusst deutsch: Sie richten sich nach deutschem Recht
   und wären in Übersetzung nicht mehr die verbindliche Fassung. */

export function ImpressumView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Impressum</h1>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Anbieter</h2>
        <p>
          Daniel Zaiser
          <br />
          Kontakt ausschließlich per E-Mail:{' '}
          <a className="underline hover:text-sky-400" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Dieses Angebot ist ein privates, nicht kommerzielles Fan-Projekt ohne Werbung, ohne
          Affiliate-Links und ohne kostenpflichtige Leistungen. Eine Anschrift wird deshalb nicht
          veröffentlicht; für Anliegen jeder Art genügt die E-Mail-Adresse oben, sie wird zeitnah
          gelesen. Wer eine ladungsfähige Anschrift benötigt, bekommt sie auf Anfrage.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Verantwortlich für den Inhalt</h2>
        <p>Daniel Zaiser, erreichbar über die oben genannte Adresse.</p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Haftung für Inhalte</h2>
        <p>
          Alle Termine sind ohne Gewähr. Maßgeblich sind ausschließlich die Angaben der jeweiligen
          Anbieter. Erscheinungsdaten verschieben sich in dieser Branche regelmäßig; abgeleitete oder
          unbestätigte Angaben sind auf dieser Seite mit einem ≈ gekennzeichnet.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Haftung für Links</h2>
        <p>
          Diese Seite verlinkt auf Angebote Dritter (Streaming-Anbieter, Händler, Datenbanken). Auf
          deren Inhalte haben wir keinen Einfluss; für sie ist ausschließlich der jeweilige Betreiber
          verantwortlich. Zum Zeitpunkt der Verlinkung waren keine Rechtsverstöße erkennbar.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Urheberrecht</h2>
        <p>
          Titelbilder, Titel und Beschreibungstexte stammen von AniList und den jeweiligen
          Rechteinhabern und werden hier lediglich eingebunden. Alle Marken- und Bildrechte liegen bei
          ihren Inhabern. Der Quellcode dieser Seite steht unter der MIT-Lizenz, die selbst gepflegten
          Termindaten unter CC BY 4.0.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Datenquellen</h2>
        <ul className="ml-4 list-disc space-y-0.5">
          <li>
            Synchro-Nachweis: <a className="underline" href="https://mydublist.com">MyDubList</a> (CC BY 4.0)
          </li>
          <li>
            Metadaten: <a className="underline" href="https://anilist.co">AniList</a>
          </li>
          <li>
            FSK und Anbieter:{' '}
            <a className="underline" href="https://www.themoviedb.org">TMDB</a> — diese Seite nutzt die
            TMDB-API, ist aber weder von TMDB unterstützt noch zertifiziert
          </li>
          <li>
            Sendezeiten:{' '}
            <a className="underline" href="https://www.crunchyroll.com/de/simulcastcalendar">
              Crunchyroll-Simulcast-Kalender
            </a>
          </li>
          <li>Termine: aniSearch, Anime2You — Quelle je Eintrag im Detail-Panel verlinkt</li>
        </ul>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Streitschlichtung</h2>
        <p>
          Wir sind nicht bereit und nicht verpflichtet, an Streitbeilegungsverfahren vor einer
          Verbraucherschlichtungsstelle teilzunehmen.
        </p>
      </div>
    </div>
  )
}

export function DatenschutzView() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-4 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Datenschutzerklärung</h1>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Verantwortlicher</h2>
        <p>
          Daniel Zaiser,{' '}
          <a className="underline hover:text-sky-400" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Aufruf der Seite</h2>
        <p>
          Diese Seite ist statisch. Sie setzt keine Cookies, kein Tracking, keine Analyse-Werkzeuge und
          keine Werbenetzwerke ein. Beim Abruf verarbeitet der Hoster GitHub Pages (GitHub Inc., 88
          Colin P Kelly Jr Street, San Francisco, CA 94107, USA) technisch notwendige Server-Logdaten
          wie IP-Adresse, Zeitpunkt und aufgerufene Datei. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f
          DSGVO (berechtigtes Interesse am sicheren Betrieb). Die Übermittlung in die USA stützt sich
          auf die Standardvertragsklauseln, die GitHub in seinen{' '}
          <a className="underline" href="https://docs.github.com/site-policy/privacy-policies/github-general-privacy-statement">
            Datenschutzbestimmungen
          </a>{' '}
          zusichert.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Bilder von Drittanbietern</h2>
        <p>
          Cover- und Bannerbilder werden direkt von den Servern von AniList (AniList, Delaware, USA)
          geladen. Dabei wird deine IP-Adresse dorthin übertragen — technisch unvermeidbar, wenn ein
          Bild von einem fremden Server angezeigt wird. Rechtsgrundlage ist Art. 6 Abs. 1 lit. f DSGVO.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Lokale Speicherung im Browser</h2>
        <p>
          Sprachwahl, Farbschema und deine Favoriten werden im <em>localStorage</em> deines Browsers
          abgelegt. Diese Daten verlassen dein Gerät nicht und werden von uns weder gelesen noch
          übertragen. Löschen kannst du sie jederzeit über die Browsereinstellungen.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Newsletter</h2>
        <p>
          Für den Newsletter speichern wir E-Mail-Adresse, gewählten Rhythmus, Plattformauswahl sowie
          Zeitpunkt und IP-Adresse von Anmeldung und Bestätigung. Letzteres dient allein dem Nachweis
          der Einwilligung. Rechtsgrundlage ist Art. 6 Abs. 1 lit. a DSGVO. Die Anmeldung erfolgt im
          Double-Opt-in-Verfahren: Ohne Klick auf den Bestätigungslink wird kein Abo aktiv.
        </p>
        <p className="mt-2">
          Die Daten liegen in einer Cloudflare-D1-Datenbank (Cloudflare Germany GmbH bzw. Cloudflare,
          Inc.); der Versand erfolgt über einen E-Mail-Dienstleister. Mit beiden bestehen Verträge zur
          Auftragsverarbeitung nach Art. 28 DSGVO. Ein Widerruf ist jederzeit über den Abmeldelink in
          jeder Mail möglich; der Datensatz wird dabei vollständig gelöscht.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">
          Keine Erfolgsmessung im Newsletter
        </h2>
        <p>
          Der Versand läuft über die eigene Absenderdomain{' '}
          <code>send.anime-kalender.de</code>. Öffnungs- und Klick-Erfassung sind dort abgeschaltet:
          Die Mails enthalten kein Zählpixel, und die Links führen direkt zum Ziel statt über einen
          Zählserver. Wir erfahren also nicht, ob und wann du eine Mail geöffnet oder worauf du
          geklickt hast.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Speicherdauer</h2>
        <p>
          Newsletter-Daten werden gespeichert, bis du dich abmeldest. Server-Logdaten des Hosters
          werden nach dessen Vorgaben gelöscht.
        </p>
      </div>

      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Deine Rechte</h2>
        <p>
          Du hast das Recht auf Auskunft (Art. 15), Berichtigung (Art. 16), Löschung (Art. 17),
          Einschränkung der Verarbeitung (Art. 18), Datenübertragbarkeit (Art. 20) und Widerspruch
          (Art. 21 DSGVO) sowie das Recht, eine erteilte Einwilligung jederzeit zu widerrufen. Wende
          dich dafür an die oben genannte E-Mail-Adresse.
        </p>
        <p className="mt-2">
          Außerdem steht dir ein Beschwerderecht bei einer Aufsichtsbehörde zu, etwa dem Landesbeauftragten
          für den Datenschutz und die Informationsfreiheit Rheinland-Pfalz.
        </p>
      </div>
    </div>
  )
}

/**
 * Quellen und Lizenzen als eigene Ansicht.
 *
 * Bis zum 10.08.2026 stand diese Liste im Seitenfuß und machte ihn sechs
 * Zeilen lang. Verschwinden darf sie nicht — die anime-offline-database steht
 * unter ODbL, MyDubList unter CC BY 4.0, und beide verlangen die Nennung. Ein
 * Klick entfernt erfüllt das genauso wie unter jeder Seite, und hier ist Platz
 * zu erklären, wofür welche Quelle überhaupt gebraucht wird.
 */
export function SourcesView({ meta }: { meta: DataMeta }) {
  const { t } = useLang()
  return (
    <div className="mx-auto max-w-3xl px-4 py-8 text-sm leading-relaxed text-slate-600 dark:text-slate-300">
      <h1 className="mb-1 text-xl font-bold text-slate-900 dark:text-slate-100">
        {t('sources.title')}
      </h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">{t('sources.intro')}</p>
      <ul className="space-y-2">
        {meta.attribution.map((a) => (
          <li
            key={a}
            className="rounded-lg border border-slate-200 px-3 py-2 dark:border-white/10"
          >
            {a}
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">{t('sources.perEntry')}</p>
    </div>
  )
}

export function Footer({ meta }: { meta: DataMeta }) {
  const { t } = useLang()
  const generated = new Date(meta.generatedAt)
  // Zwei Zeilen, mehr nicht: Zahlen und Stand, darunter die Wege. Die
  // Quellenliste hat eine eigene Ansicht bekommen — sie stand hier unter jeder
  // Seite und wurde nach dem ersten Lesen nie wieder gebraucht.
  return (
    <footer className="mt-10 border-t border-slate-200 py-4 text-xs text-slate-500 dark:border-white/10 dark:text-slate-400">
      <div className="mx-auto flex max-w-[1600px] flex-col gap-1 px-4">
        <p>
          <span className="font-semibold text-slate-700 dark:text-slate-200">{t('app.title')}</span>
          {' · '}
          {t('footer.stats', {
            titles: meta.titleCount.toLocaleString('de-DE'),
            releases: meta.releaseCount,
            events: meta.eventCount,
          })}
          {' · '}
          {t('footer.updated')}{' '}
          <time dateTime={meta.generatedAt}>
            {generated.toLocaleString('de-DE', { dateStyle: 'medium', timeStyle: 'short' })}
          </time>
        </p>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a className="hover:underline" href="#/quellen">
            {t('footer.sources')}
          </a>
          <a className="hover:underline" href="#/impressum">
            {t('view.impressum')}
          </a>
          <a className="hover:underline" href="#/datenschutz">
            {t('view.datenschutz')}
          </a>
          <a className="hover:underline" href="#/abo">
            {t('view.abo')}
          </a>
          <a
            className="hover:underline"
            href="https://github.com/danielzaiser91/anime-kalender-de"
            target="_blank"
            rel="noreferrer noopener"
          >
            {t('footer.code')}
          </a>
          <InstallFooterOffer />
        </p>
      </div>
    </footer>
  )
}
