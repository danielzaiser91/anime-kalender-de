import { useLang } from '../../lib/i18n.tsx'
import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { formatDate, monthName } from '@shared/time.ts'
import { type Release, type Title } from '@shared/types.ts'
import { MerkenKnopf } from './merken.tsx'

/**
 * **Der Trailer — eine Pille, die sich zu einem Kino öffnet.**
 *
 * Daniel am 12.09.2026: „im panel erscheint ‚trailer anschauen'
 * pill/button/interaktives element … wenn angeklickt, öffnet sich das youtube
 * video embedded in einem overlay dialog mit 95% width und height, in diesem
 * dialog gibt es ein x button oben rechts um es zu schließen, über dem
 * embedded video steht was es ist (trailer für <titel des anime films>),
 * außerdem muss dort auch noch ein link-button element sein, mit label ‚in
 * youtube öffnen'."
 *
 * **Drei Entscheidungen, die nicht im Auftrag standen:**
 *
 * - **`youtube-nocookie.com`** statt der gewöhnlichen Einbettung. Diese Seite
 *   führt eine Datenschutzerklärung und einen Double-Opt-in-Newsletter; ein
 *   Werbetracker im Panel wäre ein Widerspruch dazu. Die Einbettung sieht
 *   identisch aus.
 * - **Das `<iframe>` entsteht erst beim Öffnen.** Sonst lädt jedes geöffnete
 *   Panel YouTube mit, auch wenn niemand den Trailer sehen will — bei 52
 *   Filmen selten, aber es kostet jedes Mal einen Fremdabruf.
 * - **Der Dialog schließt auch mit Escape und einem Klick daneben.** Ein X
 *   allein ist auf dem Handy weit weg vom Daumen.
 */
/*
  **Ein Kinofilm ohne gefundenen Trailer bekommt die Pille trotzdem** (Daniel, 19.09.2026, an
  Madoka „Walpurgisnacht": „trailer pill anzeigen, beim öffnen kein video embedden, sondern
  hinweis wir haben keinen gefunden + button ‚auf youtube suchen'"). Nur für Filme, die im Kino
  laufen oder kommen — dort wird ein Trailer gesucht, und er erscheint oft erst Wochen vorher.
*/
export function TrailerKino({
  trailer,
  titel,
}: {
  trailer?: { video: string; titel: string; sprache: 'de' | 'en' | 'ja' }
  titel: string
}) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)
  /*
    **Ein fremdsprachiger Trailer sagt, dass er einer ist.** Nur 56 der 700
    Filme haben einen deutschen; für 442 weitere kennt TMDB einen englischen
    oder japanischen. Ihn als „Trailer anschauen" auszugeben wäre auf dieser
    Seite eine Falschangabe — sie beantwortet eine deutsche Frage.
  */
  /*
    **Und was wir nicht benennen können, gilt als deutsch.**

    Der erste Entwurf baute den Textschlüssel aus dem Sprachcode zusammen. Bei
    einem Eintrag ohne `sprache` stand daraufhin „Trailer auf
    trailer.sprache.undefined" auf der Pille (gemessen 12.09.2026). Ein
    zusammengesetzter Schlüssel hat keinen Rückfall — er trifft oder er steht
    roh da.

    Der Bau setzt `sprache ?? 'de'`, im Datensatz kann der Fall also nicht
    auftreten. Genau deshalb ist er gefährlich: Er fällt erst auf, wenn er
    schon auf der Seite steht.
  */
  const SPRACHNAME = { en: 'trailer.sprache.en', ja: 'trailer.sprache.ja' } as const
  const fremd = trailer?.sprache === 'en' || trailer?.sprache === 'ja'
  const deutsch = Boolean(trailer) && !fremd
  const spracheName = fremd ? t(SPRACHNAME[trailer!.sprache as 'en' | 'ja']) : ''
  const knopfText = !trailer ? t('trailer.ohne') : deutsch ? t('trailer.ansehen') : t('trailer.ansehenFremd', { sprache: spracheName })
  const suche = `https://www.youtube.com/results?search_query=${encodeURIComponent(`${titel} Trailer deutsch`)}`

  /*
    Escape schließt, und solange der Dialog steht, scrollt die Seite darunter
    nicht mit — sonst wandert das Panel weg, während oben ein Video läuft.
  */
  useEffect(() => {
    if (!offen) return
    const beiTaste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOffen(false)
    }
    document.addEventListener('keydown', beiTaste)
    const vorher = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', beiTaste)
      document.body.style.overflow = vorher
    }
  }, [offen])

  return (
    <>
      {/*
        **Die Pille sagt, was sie tut, und sieht aus wie ein Abspielknopf.**
        Ein gefülltes Dreieck in einem eigenen Kreis: Das ist das Zeichen, das
        jeder kennt, und es unterscheidet die Pille von den Anbieter-Pillen
        darunter, die zu einer fremden Seite führen statt etwas zu öffnen.
      */}
      <button
        type="button"
        onClick={() => setOffen(true)}
        title={deutsch ? undefined : trailer ? t('trailer.nochKeinDeutscher') : t('trailer.keinerGefunden')}
        className={[
          'group inline-flex shrink-0 items-center gap-1.5 rounded-full border py-1 pl-1 pr-3 text-xs font-semibold transition',
          deutsch
            ? 'border-rose-400/40 bg-rose-500/10 text-rose-700 hover:border-rose-400/70 hover:bg-rose-500/20 dark:text-rose-300'
            : 'border-slate-300 bg-slate-500/5 text-slate-600 hover:border-slate-400 hover:bg-slate-500/10 dark:border-white/15 dark:text-slate-300',
        ].join(' ')}
      >
        <span
          aria-hidden="true"
          className={[
            'grid h-5 w-5 place-items-center rounded-full text-[9px] text-white transition group-hover:scale-110',
            deutsch ? 'bg-rose-600' : 'bg-slate-500',
          ].join(' ')}
        >
          ▶
        </span>
        {knopfText}
      </button>

      {/*
        **Der Dialog hängt am Körper, nicht im Panel.**

        `position: fixed` bezieht sich normalerweise auf das Fenster — aber
        nicht, wenn ein Vorfahre `transform`, `filter` oder `backdrop-filter`
        trägt: Dann wird dieser Vorfahre zum Bezugsrahmen. Das Detail-Panel
        fährt mit einer Transform-Animation herein, also saß der Dialog in ihm
        und ragte rechts aus dem Bild (gemessen 12.09.2026 am ersten Bild).

        Der Messwert log dabei nicht, er beantwortete nur eine andere Frage:
        „95 % breit" stimmte, gemessen an `window.innerWidth` — die **Lage** hat
        niemand gefragt. Genau dafür gibt es das Bild, und deshalb prüft
        `trailer-dialog-bild.mjs` jetzt auch die Ränder.
      */}
      {offen &&
        createPortal(
        <div
          role="dialog"
          aria-modal="true"
          aria-label={t('trailer.ueberschrift', { titel })}
          onClick={() => setOffen(false)}
          className="fixed inset-0 z-[120] grid place-items-center bg-black/80 p-2 backdrop-blur-sm"
        >
          {/* Der Klick im Dialog darf ihn nicht schließen — nur der daneben. */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex h-[95vh] w-[95vw] flex-col overflow-hidden rounded-2xl border border-white/15 bg-slate-950 shadow-2xl"
          >
            <div className="flex shrink-0 items-center gap-3 border-b border-white/10 px-4 py-2.5">
              <h2 className="min-w-0 flex-1 truncate text-sm font-semibold text-white">
                {t('trailer.ueberschrift', { titel })}
                {/*
                  Der Hinweis steht **im** Dialog, nicht nur als Tooltip an der
                  Pille: Wer hier landet, hat geklickt und erwartet Deutsch —
                  er soll es lesen können, ohne mit der Maus zu suchen. Auf
                  einem Touchgerät gibt es den Tooltip ohnehin nicht.
                */}
                {trailer && !deutsch && (
                  <span className="ml-2 font-normal text-slate-400">
                    · {spracheName} — {t('trailer.nochKeinDeutscher')}
                  </span>
                )}
              </h2>
              {trailer && (
                <a
                  href={`https://www.youtube.com/watch?v=${trailer.video}`}
                  target="_blank"
                  rel="noreferrer noopener"
                  className="shrink-0 rounded-full border border-white/20 px-3 py-1 text-xs font-medium text-slate-200 transition hover:border-white/40 hover:bg-white/10 hover:text-white"
                >
                  {t('trailer.beiYoutube')} ↗
                </a>
              )}
              <button
                type="button"
                onClick={() => setOffen(false)}
                aria-label={t('trailer.schliessen')}
                className="grid h-8 w-8 shrink-0 place-items-center rounded-full text-lg text-slate-300 transition hover:bg-white/10 hover:text-white"
              >
                ✕
              </button>
            </div>
            {trailer ? (
              <iframe
                src={`https://www.youtube-nocookie.com/embed/${trailer.video}?autoplay=1&rel=0`}
                title={trailer.titel || t('trailer.ueberschrift', { titel })}
                allow="accelerometer; autoplay; encrypted-media; picture-in-picture; fullscreen"
                allowFullScreen
                className="min-h-0 flex-1 border-0 bg-black"
              />
            ) : (
              <div className="grid min-h-0 flex-1 place-items-center bg-black p-6 text-center">
                <div className="flex max-w-md flex-col items-center gap-4">
                  <p className="text-sm leading-relaxed text-slate-300">{t('trailer.keinerGefunden')}</p>
                  <a
                    href={suche}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="rounded-full bg-rose-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-rose-500"
                  >
                    {t('trailer.suchen')} ↗
                  </a>
                </div>
              </div>
            )}
          </div>
        </div>,
          document.body,
        )}
    </>
  )
}

/**
 * **So genau, wie AniList es weiß — nicht nur das Jahr.**
 *
 * Im Kopf stand „Film · JP 2026", während die Reihenliste zwei Zeilen tiefer
 * den 11.12.2026 nannte (Daniel, 12.09.2026: „für den film kennen wir genauere
 * infos für jp release date als 2026, oben steht trotzdem nur 2026"). Beide
 * lesen dieselbe Quelle; nur der Kopf nahm ausschließlich `jpYear`.
 *
 * Das Datum bleibt eine Zusatzangabe und steht deshalb klein im Kopf, nicht in
 * der Auswahlbox — dort gehört allein der deutsche Termin hin.
 */
/**
 * Ist ein Termin in der Genauigkeit seiner Quelle schon vorbei? „2026-12" gilt
 * erst ab Januar als erschienen, nicht schon am 1. Dezember.
 */
export function jpErschienen(jp: string, today: string): boolean {
  return jp.length >= 10 ? jp <= today : jp < today.slice(0, jp.length)
}

/**
 * **Das Herkunftsland im Satz.** 19 der 112 angekündigten Filme stammen aus
 * China oder Südkorea (gemessen 13.09.2026). Ein Land, das hier fehlt, bekommt
 * keinen Kino-Kasten — lieber das allgemeine Nein als ein falsches „In Japan".
 */
export const KINO_LAND: Record<string, { land: string; adj: string }> = {
  JP: { land: 'Japan', adj: 'japanischen' },
  CN: { land: 'China', adj: 'chinesischen' },
  KR: { land: 'Südkorea', adj: 'südkoreanischen' },
  TW: { land: 'Taiwan', adj: 'taiwanischen' },
}

/** „11.12.2026", „Dezember 2026" oder „2027" — so genau, wie die Quelle ist. */
export function kinoDatum(jp: string): string {
  const [jahr, monat, tag] = jp.split('-')
  if (tag) return formatDate(jp)
  if (monat) return `${monthName(Number(monat) - 1)} ${jahr}`
  return jahr ?? jp
}

export function jpAngabe(jpStart: string | undefined, jpYear: number | undefined, land = 'JP'): string | undefined {
  /* „JP 2025" stand über The Mighty Nein, einer US-Serie (Daniel, 16.09.2026) — das Land kommt jetzt aus dem Titel. */
  if (jpStart) {
    const [jahr, monat, tag] = jpStart.split('-')
    if (tag) return `${land} ${tag}.${monat}.${jahr}`
    if (monat) return `${land} ${monat}.${jahr}`
    return `${land} ${jahr}`
  }
  return jpYear ? `${land} ${jpYear}` : undefined
}

/**
 * **Der Kinostart bekommt einen eigenen Banner** (Daniel, 17.09.2026: „ein banner über die
 * box legen … in diesen banner können alle infos zum kino-ausstrahlungs zeitraum und
 * startdatum, sowie die kino pill … integriert").
 *
 * Er steht zwischen Trailer-Zeile und Antwort-Kasten und ersetzt die Kino-Pille in der
 * Wegeliste — ein Kinostart ist kein Anbieter unter vielen, sondern ein Termin mit Ende.
 *
 * **Die Wiederaufführung ist ein eigener Fall.** „Your Name." lief 2016 im Kino und läuft
 * am 29.09.2026 erneut; ohne Kennzeichen liest sich das wie ein neuer Film. Als
 * Wiederaufführung gilt ein Kinostart, der mindestens zwei Jahre nach dem japanischen
 * Erscheinungsjahr liegt.
 */
export function KinoBanner({
  release,
  title,
  today,
  t,
}: {
  release: Release
  title: Title
  today: string
  t: (k: string, v?: Record<string, string | number>) => string
}): React.JSX.Element | null {
  const start = release.schedule?.firstEpisodeDate
  if (!start) return null
  const bis = release.cinemaUntil
  const laeuft = start <= today && (!bis || bis >= today)
  const einTag = Boolean(bis && bis === start)
  const wieder = Boolean(title.jpYear && Number(start.slice(0, 4)) - title.jpYear >= 2)
  const kopf = einTag
    ? t('kino.nurAm', { datum: formatDate(start) })
    : laeuft
      ? bis
        ? t('kino.laeuftBis', { datum: formatDate(bis) })
        : t('kino.laeuft')
      : t('kino.ab', { datum: formatDate(start) })
  const unten = [release.publisher, release.fsk ? `FSK ${release.fsk}` : undefined].filter(Boolean).join(' · ')
  /*
    **Kinos und Spielzeiten — bundesweit, nicht ein Kino** (Daniel, 19.09.2026: Die Cinestar-Pille
    führte nach Leipzig, Filmspiegel nach Essen; „nutzer können aus allen städten deutschlands
    kommen, lieber kinoheld … da ist kein spezielles kino ausgewählt"). Die Adresse steht als Beleg
    am Kinotermin; kinoheld sperrt Agenten (`robots.txt: Disallow: /`), abgeleitet oder geprüft wird
    sie deshalb nicht, sondern von Hand hinterlegt. Nach dem Ende des Kinolaufs fällt der Knopf weg.
  */
  const kinoheld = !bis || bis >= today ? release.sources?.find((q) => /^https:\/\/www\.kinoheld\.de\/film\//.test(q)) : undefined
  return (
    <div className="relative overflow-hidden rounded-xl border border-amber-300/60 bg-gradient-to-r from-amber-50 via-amber-50/60 to-rose-50 px-4 py-3 dark:border-amber-400/25 dark:from-amber-500/10 dark:via-amber-500/5 dark:to-rose-500/10">
      {/* Der Filmstreifen am Rand — schmückt, ohne Platz zu kosten. */}
      <span
        aria-hidden
        className="pointer-events-none absolute inset-y-0 left-0 w-2 bg-[repeating-linear-gradient(180deg,theme(colors.amber.400)_0_6px,transparent_6px_12px)] opacity-70"
      />
      <div className="flex items-center gap-3 pl-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-amber-400/20 text-xl" aria-hidden>
          🎬
        </span>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-amber-900 dark:text-amber-200">{kopf}</span>
            {wieder && (
              <span className="rounded-full bg-amber-400/25 px-2 py-px text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:text-amber-200">
                {t('kino.wieder')}
              </span>
            )}
          </div>
          {unten && <span className="block truncate text-xs text-amber-800/80 dark:text-amber-200/70">{unten}</span>}
        </div>
        {kinoheld && (
          <a
            href={kinoheld}
            target="_blank"
            rel="noreferrer noopener"
            className="shrink-0 rounded-full border border-amber-400/50 px-3 py-1 text-xs font-semibold text-amber-900 transition hover:bg-amber-400/15 dark:text-amber-200"
          >
            {t('kino.tickets')} ↗
          </a>
        )}
        <MerkenKnopf release={release} today={today} />
      </div>
      {/* Die Notiz des Kinostarts gehört hierher, nicht in den Kasten darunter — sonst steht sie neben einer Auskunft, die von etwas anderem handelt. */}
      {release.note && (
        <p className="mt-2 pl-3 text-xs leading-relaxed text-amber-900/80 dark:text-amber-100/70">{release.note}</p>
      )}
    </div>
  )
}
