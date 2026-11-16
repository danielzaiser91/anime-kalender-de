import { existsSync } from 'node:fs'
import { SYNOPSIS_GROUPS } from '../../shared/types.ts'
import type { Release, Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { log, readJson, writeText } from '../lib/util.ts'
import { adresseMehrfach, REGELN, zaehleMaengel, type Kontext } from '../lib/maengel-regeln.ts'
import { MAENGEL_DATEI, schreibeFort, serialisiere, type Register } from '../lib/maengel-register.ts'
import { COVER_LUECKEN } from './13-11-cover-luecken.ts'

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

/** Erzeugt den Kontext der Regeln aus den fertig geschriebenen Dateien. */
function baueKontext(titel: Title[], heute: string): Kontext {
  const events = readJson<{ titleId?: number; date?: string }[]>(`${OUT}/events.json`, [])
  const releases = new Map<number, Release[]>()
  for (const r of readJson<Release[]>(`${OUT}/releases.json`, [])) (releases.get(r.titleId) ?? releases.set(r.titleId, []).get(r.titleId)!).push(r)
  return {
    heute,
    coverGrund: readJson(COVER_LUECKEN, {}),
    kuenftig: new Set(events.filter((e) => (e.date ?? '') >= heute).map((e) => e.titleId!)),
    releases,
    adresseMehrfach: adresseMehrfach(titel),
    ...leser(),
  }
}

/**
 * Schreibt `data/maengel.json`: je Mangelart die Titel, bei denen es fehlt, schwach oder falsch ist (Regeln: `pipeline/lib/maengel-regeln.ts`), mit `seit` aus der
 * committeten Vorfassung. Nur Hauptbestand (`titles.json`); der Katalog ohne Synchro fehlt zu Recht fast überall. Läuft hinter den Cover-Lücken, deren Gründe es liest.
 */
export function schreibeMaengel(): void {
  const heute = todayIso()
  const titel = readJson<Title[]>(`${OUT}/titles.json`, [])
  const treffer = zaehleMaengel(titel, baueKontext(titel, heute))
  const alt = readJson<Register | null>(MAENGEL_DATEI, null)
  const neu = schreibeFort(alt, treffer, REGELN.map((r) => r.art), heute)
  writeText(MAENGEL_DATEI, serialisiere(neu))
  const offen = Object.values(neu.zaehler).reduce((s, z) => s + z.offen, 0)
  log(`maengel.json: ${offen} offene Mängel in ${REGELN.length} Arten (${neu.zeilen.length} Zeilen)`)
}
