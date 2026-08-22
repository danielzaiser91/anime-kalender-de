/**
 * Holt die Prüfergebnisse ab, die Daniel im Browser abgeschickt hat.
 *
 * Der Weg (21.08.2026): Er öffnet einen Titel beim Anbieter, die Erweiterung in
 * `extension/` blendet einen Knopf ein, der Klick schickt die gelesenen
 * Tonspuren an den Worker. Dieses Skript holt sie von dort und trägt sie in
 * `data/dub-confirmed.yaml` ein — die Datei bleibt die maßgebliche Fassung, der
 * Worker ist nur der Briefkasten dazwischen.
 *
 * Warum das kein Scraping ist: Die Seiten hat er selbst geöffnet, die
 * Erweiterung liest nur, was der Player ohnehin geladen hat. Für Netflix ist das
 * der einzige erlaubte Weg — deren `robots.txt` untersagt jeden automatisierten
 * Abruf.
 *
 * Aufruf: npm run data:pruefungen
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import {
  beschreibeBereiche,
  bildeBereiche,
  verteileAufStaffeln,
  type Staffeleintrag,
} from './lib/folgenbereiche.ts'
import { log, ROOT, warn } from './lib/util.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN
/** Nur zeigen, was entstünde — nichts schreiben, nichts abhaken. */
const TROCKEN = process.argv.includes('--trocken')

interface Pruefung {
  id: number
  plattform: string
  url: string
  sprachen: string | null
  befund: 'dub' | 'kein_dub' | 'weg'
  titel: string | null
  folgen: number | null
  folge_nr: number | null
  staffel: number | null
  notiz: string | null
  gemeldet_am: string
}

if (!TOKEN) {
  warn('LAUF_TOKEN fehlt — ohne das Token gibt der Worker die Prüfungen nicht heraus.')
  process.exit(0)
}

const antwort = await fetch(`${WORKER}/pruefung?token=${encodeURIComponent(TOKEN)}`)
if (!antwort.ok) {
  warn(`Prüfungen nicht abrufbar: HTTP ${antwort.status}`)
  process.exit(1)
}
const { pruefungen } = (await antwort.json()) as { pruefungen: Pruefung[] }

if (!pruefungen.length) {
  log('Keine neuen Prüfungen.')
  process.exit(0)
}

/**
 * Von der Adresse zum Titel.
 *
 * Die Erweiterung meldet die Adresse, die im Browser stand. Unser Datensatz
 * führt dieselbe Adresse an einem oder mehreren Titeln — bei Demon Slayer teilen
 * sich fünf AniList-Einträge eine Netflix-Adresse, und eine Prüfung belegt dann
 * alle fünf.
 */
const titles = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8'))
const liste: Array<{
  id: number
  titleDe?: string
  titleEn?: string
  episodes?: number
  jpYear?: number
  jpSeason?: string
  streams?: Array<{ platform: string; url: string }>
}> =
  Array.isArray(titles) ? titles : (titles.titles ?? Object.values(titles))

const nachUrl = new Map<string, number[]>()
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (!s.url) continue
    const liste2 = nachUrl.get(s.url) ?? []
    liste2.push(t.id)
    nachUrl.set(s.url, liste2)
  }
}

/** Ein Zeitpunkt als Datum in Ortszeit Europe/Berlin. */
function berlinDatum(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

const heute = berlinDatum(new Date().toISOString())
const zeilen: string[] = []
let uebernommen = 0
const offenGeblieben: string[] = []
/** Kennungen der Meldungen, die wirklich eingetragen wurden. */
const erledigteIds = new Set<number>()

/**
 * Die Staffeln hinter einer Anbieteradresse, in Ausstrahlungsreihenfolge.
 *
 * Die Reihenfolge entscheidet über jede Zuordnung: Rechnet sie falsch, landet
 * ein Befund an der falschen Staffel und sieht dabei aus wie geprüft. Sortiert
 * wird deshalb nach japanischer Erstausstrahlung, nicht nach AniList-Kennung —
 * die steigt zwar meistens mit der Zeit, aber eben nur meistens.
 */
const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
function staffelnDerAdresse(ids: number[]): Staffeleintrag[] {
  const eintraege = ids
    .map((id) => liste.find((x) => x.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t?.episodes))
  if (eintraege.length !== ids.length) return []
  return eintraege
    .sort((a, b) => {
      const jahr = (a.jpYear ?? 0) - (b.jpYear ?? 0)
      if (jahr) return jahr
      return (JAHRESZEIT[a.jpSeason ?? ''] ?? 0) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 0)
    })
    .map((t) => ({ id: t.id, titel: t.titleDe ?? t.titleEn ?? String(t.id), folgen: t.episodes as number }))
}

/**
 * Meldungen zur selben Adresse gehören zusammen.
 *
 * Bis zum 22.08.2026 schrieb jede Meldung ein `dub` für die **ganze** Reihe.
 * Daniel prüfte sieben Folgen einer Serie, sechs davon ohne deutschen Ton — am
 * Ende stand „kein Deutsch", obwohl er die deutsche Fassung gesehen hatte. Sein
 * Urteil: „wenn die extension alle 7 auf kein deutsch gesetzt hat ist die logik
 * komplett schlecht". Deshalb wird jetzt erst gebündelt, dann gefolgert.
 */
const jeAdresse = new Map<string, Pruefung[]>()
for (const p of pruefungen) {
  const schluessel = `${p.plattform}\u0000${p.url}`
  jeAdresse.set(schluessel, [...(jeAdresse.get(schluessel) ?? []), p])
}

for (const gruppe of jeAdresse.values()) {
  const p = gruppe[gruppe.length - 1]!
  const ids = nachUrl.get(p.url) ?? []
  if (!ids.length) {
    offenGeblieben.push(`${p.url} — im Datensatz nicht gefunden`)
    continue
  }

  // Ein „weg" hebt alles auf: Was der Anbieter nicht mehr zeigt, hat keine
  // Folgenbereiche mehr.
  const weg = gruppe.find((x) => x.befund === 'weg')

  const meldungen = gruppe
    .filter((x) => x.befund !== 'weg' && x.folge_nr != null)
    .map((x) => ({ folge: x.folge_nr as number, dub: x.befund === 'dub' }))
  const { bereiche, widersprueche } = meldungen.length
    ? bildeBereiche(meldungen)
    : { bereiche: [], widersprueche: [] as number[] }

  const sprachen = p.sprachen ? (JSON.parse(p.sprachen) as string[]) : []
  /**
   * Eine durchgezählte Folgennummer gehört genau **einer** Staffel.
   *
   * Netflix zählt Jujutsu Kaisen durch bis 59 (Daniel, 22.08.2026: „staffel 1
   * (bis 24) staffel 2 (bis 47) staffel 3 (bis 59)"). Unser Datensatz führt
   * dieselbe Adresse an drei AniList-Einträgen. Vorher bekamen alle drei
   * denselben Befund — eine Prüfung an Folge 59 hätte also auch Staffel 1 als
   * geprüft ausgewiesen, obwohl niemand sie angesehen hat.
   */
  const staffeln = staffelnDerAdresse(ids)
  const verteilbar = bereiche.length > 0 && staffeln.length > 1

  for (const id of ids) {
    const t = liste.find((x) => x.id === id)
    /** Die Bereiche dieser Staffel, in ihrer eigenen Zählung. */
    let eigene = bereiche
    if (verteilbar) {
      eigene = bereiche
        .flatMap((b) => verteileAufStaffeln(b, staffeln))
        .filter((v) => v.staffel.id === id)
        .map((v) => ({ von: v.von, bis: v.bis, dub: v.dub, belegt: [] as number[] }))
      // Keine geprüfte Folge in dieser Staffel — dann gibt es auch nichts zu
      // melden. Schweigen ist hier die richtige Antwort.
      if (!eigene.length) continue
    }

    zeilen.push('')
    zeilen.push(`- anilistId: ${id}`)
    if (t?.titleDe || t?.titleEn) zeilen.push(`  title: ${JSON.stringify(t.titleDe ?? t.titleEn)}`)
    zeilen.push(`  platform: ${p.plattform}`)
    if (weg) {
      zeilen.push('  available: false')
    } else if (eigene.length) {
      const ganz = eigene.length === 1 && eigene[0]!.von === 1 && eigene[0]!.bis === (t?.episodes ?? -1)
      zeilen.push(`  dub: ${eigene.some((b) => b.dub)}`)
      // Deckt ein einziger Bereich die Staffel vollständig, sagt `dub` schon
      // alles — dann wären Bereiche nur Rauschen.
      if (!ganz) {
        zeilen.push('  dubRanges:')
        for (const b of eigene) {
          zeilen.push(`    - from: ${b.von}`)
          zeilen.push(`      to: ${b.bis}`)
          zeilen.push(`      dub: ${b.dub}`)
          if (b.belegt.length) zeilen.push(`      checked: [${b.belegt.join(', ')}]`)
        }
      }
    } else {
      zeilen.push(`  dub: ${p.befund === 'dub'}`)
    }
    // Ortszeit, nicht UTC: Eine Meldung um 00:41 Uhr trug sonst das Datum
    // des Vortags (22.08.2026).
    zeilen.push(`  checkedAt: '${berlinDatum(p.gemeldet_am)}'`)
    const notiz = [
      eigene.length ? beschreibeBereiche(eigene) : '',
      verteilbar ? `Anbieter zählt durch, hier auf die Staffel umgerechnet` : '',
      sprachen.length ? `Tonspuren: ${sprachen.join(', ')}` : '',
      widersprueche.length ? `Widersprüchliche Meldungen zu Folge ${widersprueche.join(', ')}` : '',
      p.notiz ?? '',
    ]
      .filter(Boolean)
      .join(' — ')
    if (notiz) zeilen.push(`  note: ${JSON.stringify(notiz)}`)
    uebernommen++
  }
  for (const x of gruppe) erledigteIds.add(x.id)
}

if (zeilen.length && !TROCKEN) {
  const p = resolve(ROOT, 'data/dub-confirmed.yaml')
  const alt = readFileSync(p, 'utf8')
  const kopf = `\n# --- Aus dem Browser gemeldet, abgeholt am ${heute} ---`
  writeFileSync(p, alt.trimEnd() + '\n' + kopf + '\n' + zeilen.join('\n') + '\n')
}

log(`${pruefungen.length} Prüfungen abgeholt, ${uebernommen} Einträge geschrieben`)
for (const o of offenGeblieben) warn(o)
if (TROCKEN) {
  console.log(zeilen.join(String.fromCharCode(10)))
  log(String(erledigteIds.size) + " Meldungen blieben im Briefkasten (Trockenlauf)")
  process.exit(0)
}
if (erledigteIds.size) {
  const quittung = await fetch(`${WORKER}/pruefung`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
    body: JSON.stringify({ uebernommen: [...erledigteIds] }),
  })
  log(quittung.ok
    ? `${erledigteIds.size} Meldungen im Worker abgehakt`
    : `Abhaken fehlgeschlagen (HTTP ${quittung.status}) — sie kommen beim nächsten Lauf erneut`)
}
if (offenGeblieben.length) {
  warn(`${offenGeblieben.length} Meldung(en) bleiben im Briefkasten, bis sie zugeordnet sind.`)
}
