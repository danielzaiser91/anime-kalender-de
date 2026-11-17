import { execFileSync } from 'node:child_process'
import { existsSync } from 'node:fs'
import { SYNOPSIS_GROUPS } from '../../shared/types.ts'
import type { Release, Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { log, readJson, ROOT, warn, writeText } from '../lib/util.ts'
import { discTitelIds } from '../lib/erstausgabe-ohne-weg.ts'
import { adresseMehrfach, COVER_BEKANNT_DATEI, REGELN, zaehleMaengel, type Kontext } from '../lib/maengel-regeln.ts'
import { ladeHandbelege } from '../lib/dub-confirmed.ts'
import { ANBIETER_STAFFELN_DATEI, letzterNetflixStart, staffelZuordnung } from '../lib/maengel-staffel.ts'
import { franchiseTeile } from '../lib/folgenzahl-erklaerung.ts'
import { baueNeinGilt } from '../lib/maengel-nein.ts'
import { MAENGEL_DATEI, schreibeFort, serialisiere, type Register } from '../lib/maengel-register.ts'

const OUT = 'public/data'

/** Liest je Kennung die Folgen- bzw. Synopsen-Datei erst beim Zugriff (nur Serien brauchen die eine, 32 Gruppen die andere). */
function leser(): Pick<Kontext, 'folgen' | 'synopse'> {
  const gruppen = new Map<number, Record<number, { de?: string; en?: string }>>()
  return {
    folgen: (id) => (existsSync(`${OUT}/folgen/${id}.json`) ? readJson(`${OUT}/folgen/${id}.json`, {}) : undefined),
    synopse: (id) => {
      const g = id % SYNOPSIS_GROUPS
      if (!gruppen.has(g)) gruppen.set(g, readJson(`${OUT}/synopses/${g}.json`, {}))
      return gruppen.get(g)![id]
    },
  }
}

/** Die Handbelege werden erst gelesen, wenn ein Titel sie braucht. */
function lazyNeinGilt(): Kontext['neinGilt'] {
  let gilt: Kontext['neinGilt'] | undefined
  return (id, plattform, ab) => (gilt ??= baueNeinGilt(ladeHandbelege()))(id, plattform, ab)
}

/** Erzeugt den Kontext der Regeln aus den fertig geschriebenen Dateien. */
function baueKontext(titel: Title[], heute: string): Kontext {
  const events = readJson<{ titleId?: number; date?: string }[]>(`${OUT}/events.json`, [])
  const alle = readJson<Release[]>(`${OUT}/releases.json`, [])
  const releases = new Map<number, Release[]>()
  for (const r of alle) (releases.get(r.titleId) ?? releases.set(r.titleId, []).get(r.titleId)!).push(r)
  const teile = franchiseTeile(titel)
  return {
    heute,
    coverBekannt: readJson(COVER_BEKANNT_DATEI, {}),
    kuenftig: new Set(events.filter((e) => (e.date ?? '') >= heute).map((e) => e.titleId!)),
    releases,
    discTitel: discTitelIds(alle),
    adresseMehrfach: adresseMehrfach(titel),
    staffelZuordnung: staffelZuordnung(titel, readJson(ANBIETER_STAFFELN_DATEI, {}), (id) => letzterNetflixStart(releases.get(id) ?? [])),
    franchiseTeile: (t) => (teile.get(t.franchiseId ?? t.id) ?? []).filter((x) => x.id !== t.id),
    neinGilt: lazyNeinGilt(),
    ...leser(),
  }
}

/**
 * Die Vorfassung ist der **committete** Stand (`git show HEAD:`), nicht die Datei im Arbeitsverzeichnis: Ein Neuversuch in `commit-data.sh` baut sonst
 * mit dem Register des ersten Versuchs als Vorfassung, und `ereignis`/neu/behoben der committeten Datei fehlten. Fehlt die Datei in HEAD, ist es der Erstlauf;
 * ist sie nicht lesbar, wird ohne Vorfassung gebaut und der Hinweis geht über die Wache in die Lauf-Meldung (ein Abbruch risse den ganzen Bestandsbau mit).
 */
function ladeVorfassung(): { alt: Register | null; hinweis?: string } {
  let text: string
  try {
    text = execFileSync('git', ['show', `HEAD:${MAENGEL_DATEI}`], { cwd: ROOT, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 64 * 1024 * 1024 })
  } catch {
    return { alt: null }
  }
  try {
    const alt = JSON.parse(text) as Register
    if (!alt.zaehler || !Array.isArray(alt.zeilen)) throw new Error('Form')
    return { alt }
  } catch {
    return { alt: null, hinweis: `Vorfassung von ${MAENGEL_DATEI} nicht lesbar, ohne Vorfassung gebaut (alles gilt als Bestand)` }
  }
}

/**
 * Schreibt `data/maengel.json`: je Mangelart die Titel, bei denen es fehlt, schwach oder falsch ist (Regeln: `pipeline/lib/maengel-regeln.ts`), mit `seit` aus der
 * committeten Vorfassung. Nur Hauptbestand (`titles.json`); der Katalog ohne Synchro fehlt zu Recht fast überall.
 */
export function schreibeMaengel(): void {
  const heute = todayIso()
  const titel = readJson<Title[]>(`${OUT}/titles.json`, [])
  const treffer = zaehleMaengel(titel, baueKontext(titel, heute))
  const { alt, hinweis } = ladeVorfassung()
  const arten = REGELN.map((r) => ({ art: r.art, wirkung: r.wirkung, wer: r.wer }))
  const neu = { ...schreibeFort(alt, treffer, arten, heute, new Set(titel.map((t) => t.id))), ...(hinweis ? { hinweis } : {}) }
  writeText(MAENGEL_DATEI, serialisiere(neu))
  const offen = Object.values(neu.zaehler).reduce((s, z) => s + z.offen, 0)
  log(`maengel.json: ${offen} offene Mängel in ${REGELN.length} Arten (${neu.zeilen.length} Zeilen)`)
  if (hinweis) warn(hinweis)
}
