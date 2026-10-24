/**
 * **Ein Disney+-„nichts da?“ erledigt eine Wiedervorlage genau dann, wenn es nach dem Prüfstand ankommt** (24.10.2026).
 *
 * Die Erweiterung (`disney-weg.js`) rechnet ihre Antwort gegen `pruefstandAm`; der Worker muss dieselbe Meldung
 * (`befund = weg`, keine Folgennummer) als Meldung seit dem Prüfstand zählen, sonst zeigt der Knopf weniger als der
 * Laufstatus. Echter Worker-Code (`handlePruefung`, `berechnePruefstand`) auf einer In-Memory-Datenbank mit den
 * Migrationen; nie gegen den echten Briefkasten. Der Prüfstand liegt vor oder nach der Meldung über ein festes Datum.
 *
 * Aufruf: `npx tsx tools/worker-weg-stand.test.ts`
 */
import { handlePruefung } from '../worker/src/pruefung.ts'
import { berechnePruefstand } from '../worker/src/pruefung-stand.ts'
import { neueDatenbank, post, stand, umgebung, type Hilfe } from './worker-titelzeile-hilfe.ts'

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
console.error = () => {}
console.warn = () => {}

const VOR = '2000-01-01T00:00:00.000Z'
const NACH = '2999-12-31T00:00:00.000Z'
const WEG = 'https://www.disneyplus.com/de-de/series/bleach/4Afet1Q421gy'
const ANDERE = 'https://www.disneyplus.com/de-de/series/aoashi/zzz'

/** Der Körper aus `akDisneyWegSenden` (extension/disney-weg.js). */
const weg = (url: string) => ({
  plattform: 'disneyplus',
  url,
  vorhanden: 'nein',
  art: 'gemessen',
  titel: 'Titel',
  serientitel: 'Titel',
  notiz: 'Disney+ meldet: nicht in deinem Gebiet verfügbar',
})

async function offeneZiele(erzeugtAm: string, meldungen: string[], nachher?: (env: ReturnType<typeof umgebung>) => Promise<void>) {
  const db = neueDatenbank()
  const h: Hilfe = { geschrieben: 0 }
  const env = umgebung(db, h)
  for (const url of meldungen) await handlePruefung(post(weg(url)), env)
  if (nachher) await nachher(env)
  stand.erzeugtAm = erzeugtAm
  stand.anbieter = [
    {
      name: 'Disney+',
      plattform: 'disneyplus',
      offen: 2,
      gesamt: 2,
      gemeldet: 0,
      ziele: [
        { url: WEG, titel: 'Bleach', seit: '2026-10-15' },
        { url: ANDERE, titel: 'Aoashi', seit: '2026-08-26' },
      ],
    },
  ]
  const antwort = (await (await berechnePruefstand({ env, antwort: (b) => Response.json(b) })).json()) as {
    anbieter: { ziele: { url: string }[]; titel: number }[]
  }
  return { urls: antwort.anbieter[0]!.ziele.map((z) => z.url), titel: antwort.anbieter[0]!.titel }
}

console.log('weg ohne Folgennummer')
{
  const davor = await offeneZiele(VOR, [WEG])
  pruefe(!davor.urls.includes(WEG) && davor.urls.includes(ANDERE), 'weg nach dem Prüfstand: die Wiedervorlage ist erledigt, die andere bleibt offen')
  pruefe(davor.titel === 1, 'Zahl: ein Titel offen')
  const danach = await offeneZiele(NACH, [WEG])
  pruefe(danach.urls.includes(WEG) && danach.urls.includes(ANDERE) && danach.titel === 2, 'weg vor dem Prüfstand (nur im Briefkasten unterwegs): beide bleiben offen')
  const keine = await offeneZiele(VOR, [])
  pruefe(keine.titel === 2, 'ohne Meldung: beide offen')
  const abgehakt = await offeneZiele(VOR, [WEG], async (env) => {
    const offen = (await (await handlePruefung(new Request('https://w.test/pruefung?token=t'), env)).json()) as { pruefungen: { id: number }[] }
    await handlePruefung(post({ uebernommen: offen.pruefungen.map((p) => p.id) }), env)
  })
  pruefe(!abgehakt.urls.includes(WEG), 'nach dem Prüfstand gemeldet und schon übernommen: bleibt erledigt')

  /* Die Adresse hat schon eine Titelzeile (Folgen gemeldet, `NICHT_VERDRAENGT`): das weg danach zählt trotzdem. */
  const mitZeile = await offeneZiele(VOR, [], async (env) => {
    const folge = {
      ...weg(WEG),
      vorhanden: 'ja',
      ton_de: 'ja',
      titelId: 5,
      folge: 'Folge 1',
      folge_nr: 1,
      staffel: 1,
      rohfolgen: [{ gti: 'g1', nummer: 1, titel: 'Folge 1', sprachen: ['de'], staffelNr: 1, vorhanden: 'ja', ton_de: 'ja' }],
    }
    await handlePruefung(post(folge), env)
    await handlePruefung(post(weg(WEG)), env)
  })
  pruefe(!mitZeile.urls.includes(WEG), 'Adresse mit Titelzeile, weg nach dem Prüfstand: erledigt')
  const mitZeileVor = await offeneZiele(NACH, [], async (env) => {
    await handlePruefung(post(weg(WEG)), env)
  })
  pruefe(mitZeileVor.urls.includes(WEG), 'Gegenprobe ohne Titelzeile, Prüfstand später: offen')
}

if (fehler) {
  console.error(`worker-weg-stand: ${fehler} Fehler`)
  process.exit(1)
}
console.log('worker-weg-stand: alle Zusicherungen erfüllt')
