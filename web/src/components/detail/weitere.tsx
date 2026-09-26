import { type Title } from '@shared/types.ts'
import { useLang } from '../../lib/i18n.tsx'
import { useState, Fragment, useEffect, useRef, useMemo } from 'react'
import { eindeutschenStaffel, anzeigeName } from '@shared/titles.ts'
import { type Voices, loadVoices, type Dataset, loadCartoons, loadAllTitles } from '../../lib/data.ts'
import { aehnlicheTitel } from '../../lib/aehnlich.ts'
import { coverBild } from '../../lib/cover.ts'

/**
 * Alle weiteren Schreibweisen eines Titels — eingeklappt, an einer Stelle.
 *
 * Nach dem Muster von MyAnimeLists „Alternative Titles": ein Aufklapper statt
 * dauerhaft sichtbarer Zeilen. Wer die Umschrift oder die Originalschrift sucht,
 * findet sie in einem Klick; alle anderen bekommen zwei Zeilen weniger, die sie
 * nie gelesen hätten.
 *
 * Die Regel „infos nie verstecken" (Daniel, 15.08.2026) ist damit nicht
 * verletzt, sondern befolgt: Verstecken hieße weglassen oder hinter ein Symbol
 * ohne Beschriftung packen. Hier steht ausgeschrieben, was drin ist, samt
 * Anzahl — genau das, was MAL mit „More titles" tut.
 */
export function WeitereTitel({ title }: { title: Title }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  const gezeigt = title.titleDe ?? title.titleEn ?? title.titleRomaji
  const weitere: { label: string; wert: string }[] = []
  if (title.titleRomaji && title.titleRomaji !== gezeigt) {
    weitere.push({ label: t('detail.titleRomaji'), wert: eindeutschenStaffel(title.titleRomaji) })
  }
  if (title.titleEn && title.titleEn !== gezeigt) {
    weitere.push({ label: t('detail.titleEn'), wert: title.titleEn })
  }
  if (title.titleNative) weitere.push({ label: t('detail.titleNative'), wert: title.titleNative })
  if (!weitere.length) return null

  return (
    <div className="mt-0.5 text-xs">
      <button
        type="button"
        onClick={() => setOffen((o) => !o)}
        className="cursor-pointer text-slate-400 underline decoration-dotted underline-offset-2 hover:text-sky-400 dark:text-slate-500"
      >
        {offen ? t('detail.otherTitlesHide') : t('detail.otherTitles', { count: weitere.length })}
      </button>
      {offen && (
        <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-2 gap-y-0.5 text-slate-500 dark:text-slate-400">
          {weitere.map((w) => (
            <Fragment key={w.label}>
              <dt className="text-slate-400 dark:text-slate-500">{w.label}</dt>
              <dd className="min-w-0 break-words">{w.wert}</dd>
            </Fragment>
          ))}
        </dl>
      )}
    </div>
  )
}

/**
 * Deutsche Sprechrollen — zugeklappt, und erst der Klick holt die Daten.
 *
 * Bewusst nicht im Hauptdatensatz: Über alle Titel wären das mehr als 50.000
 * Einträge für eine Angabe, die die meisten nie aufschlagen. Wer sie sehen
 * will, lädt zwei Kilobyte; alle anderen zahlen nichts. Siehe ARCHITEKTUR.md.
 */
export function VoiceCast({ titleId }: { titleId: number }) {
  const { t } = useLang()
  const [open, setOpen] = useState(false)
  const [stimmen, setStimmen] = useState<Voices | undefined>()

  // Titelwechsel: zuklappen und vergessen. Sonst stünde beim nächsten Anime
  // kurz die Besetzung des vorherigen da.
  useEffect(() => {
    setOpen(false)
    setStimmen(undefined)
  }, [titleId])

  useEffect(() => {
    if (!open || stimmen) return
    let alive = true
    loadVoices(titleId)
      .then((v) => {
        if (alive) setStimmen(v)
      })
      .catch(() => {
        if (alive) setStimmen({ roles: [] })
      })
    return () => {
      alive = false
    }
  }, [open, stimmen, titleId])

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
        {t('detail.voices')}
      </button>

      {open && (
        <div className="mt-2">
          {stimmen === undefined ? (
            <p className="text-sm text-slate-400">{t('detail.voicesLoading')}</p>
          ) : stimmen.roles.length === 0 ? (
            <p className="text-sm text-slate-400">{t('detail.voicesNone')}</p>
          ) : (
            <>
              <dl className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] gap-x-3 gap-y-1 text-sm">
                {stimmen.roles.map((r) => (
                  <Fragment key={`${r.character}-${r.actor}`}>
                    <dt className="truncate text-slate-500 dark:text-slate-400" title={r.character}>
                      {r.character}
                    </dt>
                    <dd className="truncate text-slate-700 dark:text-slate-200" title={r.actor}>
                      {r.actor}
                    </dd>
                  </Fragment>
                ))}
              </dl>
              {/*
                Quellennennung, und bei ANN ist sie eine Auflage, keine Geste.

                Anime News Network verlangt fuer die Nutzung der
                Encyclopedia-Daten ausdruecklich eine Quellenangabe **und** einen
                Link zum jeweiligen Eintrag auf jeder Seite, die die Angaben
                zeigt. Der Link steht deshalb hier und nicht auf der
                Quellenseite: Er gehoert dorthin, wo die Daten stehen.
              */}
              <p className="mt-2 text-[11px] text-slate-400">
                {t('detail.voicesSource')}
                {stimmen.annUrl && (
                  <>
                    {', '}
                    <a
                      href={stimmen.annUrl}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="underline hover:text-sky-400"
                    >
                      Anime News Network
                    </a>
                  </>
                )}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  )
}

/**
 * Ähnliche Titel — aufgeklappt, einklappbar, geladen erst im Bild.
 *
 * Daniel am 15.09.2026: „aber einklappbar", dann „per default aufklappen".
 * Die Rechnung braucht den ganzen Hauptbestand (`titles.json`, mehrere
 * Megabyte). Geholt wird er deshalb erst, wenn der Bereich ins Bild scrollt —
 * wer das Panel oben liest und schließt, lädt nichts. Die gemeinsamen Merkmale
 * stehen je Zeile dabei, damit nachzulesen ist, warum ein Titel vorkommt.
 */
export function AehnlicheTitel({ title, data, onOpenTitle }: { title: Title; data: Dataset; onOpenTitle: (id: number) => void }) {
  const { t, tGenre, tKeyword } = useLang()
  const [open, setOpen] = useState(true)
  const [imBild, setImBild] = useState(false)
  /* Die Vergleichsliste gehört zu ihrer Art (Anime oder Cartoon): Wechselt das Panel ohne
     Neumontage von einem zum anderen, wäre die alte Liste die falsche (18.09.2026). */
  const westlich = Boolean(title.westlich)
  const [geladen, setGeladen] = useState<{ westlich: boolean; liste: Title[] } | undefined>()
  const alle = geladen?.westlich === westlich ? geladen.liste : undefined
  const bereich = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = bereich.current
    if (!el || imBild) return
    const beobachter = new IntersectionObserver((eintraege) => {
      if (eintraege.some((e) => e.isIntersecting)) setImBild(true)
    })
    beobachter.observe(el)
    return () => beobachter.disconnect()
  }, [imBild])

  useEffect(() => {
    if (!open || !imBild || alle) return
    let alive = true
    /* Cartoons tragen TMDB-Genres und -Schlagwörter — verglichen wird mit ihresgleichen (16.09.2026). */
    ;(westlich ? loadCartoons(data) : loadAllTitles(data))
      .then((liste) => {
        if (alive) setGeladen({ westlich, liste })
      })
      .catch(() => {
        if (alive) setGeladen({ westlich, liste: [] })
      })
    return () => {
      alive = false
    }
  }, [open, imBild, alle, data, westlich])

  const vorschlaege = useMemo(() => (open && alle ? aehnlicheTitel(title, alle) : []), [open, alle, title])
  const merkmalName = (m: string) => (m.startsWith('g:') ? tGenre(m.slice(2)) : tKeyword(m.slice(2)))

  return (
    <div ref={bereich}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="flex w-full cursor-pointer items-center gap-1.5 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span aria-hidden className={`transition-transform ${open ? 'rotate-90' : ''}`}>
          ›
        </span>
        {t('detail.aehnlich')}
      </button>

      {open && (
        <div className="mt-2">
          {alle === undefined ? (
            <p className="text-sm text-slate-400">{t('detail.aehnlichLaedt')}</p>
          ) : vorschlaege.length === 0 ? (
            <p className="text-sm text-slate-400">{t('detail.aehnlichKeine')}</p>
          ) : (
            /*
              **Kacheln statt Zeilen — das Bild und die Gemeinsamkeit lösen den Klick aus.**

              Vorher: ein 28×40-Pixel-Cover und darunter „gemeinsam: Real Robot,
              Roboter, Mecha" als grauer Fließtext. Daniel am 16.09.2026, mit Bild:
              „nutzer sind interessiert wenn das bild oder die gemeinsamkeiten dem
              geschmack passen. also entsprechend diese beiden hervorheben."

              Also beides größer: Poster im Format 2:3 mit 96 px Breite (dreimal so
              viel Fläche wie zuvor) und die Merkmale als Chips statt als Aufzählung.
              Zwei Kacheln je Reihe passen in die 32 rem des Panels, ohne dass ein
              Titel abgeschnitten wird; bei fünf Vorschlägen sind das drei Reihen.

              Genre und Keyword tragen verschiedene Farben: Das Genre sagt, was für
              ein Werk es ist, das Keyword, was darin vorkommt — zwei Fragen, die
              man beim Überfliegen auseinanderhalten können soll.
            */
            <ul className="grid grid-cols-2 gap-1.5">
              {vorschlaege.map((v) => (
                <li key={v.title.id}>
                  <button
                    type="button"
                    onClick={() => onOpenTitle(v.title.id)}
                    /*
                      **Cover über die volle Höhe, Name oben, Merkmale unten** (Daniel,
                      16.09.2026). Die feste Kachelhöhe ist der Grund, warum das geht:
                      Ohne sie richtet sich das Bild nach der Textmenge, und eine Kachel
                      mit dreizeiligem Titel hätte ein höheres Poster als die daneben.
                      144 px bei 96 px Breite ist das Posterformat 2:3.
                    */
                    className="flex h-36 w-full cursor-pointer items-stretch gap-2 rounded-lg p-1.5 text-left transition hover:bg-slate-100 dark:hover:bg-white/5"
                  >
                    {v.title.coverImage ? (
                      <img
                        {...coverBild(v.title.coverImage, 88)}
                        alt=""
                        loading="lazy"
                        className="h-full w-[88px] shrink-0 rounded-md object-cover shadow-sm"
                      />
                    ) : (
                      <span className="h-full w-[88px] shrink-0 rounded-md bg-slate-200 dark:bg-white/10" />
                    )}
                    {/* `justify-between` verankert: Name am oberen Rand, Chips am unteren. */}
                    <span className="flex min-w-0 flex-1 flex-col justify-between py-0.5">
                      <span className="line-clamp-3 text-sm font-medium leading-snug text-slate-700 dark:text-slate-200">
                        {anzeigeName(v.title)}
                      </span>
                      <span className="flex flex-wrap gap-1">
                        {[...new Set(v.gemeinsam)].map((m) => (
                          <span
                            key={m}
                            className={
                              m.startsWith('g:')
                                ? 'rounded bg-sky-500/10 px-1.5 py-px text-[10px] font-medium text-sky-700 dark:bg-sky-400/15 dark:text-sky-300'
                                : 'rounded bg-slate-500/10 px-1.5 py-px text-[10px] text-slate-600 dark:bg-white/10 dark:text-slate-300'
                            }
                          >
                            {merkmalName(m)}
                          </span>
                        ))}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}
