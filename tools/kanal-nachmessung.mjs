/**
 * Kern der Kanal-Nachmessung (12.10.2026): alter Kanal-Beleg gegen neue Messung, je Adresse.
 *
 * Seit dem 11.10.2026 zählt Amazons Sprachangabe auf einem Kanal-Titel nicht mehr (`pipeline/lib/kanal-titel.ts`). Ob sie wieder
 * zählen darf, entscheidet die Zahl der Abweichungen zwischen dem alten Ja und einer frischen Messung der aktuellen Erweiterung
 * (ab 4.20.10, 15.09.2026: die Rückfallebene mit dem Sammel-Set `gesehen.sprachen` ist weg — Hell Mode, Bericht 12.10.2026).
 *
 * Zwei Quellen für die neue Seite:
 * - `kanalMessung` in `data/dub-confirmed.yaml` (ab 12.10.2026 von `fetch-pruefungen.ts` geschrieben, `ja` oder `nein`): die Messung.
 * - `data/prime-zugeordnet.json` (je Folge, ohne Datum, Meldungen ab 28.09.2026): die Gegenprobe, schon vor der Nachmessung vorhanden.
 */

/** Letzter Tag vor Erweiterung 4.20.10 (141e692d8, 15.09.2026). */
export const VOR_4_20_10 = '2026-09-14'

const KANAL = /Kanal-Titel/
/** ASIN (`B0…`), 26-stellige Kennung oder gti in einer Amazon-Adresse. */
const KENNUNG = /(?:\/(?:dp|detail)\/|[?&]gti=)(B0[A-Z0-9]{8}|[A-Z0-9]{26}|amzn1\.dv\.gti\.[a-z0-9-]+)/
const SEITE = /Amazon-Seite ([A-Z0-9]{10,26})/

/** Die Kennung einer Amazon-Adresse. */
export const kennungVon = (url) => KENNUNG.exec(url ?? '')?.[1]

/** Alle Kennungen, unter denen eine Messung zu einem Beleg gemeldet sein kann: die der Adresse und die der Seite (Notiz). */
export const kennungenVon = (b) => [kennungVon(b.url), SEITE.exec(b.note ?? '')?.[1]].filter(Boolean)

const sagtJa = (b) => b.dub === true || (b.dubRanges ?? []).some((r) => r.dub === true)

/** Prime-Belege mit Kanal-Warnung, deren Ja seit 11.10.2026 nicht mehr zählt (ohne `zweiteQuelle`). */
export const kanalJaBelege = (belege) =>
  belege.filter((b) => b.platform === 'primevideo' && KANAL.test(b.note ?? '') && sagtJa(b) && !b.zweiteQuelle)

/** Gemeldete Folgen je Kennung: `Kennung → [Eintrag]` (Schlüssel, `asin` und `seite` des Eintrags zählen alle). */
export function zugeordnetNachKennung(zugeordnet) {
  const karte = new Map()
  for (const [schluessel, eintrag] of Object.entries(zugeordnet)) {
    const kennungen = new Set([kennungVon(schluessel), eintrag.asin, kennungVon(eintrag.seite)].filter(Boolean))
    for (const k of kennungen) karte.set(k, [...(karte.get(k) ?? []), eintrag])
  }
  return karte
}

/** Die Gegenprobe aus den gemeldeten Folgen: `ja` (irgendwo Deutsch), `nein` (Folgen gemeldet, nie Deutsch) oder `keine`. */
export function gegenprobe(kennungen, karte) {
  const sprachen = kennungen.flatMap((k) => (karte.get(k) ?? []).flatMap((e) => (e.folgen ?? []).flatMap((f) => f.sprachen ?? [])))
  if (!sprachen.length) return 'keine'
  return sprachen.some((s) => /deutsch|german/i.test(s)) ? 'ja' : 'nein'
}

/** Die jüngste Messung (`kanalMessung`) zu Titel und Kennung ab `seit`, sonst `undefined`. */
function neueMessung(belege, anilistId, kennung, seit) {
  const treffer = belege.filter(
    (b) => b.anilistId === anilistId && b.kanalMessung && kennungenVon(b).includes(kennung) && String(b.checkedAt ?? '') >= seit,
  )
  return treffer.sort((a, b) => String(a.checkedAt).localeCompare(String(b.checkedAt))).at(-1)
}

/**
 * Eine Zeile je Titel und Kennung mit altem Kanal-Ja: alter Beleg (`alt`, `vorErweiterung`), Gegenprobe und neue Messung
 * (`neu`: `ja`, `nein` oder `fehlt`, dazu `neuAm`). Belege ab `seit` sind selbst neue Messungen und zählen nicht als alt.
 */
export function vergleiche(belege, zugeordnet, seit) {
  const karte = zugeordnetNachKennung(zugeordnet)
  const zeilen = new Map()
  for (const b of kanalJaBelege(belege)) {
    const kennungen = kennungenVon(b)
    if (String(b.checkedAt ?? '') >= seit || !kennungen.length) continue
    const schluessel = `${b.anilistId}|${kennungen[0]}`
    if (String(zeilen.get(schluessel)?.alt ?? '') >= String(b.checkedAt)) continue
    const messung = neueMessung(belege, b.anilistId, kennungen[0], seit)
    zeilen.set(schluessel, {
      anilistId: b.anilistId,
      asin: kennungen[0],
      alt: b.checkedAt,
      vorErweiterung: String(b.checkedAt) <= VOR_4_20_10,
      gegenprobe: gegenprobe(kennungen, karte),
      neu: messung ? messung.kanalMessung : 'fehlt',
      neuAm: messung?.checkedAt,
    })
  }
  return [...zeilen.values()]
}

/** Zählt `zeilen` nach `feld`. */
export function zaehle(zeilen, feld) {
  const summe = {}
  for (const z of zeilen) summe[z[feld]] = (summe[z[feld]] ?? 0) + 1
  return summe
}

/**
 * Die Titel, die auf die Prüfliste sollen, mit Vorrang: Titel, bei denen eine Adresse keine Gegenprobe mit Deutsch hat.
 * Vorrang 1: Gegenprobe widerspricht (`nein`) oder der Beleg stammt von vor 4.20.10; sonst Vorrang 2.
 */
export function einzureihen(zeilen) {
  const titel = new Map()
  for (const z of zeilen) {
    if (z.gegenprobe === 'ja') continue
    const vorrang = z.gegenprobe === 'nein' || z.vorErweiterung ? 1 : 2
    titel.set(z.anilistId, Math.min(titel.get(z.anilistId) ?? 2, vorrang))
  }
  return titel
}
