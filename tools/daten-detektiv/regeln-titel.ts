/**
 * Regeln über Titel und Stammdaten: Dubletten, Lücken, Zahlen gegen Zweitquellen.
 */
import type { Title } from '../../shared/types.ts'
import type { Bestand } from './laden.ts'
import { titelName } from './laden.ts'
import { regel, type Regel, type Treffer } from './regel.ts'

/** D-02: Ein Release behauptet mehr Folgen als der Titel hat (ohne erklärten Teilbereich). */
export function releaseFolgenUeberTitel(b: Bestand): Regel {
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const r of b.releases) {
    const t = titel.get(r.titleId)
    const n = r.schedule.episodeCount
    if (!t?.episodes || !n || r.releaseType === 'disc') continue
    geprueft++
    if (n > t.episodes && !r.schedule.firstEpisodeNumber)
      treffer.push({ schluessel: r.slug, text: `${r.name} (${r.platform}, ${r.slug}): ${n} Folgen, Titel ${titelName(t)}${r.schedule.episodeCountAssumed ? ' (Folgenzahl angenommen)' : ''}${r.herkunft ? ` — ${r.herkunft.slice(0, 90)}` : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-02', 'Release-Folgenzahl über der Titel-Folgenzahl', 'Panel verspricht Folgen, die das Werk nicht hat', geprueft, treffer)
}

/** D-05: Titel ohne Cover, obwohl eine Zweitquelle eines kennt. */
export function coverFehltTrotzQuelle(b: Bestand): Regel {
  const ohne = b.titles.filter((t) => !t.coverImage)
  const treffer: Treffer[] = []
  for (const t of ohne) {
    const quelle = b.anisearchCover[String(t.id)]?.cover ? 'anisearch-cover.json' : b.tmdbPoster[String(t.id)]?.p ? 'tmdb-poster.json' : undefined
    if (quelle) treffer.push({ schluessel: String(t.id), text: `${titelName(t)}: kein Cover, ${quelle} kennt eines`, ort: `/t/${t.slug}/` })
  }
  const r = regel('D-05', 'Cover fehlt, Zweitquelle kennt eines', 'Karte ohne Bild, obwohl ein Bild da wäre', ohne.length, treffer)
  r.name += ` (${ohne.length} von ${b.titles.length} ohne Cover)`
  return r
}

function dublettenNach(titles: Title[], schluessel: (t: Title) => string | undefined, art: string): Treffer[] {
  const gruppen = new Map<string, Title[]>()
  for (const t of titles) {
    const k = schluessel(t)
    if (k) (gruppen.get(k) ?? gruppen.set(k, []).get(k)!).push(t)
  }
  return [...gruppen].filter(([, g]) => g.length > 1).map(([k, g]) => ({ schluessel: `${art}:${k}`, text: `${art} ${k}: ${g.map((t) => `${titelName(t)} [${t.id}]`).join(' / ')}` }))
}

/** D-07: Dasselbe Werk zweimal — gleiche MAL-/aniSearch-Kennung oder gleicher Name und Jahr; oder gleichzeitig im Bestand und hinter dem Toggle. */
export function dubletten(b: Bestand): Regel {
  /* Gleiche MAL allein ist keine Dublette (MAL fasst Specials zusammen, AniList trennt) — erst mit gleichem Format, gleicher Folgenzahl und gleichem Jahr (datensatz.md, 08.10.2026). */
  /* Einzelwerke (Filmreihen, OVAs) bündeln MAL und aniSearch unter einer Kennung — dort zählt nur ein gleicher Name. */
  const kern = (t: Title): string => (t.episodes ?? 0) > 1 ? `${t.episodes}|${t.jpYear}` : `${t.titleRomaji?.toLowerCase()}|${t.jpYear}`
  const treffer = [
    ...dublettenNach(b.titles, (t) => t.malId ? `${t.malId}|${t.format}|${kern(t)}` : undefined, 'MAL'),
    ...dublettenNach(b.titles, (t) => t.anisearchId ? `${t.anisearchId}|${kern(t)}` : undefined, 'aniSearch'),
    ...dublettenNach(b.titles, (t) => t.titleRomaji && t.jpYear ? `${t.titleRomaji.toLowerCase()}|${t.jpYear}|${t.format}` : undefined, 'Name+Jahr'),
  ]
  const ids = new Set(b.titles.map((t) => t.id))
  const mal = new Map(b.titles.filter((t) => t.malId).map((t) => [t.malId!, t]))
  for (const o of b.ohneSynchro) {
    if (ids.has(o.id)) treffer.push({ schluessel: `beides:${o.id}`, text: `${titelName(o)} steht im Bestand und hinter dem Toggle` })
    else if (o.malId && mal.has(o.malId) && mal.get(o.malId)!.episodes === o.episodes && mal.get(o.malId)!.jpYear === o.jpYear)
      treffer.push({ schluessel: `MAL-beides:${o.malId}`, text: `MAL ${o.malId}: ${titelName(o)} [${o.id}] hinter dem Toggle, ${titelName(mal.get(o.malId))} [${mal.get(o.malId)!.id}] im Bestand` })
  }
  return regel('D-07', 'Doppelte Werke', 'Zwei Karten für ein Werk, Termine auf der falschen', b.titles.length + b.ohneSynchro.length, treffer)
}

/** D-08: Titel im Hauptbestand ohne jeden Weg und ohne Termin — obwohl JustWatch einen deutschen Ton nennt. */
export function ohneWegTrotzJustwatch(b: Bestand): Regel {
  const mitRelease = new Set(b.releases.map((r) => r.titleId))
  const kandidaten = b.titles.filter((t) => !t.streams.length && !t.watchLinks?.length && !mitRelease.has(t.id) && !t.angebotSeit)
  const treffer: Treffer[] = []
  for (const t of kandidaten) {
    const de = (b.justwatch[String(t.id)]?.angebote ?? []).filter((a) => a.audio?.includes('de'))
    if (de.length) treffer.push({ schluessel: String(t.id), text: `${titelName(t)}: kein Weg im Bestand, JustWatch nennt deutschen Ton bei ${[...new Set(de.map((a) => a.anbieter))].join(', ')}`, ort: `/t/${t.slug}/` })
  }
  const r = regel('D-08', 'Titel ohne Weg, JustWatch kennt einen mit deutschem Ton', 'Besucher erfährt nicht, wo er den Titel sehen kann', kandidaten.length, treffer)
  r.name += ` (${kandidaten.length} ohne Weg und Termin)`
  return r
}

/** D-15: Reihen-Verweise zeigen ins Leere. */
export function reihenVerweise(b: Bestand): Regel {
  const bekannt = new Set([...b.titles, ...b.ohneSynchro, ...b.cartoons].map((t) => t.id))
  const treffer: Treffer[] = []
  /* franchises.json führt nur Reihen mit mehr als einem Glied — ein Einzeltitel ohne Eintrag ist normal. */
  const glieder = new Map<number, number>()
  for (const t of b.titles) if (t.franchiseId != null) glieder.set(t.franchiseId, (glieder.get(t.franchiseId) ?? 0) + 1)
  for (const t of b.titles) if (t.franchiseId != null && (glieder.get(t.franchiseId) ?? 0) > 1 && !b.franchises[String(t.franchiseId)]) treffer.push({ schluessel: `titel:${t.id}`, text: `${titelName(t)}: franchiseId ${t.franchiseId} (${glieder.get(t.franchiseId)} Titel) fehlt in franchises.json` })
  for (const [fid, glieder] of Object.entries(b.franchises)) for (const g of glieder) if (!bekannt.has(g.id)) treffer.push({ schluessel: `reihe:${fid}:${g.id}`, text: `Reihe ${fid}: Glied „${g.name}" [${g.id}] ist kein bekannter Titel` })
  return regel('D-15', 'Reihen-Verweis ins Leere', 'Karussell der Reihe zeigt ein Glied ohne Seite', b.titles.length, treffer)
}

/** D-18: Felder am Weg widersprechen sich: entferntAm im Weg-Feld, dubRanges jenseits der Folgenzahl, sharedWith ≠ Zahl der Adressnutzer. */
export function wegFelder(b: Bestand): Regel {
  /* `sharedWith` zählt auch Einträge hinter dem Toggle (Dr. Stone: 7 = 6 im Bestand + 1 dahinter). */
  const nutzer = new Map<string, number>()
  for (const t of [...b.titles, ...b.ohneSynchro]) for (const s of t.streams ?? []) nutzer.set(s.url, (nutzer.get(s.url) ?? 0) + 1)
  const treffer: Treffer[] = []
  for (const t of b.titles) for (const s of t.streams) {
    if (s.entferntAm) treffer.push({ schluessel: `${t.id}|${s.url}|entfernt`, text: `${titelName(t)}: Weg ${s.platform} trägt entferntAm ${s.entferntAm}, steht aber unter streams` })
    const ueber = (s.dubRanges ?? []).filter((r) => t.episodes && r.to > t.episodes)
    if (ueber.length) treffer.push({ schluessel: `${t.id}|${s.url}|bereich`, text: `${titelName(t)}: ${s.platform}-Bereich bis Folge ${Math.max(...ueber.map((r) => r.to))} bei ${t.episodes} Folgen` })
    const ist = nutzer.get(s.url) ?? 1
    if ((s.sharedWith ?? 1) !== ist && ist > 1) treffer.push({ schluessel: `${t.id}|${s.url}|shared`, text: `${titelName(t)}: ${s.platform}-Adresse bedient ${ist} Titel, sharedWith sagt ${s.sharedWith ?? 'nichts'}` })
  }
  return regel('D-18', 'Weg-Felder widersprechen sich', 'Folgenbereiche oder „geteilte Seite" werden falsch angezeigt', b.titles.reduce((n, t) => n + t.streams.length, 0), treffer)
}

/** D-22: Folgenzahl des Titels weicht vom aniSearch-Eintrag ab (gleiches Werk über die aniSearch-Kennung). */
export function folgenzahlGegenAnisearch(b: Bestand): Regel {
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const t of b.titles) {
    const liste = t.anisearchId ? b.anisearchFolgen[String(t.anisearchId)] : undefined
    if (!liste?.folgen?.length || !t.episodes || t.format === 'MOVIE') continue
    geprueft++
    const n = liste.folgen.length
    if (Math.abs(n - t.episodes) >= 2) treffer.push({ schluessel: String(t.id), text: `${titelName(t)}: ${t.episodes} Folgen laut AniList, aniSearch-Folgenliste hat ${n}`, ort: `/t/${t.slug}/` })
  }
  return regel('D-22', 'Folgenzahl: AniList gegen aniSearch-Folgenliste', '„x von n Folgen" rechnet mit der falschen Gesamtzahl', geprueft, treffer)
}

/** D-24: Im Hauptbestand, aber ohne jeden Beleg einer deutschen Synchro (B-01). */
export function ohneJedenBeleg(b: Bestand): Regel {
  const mitRelease = new Set(b.releases.map((r) => r.titleId))
  const treffer = b.titles
    .filter((t) => !t.streams.some((s) => s.dub === true) && !mitRelease.has(t.id) && !t.deErstausgabe && !t.watchLinks?.length && !t.ankuendigung && !t.westlich)
    .map((t) => ({ schluessel: String(t.id), text: `${titelName(t)}: dubConfidence ${t.dubConfidence}, kein Stream, Termin, Weg, aniSearch-Ausgabe${b.anisearchDubs[String(t.id)] === 'd' ? ' — aniSearch-Dub-Liste führt ihn' : ''}`, ort: `/t/${t.slug}/` }))
  return regel('D-24', 'Im Bestand ohne jeden Beleg', 'Zählt als „belegte deutsche Synchro", ohne dass irgendetwas sie belegt', b.titles.length, treffer)
}

/** D-25: Synopsis fehlt im ausgelieferten Satz. */
export function synopsisFehlt(b: Bestand): Regel {
  const ohne = b.titles.filter((t) => !b.synopsen.has(t.id))
  const treffer = ohne.filter((t) => b.anisearchBeschreibung.has(t.id)).map((t) => ({ schluessel: String(t.id), text: `${titelName(t)}: keine Handlung ausgeliefert, data/anisearch.json hat eine deutsche Beschreibung`, ort: `/t/${t.slug}/` }))
  const r = regel('D-25', 'Handlung fehlt, aniSearch hat eine', 'Panel ohne Beschreibung, obwohl eine vorliegt', ohne.length, treffer)
  r.name += ` (${ohne.length} ohne Handlung)`
  return r
}

export const regelnTitel = (b: Bestand): Regel[] => [
  releaseFolgenUeberTitel(b), coverFehltTrotzQuelle(b), dubletten(b), ohneWegTrotzJustwatch(b), reihenVerweise(b),
  wegFelder(b), folgenzahlGegenAnisearch(b), ohneJedenBeleg(b), synopsisFehlt(b),
]
