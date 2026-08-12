/**
 * Erzeugt die Prüfliste der Anbieter-Verweise ohne belegte Synchro.
 *
 * Der Hintergrund in einem Satz: Ein Stream-Verweis sagt, **dass** ein Titel
 * dort läuft — nicht, in welcher Sprache. Belegen kann die Pipeline das nur bei
 * ADN (Sprachcode `vde` je Folge) und Crunchyroll („(Deutsch)" im Kalender).
 * Bei YouTube, Netflix, Prime Video, RTL+, Joyn, Disney+ und Aniverse gibt es
 * gar keine maschinenlesbare Auskunft — dort steht dauerhaft „🇩🇪 ?".
 *
 * Diese Liste macht daraus eine abarbeitbare Reihenfolge: neueste zuerst,
 * ausschließlich Titel, die es **schon gibt**. Was erst erscheinen soll, lässt
 * sich nicht nachsehen und rutscht von selbst herein, sobald sein Termin
 * vorbei ist — die Liste wird bei jedem Lauf neu gebaut.
 *
 * Geprüftes verschwindet: Was in `data/dub-confirmed.yaml` steht, taucht hier
 * nicht mehr auf.
 *
 * Aufruf: npm run data:dub-checks
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, writeText } from './lib/util.ts'
import { loadDubChecks, dubKey } from './lib/dub-confirmed.ts'
import { loadWatchLinks } from './lib/curated.ts'
import { lastEpisodeDate } from '../shared/logic.ts'
import { anzeigeName } from '../shared/titles.ts'
import { todayIso } from '../shared/time.ts'
import { PLATFORMS, type PlatformId, type Release, type Title } from '../shared/types.ts'

/** Ein zu prüfender Verweis. */
interface Pruefpunkt {
  id: string
  titleId: number
  name: string
  platform: PlatformId
  url: string
  /** Datum, nach dem sortiert wird. */
  datum: string
  /** Woher das Datum stammt — das ändert, wie belastbar die Reihenfolge ist. */
  datumHerkunft: 'deutscher Termin' | 'japanisches Ende' | 'japanisches Jahr'
  /** Wer den Verweis geliefert hat. */
  herkunft: string
  /** Warum er ungeprüft ist. */
  grund: string
}

/**
 * Woher ein Verweis stammt.
 *
 * Die Angabe steht nicht im Datensatz — sie dort mitzuführen hieße, jedem
 * Besucher ein Feld auszuliefern, das nur die Kuratierung braucht. Hier wird
 * sie stattdessen aus denselben Rohdaten wieder hergeleitet, aus denen der
 * Verweis entstanden ist.
 */
function herkunftVon(titleId: number, url: string): string {
  if (anisearchUrls.get(titleId)?.has(url)) return 'aniSearch'
  if (anilistUrls.get(titleId)?.has(url)) return 'AniList'
  if (kuratierteUrls.has(url)) return 'Handarbeit'
  return 'abgeleitet'
}

/**
 * Warum wir es nicht selbst belegen konnten.
 *
 * Der Satz ist je Plattform derselbe, weil auch der Grund je Plattform
 * derselbe ist — es liegt nicht am einzelnen Titel, sondern daran, was die
 * Plattform überhaupt öffentlich sagt.
 */
const GRUND: Partial<Record<PlatformId, string>> = {
  youtube:
    'YouTube nennt in den Metadaten keine Tonspur. Ob der Kanal die deutsche Fassung hochgeladen hat, sieht man erst im Video.',
  netflix:
    'Netflix veröffentlicht keinen maschinenlesbaren Katalog; die Sprachliste steht nur im eingeloggten Player.',
  primevideo:
    'Prime Video nennt die Tonspuren erst auf der Produktseite, und die ist ohne Anmeldung unvollständig.',
  disneyplus: 'Disney+ hat keine öffentliche Schnittstelle; die Sprachwahl steht nur im Player.',
  rtlplus: 'RTL+ nennt die Sprachfassung nirgends öffentlich.',
  joyn: 'Joyn nennt die Sprachfassung nirgends öffentlich.',
  aniverse: 'aniverse.de ist von hier aus nicht erreichbar (TLS-Handshake bricht ab).',
  wow: 'WOW nennt die Sprachfassung nirgends öffentlich.',
  crunchyroll:
    'Der Simulcast-Kalender führt nur laufende Staffeln. Für Katalogtitel sagt er nichts — Fehlen ist dort kein Gegenbeweis.',
  adn: 'Der Titel steht nicht im ADN-Bestand mit Sprachcode vde. Möglich, dass er inzwischen dazugekommen ist.',
}

const heute = todayIso()
const titles = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8')) as Title[]
const releases = readJson<Release[]>('public/data/releases.json', [])
const anisearch = readJson<Record<number, { streams?: { provider: string; url: string }[] }>>(
  'data/anisearch.json',
  {},
)

/** Verweise, die aniSearch geliefert hat — je Titel. */
const anisearchUrls = new Map<number, Set<string>>()
for (const [id, eintrag] of Object.entries(anisearch)) {
  const menge = new Set((eintrag?.streams ?? []).map((s) => s.url))
  if (menge.size) anisearchUrls.set(Number(id), menge)
}

/** Verweise aus dem AniList-Cache. */
const anilistUrls = new Map<number, Set<string>>()
for (const datei of ['data/cache/anilist-media.json', 'data/cache/anilist-by-id.json']) {
  const roh = readJson<Record<string, { id?: number; externalLinks?: { url: string }[] }>>(datei, {})
  for (const media of Object.values(roh)) {
    if (!media?.id) continue
    const menge = anilistUrls.get(media.id) ?? new Set<string>()
    for (const l of media.externalLinks ?? []) menge.add(l.url)
    anilistUrls.set(media.id, menge)
  }
}

const kuratierteUrls = new Set(loadWatchLinks().flatMap((w) => w.links.map((l) => l.url)))

const bereitsGeprueft = new Set(loadDubChecks().map((c) => dubKey(c.anilistId, c.platform)))

/** Letzter bekannter deutscher Termin eines Titels. */
const letzterTermin = new Map<number, string>()
for (const r of releases) {
  const ende = lastEpisodeDate(r) ?? r.schedule.firstEpisodeDate
  const bisher = letzterTermin.get(r.titleId)
  if (!bisher || ende > bisher) letzterTermin.set(r.titleId, ende)
}

const punkte: Pruefpunkt[] = []
for (const title of titles) {
  for (const stream of title.streams) {
    if (stream.dub !== undefined) continue
    if (bereitsGeprueft.has(dubKey(title.id, stream.platform))) continue

    /**
     * Wonach sortiert wird — und warum nicht einfach nach dem japanischen Jahr.
     *
     * Gefragt ist „von heute in die Vergangenheit", also nach dem, was auf
     * Deutsch zuletzt passiert ist. Wo ein deutscher Termin bekannt ist, ist
     * das die richtige Zahl. Bei einem Katalogtitel von 1976 gibt es keinen —
     * dann bleibt das japanische Ende als grobe Einordnung, und die Liste sagt
     * dazu, dass es eine ist.
     */
    const deutsch = letzterTermin.get(title.id)
    const datum = deutsch ?? title.jpEnd ?? (title.jpYear ? `${title.jpYear}-12-31` : '')
    if (!datum) continue
    // Was noch nicht erschienen ist, kann niemand nachsehen. Es kommt von
    // selbst herein, sobald der Termin vorbei ist — die Liste wird neu gebaut.
    if (datum > heute) continue

    punkte.push({
      id: `${title.id}-${stream.platform}`,
      titleId: title.id,
      name: anzeigeName(title),
      platform: stream.platform,
      url: stream.url,
      datum,
      datumHerkunft: deutsch ? 'deutscher Termin' : title.jpEnd ? 'japanisches Ende' : 'japanisches Jahr',
      herkunft: herkunftVon(title.id, stream.url),
      grund: GRUND[stream.platform] ?? 'Für diese Plattform gibt es keine öffentliche Sprachangabe.',
    })
  }
}

punkte.sort((a, b) => b.datum.localeCompare(a.datum) || a.name.localeCompare(b.name, 'de'))

const nachPlattform = new Map<string, number>()
for (const p of punkte) nachPlattform.set(p.platform, (nachPlattform.get(p.platform) ?? 0) + 1)

const zeilen: string[] = [
  '# Prüfliste: Wo läuft es wirklich auf Deutsch?',
  '',
  `Stand ${heute} · **${punkte.length} offene Verweise** auf ${new Set(punkte.map((p) => p.titleId)).size} Titeln.`,
  '',
  'Erzeugt von `npm run data:dub-checks`, **nicht von Hand pflegen**. Was geprüft ist, gehört',
  'nach `data/dub-confirmed.yaml`; beim nächsten Lauf verschwindet es hier.',
  '',
  'Sortiert von heute in die Vergangenheit. Ausschließlich Titel, die es schon gibt —',
  'Künftiges lässt sich nicht nachsehen und rutscht von selbst herein, sobald sein Termin',
  'vorbei ist.',
  '',
  '**Datum** ist der letzte bekannte deutsche Termin. Fehlt der, steht dort das japanische',
  'Ende als grobe Einordnung; die Spalte sagt, was von beidem gemeint ist.',
  '',
  '| Offen je Plattform | Anzahl |',
  '|---|---|',
  ...[...nachPlattform.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `| ${PLATFORMS[p as PlatformId].name} | ${n} |`),
  '',
  '## Zu prüfen',
  '',
  '| # | Datum | Bezug | Titel | Anbieter | Verweis | Herkunft |',
  '|---|---|---|---|---|---|---|',
]

punkte.forEach((p, i) => {
  zeilen.push(
    `| ${i + 1} | ${p.datum} | ${p.datumHerkunft} | ${p.name.replace(/\|/g, '\\|')} | ${PLATFORMS[p.platform].name} | [${p.id}](${p.url}) | ${p.herkunft} |`,
  )
})

zeilen.push(
  '',
  '## Warum die einzelnen Plattformen unsicher sind',
  '',
  ...[...nachPlattform.keys()]
    .sort()
    .map((p) => `- **${PLATFORMS[p as PlatformId].name}:** ${GRUND[p as PlatformId] ?? '—'}`),
  '',
)

writeText('data/dub-pruefliste.md', zeilen.join('\n'))
log(`Prüfliste geschrieben: ${punkte.length} offene Verweise (data/dub-pruefliste.md)`)
for (const [p, n] of [...nachPlattform.entries()].sort((a, b) => b[1] - a[1])) log(`  · ${p}: ${n}`)
