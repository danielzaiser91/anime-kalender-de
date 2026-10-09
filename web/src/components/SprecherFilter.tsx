import { useContext, useEffect, useId, useMemo, useRef, useState, type FocusEvent, type KeyboardEvent } from 'react'
import { sprecherGruppe } from '@shared/sprecher.ts'
import { toggleFilter, type FilterState } from '../lib/filters.ts'
import { useLang, type Translate } from '../lib/i18n.tsx'
import { gruppenDer, TitelNamenContext, useSprecherAuswahl, useSprecherGruppen, useSprecherIndex } from '../lib/sprecher.ts'
import { kurzeTitelzeile, sprecherVorschlaege, type SprecherEintrag } from '../lib/sprecher-auswahl.ts'

/** Ab so vielen Zeichen wird vorgeschlagen — bei einem Buchstaben wären es Hunderte beliebiger Namen. */
const MIN_ZEICHEN = 2
const MAX_VORSCHLAEGE = 8
const FOKUS = 'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400'
const LINK = 'cursor-pointer font-semibold text-ak-akzent-text underline'

function useEntprellt<T>(wert: T, ms: number): T {
  const [spaeter, setSpaeter] = useState(wert)
  useEffect(() => {
    const id = setTimeout(() => setSpaeter(wert), ms)
    return () => clearTimeout(id)
  }, [wert, ms])
  return spaeter
}

/** Meldung mit „Erneut versuchen"; `mouseDown` hält den Fokus im Eingabefeld, damit die Vorschläge offen bleiben. */
function FehlerZeile({ t, text, nochmal }: { t: Translate; text: string; nochmal: () => void }) {
  return (
    <div className="flex items-center gap-2 p-3 text-xs text-ak-leise">
      {text}
      <button type="button" className={LINK} onMouseDown={(e) => e.preventDefault()} onClick={nochmal}>
        {t('filter.sprecher.nochmal')}
      </button>
    </div>
  )
}

/** Eine Zeile der Vorschläge: Name wählt, der Pfeil daneben klappt die Titel auf und wählt nichts. */
function VorschlagZeile(p: {
  t: Translate
  eintrag: SprecherEintrag
  id: string
  aktiv: boolean
  aufgeklappt: boolean
  titel?: string[]
  ladefehler: boolean
  waehlen: () => void
  auf: () => void
}) {
  const { t, eintrag, titel } = p
  const [name, anzahl] = eintrag
  return (
    <div className="flex flex-wrap items-stretch border-b border-ak-linie last:border-b-0">
      <div
        role="option"
        id={p.id}
        aria-selected={p.aktiv}
        onMouseDown={(e) => e.preventDefault()}
        onClick={p.waehlen}
        className={['min-h-11 min-w-0 flex-1 cursor-pointer px-3 py-2 hover:bg-emerald-500/10', p.aktiv ? 'bg-emerald-500/10' : ''].join(' ')}
      >
        <div className="flex items-baseline justify-between gap-2 text-sm font-medium text-ak-text">
          <span>{name}</span>
          <span className="shrink-0 text-xs font-normal text-ak-leise">{t('filter.sprecher.titelZahl', { n: anzahl })}</span>
        </div>
        {!p.aufgeklappt && <div className="mt-0.5 line-clamp-2 text-xs text-ak-leise">{titel ? kurzeTitelzeile(titel) : p.ladefehler ? '' : '…'}</div>}
      </div>
      <button
        type="button"
        aria-expanded={p.aufgeklappt}
        aria-label={t(p.aufgeklappt ? 'filter.sprecher.zuklappen' : 'filter.sprecher.aufklappen', { name })}
        onMouseDown={(e) => e.preventDefault()}
        onClick={p.auf}
        className={`min-h-11 w-11 shrink-0 cursor-pointer border-l border-ak-linie text-ak-leise hover:bg-ak-flaeche-2 ${FOKUS}`}
      >
        <span aria-hidden="true">{p.aufgeklappt ? '▾' : '▸'}</span>
      </button>
      {p.aufgeklappt && (
        <ul className="basis-full list-inside list-disc px-3 pb-2 pl-5 text-xs text-ak-leise">
          {(titel ?? []).map((n, k) => (
            <li key={k}>{n}</li>
          ))}
        </ul>
      )}
    </div>
  )
}

/** Die gewählten Sprecher als Pillen: Name, Schalter mit/ohne, Entfernen. */
function SprecherPillen({ t, filters, onChange }: { t: Translate; filters: FilterState; onChange: (next: FilterState) => void }) {
  const knopf = `inline-flex min-h-7 min-w-7 cursor-pointer items-center justify-center rounded-full px-2 text-xs font-semibold ${FOKUS}`
  const pillen = [...filters.sprecher.map((name) => ({ name, istMit: true })), ...filters.excluded.sprecher.map((name) => ({ name, istMit: false }))]
  const tausche = (name: string, ziel: 'include' | 'exclude') => onChange(toggleFilter(filters, 'sprecher', name, ziel))
  return (
    <div className="mt-2 flex flex-wrap gap-1.5" data-testid="sprecher-pillen">
      {pillen.map(({ name, istMit }) => {
        const art = t(istMit ? 'filter.sprecher.mit' : 'filter.sprecher.ohne')
        return (
          <span
            key={name}
            className={[
              'inline-flex items-center gap-1 rounded-full border py-0.5 pr-1 pl-3 text-xs font-medium',
              istMit
                ? 'border-emerald-500/50 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300'
                : 'border-rose-400/70 bg-rose-500/10 text-rose-600 dark:border-rose-400/50 dark:text-rose-300',
            ].join(' ')}
          >
            {name}
            <button type="button" onClick={() => tausche(name, istMit ? 'exclude' : 'include')} aria-label={t('filter.sprecher.umschalten', { name, art })} className={`${knopf} bg-black/10 dark:bg-white/10`}>
              {art}
            </button>
            <button type="button" onClick={() => tausche(name, istMit ? 'include' : 'exclude')} aria-label={t('filter.entfernen', { name })} className={knopf}>
              <span aria-hidden="true">×</span>
            </button>
          </span>
        )
      })}
    </div>
  )
}

/** Hinweise unter den Pillen: Ladezustand, Fehler der Titeldaten, Verknüpfungsregel. */
function SprecherStand({ t, filters }: { t: Translate; filters: FilterState }) {
  const auswahl = useSprecherAuswahl(filters)
  return (
    <>
      {auswahl.fehler && (
        <p className="mt-2 text-xs text-rose-600 dark:text-rose-300">
          {t('filter.sprecher.datenFehler')}{' '}
          <button type="button" className={LINK} onClick={auswahl.nochmal}>
            {t('filter.sprecher.nochmal')}
          </button>
        </p>
      )}
      {auswahl.laedt && <p className="mt-2 text-xs text-ak-leise">{t('filter.sprecher.datenLaedt')}</p>}
      <p className="mt-2 text-xs text-ak-leise">{t('filter.sprecher.hinweis')}</p>
    </>
  )
}

type Vorschlaege = ReturnType<typeof useVorschlaege>

/** Index laden, entprellt vorschlagen, Titel der Vorschläge nachladen — alles, was das Feld darunter braucht. */
function useVorschlaege(eingabe: string, fokus: boolean, gewaehlt: readonly string[]) {
  const anfrage = useEntprellt(eingabe.trim(), 120)
  const index = useSprecherIndex()
  const vorschlag = useMemo(
    () => (index.index && anfrage.length >= MIN_ZEICHEN ? sprecherVorschlaege(index.index.sprecher, anfrage, new Set(gewaehlt), MAX_VORSCHLAEGE) : undefined),
    [index.index, anfrage, gewaehlt],
  )
  const treffer = vorschlag?.treffer ?? []
  /* Gruppen nur holen, solange die Vorschläge zu sehen sind. */
  const gruppen = useSprecherGruppen(fokus ? gruppenDer(treffer.map((e) => e[0])) : [])
  return { anfrage, index, vorschlag, treffer, gruppen }
}

/** Die Liste der Vorschläge mit allen Zuständen: Index lädt/fehlt, zu kurz, kein Treffer, Treffer. Welche Zeilen aufgeklappt sind, weiß nur sie. */
function Vorschlagsliste({ t, id, v, aktiv, zuKurz, waehlen }: { t: Translate; id: string; v: Vorschlaege; aktiv: number; zuKurz: boolean; waehlen: (name: string) => void }) {
  const titelName = useContext(TitelNamenContext)
  const [offen, setOffen] = useState<ReadonlySet<string>>(new Set())
  const { index, vorschlag, treffer, gruppen } = v
  /* Im scrollenden Filterkasten die Vorschläge ins Bild holen (am Handy liegt das Feld oft am unteren Rand). */
  const liste = useRef<HTMLDivElement>(null)
  const hatVorschlag = !!vorschlag
  useEffect(() => {
    liste.current?.scrollIntoView({ block: 'nearest' })
  }, [treffer.length, hatVorschlag])
  const titelVon = (name: string): string[] | undefined =>
    gruppen.gruppe(sprecherGruppe(name))?.[name]
      ?.map((x) => titelName?.(x.id))
      .filter((n): n is string => !!n)
      .sort((a, b) => a.localeCompare(b, 'de'))
  const auf = (name: string) =>
    setOffen((alt) => {
      const neu = new Set(alt)
      if (!neu.delete(name)) neu.add(name)
      return neu
    })
  const hinweis = (text: string) => <div className="p-3 text-xs text-ak-leise">{text}</div>
  return (
    <div ref={liste} id={id} role="listbox" aria-label={t('filter.sprecher')} className="mt-1.5 max-h-72 overflow-y-auto overscroll-contain rounded-xl border border-ak-rand bg-ak-flaeche">
      {index.fehler ? (
        <FehlerZeile t={t} text={t('filter.sprecher.fehler')} nochmal={index.nochmal} />
      ) : !index.index || !vorschlag ? (
        hinweis(zuKurz && index.index ? t('filter.sprecher.mindestens') : t('filter.sprecher.laedt'))
      ) : !treffer.length ? (
        hinweis(t('filter.sprecher.keiner'))
      ) : (
        <>
          {treffer.map((eintrag, i) => (
            <VorschlagZeile
              key={eintrag[0]}
              t={t}
              eintrag={eintrag}
              id={`${id}-${i}`}
              aktiv={i === aktiv}
              aufgeklappt={offen.has(eintrag[0])}
              titel={titelVon(eintrag[0])}
              ladefehler={gruppen.fehler}
              waehlen={() => waehlen(eintrag[0])}
              auf={() => auf(eintrag[0])}
            />
          ))}
          {vorschlag.mehr > 0 && <div className="p-2 text-center text-xs text-ak-leise">{t('filter.sprecher.mehr', { n: vorschlag.mehr })}</div>}
          {gruppen.fehler && <FehlerZeile t={t} text={t('filter.sprecher.fehler')} nochmal={gruppen.nochmal} />}
        </>
      )}
    </div>
  )
}

/**
 * **Sprecher-Filter der Datenbank**: Eingabe mit Vorschlägen aus dem Sprecher-Index, jede Wahl wird eine Pille, die zwischen
 * „mit" und „ohne" umschaltet. Verknüpfung siehe `SprecherAuswahl`. Die Vorschläge stehen im Fluss der Seite statt als
 * Schwebefenster, weil das Filterfeld selbst scrollt und ein Schwebefenster dort abgeschnitten würde.
 */
export function SprecherFilter({ filters, onChange, mode }: { filters: FilterState; onChange: (next: FilterState) => void; mode: 'include' | 'exclude' }) {
  const { t } = useLang()
  const listenId = useId()
  const [eingabe, setEingabe] = useState('')
  const [fokus, setFokus] = useState(false)
  const [aktiv, setAktiv] = useState(0)
  const gewaehlt = useMemo(() => [...filters.sprecher, ...filters.excluded.sprecher], [filters.sprecher, filters.excluded.sprecher])
  const v = useVorschlaege(eingabe, fokus, gewaehlt)
  const treffer = v.treffer
  useEffect(() => setAktiv(0), [v.anfrage])

  const waehlen = (name: string) => {
    onChange(toggleFilter(filters, 'sprecher', name, mode))
    setEingabe('')
  }
  const taste = (e: KeyboardEvent<HTMLInputElement>) => {
    if ((e.key === 'ArrowDown' || e.key === 'ArrowUp') && treffer.length) {
      e.preventDefault()
      setAktiv((a) => (a + (e.key === 'ArrowDown' ? 1 : treffer.length - 1)) % treffer.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      /* Innerhalb der Entprellung gilt, was jetzt im Feld steht, nicht der Vorschlag der vorigen Eingabe. */
      const aktuell = v.anfrage === eingabe.trim() ? treffer : v.index.index && eingabe.trim().length >= MIN_ZEICHEN ? sprecherVorschlaege(v.index.index.sprecher, eingabe.trim(), new Set(gewaehlt), MAX_VORSCHLAEGE).treffer : []
      const ziel = aktuell[v.anfrage === eingabe.trim() ? aktiv : 0]
      if (ziel) waehlen(ziel[0])
    } else if (e.key === 'Escape') setEingabe('')
  }
  const verlassen = (e: FocusEvent<HTMLDivElement>) => {
    if (!e.currentTarget.contains(e.relatedTarget)) setFokus(false)
  }
  const menueOffen = fokus && eingabe.trim().length > 0

  return (
    <div className="w-full" onFocus={() => (v.index.starten(), setFokus(true))} onBlur={verlassen}>
      <input
        type="text"
        role="combobox"
        value={eingabe}
        onChange={(e) => setEingabe(e.target.value)}
        onKeyDown={taste}
        placeholder={t('filter.sprecher.platzhalter')}
        aria-label={t('filter.sprecher')}
        aria-expanded={menueOffen}
        aria-controls={listenId}
        aria-autocomplete="list"
        aria-activedescendant={menueOffen && treffer[aktiv] ? `${listenId}-${aktiv}` : undefined}
        autoComplete="off"
        autoCapitalize="off"
        spellCheck={false}
        enterKeyHint="done"
        className="w-full rounded-full border border-ak-rand bg-ak-flaeche px-3 py-1.5 text-sm text-ak-text"
      />
      {menueOffen && <Vorschlagsliste t={t} id={listenId} v={v} aktiv={aktiv} zuKurz={eingabe.trim().length < MIN_ZEICHEN} waehlen={waehlen} />}
      {gewaehlt.length > 0 && <SprecherPillen t={t} filters={filters} onChange={onChange} />}
      {gewaehlt.length > 0 && <SprecherStand t={t} filters={filters} />}
    </div>
  )
}
