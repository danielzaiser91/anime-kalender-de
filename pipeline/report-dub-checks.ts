/**
 * Erzeugt die Prüfliste der Anbieter-Verweise ohne belegte Synchro.
 *
 * Der Hintergrund in einem Satz: Ein Stream-Verweis sagt, **dass** ein Titel
 * dort läuft — nicht, in welcher Sprache. Belegen kann die Pipeline das nur bei
 * ADN (Sprachcode `vde` je Folge) und Crunchyroll („(Deutsch)" im Kalender).
 * Bei YouTube, Netflix, Prime Video, RTL+, Joyn, Disney+ und Aniverse gibt es
 * gar keine maschinenlesbare Auskunft — dort steht dauerhaft „🇩🇪 ?".
 *
 * **Eine Zeile ist eine Reihe auf einem Anbieter**, nicht eine einzelne
 * Staffel. Der Grund kommt aus dem ersten Prüfdurchgang (Daniel, 12.08.2026):
 * Wer den Crunchyroll-Verweis von „Attack on Titan" öffnet, sieht dort alle
 * Staffeln, die OADs und den Film auf einmal — und kann sie auch alle auf
 * einmal beantworten. Zehn Zeilen für zehn Staffeln derselben Serie wären zehn
 * Mal derselbe Klick.
 *
 * Sortiert von heute in die Vergangenheit, ausschließlich Titel, die es **schon
 * gibt**. Was erst erscheinen soll, lässt sich nicht nachsehen und rutscht von
 * selbst herein, sobald sein Termin vorbei ist — die Liste wird bei jedem Lauf
 * neu gebaut. Geprüftes verschwindet: Was in `data/dub-confirmed.yaml` steht,
 * taucht hier nicht mehr auf.
 *
 * Aufruf: npm run data:dub-checks
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, readJson, ROOT, writeText } from './lib/util.ts'
import { loadDubChecks, dubKey } from './lib/dub-confirmed.ts'
import { loadWatchLinks } from './lib/curated.ts'
import { lastEpisodeDate } from '../shared/logic.ts'
import { anzeigeName, ohneStaffelEins, reihenVertreter } from '../shared/titles.ts'
import { todayIso } from '../shared/time.ts'
import { PLATFORMS, type Franchises, type PlatformId, type Release, type Title } from '../shared/types.ts'

/** Ein einzelner Verweis, der noch bestätigt werden muss. */
interface Offen {
  titleId: number
  name: string
  url: string
  datum: string
  datumHerkunft: 'deutscher Termin' | 'japanisches Ende' | 'japanisches Jahr'
  herkunft: string
}

/**
 * Anbieter, die ein laufendes Abo verlangen, um überhaupt nachsehen zu können.
 *
 * Daniel am 21.08.2026: „ich hol mir kein rtl+ abo um das zu prüfen". Eine
 * Zeile, die niemand ohne laufende Kosten prüfen kann, gehört nicht in eine
 * Arbeitsliste — dort steht, was heute abzuarbeiten ist.
 *
 * Verloren geht dabei nichts: Diese Zeilen wandern nach
 * `data/dub-pruefliste-zurueckgestellt.md` und bleiben auffindbar, falls sich
 * die Lage ändert.
 */
const ZURUECKGESTELLT = new Set<PlatformId>(['rtlplus'])

/** Eine Reihe auf einem Anbieter — das ist eine Zeile der Liste. */
interface Zeile {
  reihenId: number
  reihe: string
  platform: PlatformId
  datum: string
  offen: Offen[]
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
const reihen = readJson<Franchises>('public/data/franchises.json', {})
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

const kuratierteUrls = new Set(loadWatchLinks().flatMap((w) => (w.links ?? []).map((l) => l.url)))
const bereitsGeprueft = new Set(loadDubChecks().map((c) => dubKey(c.anilistId, c.platform)))

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

/** Letzter bekannter deutscher Termin eines Titels. */
const letzterTermin = new Map<number, string>()
/** Titel, für die noch ein Termin aussteht — sie wiegen beim Sortieren schwerer. */
const mitAnstehendemTermin = new Set<number>()
for (const r of releases) {
  const ende = lastEpisodeDate(r) ?? r.schedule.firstEpisodeDate
  const bisher = letzterTermin.get(r.titleId)
  if (!bisher || ende > bisher) letzterTermin.set(r.titleId, ende)
  if ((lastEpisodeDate(r) ?? r.schedule.firstEpisodeDate) > heute) mitAnstehendemTermin.add(r.titleId)
}

const titleById = new Map(titles.map((t) => [t.id, t]))

/**
 * Name der Reihe — die erste reguläre Staffel gibt ihn vor, ohne Staffelzusatz.
 *
 * Der deutsche Name der ersten Staffel heißt oft schon „… – Staffel 1", weil er
 * aus einer Disc-Ausgabe stammt. Als Überschrift einer Reihe, unter der dann
 * „Staffel 1" und „Staffel 2" stehen, wäre das eine Zählung zu viel.
 */
function reihenName(reihenId: number, ersatz: Title): string {
  const mitglieder = reihen[reihenId]
  /**
   * Der Rückfall ist nötig, weil eine `franchiseId` auf einen Anime zeigen
   * kann, den wir gar nicht führen — dann steht die Reihe unter einer Kennung,
   * die es im Datensatz nicht gibt. In der Liste stand dafür „#9120".
   */
  const roh = mitglieder?.length ? reihenVertreter(mitglieder).name : anzeigeName(titleById.get(reihenId) ?? ersatz)
  return ohneStaffelEins(roh)
}

const nachReiheUndPlattform = new Map<string, Zeile>()

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
     * dann bleibt das japanische Ende als grobe Einordnung.
     */
    const deutsch = letzterTermin.get(title.id)
    const datum = deutsch ?? title.jpEnd ?? (title.jpYear ? `${title.jpYear}-12-31` : '')
    if (!datum) continue
    // Was noch nicht erschienen ist, kann niemand nachsehen. Es kommt von
    // selbst herein, sobald der Termin vorbei ist — die Liste wird neu gebaut.
    if (datum > heute) continue

    const reihenId = title.franchiseId ?? title.id
    const key = `${reihenId}|${stream.platform}`
    const zeile = nachReiheUndPlattform.get(key) ?? {
      reihenId,
      reihe: reihenName(reihenId, title),
      platform: stream.platform,
      datum,
      offen: [],
    }
    if (datum > zeile.datum) zeile.datum = datum
    zeile.offen.push({
      titleId: title.id,
      name: anzeigeName(title),
      url: stream.url,
      datum,
      datumHerkunft: deutsch ? 'deutscher Termin' : title.jpEnd ? 'japanisches Ende' : 'japanisches Jahr',
      herkunft: herkunftVon(title.id, stream.url),
    })
    nachReiheUndPlattform.set(key, zeile)
  }
}

const zeilen = [...nachReiheUndPlattform.values()]
/**
 * Innerhalb einer Zeile zählt die Reihenfolge der Reihe, nicht das Datum.
 *
 * Wer den Verweis öffnet, geht die Staffeln von vorn durch. „Staffel 2" vor
 * „Staffel 1" zu listen, nur weil deren deutscher Termin älter ist, macht das
 * Abhaken unnötig schwer.
 */
const reihenfolge = new Map<number, number>()
for (const [id, mitglieder] of Object.entries(reihen)) {
  mitglieder.forEach((m, i) => reihenfolge.set(m.id, i))
  void id
}
for (const z of zeilen) {
  z.offen.sort(
    (a, b) =>
      (reihenfolge.get(a.titleId) ?? 999) - (reihenfolge.get(b.titleId) ?? 999) ||
      a.name.localeCompare(b.name, 'de'),
  )
}
zeilen.sort((a, b) => b.datum.localeCompare(a.datum) || a.reihe.localeCompare(b.reihe, 'de'))

// Getrennt statt gefiltert: Was hier herausfällt, landet in einer eigenen Datei.
const zurueckgestellt = zeilen.filter((z) => ZURUECKGESTELLT.has(z.platform))
const zuPruefen = zeilen.filter((z) => !ZURUECKGESTELLT.has(z.platform))

const offenGesamt = zuPruefen.reduce((n, z) => n + z.offen.length, 0)
const nachPlattform = new Map<PlatformId, number>()
for (const z of zuPruefen) nachPlattform.set(z.platform, (nachPlattform.get(z.platform) ?? 0) + z.offen.length)

/**
 * Kurzname eines Eintrags innerhalb seiner Reihe.
 *
 * „Attack on Titan Staffel 2" heißt in einer Zeile, die schon „Attack on Titan"
 * überschrieben ist, nur noch „Staffel 2". Bleibt nichts übrig, steht der volle
 * Name da — bei einem Film heißt der Eintrag nun einmal anders als die Reihe.
 */
function kurzname(reihe: string, name: string): string {
  if (name === reihe) return 'Hauptserie'
  if (name.startsWith(reihe)) {
    const rest = name
      .slice(reihe.length)
      .replace(/^[\s:–—-]+/, '')
      // „The Case Study of Vanitas (Staffel 1)" ließ als Rest „(Staffel 1)"
      // stehen — die Klammer gehörte zum vollen Namen, nicht zum Zusatz.
      .replace(/^\((.*)\)$/, '$1')
      .trim()
    if (rest) return rest
  }
  return name
}

const md: string[] = [
  '# Prüfliste: Wo läuft es wirklich auf Deutsch?',
  '',
  `Stand ${heute} · **${offenGesamt} offene Verweise** in **${zuPruefen.length} Zeilen**.`,
  '',
  'Erzeugt von `npm run data:dub-checks`, **nicht von Hand pflegen**. Was geprüft ist, gehört',
  'nach `data/dub-confirmed.yaml`; beim nächsten Lauf verschwindet es hier.',
  '',
  '**Eine Zeile ist eine Reihe auf einem Anbieter.** Wer den Verweis öffnet, sieht dort in aller',
  'Regel alle Staffeln auf einmal und kann sie auch auf einmal beantworten. In der letzten Spalte',
  'steht, welche Einträge dieser Reihe dort noch offen sind — bereits Bestätigtes fehlt dort.',
  '',
  'Sortiert von heute in die Vergangenheit, ausschließlich Titel, die es schon gibt.',
  '',
  'Zum Abarbeiten gibt es dieselben Zeilen in `dub-batches.md` — nach Nutzen sortiert und in',
  'Paketen zu je zwanzig.',
  '',
  '## Wie geantwortet wird',
  '',
  'Kurzschrift, damit ein Batch in einer Zeile beantwortet werden kann (Daniel, 12.08.2026):',
  '',
  '| Zeichen | Bedeutung | wird zu |',
  '|---|---|---|',
  '| `1` | hat deutsche Synchro | `dub: true` |',
  '| `0` | keine deutsche Synchro, nur Untertitel | `dub: false` — Verweis bleibt mit ✕ |',
  '| `x` | kein Video: nicht verfügbar, Verweis tot, Weiterleitung | `available: false` — Verweis wird entfernt |',
  '',
  'Stehen in einer Zeile **mehrere** Einträge zum Prüfen, werden die Ergebnisse mit Punkt',
  'getrennt in derselben Reihenfolge angegeben: `1.0` heißt „erster Eintrag ja, zweiter nein".',
  'Eine **einzelne** Angabe gilt für alle Einträge der Zeile.',
  '',
  'Beispiel: `1-x 2-1 3-1.0 4-x` — Zeile 1 tot, Zeile 2 Synchro, Zeile 3 erster Eintrag',
  'Synchro und zweiter ohne, Zeile 4 tot.',
  '',
  '| Offen je Anbieter | Verweise |',
  '|---|---|',
  ...[...nachPlattform.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([p, n]) => `| ${PLATFORMS[p].name} | ${n} |`),
  '',
  '## Zu prüfen',
  '',
  '| # | Datum | Reihe | Noch zu bestätigen |',
  '|---|---|---|---|',
]

zuPruefen.forEach((z, i) => {
  const eintraege = z.offen
    .map((o) => `[${kurzname(z.reihe, o.name).replace(/\|/g, '\\|')}](${o.url})`)
    .join(' · ')
  md.push(`| ${i + 1} | ${z.datum} | ${z.reihe.replace(/\|/g, '\\|')} | ${eintraege} |`)
})

md.push(
  '',
  '## Warum die einzelnen Anbieter unsicher sind',
  '',
  ...[...nachPlattform.keys()]
    .sort()
    .map((p) => `- **${PLATFORMS[p].name}:** ${GRUND[p] ?? '—'}`),
  '',
)

writeText('daniel-zum-abarbeiten/07-alle-anbieter.md', md.join('\n'))
log(`Prüfliste geschrieben: ${zuPruefen.length} Zeilen, ${offenGesamt} offene Verweise`)
for (const [p, n] of [...nachPlattform.entries()].sort((a, b) => b[1] - a[1])) log(`  · ${p}: ${n}`)

// --- Arbeitspakete zu je zwanzig Zeilen --------------------------------------
//
// Daniels Zuschnitt vom 21.08.2026: „mir den Rest in 20er-Batches zum Prüfen
// geben." Dieselben Zeilen wie oben, nur zweimal anders geordnet als die
// Prüfliste, und beides ist Absicht:
//
//  * **Nach Nutzen statt nach Datum.** Der Aufwand je Zeile ist immer derselbe
//    — Verweis öffnen, hinsehen, eine Ziffer schreiben. Der Ertrag ist es
//    nicht: Eine Reihe mit 120 Folgen und einem anstehenden Termin bringt mehr
//    als ein Einzelfilm von 2009.
//  * **Durchgehend von 1 bis N.** Daniels Rückmeldungen beziehen sich auf diese
//    Nummern („1-x 2-1 3-1.0"). Eine Lücke oder ein Neustart je Paket würde
//    zwei Antworten auf dieselbe Nummer erzeugen.

const PAKETGROESSE = 20

/**
 * Wie viel eine Zeile bringt.
 *
 * Folgen, weil jede beantwortete Reihe so viele Einträge auf einmal klärt. Der
 * anstehende Termin kommt oben drauf, weil dort jemand wartet — bei allem
 * anderen ist es ein Katalogtitel, der auch nächste Woche noch da ist.
 */
function nutzen(z: Zeile): number {
  const folgen = z.offen.reduce((n, o) => n + (titleById.get(o.titleId)?.episodes ?? 1), 0)
  const anstehend = z.offen.some((o) => mitAnstehendemTermin.has(o.titleId))
  return folgen + (anstehend ? 1000 : 0)
}

// Auf zuPruefen, nicht auf zeilen: Die zurückgestellten Anbieter (RTL+) haben
// in einem Arbeitspaket nichts verloren — sie sind ohne Abo nicht prüfbar.
const nachNutzen = [...zuPruefen].sort(
  (a, b) => nutzen(b) - nutzen(a) || b.datum.localeCompare(a.datum) || a.reihe.localeCompare(b.reihe, 'de'),
)

const batches: string[] = [
  '# Arbeitspakete: Wo läuft es wirklich auf Deutsch?',
  '',
  `Stand ${heute} · **${offenGesamt} offene Verweise** in **${nachNutzen.length} Zeilen**,`,
  `aufgeteilt in **${Math.ceil(nachNutzen.length / PAKETGROESSE)} Pakete** zu je ${PAKETGROESSE}.`,
  '',
  'Erzeugt von `npm run data:dub-checks`, **nicht von Hand pflegen**. Derselbe Bestand wie in',
  '`dub-pruefliste.md`, nur nach Nutzen sortiert statt nach Datum: Was viele Folgen oder einen',
  'anstehenden Termin hat, steht vorn. Der Aufwand je Zeile ist gleich, der Ertrag nicht.',
  '',
  '**Die Nummern laufen durch von 1 bis N.** Sie sind die Anschrift für die Antworten und',
  'ändern sich beim nächsten Lauf — ein Paket also bitte beantworten, bevor die Liste neu',
  'gebaut wird.',
  '',
  '## Wie geantwortet wird',
  '',
  '| Zeichen | Bedeutung | wird zu |',
  '|---|---|---|',
  '| `1` | hat deutsche Synchro | `dub: true` |',
  '| `0` | keine deutsche Synchro, nur Untertitel | `dub: false` — Verweis bleibt mit ✕ |',
  '| `x` | kein Video: nicht verfügbar, Verweis tot, Weiterleitung | `available: false` — Verweis wird entfernt |',
  '',
  'Zwei Kurzformen für das, was am häufigsten vorkommt (Daniel, 20.08.2026) — beide bedeuten',
  '`x` und unterscheiden sich nur darin, wie der Anbieter sein Nein mitteilt:',
  '',
  '| Kurzform | Was du siehst |',
  '|---|---|',
  '| **schief-Error** | Der Treffer steht in der Suche, beim Klick kommt „Da ist etwas schief gelaufen" |',
  '| **404** | Weiterleitung auf die Startseite, der Titel ist dort nicht zu finden |',
  '',
  'Mehrere Einträge in einer Zeile werden mit Punkt getrennt in derselben Reihenfolge',
  'beantwortet (`1.0` = erster ja, zweiter nein). Eine einzelne Angabe gilt für alle Einträge',
  'der Zeile. Beispiel für ein ganzes Paket: `1-x 2-1 3-1.0 4-x`.',
  '',
]

for (let start = 0; start < nachNutzen.length; start += PAKETGROESSE) {
  const paket = nachNutzen.slice(start, start + PAKETGROESSE)
  batches.push(
    `## Paket ${Math.floor(start / PAKETGROESSE) + 1} — Zeilen ${start + 1} bis ${start + paket.length}`,
    '',
    '| # | Anbieter | Reihe | Noch zu bestätigen |',
    '|---|---|---|---|',
    ...paket.map((z, i) => {
      const eintraege = z.offen
        .map((o) => `[${kurzname(z.reihe, o.name).replace(/\|/g, '\\|')}](${o.url})`)
        .join(' · ')
      return `| ${start + i + 1} | ${PLATFORMS[z.platform].name} | ${z.reihe.replace(/\|/g, '\\|')} | ${eintraege} |`
    }),
    '',
  )
}

writeText('daniel-zum-abarbeiten/08-arbeitspakete.md', batches.join('\n'))
log(`Arbeitspakete geschrieben: ${Math.ceil(nachNutzen.length / PAKETGROESSE)} Pakete zu je ${PAKETGROESSE} Zeilen`)

/**
 * Die zurückgestellten Anbieter bekommen eine eigene Datei.
 *
 * Sie aus dem Bestand zu werfen wäre falsch: Was hier steht, ist weiterhin
 * offen — nur eben nicht von Hand prüfbar, weil es ein laufendes Abo verlangt.
 * In der Arbeitsliste hätte es nichts verloren, denn dort steht, was jemand
 * heute abarbeiten kann.
 */
const zurueck: string[] = [
  '# Zurückgestellt: nur mit Abo prüfbar',
  '',
  `Stand ${heute} · **${zurueckgestellt.reduce((n, z) => n + z.offen.length, 0)} offene Verweise** in **${zurueckgestellt.length} Zeilen**.`,
  '',
  'Diese Verweise stehen **nicht** in `daniel-zum-abarbeiten/07-alle-anbieter.md`: Wer sie prüfen will, braucht ein',
  'laufendes Abo beim Anbieter. Daniel am 21.08.2026: „ich hol mir kein rtl+ abo um das zu prüfen".',
  'Auf der Seite tragen sie weiterhin „🇩🇪 ?" — das ist die ehrliche Angabe.',
  '',
  'Erzeugt von `npm run data:dub-checks`, nicht von Hand pflegen. Wird eine Zeile doch geprüft,',
  'gehört das Ergebnis wie sonst auch nach `data/dub-confirmed.yaml`.',
  '',
  '| # | Datum | Reihe | Offen |',
  '|---|---|---|---|',
]
zurueckgestellt.forEach((z, i) => {
  const eintraege = z.offen.map((o) => `[${kurzname(z.reihe, o.name)}](${o.url})`).join(' · ')
  zurueck.push(`| ${i + 1} | ${z.datum} | ${z.reihe} | ${eintraege} |`)
})
zurueck.push('')
writeText('data/dub-pruefliste-zurueckgestellt.md', zurueck.join('\n'))
