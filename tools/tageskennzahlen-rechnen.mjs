/**
 * Reine Rechenfunktionen der Tageskennzahlen (kein gh, kein git, kein Dateizugriff): `tools/tageskennzahlen.mjs` holt die Daten.
 *
 * Story Points (mechanisch, ein PR):
 *   Grundwert aus geänderten Zeilen (hinzu + weg) ohne Datendateien (data/, public/data/) und Testdateien (*.test.*, *.spec.*):
 *   bis 30 = 1, bis 150 = 2, bis 400 = 3, darüber 5; dazu +1 bei Prüfstufe 2 laut tools/pr-stufe.mjs (bestimmeStufe).
 * Bot-Abgrenzung: Autor endet auf „[bot]“ UND Titel beginnt mit chore(data)/chore(wache)/chore(extension)/Patch Notes …
 *   siehe `istBot`; alles andere zählt als „von Hand“ (auch Daniels Claude-Sitzungen, die unter seinem Konto mergen).
 */

export const ZEITZONE = 'Europe/Berlin'
const GRENZEN_PUNKTE = [[30, 1], [150, 2], [400, 3]]
const DATEN_PFAD = /^(data|public\/data)\//
const TEST_PFAD = /(^|\/)[^/]+\.(test|spec)\.[cm]?[jt]sx?$/
// Nur diese Titel-Anfänge gelten bei einem [bot]-Autor als Bot-Arbeit; ein Bot-PR mit anderem Titel ist Handarbeit.
const BOT_TITEL = /^chore\((data|wache|extension)\)/

const datumFormat = new Intl.DateTimeFormat('sv-SE', { timeZone: ZEITZONE })

/** Kalendertag `YYYY-MM-DD` in Europe/Berlin zu einem ISO-Zeitpunkt (oder ms). */
export function tagBerlin(zeitpunkt) {
  return datumFormat.format(new Date(zeitpunkt))
}

/** Beginn (ms, UTC-Epoche) des Berlin-Tages `tag`; berücksichtigt Sommerzeit (Tag mit 23 oder 25 Stunden). */
export function tagesBeginnMs(tag) {
  const [j, m, d] = tag.split('-').map(Number)
  const mitternachtUtc = Date.UTC(j, m - 1, d)
  // Berlin liegt bei +0 bis +2 h gegenüber UTC: der Beginn ist 22:00–24:00 UTC des Vortags.
  for (const stunden of [0, 1, 2]) {
    const kandidat = mitternachtUtc - stunden * 3_600_000
    if (tagBerlin(kandidat) === tag && tagBerlin(kandidat - 1) !== tag) return kandidat
  }
  throw new Error(`Tagesbeginn nicht bestimmbar: ${tag}`)
}

/** `YYYY-MM-DD` plus `n` Tage (Kalenderrechnung, ohne Zeitzone). */
export function tagPlus(tag, n) {
  const [j, m, d] = tag.split('-').map(Number)
  return new Date(Date.UTC(j, m - 1, d + n)).toISOString().slice(0, 10)
}

/** Alle Tage von `von` bis `bis` einschließlich. */
export function tageZwischen(von, bis) {
  const tage = []
  for (let t = von; t <= bis; t = tagPlus(t, 1)) tage.push(t)
  return tage
}

/** Story Points eines PR. `dateien`: [{ pfad, zeilen }] (zeilen = hinzu + weg); `stufe`: Prüfstufe 0–2 oder undefined. */
export function storyPoints(dateien, stufe) {
  const zeilen = dateien.filter((d) => !DATEN_PFAD.test(d.pfad) && !TEST_PFAD.test(d.pfad)).reduce((a, d) => a + d.zeilen, 0)
  const grund = GRENZEN_PUNKTE.find(([grenze]) => zeilen <= grenze)?.[1] ?? 5
  return grund + (stufe === 2 ? 1 : 0)
}

/** Bot-PR: Autor `…[bot]` mit Bot-Titel (Sammler, Bestandsbau, Wache, Erweiterungs-Version). */
export function istBot(pr) {
  return pr.author.endsWith('[bot]') && BOT_TITEL.test(pr.title)
}

/** Revert-Commit: Betreff beginnt mit „Revert“ (Git-Standard) oder ist ein zurückgenommener Sammler-Stand. */
export function istRevert(betreff) {
  return /^revert\b/i.test(betreff) || /Sammler-Stand zurückgenommen/.test(betreff)
}

/** Median einer Zahlenliste, `undefined` bei leerer Liste. */
export function median(zahlen) {
  if (zahlen.length === 0) return undefined
  const s = [...zahlen].sort((a, b) => a - b)
  const mitte = s.length >> 1
  return s.length % 2 ? s[mitte] : (s[mitte - 1] + s[mitte]) / 2
}

const runde = (x, stellen = 2) => (x === undefined ? undefined : Number(x.toFixed(stellen)))
const stunden = (ms) => ms / 3_600_000

/** Stau am Ende des Tages [beginn, ende): offene PRs, davon über 24 h, Alter des ältesten (h). `prs`: [{ createdAt, endeAt }] (endeAt = Merge/Schließung oder null). */
export function stauAmTagesende(prs, endeMs) {
  const offen = prs.filter((p) => Date.parse(p.createdAt) < endeMs && (!p.endeAt || Date.parse(p.endeAt) >= endeMs))
  const alter = offen.map((p) => stunden(endeMs - Date.parse(p.createdAt)))
  return { offen: offen.length, ueber24h: alter.filter((a) => a > 24).length, aeltestesH: alter.length ? runde(Math.max(...alter), 1) : 0 }
}

/** Durchsatz und Geschwindigkeit der PRs, die am Tag gemergt wurden. `prs`: [{ bot, createdAt, mergedAt, punkte? }]. */
export function durchsatz(prs) {
  const hand = prs.filter((p) => !p.bot)
  const wartezeit = (liste) => runde(median(liste.map((p) => stunden(Date.parse(p.mergedAt) - Date.parse(p.createdAt)))))
  return {
    merges: prs.length,
    mergesHand: hand.length,
    mergesBot: prs.length - hand.length,
    storyPoints: hand.reduce((a, p) => a + (p.punkte ?? 0), 0),
    medianOffenBisMergeHandH: wartezeit(hand),
    medianOffenBisMergeBotH: wartezeit(prs.filter((p) => p.bot)),
  }
}

/**
 * Stunden mit rotem Bestandsbau je Tag. Rot beginnt mit dem ersten failure/timed_out nach einem Erfolg und endet mit dem nächsten Erfolg;
 * abgebrochene und übersprungene Läufe ändern den Zustand nicht. `laeufe`: [{ createdAt, conclusion }], `jetztMs` begrenzt einen noch offenen Zeitraum.
 * Ergebnis: { 'YYYY-MM-DD': Stunden }.
 */
export function rotStundenJeTag(laeufe, jetztMs) {
  const sortiert = laeufe.filter((l) => l.conclusion).sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt))
  const zeitraeume = []
  let von = null
  for (const l of sortiert) {
    const rot = l.conclusion === 'failure' || l.conclusion === 'timed_out'
    if (rot && von === null) von = Date.parse(l.createdAt)
    if (l.conclusion === 'success' && von !== null) {
      zeitraeume.push([von, Date.parse(l.createdAt)])
      von = null
    }
  }
  if (von !== null) zeitraeume.push([von, jetztMs])
  return verteileAufTage(zeitraeume)
}

function verteileAufTage(zeitraeume) {
  const jeTag = {}
  for (const [von, bis] of zeitraeume) {
    for (let t = tagBerlin(von); tagesBeginnMs(t) < bis; t = tagPlus(t, 1)) {
      const ende = tagesBeginnMs(tagPlus(t, 1))
      const anteil = Math.min(bis, ende) - Math.max(von, tagesBeginnMs(t))
      jeTag[t] = (jeTag[t] ?? 0) + stunden(anteil)
    }
  }
  for (const t of Object.keys(jeTag)) jeTag[t] = runde(jeTag[t])
  return jeTag
}

/** Median der Laufdauer in Minuten über erfolgreiche Läufe; `undefined` ohne Lauf. `laeufe`: [{ start, ende, conclusion }]. */
export function medianDauerMin(laeufe) {
  const dauern = laeufe.filter((l) => l.conclusion === 'success').map((l) => (Date.parse(l.ende) - Date.parse(l.start)) / 60_000)
  return runde(median(dauern))
}
