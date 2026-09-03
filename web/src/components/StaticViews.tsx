import { useEffect, useState } from 'react'
import type { DataMeta, PlatformId } from '@shared/types.ts'
import { PLATFORMS } from '@shared/types.ts'
import { absoluteFeedUrl, loadAllTitles, loadOhneSynchro, type Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import { favoritenErgaenzen, useFavorites } from '../lib/favorites.ts'
import {
  getSyncToken,
  ladeEinstellungen,
  speichereEinstellungen,
  useNewsletterVerbindung,
  pullFavorites,
  pushFavorites,
  requestRestore,
  unsubscribeByToken,
  setSyncToken,
  type Einstellungen,
} from '../lib/newsletterSync.ts'
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

/**
 * Was ein verbundener Browser sieht: seinen Stand, nicht das Anmeldeformular.
 *
 * Rhythmus und Plattformen lassen sich hier ändern, ohne sich neu anzumelden.
 * Die Adresse bleibt außen vor — sie zu wechseln heißt, ein neues Abo mit neuer
 * Bestätigung anzulegen, und dafür gibt es das Formular.
 */
function AboEinstellungen({ meta, onWechseln }: { meta: DataMeta; onWechseln: () => void }) {
  const { t } = useLang()
  const [stand, setStand] = useState<Einstellungen | undefined>()
  const [fehler, setFehler] = useState('')
  const [speichert, setSpeichert] = useState<'idle' | 'laeuft' | 'ok'>('idle')
  /**
   * Eigener Zustand statt `!stand`.
   *
   * „Wird geladen" hing vorher allein daran, dass noch nichts angekommen war —
   * und blieb deshalb nach einem Fehler für immer stehen. Am 18.08.2026 stand so
   * eine rote Fehlermeldung direkt über einem Ladehinweis, der nie endete
   * (Daniel: „egal wie lange ich warte, nix passiert").
   */
  const [laedt, setLaedt] = useState(true)

  useEffect(() => {
    const token = getSyncToken()
    if (!token) {
      setLaedt(false)
      return
    }
    ladeEinstellungen(token)
      .then(setStand)
      .catch((e: Error) => setFehler(e.message))
      .finally(() => setLaedt(false))
  }, [])

  function sichern(werte: { frequency: 'daily' | 'weekly'; platforms: string[]; franchiseHinweis?: boolean }) {
    const token = getSyncToken()
    if (!token) return
    setStand((s) => (s ? { ...s, ...werte } : s))
    setSpeichert('laeuft')
    speichereEinstellungen(token, werte)
      .then(() => setSpeichert('ok'))
      .catch((e: Error) => {
        setFehler(e.message)
        setSpeichert('idle')
      })
  }

  return (
    <Card>
      <SectionTitle>{t('news.yourSubscription')}</SectionTitle>
      {fehler && <p className="mb-2 text-sm text-red-400">{fehler}</p>}
      {laedt ? (
        <p className="text-sm text-slate-400">{t('news.loadingPrefs')}</p>
      ) : !stand ? null : (
        <div className="flex flex-col gap-4">
          <p className="text-sm text-slate-600 dark:text-slate-300">
            {t('news.connectedAs', { mail: stand.email })}
          </p>

          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('news.frequency')}
            </span>
            <div className="mt-1.5 flex gap-2">
              {(['weekly', 'daily'] as const).map((f) => (
                <button
                  key={f}
                  type="button"
                  onClick={() => sichern({ frequency: f, platforms: stand.platforms })}
                  className={[
                    'cursor-pointer rounded-lg border px-3 py-2 text-sm transition',
                    stand.frequency === f
                      ? 'border-sky-500 bg-sky-500/10 font-medium text-slate-900 dark:text-white'
                      : 'border-slate-300 text-slate-600 hover:border-slate-400 dark:border-white/15 dark:text-slate-300',
                  ].join(' ')}
                >
                  {t(f === 'weekly' ? 'news.weekly' : 'news.daily')}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
              {t('news.platforms')}
            </span>
            <div className="mt-1.5">
              <PlatformToggleList
                platforms={meta.platforms}
                selected={stand.platforms.length ? (stand.platforms as PlatformId[]) : 'all'}
                onToggle={(p) => {
                  const naechste = stand.platforms.includes(p)
                    ? stand.platforms.filter((x) => x !== p)
                    : [...stand.platforms, p]
                  sichern({ frequency: stand.frequency, platforms: naechste })
                }}
                allLabel={t('news.allPlatforms')}
                onAll={() => sichern({ frequency: stand.frequency, platforms: [] })}
              />
            </div>

          {/*
            **Neues aus gemerkten Reihen.**

            Daniel am 28.08.2026: „ich will informiert werden weil ich es sonst
            evtl verpasse." Wer die letzte Staffel gemerkt hat, erfährt sonst nie
            von der nächsten — sie ist ein eigener Titel, und den kann noch
            niemand gemerkt haben.
          */}
          <div>
            <label className="flex cursor-pointer items-start gap-2.5">
              <input
                type="checkbox"
                checked={stand.franchiseHinweis !== false}
                onChange={(e) =>
                  sichern({
                    frequency: stand.frequency,
                    platforms: stand.platforms,
                    franchiseHinweis: e.target.checked,
                  })
                }
                className="mt-0.5 h-4 w-4 cursor-pointer accent-sky-500"
              />
              <span className="text-sm text-slate-700 dark:text-slate-200">
                {t('news.franchiseHint')}
                <span className="mt-0.5 block text-xs text-slate-500 dark:text-slate-400">
                  {t('news.franchiseHintNote')}
                </span>
              </span>
            </label>
          </div>
          </div>

          {speichert === 'ok' && <p className="text-sm text-emerald-500">{t('news.prefsSaved')}</p>}

          <div className="flex flex-wrap items-center gap-3 border-t border-slate-200 pt-3 dark:border-white/10">
            {/*
              Abmelden steht bewusst **nicht** hier, sondern weiter unten im
              Kasten „Favoriten verloren?". Dort gab es den Weg schon, zweistufig
              und mit Abbruch; ein zweiter Knopf gleichen Namens auf derselben
              Seite wäre die Sorte Dopplung, die diese Runde eigentlich beseitigt.
            */}
            <button
              type="button"
              onClick={onWechseln}
              className="cursor-pointer text-sm text-sky-500 underline hover:text-sky-400"
            >
              {t('news.changeAddress')}
            </button>
          </div>
        </div>
      )}
    </Card>
  )
}

type FormState = 'idle' | 'sending' | 'ok' | 'error'

export function NewsletterView({ meta, data }: { meta: DataMeta; data: Dataset }) {
  const { t } = useLang()
  const { favorites, toggle: toggleFavorit } = useFavorites()
  const [email, setEmail] = useState('')
  const [restoreState, setRestoreState] = useState<'idle' | 'sending' | 'done'>('idle')
  /** Formular trotz bestehender Verbindung zeigen — für den Fall eines toten Schlüssels. */
  const [restoreOffen, setRestoreOffen] = useState(false)
  const [abmeldeState, setAbmeldeState] = useState<'idle' | 'fragt' | 'laeuft' | 'weg'>('idle')
  /**
   * Was beim Verbinden vom Server dazukam — für die Rückmeldung mit Abwahl.
   *
   * Die Vereinigung ist die richtige Vorgabe, aber sie holt auch zurück, was
   * jemand absichtlich entfernt hatte. Deshalb wird **nach** dem Verbinden
   * gezeigt, was dazugekommen ist, statt vorher zu fragen: Wer nichts tut, hat
   * den vollständigen Stand, und wer etwas nicht will, hakt es ab (Daniels
   * Entscheidung, 14.08.2026, gegen eine eigene Vergleichsseite).
   */
  const [uebernommen, setUebernommen] = useState<number[]>([])
  const [namen, setNamen] = useState<Map<number, string>>(new Map())
  const [frequency, setFrequency] = useState<'daily' | 'weekly'>('weekly')
  const [platforms, setPlatforms] = useState<PlatformId[]>([])
  const [consent, setConsent] = useState(false)
  const [state, setState] = useState<FormState>('idle')
  const [message, setMessage] = useState('')
  const [syncState, setSyncState] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle')
  const [syncMessage, setSyncMessage] = useState('')
  const [welcome, setWelcome] = useState(false)
  const verbindung = useNewsletterVerbindung()
  /**
   * Aus dem **reaktiven** Zustand, nicht aus einem Direktzugriff.
   *
   * `!!getSyncToken()` war ein Schnappschuss beim Zeichnen: Wurde der Schlüssel
   * danach weggeräumt — weil das Abo nicht mehr existiert —, bemerkte diese
   * Ansicht es nicht und zeigte weiter „verbunden". Genau daran hing der
   * widersprüchliche Zustand vom 18.08.2026.
   */
  const autoSync = verbindung.verbunden
  /**
   * Wann der Kasten „Dieses Gerät" statt des Wiederherstellungs-Formulars steht.
   *
   * Nach dem Abbestellen ist die Verbindung im selben Augenblick weg — und mit
   * ihr wäre der Satz „Abo beendet" verschwunden, bevor ihn jemand liest.
   * Übrig bliebe ein Formular, das aussieht, als sei nichts passiert.
   */
  const zeigeGeraet = (autoSync || abmeldeState === 'weg') && !restoreOffen
  /** Bewusst aufklappbar: Eine neue Adresse ist eine neue Anmeldung. */
  const [adresseWechseln, setAdresseWechseln] = useState(false)
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

    /**
     * Kommt der Nutzer über einen **Wiederherstellungslink**, ist die Richtung
     * umgekehrt: Der Browser hat nichts (oder Reste), der Dienst hat alles.
     * Deshalb wird hier geholt und mit dem Lokalen **vereinigt** statt ersetzt
     * — wer auf dem neuen Gerät schon etwas gemerkt hat, soll es behalten.
     * Danach geht die vereinigte Liste zurück, damit beide Seiten gleichstehen.
     *
     * Auf dem gewöhnlichen Weg (Bestätigung, Abgleich-Link aus dem Newsletter)
     * bleibt es beim Schicken: Dort ist der Browser die Quelle der Wahrheit.
     */
    /**
     * Verbinden heißt **immer vereinigen**, nie überschreiben.
     *
     * Anfangs galt das nur für den Wiederherstellungslink; der gewöhnliche
     * Abgleich-Link aus der Mail schickte stattdessen die lokale Liste hoch.
     * Damit zerstörte er den Serverstand, und zwar in genau dem Fall, für den
     * es ihn gibt (Daniels Ablauf, 14.08.2026): merken, abonnieren, weiter
     * merken, Browserdaten löschen, neu merken, Link aus einer alten Mail
     * anklicken. Der frische Browser kennt nur die letzte Markierung — und
     * überschrieb damit alles, was vorher auf dem Server lag.
     *
     * Die Unterscheidung nach `restored` war ohnehin erfunden: Einen Browser
     * zu verbinden bedeutet in beiden Fällen dasselbe, nämlich dass aus zwei
     * Listen eine wird. Danach ist der Browser wieder die Quelle der Wahrheit
     * — Abwählen wirkt also weiterhin, nur eben nicht im Moment des Verbindens.
     */
    const arbeit = pullFavorites(token)
      .catch(() => [] as number[])
      .then((vomServer) => {
        const vereint = [...new Set([...favorites, ...vomServer])].sort((a, b) => a - b)
        // Ergänzen statt umschalten — siehe `favoritenErgaenzen`.
        favoritenErgaenzen(vomServer)
        setUebernommen(vomServer.filter((id) => !favorites.has(id)))
        return pushFavorites(token, vereint)
      })

    arbeit
      .then((count) => {
        setSyncState('ok')
        // Die Meldung sagt, was tatsächlich passiert ist: Kamen Titel vom
        // Server dazu, ist das die Nachricht — sonst genügt die Gesamtzahl.
        setSyncMessage(t('news.syncOk', { count }))
      })
      .catch((err: Error) => {
        setSyncState('error')
        setSyncMessage(err.message)
      })
    // Nur beim Öffnen. Spätere Änderungen übernimmt der Abgleich in App.tsx.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /**
   * Namen der übernommenen Titel — nur dann geholt, wenn es welche gibt.
   *
   * Die Newsletter-Seite kennt sonst nur Kennungen. Der vollständige Bestand
   * ist mehrere Megabyte groß und wird deshalb ausschließlich in diesem
   * seltenen Moment nachgeladen, und auch dann nur so weit, wie nötig: erst der
   * gepflegte Bestand, und nur wenn danach noch Kennungen offen sind, die Liste
   * der Titel ohne deutsche Synchro.
   */
  useEffect(() => {
    if (!uebernommen.length) return
    let alive = true
    const sammeln = (quelle: { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }[]) => {
      if (!alive) return
      setNamen((bisher) => {
        const neu = new Map(bisher)
        for (const t of quelle) {
          if (uebernommen.includes(t.id)) neu.set(t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`)
        }
        return neu
      })
    }
    sammeln([...data.titleById.values()])
    loadAllTitles(data).then((alle) => {
      sammeln(alle)
      const offen = uebernommen.filter((id) => !alle.some((t) => t.id === id) && !data.titleById.has(id))
      if (offen.length) loadOhneSynchro(data).then(sammeln)
    })
    return () => {
      alive = false
    }
  }, [uebernommen, data])

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

      {/*
        Was vom Abo dazukam — mit der Möglichkeit, es wieder abzuwählen.

        Kein Zwischenschritt und keine Pflicht: Wer nichts tut, behält alles.
        Das Abwählen entfernt den Titel lokal; der Abgleich in `App.tsx` schickt
        die neue Liste von selbst hinterher.
      */}
      {uebernommen.length > 0 && (
        <Card>
          <SectionTitle>{t('news.mergedTitle', { count: uebernommen.length })}</SectionTitle>
          <p className="text-sm text-slate-600 dark:text-slate-300">{t('news.mergedBody')}</p>
          <ul className="mt-3 grid gap-1 sm:grid-cols-2">
            {uebernommen.map((id) => (
              <li key={id}>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-slate-700 dark:text-slate-200">
                  <input
                    type="checkbox"
                    checked={favorites.has(id)}
                    onChange={() => toggleFavorit(id)}
                    className="size-4 cursor-pointer accent-amber-400"
                  />
                  <span className={favorites.has(id) ? '' : 'text-slate-400 line-through dark:text-slate-500'}>
                    {namen.get(id) ?? `#${id}`}
                  </span>
                </label>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {/*
        Ein verbundener Browser sieht seinen Stand, kein Anmeldeformular.

        Vorher stand hier für jeden dasselbe Formular — auch für Abonnenten, die
        weder Rhythmus noch Plattformen ändern konnten, ohne sich neu
        anzumelden (Daniel, 15.08.2026: „wenn ich bereits verbunden bin, sollte
        ich wechseln können, abbestellen, etc"). Wer die Adresse wechseln will,
        klappt das Formular über den Knopf darunter wieder auf: Eine neue
        Adresse ist eine neue Anmeldung samt Bestätigung, und das soll sie auch
        bleiben.
      */}
      {verbindung.verbunden && !adresseWechseln ? (
        <AboEinstellungen meta={meta} onWechseln={() => setAdresseWechseln(true)} />
      ) : (
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
            {/*
              Die Gegenprobe zum grünen Häkchen.

              Bisher stand hier nur die gute Nachricht: „Änderungen werden ab
              jetzt selbsttätig übernommen", wenn dieser Browser einen
              Abgleich-Schlüssel hat. Fehlte er, stand **nichts** — und wer
              anderswo abonniert und hier Titel merkt, erfuhr nie, dass sie den
              Versand gar nicht erreichen (Daniels Frage, 14.08.2026: „ist auch
              gesichert, dass der Newsletter das mitbekommt?").

              Nur bei vorhandenen Favoriten, und im Konjunktiv: Wer sich hier
              gerade erst anmeldet, schickt seine Favoriten mit dem Formular mit
              — für den wäre der Hinweis eine Warnung vor nichts.
            */}
            {autoSync ? (
              <p className="mt-1 text-xs text-emerald-500">✓ {t('news.autoSync')}</p>
            ) : favorites.size > 0 ? (
              <p className="mt-1 text-xs text-amber-600 dark:text-amber-400">{t('news.noSyncYet')}</p>
            ) : null}
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
      )}

      {/*
        Der Abschnitt steht vor der Technik und nach dem Formular: Er ist der
        Grund, aus dem sich jemand anmeldet, der noch gar nichts im Kalender
        gefunden hat — seine Serie ist ja gerade nicht dabei.
      */}
      {/*
        Wiederherstellung — der Weg zurück an die gemerkten Titel.

        Steht bewusst als eigener Kasten und nicht im Anmeldeformular: Wer
        hierher kommt, hat schon ein Abo und sucht keine Anmeldung, sondern
        seine Daten. Die Antwort ist **immer dieselbe**, auch bei unbekannter
        Adresse — sonst ließe sich mit dem Feld herausfinden, wer abonniert hat
        (Daniels Datenschutz-Einwand, 14.08.2026).
      */}
      <Card>
        {/*
          Die Überschrift richtet sich nach dem Zustand.

          „Favoriten verloren?" ist die Frage eines Menschen, der etwas sucht.
          Wer verbunden ist, sucht nichts — für ihn war die Überschrift eine
          Frage ohne Anlass, und der Knopf darunter hieß „Trotzdem einen
          Wiederherstellungslink anfordern", als müsse er sich rechtfertigen
          (Daniel, 16.08.2026). Verbunden heißt der Kasten jetzt nach dem, was
          er zeigt: dieses Gerät.
        */}
        <SectionTitle>
          {t(zeigeGeraet ? 'news.deviceTitle' : 'news.restoreTitle')}
        </SectionTitle>
        {/*
          Wer verbunden ist, braucht das Formular nicht.

          Es stand trotzdem da — ein Eingabefeld für ein Problem, das dieser
          Browser gerade nicht hat (Daniel, 14.08.2026: „warum kann ich erneut
          E-Mail eingeben, wenn ich verbunden bin?"). Erreichbar bleibt es
          trotzdem: Ein Schlüssel kann ungültig geworden sein, und dann ist der
          Link der einzige Weg zurück.
        */}
        {zeigeGeraet ? (
          <>
            {abmeldeState !== 'weg' && (
              <p className="rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
                ✓ {t('news.restoreConnected')}
              </p>
            )}
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1">
              <button
                type="button"
                onClick={() => setRestoreOffen(true)}
                className="cursor-pointer text-[13px] text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
              >
                {t('news.restoreAnyway')}
              </button>
              {/*
                Abmelden direkt hier — bisher musste man dafür eine alte Mail
                heraussuchen, weil der Abmeldelink am `unsub_token` hängt und
                die Seite nur den `pref_token` kennt (Daniel, 14.08.2026).

                Zweistufig, weil Löschen nicht umkehrbar ist: Der erste Klick
                fragt, der zweite handelt. Kein Dialogfenster — die Frage steht
                an derselben Stelle, an der auch der Knopf stand.
              */}
              {abmeldeState === 'weg' ? (
                <span className="text-[13px] text-slate-500 dark:text-slate-400">{t('news.unsubDone')}</span>
              ) : abmeldeState === 'fragt' ? (
                <span className="flex items-center gap-2 text-[13px]">
                  <span className="text-slate-600 dark:text-slate-300">{t('news.unsubConfirm')}</span>
                  <button
                    type="button"
                    onClick={() => {
                      const token = getSyncToken()
                      if (!token) return
                      setAbmeldeState('laeuft')
                      unsubscribeByToken(token)
                        .then(() => setAbmeldeState('weg'))
                        .catch(() => setAbmeldeState('idle'))
                    }}
                    className="cursor-pointer font-medium text-red-500 underline underline-offset-2 hover:text-red-400"
                  >
                    {t('news.unsubYes')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setAbmeldeState('idle')}
                    className="cursor-pointer text-slate-500 underline underline-offset-2 hover:text-slate-700 dark:hover:text-slate-200"
                  >
                    {t('news.unsubNo')}
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  disabled={abmeldeState === 'laeuft'}
                  onClick={() => setAbmeldeState('fragt')}
                  className="cursor-pointer text-[13px] text-slate-500 underline decoration-dotted underline-offset-2 transition hover:text-red-500 disabled:opacity-60 dark:text-slate-400"
                >
                  {t('news.unsub')}
                </button>
              )}
            </div>
          </>
        ) : (
          <>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('news.restoreBody')}</p>
        {restoreState === 'done' ? (
          <p className="mt-3 rounded-lg bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600 dark:text-emerald-400">
            {t('news.restoreSent')}
          </p>
        ) : (
          <form
            className="mt-3 flex flex-wrap gap-2"
            onSubmit={(e) => {
              e.preventDefault()
              if (!WORKER_URL || restoreState === 'sending') return
              setRestoreState('sending')
              // Auch ein Fehlschlag endet in derselben Anzeige: Der Nutzer soll
              // aus der Antwort nichts über fremde Adressen schließen können.
              requestRestore(email).finally(() => setRestoreState('done'))
            }}
          >
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={t('news.email')}
              className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-white/15 dark:bg-white/5"
            />
            <button
              type="submit"
              disabled={restoreState === 'sending' || !WORKER_URL}
              className="cursor-pointer rounded-lg bg-slate-700 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-600 disabled:opacity-60 dark:bg-white/15 dark:hover:bg-white/25"
            >
              {restoreState === 'sending' ? t('news.sending') : t('news.restoreSubmit')}
            </button>
          </form>
        )}
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">{t('news.restoreSafety')}</p>
          </>
        )}
      </Card>

      <Card>
        <SectionTitle>{t('news.waitTitle')}</SectionTitle>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('news.waitBody')}</p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{t('news.waitHow')}</p>
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
            FSK: <a className="underline" href="https://www.themoviedb.org">TMDB</a> — diese Seite nutzt die
            TMDB-API, ist aber weder von TMDB unterstützt noch zertifiziert
          </li>
          <li>
            Wo ein Titel läuft und was er kostet:{' '}
            <a className="underline" href="https://www.justwatch.com">JustWatch</a>, über die TMDB-API
          </li>
          <li>
            Tonspuren bei Netflix, Prime Video und Disney+:{' '}
            <a className="underline" href="https://www.movieofthenight.com/about/api">
              Streaming Availability API
            </a>{' '}
            von Movie of the Night
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
/**
 * **Eine Adresse, die dasteht, gehört verlinkt.**
 *
 * `meta.attribution` sind fertige Sätze aus der Pipeline, und die Adresse steht
 * darin im Klartext: „Dub-Daten: MyDubList (https://mydublist.com) — CC BY
 * 4.0". Gerendert wurde der Satz roh — auf der Quellenseite standen damit sieben
 * ausgeschriebene URLs, die niemand anklicken konnte (gemessen am 03.09.2026).
 *
 * Der Lizenzhinweis verlangt die Nennung der Quelle; ein Klick dorthin ist das
 * Mindeste, was man daraus machen kann. Zerlegt wird am Adressmuster, damit die
 * Pipeline weiter Sätze liefern kann und kein Datenformat sich ändern muss.
 */
function MitLinks({ text }: { text: string }) {
  /* Die schließende Klammer gehört zum Satz, nicht zur Adresse — daher `[^\s)]`. */
  const teile = text.split(/(https?:\/\/[^\s)]+)/g)
  return (
    <>
      {teile.map((teil, i) =>
        /^https?:\/\//.test(teil) ? (
          <a
            key={i}
            href={teil}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sky-600 underline decoration-dotted underline-offset-2 hover:decoration-solid dark:text-sky-400"
          >
            {teil.replace(/^https?:\/\/(www\.)?/, '')}
          </a>
        ) : (
          <span key={i}>{teil}</span>
        ),
      )}
    </>
  )
}

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
            <MitLinks text={a} />
          </li>
        ))}
      </ul>
      <p className="mt-6 text-xs text-slate-500 dark:text-slate-400">{t('sources.perEntry')}</p>

      <Wissenswert />
    </div>
  )
}

/**
 * Wie die Termine hierher kommen — die Betriebsanleitung des Bots.
 *
 * Steht auf der Quellenseite und nicht im Impressum: Wer wissen will, woher ein
 * Termin stammt, klickt „Quellen". Dort erwartet er die Liste **und** das
 * Verfahren; zwei Seiten dafür wären eine zu viel.
 *
 * Bewusst knapp gehalten. Was hier fehlt, steht ausführlich in `CLAUDE.md` —
 * hier braucht der Leser nur, was er zur Einordnung eines Termins braucht.
 */
function Wissenswert() {
  const { t } = useLang()
  const bloecke: { titel: string; text: string }[] = [
    { titel: t('sources.howTitle'), text: t('sources.howText') },
    { titel: t('sources.autoTitle'), text: t('sources.autoText') },
    { titel: t('sources.unsureTitle'), text: t('sources.unsureText') },
    { titel: t('sources.catalogTitle'), text: t('sources.catalogText') },
    { titel: t('sources.staleTitle'), text: t('sources.staleText') },
  ]
  return (
    <div className="mt-10 space-y-5">
      {/*
        Der Bereichstitel muss sich von seinen Unterfragen abheben.

        Vorher war er `text-lg font-bold`, die Fragen darunter `font-semibold`
        in Grundgröße — zwei Stufen, die im Fließtext fast gleich aussehen
        (Daniel, 15.08.2026: „visuell ist er zu identisch zu den untergeordneten
        Überschriften"). Jetzt trennen ihn drei Dinge: Größe, eine Linie
        darunter und mehr Abstand.
      */}
      <h2 className="border-b border-slate-200 pb-2 text-2xl font-bold text-slate-900 dark:border-white/10 dark:text-slate-100">
        {t('sources.pipelineTitle')}
      </h2>
      {bloecke.map((b) => (
        <div key={b.titel}>
          <h3 className="font-semibold text-slate-800 dark:text-slate-100">{b.titel}</h3>
          <p className="mt-0.5">{b.text}</p>
        </div>
      ))}
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
