/**
 * Regeln, die den Datensatz gegen Zweitquellen aus `data/` halten: Link-Prüfung, aniSearch,
 * Crunchyroll-Katalog, MotN-Tonspuren, JustWatch, Handbelege.
 */
import type { Bestand } from './laden.ts'
import { titelName } from './laden.ts'
import { regel, type Regel, type Treffer } from './regel.ts'

const STREAM_PLATTFORMEN = new Set(['crunchyroll', 'netflix', 'primevideo', 'disneyplus', 'adn', 'aniverse', 'wow', 'joyn', 'rtlplus', 'youtube'])

/** D-03: Ein Weg im Bestand, den die Link-Prüfung als tot (404) kennt — oder nie geprüft hat. */
export function toteWege(b: Bestand): Regel {
  const treffer: Treffer[] = []
  let geprueft = 0, ungeprueft = 0
  for (const t of b.titles) for (const s of t.streams) {
    const l = b.linkCheck[s.url] ?? (s.seite ? b.linkCheck[s.seite] : undefined)
    if (!l) { ungeprueft++; continue }
    geprueft++
    if (l.status === 404) treffer.push({ schluessel: `${t.id}|${s.url}`, text: `${titelName(t)}: ${s.platform}-Weg 404 seit ${l.geprueftAm}`, ort: s.url })
  }
  const r = regel('D-03', 'Weg laut Link-Prüfung tot (404)', 'Besucher klickt auf eine Seite, die es nicht gibt', geprueft, treffer)
  r.name += ` — ${ungeprueft} Wege nie geprüft`
  return r
}

/** D-06: Hinter dem Toggle („keine deutsche Synchro"), obwohl eine Quelle eine Synchro führt. */
export function toggleTrotzSynchroQuelle(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const crDeutsch = new Set(b.crDub.filter((s) => s.staffeln?.some((st) => st.deutscheFassung)).map((s) => s.seriesId))
  for (const o of b.ohneSynchro) {
    const quellen: string[] = []
    if (b.anisearchDubs[String(o.id)] === 'd') quellen.push('aniSearch-Dub-Liste')
    if (o.anisearchId && b.anisearchDubIds[String(o.anisearchId)] === 'd') quellen.push('aniSearch-Kennung „d"')
    const hand = [...b.dubConfirmed].filter(([k, dub]) => dub && k.startsWith(`${o.id}|`)).map(([k]) => k.split('|')[1])
    if (hand.length) quellen.push(`Handbeleg dub:true (${hand.join(', ')})`)
    const jw = (b.justwatch[String(o.id)]?.angebote ?? []).filter((a) => a.audio?.includes('de') && a.art !== 'BUY')
    if (jw.length) quellen.push(`JustWatch de-Ton (${[...new Set(jw.map((a) => a.anbieter))].join(', ')})`)
    for (const s of o.streams ?? []) if (s.platform === 'crunchyroll' && crDeutsch.has(s.url.split('/').pop() ?? '')) quellen.push('CR-Katalog deutsch')
    if (quellen.length) treffer.push({ schluessel: String(o.id), text: `${titelName(o)}: ${quellen.join('; ')}${o.ankuendigung ? ' (Ankündigung vorhanden)' : ''}`, ort: `/t/${o.slug ?? o.id}/` })
  }
  return regel('D-06', 'Hinter dem Toggle, aber Quelle führt Synchro', 'Ein Titel mit deutscher Fassung fehlt im Hauptbestand', b.ohneSynchro.length, treffer)
}

/** D-11: Release sagt „Premiere" in Jahr X, aniSearch kennt die deutsche Erstausgabe Jahre früher (SAO-Fehlerklasse). */
export function premiereGegenErstausgabe(b: Bestand): Regel {
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const r of b.releases) {
    const t = titel.get(r.titleId)
    const von = t?.deErstausgabe?.von ?? t?.deErstausgabe?.zeitraum?.match(/\d{4}/)?.[0]
    if (!von || r.dateMeaning === 'available-from' || r.releaseType === 'disc' || !t?.deErstausgabe?.synchro) continue
    geprueft++
    const jahrRelease = Number(r.schedule.firstEpisodeDate.slice(0, 4)), jahrErst = Number(von.slice(0, 4))
    if (jahrRelease - jahrErst >= 2 && !r.herkunft && !r.note)
      treffer.push({ schluessel: r.slug, text: `${r.name} (${r.platform}): Termin ${r.schedule.firstEpisodeDate} als Premiere, aniSearch nennt deutsche Erstausgabe ${von}${t.deErstausgabe?.publisher ? ` (${t.deErstausgabe.publisher})` : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-11', '„Premiere" Jahre nach der aniSearch-Erstausgabe', '„Start der deutschen Fassung" für eine Fassung, die es seit Jahren gibt', geprueft, treffer)
}

/** D-12: Weg mit `dub: true`, aber eine gemessene Zweitquelle sagt „kein Deutsch" für die ganze Staffel. */
export function dubGegenZweitquelle(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const motn = new Map(b.motnTonspur.map((m) => [`${m.titleId}|${m.platform}`, m]))
  const cr = new Map(b.crDub.map((s) => [s.seriesId, s]))
  const gesehen = new Set<string>()
  let geprueft = 0, hoeherBelegt = 0
  for (const t of b.titles) for (const s of t.streams) {
    const k = `${t.id}|${s.platform}`
    if (s.dub !== true || gesehen.has(k)) continue
    const m = motn.get(k)
    const serie = s.platform === 'crunchyroll' ? cr.get(s.url.split('/').pop() ?? '') : undefined
    const widerspruch = (m && !m.deutsch && m.von <= 1 && !!t.episodes && m.bis >= t.episodes && !s.dubRanges?.length)
      || (serie?.deutschImAngebot === false && !!serie.staffeln?.length && !(s.sharedWith ?? 0))
    if (!m && !serie) continue
    geprueft++
    gesehen.add(k)
    if (!widerspruch) continue
    /* Prüfhierarchie (karte.md §10): Handbeleg und gemessenes Urteil stehen über MotN und CR-Katalog. */
    if (b.dubConfirmed.get(k) === true || b.urteile.get(k)?.has('deutsch')) { hoeherBelegt++; continue }
    const quelle = m && !m.deutsch ? `MotN-Tonspur sagt kein Deutsch (Folgen ${m.von}–${m.bis}, Stand ${m.stand})` : `CR-Katalog meldet keine deutsche Fassung (${serie!.staffeln!.map((x) => `${x.name}: ${x.deutsch}/${x.folgen}`).join('; ')})`
    treffer.push({ schluessel: k, text: `${titelName(t)}: ${s.platform}-Weg „deutsch", ${quelle}`, ort: s.url })
  }
  const r = regel('D-12', 'Weg „deutsch", Zweitquelle sagt „kein Deutsch"', '„DE ✓" an einem Weg ohne deutschen Ton', geprueft, treffer)
  r.name += ` (${hoeherBelegt} weitere durch Handbeleg/Urteil entschieden)`
  return r
}

/** D-16: Erschienene Disc ohne Kaufweg oder mit einer Suchseite als Kaufweg (B-09). */
export function discKaufweg(b: Bestand): Regel {
  const treffer: Treffer[] = []
  const discs = b.releases.filter((r) => r.releaseType === 'disc')
  for (const r of discs) {
    if (!r.buyUrl) treffer.push({ schluessel: r.slug, text: `${r.name}: kein Kaufweg`, ort: `/r/${r.slug}/` })
    else if (/amazon\.[a-z.]+\/s\?/.test(r.buyUrl)) treffer.push({ schluessel: r.slug, text: `${r.name}: Kaufweg ist eine Amazon-Suche`, ort: r.buyUrl })
  }
  return regel('D-16', 'Disc ohne Produktseite als Kaufweg', '„Kaufen" führt ins Leere oder auf eine Suche', discs.length, treffer)
}

/** D-17: News-Meldungen, deren Release oder Titel es im Bestand nicht mehr gibt. */
export function newsVerweise(b: Bestand): Regel {
  const slugs = new Set(b.releases.map((r) => r.slug))
  const ids = new Set([...b.titles, ...b.cartoons].map((t) => t.id))
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const n of b.news) for (const m of n.meldungen) {
    geprueft++
    if (m.release && !slugs.has(m.release)) treffer.push({ schluessel: `${n.titel}|${m.release}`, text: `„${n.titel}" (${m.art}, ${m.datum ?? '?'}): Release ${m.release} gibt es nicht mehr` })
    else if (n.titleId != null && !ids.has(n.titleId)) treffer.push({ schluessel: `${n.titel}|${n.titleId}`, text: `„${n.titel}" (${m.art}): Titel ${n.titleId} gibt es nicht` })
  }
  return regel('D-17', 'News-Meldung zeigt auf verschwundenes Release', 'Meldung verliert ihren Beleg-Link (fällt auf die Anbieterseite zurück), Termin-Verlauf reißt ab', geprueft, treffer)
}

/** D-19: Termin bei Anbieter P (vergangen), aber der Titel hat keinen Weg zu P — wo soll man es ansehen? */
export function terminOhneWeg(b: Bestand): Regel {
  const titel = new Map(b.titles.map((t) => [t.id, t]))
  const treffer: Treffer[] = []
  let geprueft = 0
  for (const r of b.releases) {
    const t = titel.get(r.titleId)
    if (!t || !STREAM_PLATTFORMEN.has(r.platform) || r.widerlegt || r.schedule.firstEpisodeDate > b.heute) continue
    geprueft++
    if (t.streams.some((s) => s.platform === r.platform) || r.platformUrl) continue
    const entfernt = t.entfernteStreams?.find((s) => s.platform === r.platform)
    treffer.push({ schluessel: r.slug, text: `${r.name}: Termin ${r.schedule.firstEpisodeDate} bei ${r.platform}, Titel hat dort keinen Weg${entfernt ? ` (entfernt am ${entfernt.entferntAm})` : ''}`, ort: `/r/${r.slug}/` })
  }
  return regel('D-19', 'Termin bei einem Anbieter ohne Weg dorthin', 'Panel nennt den Anbieter, aber keinen Link', geprueft, treffer)
}

export const regelnQuellen = (b: Bestand): Regel[] => [
  toteWege(b), toggleTrotzSynchroQuelle(b), premiereGegenErstausgabe(b), dubGegenZweitquelle(b), discKaufweg(b), newsVerweise(b), terminOhneWeg(b),
]
