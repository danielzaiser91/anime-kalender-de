/**
 * **`?zaehlen=1&nummern=1` ist eine Obermenge von `?zaehlen=1`** (15.10.2026).
 *
 * Die Prime-Seite (`amazon.js`, `briefkastenHolen` und `standVomWorker`) und `disney.js` rufen dieselbe
 * Adresse ab, damit eine einzige D1-Abfrage je Rechenzentrum und zwei Stunden alle bedient. Das geht nur,
 * solange die Antwort mit `nummern=1` jedes Feld der Antwort ohne trägt, mit gleichem Wert.
 *
 * Aufruf: `npx tsx tools/worker-zaehlen-nummern.test.ts`
 */
import { zaehleOffenePruefungen } from '../worker/src/pruefung-zaehlen.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}

/* Jede Abfrage liefert dieselbe Zeile mit allen Spalten, die die Zählung liest. */
const zeile = { plattform: 'primevideo', url: 'https://www.amazon.de/dp/B0TEST0001', folge_nr: 3, staffel: 1, such_url: 's', seiten_kennung: 'k', kennungen: '["B0TEST0001"]' }
const anweisung = { bind: () => anweisung, all: async () => ({ results: [zeile] }) }
const env = { DB: { prepare: () => anweisung }, SITE_URL: 'https://attrappe.test/' } as never
globalThis.fetch = (async () => new Response(JSON.stringify({ erzeugtAm: '2026-10-15T10:00:00.000Z' }))) as typeof fetch
const antwort = (body: unknown) => new Response(JSON.stringify(body))

async function hole(suche: string) {
  const r = await zaehleOffenePruefungen({ request: new Request(`https://worker.test/pruefung?${suche}`) as never, env, antwort })
  return (await r.json()) as Record<string, unknown>
}

console.log('zaehlen mit und ohne nummern')
const ohne = await hole('zaehlen=1')
const mit = await hole('zaehlen=1&nummern=1')
for (const [feld, wert] of Object.entries(ohne)) {
  pruefe(JSON.stringify(mit[feld]) === JSON.stringify(wert), `Feld ${feld} gleich`)
}
pruefe(Object.keys(ohne).length >= 6, 'Antwort ohne nummern hat ihre Felder')
pruefe(Array.isArray(mit.eintraege) && (mit.eintraege as unknown[]).length === 2, 'mit nummern: eintraege dazu')

/*
  Meldungen 25028/25029 (31.10.2026): Staffel nicht im Bestand, Meldung 17:45 Z, Prüfstand 19:30 Z. Die Seitenabfrage mit
  Zeitgrenze liefert sie nicht mehr; sie liegt aber noch unübernommen im Briefkasten und muss als gemeldet gelten.
  Die Attrappe antwortet je nach SQL: Zeitgrenze leer, offene Zeilen mit der Kennung.
*/
console.log('offene Meldung ohne Bestandszuordnung nach dem Prüfstand')
const offeneZeile = (kennung: string | null) => ({ plattform: 'primevideo', url: 'https://www.amazon.de/dp/B0C94H534K', folge_nr: null, staffel: 20, seiten_kennung: kennung })
const umgebung = (offen: unknown[], seiten: unknown[]) => ({
  DB: {
    prepare: (sql: string) => {
      const ergebnis = sql.includes('uebernommen = 0') ? (sql.includes('pruefung_titel') ? [] : offen) : sql.includes('seiten_kennung') ? seiten : []
      const a = { bind: () => a, all: async () => ({ results: ergebnis }) }
      return a
    },
  },
  SITE_URL: 'https://attrappe.test/',
}) as never
async function seitenMit(offen: unknown[], seiten: unknown[]) {
  const r = await zaehleOffenePruefungen({ request: new Request('https://worker.test/pruefung?zaehlen=1') as never, env: umgebung(offen, seiten), antwort })
  return ((await r.json()) as { gemeldeteSeiten: string[] }).gemeldeteSeiten
}
pruefe(JSON.stringify(await seitenMit([offeneZeile('B0C94H534K')], [])) === '["B0C94H534K"]', 'offene Meldung: ASIN in gemeldeteSeiten')
pruefe(JSON.stringify(await seitenMit([], [])) === '[]', 'keine offene Zeile: nicht gemeldet')
pruefe(JSON.stringify(await seitenMit([offeneZeile(null)], [])) === '[]', 'offene Zeile ohne Seitenkennung: leer')
pruefe(JSON.stringify(await seitenMit([offeneZeile('B0C94H534K')], [{ seiten_kennung: 'B0CKBMLDTL' }])) === '["B0CKBMLDTL","B0C94H534K"]', 'Zeitgrenze und offen zusammen')
pruefe(JSON.stringify(await seitenMit([offeneZeile('B0C94H534K')], [{ seiten_kennung: 'B0C94H534K' }])) === '["B0C94H534K"]', 'dieselbe Kennung in beiden: einmal')

if (fehler) {
  console.log(`${fehler} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log('Obermenge hält.')
