import { Button, SectionTitle } from './ui.tsx'
import type { Translate } from '../lib/i18n.tsx'
import { type DataMeta, type PlatformId } from '@shared/types.ts'
import { WORKER_URL, Card, PlatformToggleList, type FormState } from './static-bausteine.tsx'
import type { Dispatch, SetStateAction } from 'react'
import { requestRestore } from '../lib/newsletterSync.ts'
import { type AbmeldeState } from './AboBeenden.tsx'

export function WiederherstellenKasten({ t, zeigeGeraet, abmeldeState, setRestoreOffen, restoreState, setRestoreState, email, setEmail }: {
  t: Translate
  zeigeGeraet: boolean
  abmeldeState: AbmeldeState
  setRestoreOffen: Dispatch<SetStateAction<boolean>>
  restoreState: 'idle' | 'sending' | 'done'
  setRestoreState: Dispatch<SetStateAction<'idle' | 'sending' | 'done'>>
  email: string
  setEmail: Dispatch<SetStateAction<string>>
}) {
  return (
    <>

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
          Wiederherstellungslink anfordern", als müsse er sich rechtfertigen.
          Verbunden heißt der Kasten jetzt nach dem, was
          er zeigt: dieses Gerät.
        */}
        <SectionTitle>
          {t(zeigeGeraet ? 'news.deviceTitle' : 'news.restoreTitle')}
        </SectionTitle>
        {/*
          Wer verbunden ist, braucht das Formular nicht.

          Es stand trotzdem da — ein Eingabefeld für ein Problem, das dieser
          Browser gerade nicht hat. Erreichbar bleibt es
          trotzdem: Ein Schlüssel kann ungültig geworden sein, und dann ist der
          Link der einzige Weg zurück.
        */}
        {zeigeGeraet ? (
          <>
            {abmeldeState !== 'weg' && (
              <p className="rounded-lg bg-ak-gut-grund px-3 py-2 text-sm text-ak-gut-text">
                ✓ {t('news.restoreConnected')}
              </p>
            )}
            <div className="mt-3 flex flex-col items-start gap-3">
              <button
                type="button"
                onClick={() => setRestoreOffen(true)}
                className="cursor-pointer rounded-full border border-ak-rand bg-ak-flaeche-2 px-3 py-1.5 text-[13px] font-semibold text-ak-text transition hover:border-ak-leise"
              >
                {t('news.restoreAnyway')}
              </button>
              {/*
                Abmelden direkt hier — bisher musste man dafür eine alte Mail
                heraussuchen, weil der Abmeldelink am `unsub_token` hängt und
                die Seite nur den `pref_token` kennt.

                Zweistufig, weil Löschen nicht umkehrbar ist: Der erste Klick
                fragt, der zweite handelt. Kein Dialogfenster — die Frage steht
                an derselben Stelle, an der auch der Knopf stand.
              */}
              {abmeldeState === 'weg' && <span className="text-[13px] text-slate-500 dark:text-slate-400">{t('news.unsubDone')}</span>}
            </div>
          </>
        ) : (
          <>
        <p className="text-sm text-slate-600 dark:text-slate-300">{t('news.restoreBody')}</p>
        {restoreState === 'done' ? (
          <p className="mt-3 rounded-lg bg-ak-gut-grund px-3 py-2 text-sm text-ak-gut-text">
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
              className="cursor-pointer rounded-lg bg-ak-flaeche-2 px-4 py-2 text-sm font-medium text-ak-text transition hover:bg-ak-flaeche-3 disabled:cursor-default disabled:opacity-45"
            >
              {restoreState === 'sending' ? t('news.sending') : t('news.restoreSubmit')}
            </button>
          </form>
        )}
        <p className="mt-2 text-[13px] text-slate-500 dark:text-slate-400">{t('news.restoreSafety')}</p>
          </>
        )}
      </Card>
    </>
  )
}

export function AnmeldeFormular({ submit, t, email, setEmail, frequency, setFrequency, favorites, autoSync, meta, platforms, setPlatforms, consent, setConsent, state, message }: {
  submit: (e: React.FormEvent) => Promise<void>
  t: Translate
  email: string
  setEmail: Dispatch<SetStateAction<string>>
  frequency: 'weekly' | 'daily'
  setFrequency: Dispatch<SetStateAction<'weekly' | 'daily'>>
  favorites: Set<number>
  autoSync: boolean
  meta: DataMeta
  platforms: PlatformId[]
  setPlatforms: Dispatch<SetStateAction<PlatformId[]>>
  consent: boolean
  setConsent: Dispatch<SetStateAction<boolean>>
  state: FormState
  message: string
}) {
  return (
    <>
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
                    : 'border-slate-300 hover:border-ak-leise dark:border-white/15',
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
            <p className="mt-1 text-xs text-ak-gut-text">✓ {t('news.autoSync')}</p>
          ) : favorites.size > 0 ? (
            <p className="mt-1 text-xs text-ak-warnung-text">{t('news.noSyncYet')}</p>
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
                state === 'ok' ? 'text-ak-gut-text' : state === 'error' ? 'text-ak-fehler-text' : 'text-slate-400',
              ].join(' ')}
            >
              {message}
            </span>
          )}
        </div>
      </form>
    </>
  )
}

export function UebernommenKasten({ uebernommen, t, favorites, toggleFavorit, namen }: {
  uebernommen: number[]
  t: Translate
  favorites: Set<number>
  toggleFavorit: (id: number) => void
  namen: Map<number, string>
}) {
  return (
    <>
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
                    className="size-4 cursor-pointer accent-ak-akzent"
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
    </>
  )
}
