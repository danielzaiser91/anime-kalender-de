import yaml from 'js-yaml'

/**
 * Fast-Doppel in `data/dub-confirmed.yaml`: Belege, die sich nur im Prüfdatum (`checkedAt`) unterscheiden.
 * Verglichen wird der ganze übrige Beleg samt Notiz — die Notiz trägt Fundstellen (Amazon-Seite, Tonspuren), die
 * Leser der Rohliste einzeln auswerten (`notizSeite`, `kanalAusNotiz`). Gleich ist der Beleg also nur, wenn auch sie gleich ist.
 * Es bleibt der erste Beleg der Gruppe an seinem Platz und bekommt das jüngste `checkedAt`: Leser, die die Datei der Reihe
 * nach auswerten (erster Anspruch auf eine Amazon-Seite), sehen so dieselbe Reihenfolge wie vorher (gemessen im Bau-Vergleich:
 * blieb der jüngere Beleg weiter hinten, änderte sich bei Pokémon und Food Wars! The Second Plate der Prime-Weg).
 *
 * Nicht zusammengeführt wird eine Gruppe, wenn
 *  - ihre Belege aus verschiedener Herkunft stammen (Abschnitt „Aus dem Browser gemeldet“ gegen von Hand geprüft;
 *    `tools/poc-urteil/beobachtungen.mjs` zählt nur die von Hand geprüften), oder
 *  - ein überzähliger Beleg einen eigenen Kommentar unmittelbar davor trägt (er würde am Nachbarn hängen bleiben), oder
 *  - der bleibende Beleg keine eigene `checkedAt`-Zeile hat, in die das jüngste Datum passt.
 */
export type FastDoppelBilanz = { text: string; entfernt: number; gruppen: number; gemischt: number; mitKommentar: number }

type Block = { von: number; bis: number; datumZeile: number; schluessel: string; datum: string; browser: boolean; kommentar: boolean }

const ISO_TAG = /^\d{4}-\d{2}-\d{2}$/
const ABSCHNITT =/^# ---/
const BROWSER = /Aus dem Browser gemeldet|Kanal-Meldungen mit zweiter Quelle/

/** Alle Belegblöcke mit Schlüssel (ohne `checkedAt`), Datum, Herkunft und der Angabe, ob ein eigener Kommentar direkt davorsteht. */
function lieseBloecke(zeilen: string[]): Block[] {
  const bloecke: Block[] = []
  let browser = false
  for (let i = 0; i < zeilen.length; ) {
    const z = zeilen[i] ?? ''
    if (ABSCHNITT.test(z)) browser = BROWSER.test(z)
    if (!z.startsWith('- ')) {
      i++
      continue
    }
    let j = i + 1
    while (j < zeilen.length && ((zeilen[j] ?? '').startsWith(' ') || (zeilen[j] ?? '').trim() === '')) j++
    let ende = j
    while (ende > i && (zeilen[ende - 1] ?? '').trim() === '') ende--
    const davor = zeilen[i - 1] ?? ''
    const kommentar = davor.startsWith('#') && !ABSCHNITT.test(davor)
    try {
      const beleg = (yaml.load(zeilen.slice(i, ende).join('\n')) as Record<string, unknown>[] | null)?.[0]
      if (beleg) {
        const { checkedAt, ...rest } = beleg
        const sortiert = Object.fromEntries(Object.entries(rest).sort(([a], [b]) => a.localeCompare(b)))
        const datumZeile = zeilen.slice(i, ende).findIndex((x) => /^\s+checkedAt:/.test(x))
        bloecke.push({ von: i, bis: ende, datumZeile: datumZeile < 0 ? -1 : i + datumZeile, schluessel: JSON.stringify(sortiert), datum: String(checkedAt ?? ''), browser, kommentar })
      }
    } catch {
      /* ein unlesbarer Block bleibt stehen */
    }
    i = j
  }
  return bloecke
}

/** Entfernt die überzähligen Belege jeder Gruppe; der Rest des Textes (Kommentare, Reihenfolge, Anführungszeichen) bleibt unangetastet. */
export function entferneFastDoppel(text: string): FastDoppelBilanz {
  const zeilen = text.split('\n')
  const gruppenMap = new Map<string, Block[]>()
  for (const b of lieseBloecke(zeilen)) gruppenMap.set(b.schluessel, [...(gruppenMap.get(b.schluessel) ?? []), b])
  const raus = new Set<Block>()
  const neuesDatum = new Map<number, string>()
  let gruppen = 0
  let gemischt = 0
  let mitKommentar = 0
  for (const g of gruppenMap.values()) {
    if (g.length < 2) continue
    gruppen++
    const [bleibt, ...weg] = g as [Block, ...Block[]]
    const juengster = g.reduce((a, b) => (b.datum > a.datum ? b : a)).datum
    if (g.some((b) => b.browser !== bleibt.browser)) gemischt++
    else if (weg.some((b) => b.kommentar) || bleibt.datumZeile < 0 || !g.every((b) => ISO_TAG.test(b.datum))) mitKommentar++
    else {
      weg.forEach((b) => raus.add(b))
      if (juengster !== bleibt.datum) neuesDatum.set(bleibt.datumZeile, juengster)
    }
  }
  const ausgabe: string[] = []
  const wegVon = new Map([...raus].map((b) => [b.von, b]))
  for (let i = 0; i < zeilen.length; ) {
    const b = wegVon.get(i)
    if (!b) {
      const datum = neuesDatum.get(i)
      ausgabe.push(datum ? (zeilen[i] ?? '').replace(/\d{4}-\d{2}-\d{2}/, () => datum) : (zeilen[i] ?? ''))
      i++
      continue
    }
    /* Auch den Abstand vor dem entfernten Beleg zurücknehmen. */
    while (ausgabe.length && (ausgabe[ausgabe.length - 1] ?? '').trim() === '') ausgabe.pop()
    i = b.bis
  }
  return { text: ausgabe.join('\n'), entfernt: raus.size, gruppen, gemischt, mitKommentar }
}
