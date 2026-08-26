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
    /* Dieselbe Regel wie in `extension-offene-amazon.mjs`: /dp/ oder /detail/, 10–32 Zeichen. */
    kennung: (u) => /\/(?:dp|detail)\/([A-Z0-9]{10,32})/.exec(u)?.[1],
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
    /* Dieselbe Regel wie in `extension-offene-liste.mjs`. */
    kennung: (u) => /\/title\/(\d+)/.exec(u)?.[1],
    offene: (wert) => (wert.staffeln ?? []).filter((s) => s.offen).length,
  },
]

const stand = ANBIETER.map((a) => {
  const liste = Object.entries(listeLesen(a.datei, a.global))
  const offen = liste.reduce((n, [, wert]) => n + a.offene(wert), 0)

  /*
    **Gezählt wird nur, was jemand öffnen kann.**

    Daniel am 26.08.2026: „wieso 550/550 amazon, heißt das 550 wurden gemeldet
    und immer noch nicht übernommen in kalender?"

    Nein — und die Zahl war trotzdem falsch. 122 der 550 Prime-Verweise sind
    **Suchadressen** (`/s?k=Cowboy%20Bebop&i=instant-video`); dort gibt es
    keine Titelseite, auf der die Erweiterung etwas lesen könnte. Sie stehen
    darum zu Recht nicht in der Prüfliste — nur zählte die erste Fassung sie
    über die Differenz stillschweigend als „gemeldet" mit. 428 geprüfte
    Verweise sahen damit aus wie 550.

    Eine geschönte Zahl ist schlimmer als eine unbequeme: Sie behauptet
    Erledigtes, das niemand erledigt hat.
  */
  let gesamt = 0
  let ohneSeite = 0
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.platform !== a.plattform) continue
      if (a.kennung(s.url ?? '')) gesamt++
      else ohneSeite++
    }
  }

  /*
    **Mehrere Ziele, nicht eines.**

    Wer den ersten Titel gemeldet hat, soll beim nächsten Klick den zweiten
    bekommen — und nicht wieder den ersten, bis der nächste Datenlauf die Liste
    neu schreibt. Die Anzeige gleicht dazu gegen den Briefkasten ab; dafür
    braucht sie mehr als einen Kandidaten.

    Fünfundzwanzig reichen für eine Sitzung und halten die Datei klein.
  */
  const ziele = liste
    .filter(([, wert]) => a.offene(wert) > 0)
    .slice(0, 25)
    .map(([schluessel, wert]) => ({ url: a.ziel(schluessel, wert), titel: wert?.titel ?? null }))
    .filter((z) => z.url)

  const [schluessel, wert] = liste[0] ?? []
  return {
    name: a.name,
    /* Der Schlüssel, unter dem der Worker die Meldungen im Briefkasten zählt. */
    plattform: a.plattform,
    gemeldet: Math.max(0, gesamt - offen),
    gesamt,
    offen,
    /* Verweise ohne Titelseite — nicht prüfbar, deshalb außerhalb der Rechnung. */
    ohneSeite,
    ziel: schluessel ? a.ziel(schluessel, wert) : null,
    ziele,
    /* Der Name des ersten offenen Eintrags — er steht als Titel am Knopf. */
    naechster: wert?.titel ?? null,
  }
})

writeFileSync(
  resolve(wurzel, 'public/data/pruefstand.json'),
  JSON.stringify({ erzeugtAm: new Date().toISOString(), anbieter: stand }, null, 1) + '\n',
)
for (const a of stand) {
  console.log(
    `${a.name}: ${a.gemeldet}/${a.gesamt} — ${a.offen} offen` +
      (a.naechster ? `, zuerst „${a.naechster}"` : '') +
      (a.ohneSeite ? `; ${a.ohneSeite} Suchadressen ohne Titelseite` : ''),
  )
}
