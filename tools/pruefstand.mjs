/**
 * Wie weit die Prüfung je Anbieter ist — für die Statusanzeige.
 *
 * Daniel am 26.08.2026: „mach oben in die status app eine leiste für die
 * prüfliste, damit ich auf einen blick sehe ob dort irgendwas für mich zum
 * abarbeiten mit extension drinsteht … mach dort zB amazon 40/300, wenn 300 von
 * mir zu melden sind und ich 40 bereits gemeldet habe."
 *
 * Gezählt werden **Einträge**, nicht Adressen: Unter einer Amazon-Kennung
 * hängen oft mehrere Staffeln, und jede braucht ihre eigene Antwort.
 *
 * **Die Prüfliste ist die Wahrheit über „offen", nicht der Datensatz.** Sie
 * lässt weg, was niemand anklicken kann — bei Amazon etwa jede Suchadresse
 * (`/s?k=…`), die keine Kennung trägt. Wer stattdessen selbst über
 * `titles.json` zählt, kommt auf 210 offene Einträge, wo 62 zu tun sind: eine
 * Zahl, die zu Arbeit auffordert, die es nicht gibt. Deshalb kommt „offen" aus
 * der Liste und „gemeldet" ist die Differenz — so stimmt die Rechnung auch
 * dann noch, wenn ein Erzeuger seinen Filter ändert.
 *
 * Die Datei ist winzig (unter 400 Byte) und liegt neben den anderen
 * Erzeugnissen. Die Statusanzeige läuft aus einer lokalen Datei; sie kann
 * `titles.json` mit seinen gut 550 KB nicht bei jedem Takt laden, diese hier
 * schon.
 *
 * Aufruf: node tools/pruefstand.mjs — hängt an `npm run data:extension-liste`.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/** Die Prüfliste laden, wie die Erweiterung sie sieht. */
function listeLesen(datei, global) {
  try {
    const text = readFileSync(resolve(wurzel, datei), 'utf8')
    return JSON.parse(text.replace(new RegExp(`^globalThis.${global} = `), ''))
  } catch {
    return {}
  }
}

/** Die Adresse aus dem Bestand holen, statt sie zu bauen. */
function adresseFuer(plattform, kennung) {
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.platform === plattform && (s.url ?? '').includes(kennung)) return s.url
    }
  }
  return null
}

const ANBIETER = [
  {
    name: 'Amazon',
    plattform: 'primevideo',
    datei: 'extension/offene-amazon.js',
    global: 'AK_OFFENE_AMAZON',
    /* Bei Amazon steht die Adresse im Eintrag, bei Netflix ist sie der Schlüssel. */
    ziel: (schluessel, wert) => wert.url ?? schluessel,
    offene: (wert) => (wert.eintraege ?? []).filter((e) => e.offen).length,
  },
  {
    name: 'Netflix',
    plattform: 'netflix',
    datei: 'extension/offene-netflix.js',
    global: 'AK_OFFENE_TITEL',
    /*
      Netflix führt die Kennung als Schlüssel, nicht die Adresse. Die Form ist
      im Bestand belegt (`https://www.netflix.com/title/80075178`) und wird von
      dort genommen, nicht zusammengebaut — eine Adresse, die plausibel aussieht
      und ins Leere führt, ist von einer echten nicht zu unterscheiden.
    */
    ziel: (schluessel) => adresseFuer('netflix', schluessel),
    offene: (wert) => (wert.staffeln ?? []).filter((s) => s.offen).length,
  },
]

const stand = ANBIETER.map((a) => {
  const liste = Object.entries(listeLesen(a.datei, a.global))
  const offen = liste.reduce((n, [, wert]) => n + a.offene(wert), 0)

  /*
    Alle Verweise dieses Anbieters im Datensatz — die Obergrenze. Was davon
    nicht anklickbar ist, steht schon in der Liste nicht drin und wird über die
    Differenz als „gemeldet" gezählt; das ist die freundlichere Seite zum
    Irren, denn eine zu kleine Restzahl treibt niemanden zu Leerlauf.
  */
  let gesamt = 0
  for (const t of titel) for (const s of t.streams ?? []) if (s.platform === a.plattform) gesamt++

  const [schluessel, wert] = liste[0] ?? []
  return {
    name: a.name,
    gemeldet: Math.max(0, gesamt - offen),
    gesamt,
    offen,
    ziel: schluessel ? a.ziel(schluessel, wert) : null,
    /* Der Name des ersten offenen Eintrags — er steht als Titel am Knopf. */
    naechster: wert?.titel ?? null,
  }
})

writeFileSync(
  resolve(wurzel, 'public/data/pruefstand.json'),
  JSON.stringify({ erzeugtAm: new Date().toISOString(), anbieter: stand }, null, 1) + '\n',
)
for (const a of stand) console.log(`${a.name}: ${a.gemeldet}/${a.gesamt} — ${a.offen} offen${a.naechster ? `, zuerst „${a.naechster}"` : ''}`)
