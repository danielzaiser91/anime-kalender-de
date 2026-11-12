/**
 * Zusicherungen zu `worker/src/monitor-statistik.ts`: `ladeMesswerte()` an einer DB-Attrappe (Beginn des Zeitraums, Zeilen ohne
 * erfolgreiche Messung fallen weg, fehlende `results`, Fehler der DB ergibt eine leere Karte), `messZelle()` und `messText()` mit und
 * ohne Verlauf. Läuft in `check:logic`.
 */
import { ladeMesswerte, messText, messZelle, type LesendeDb } from '../worker/src/monitor-statistik.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

type Zeile = { url: string; avg: number | null; max: number; laeufe: number }

/** Attrappe: merkt sich SQL und gebundene Werte, liefert `results` oder wirft beim Lesen. */
function attrappe(antwort: { results?: Zeile[] } | Error) {
  const gesehen: { sql: string; werte: unknown[] }[] = []
  const db: LesendeDb = {
    prepare: (sql) => ({
      bind: (...werte) => {
        gesehen.push({ sql, werte })
        return {
          all: async <T>() => {
            if (antwort instanceof Error) throw antwort
            return antwort as { results?: T[] }
          },
        }
      },
    }),
  }
  return { db, gesehen }
}

async function main() {
  const jetzt = '2026-11-12T23:30:00.000Z'

  const voll = attrappe({
    results: [
      { url: 'https://a.example/', avg: 412, max: 1900, laeufe: 7 },
      { url: 'https://b.example/', avg: null, max: 5000, laeufe: 3 },
      { url: 'https://c.example/', avg: 0, max: 0, laeufe: 1 },
    ],
  })
  const werte = await ladeMesswerte(voll.db, jetzt)
  pruefe('Zeilen ohne Mittelwert fallen weg, 0 bleibt', [...werte.entries()], [
    ['https://a.example/', { avg: 412, max: 1900, laeufe: 7 }],
    ['https://c.example/', { avg: 0, max: 0, laeufe: 1 }],
  ])
  pruefe('Standard: sieben Tage zurück', voll.gesehen.map((g) => g.werte), [['2026-11-05T23:30:00.000Z']])
  pruefe('liest site_history ab ?1, gruppiert je Adresse', /FROM site_history WHERE checked_at >= \?1 GROUP BY url/.test(voll.gesehen[0]!.sql), true)

  const tage = attrappe({ results: [] })
  await ladeMesswerte(tage.db, '2026-03-01T00:00:00.000Z', 1)
  pruefe('ein Tag über die Monatsgrenze', tage.gesehen[0]!.werte, ['2026-02-28T00:00:00.000Z'])
  const null_ = attrappe({ results: [] })
  await ladeMesswerte(null_.db, jetzt, 0)
  pruefe('null Tage: ab jetzt', null_.gesehen[0]!.werte, [jetzt])

  pruefe('leere Ergebnisliste', (await ladeMesswerte(attrappe({ results: [] }).db, jetzt)).size, 0)
  pruefe('results fehlt', (await ladeMesswerte(attrappe({}).db, jetzt)).size, 0)

  // Ein DB-Fehler darf die Wochenmail nicht kippen: leere Karte, Meldung nur im Log.
  const logAlt = console.error
  const log: string[] = []
  console.error = (...a: unknown[]) => void log.push(a.join(' '))
  let karte: Map<string, unknown> | string
  try {
    karte = await ladeMesswerte(attrappe(new Error('D1 weg')).db, jetzt)
  } catch {
    karte = 'geworfen'
  } finally {
    console.error = logAlt
  }
  pruefe('DB-Fehler: leere Karte', karte instanceof Map ? karte.size : karte, 0)
  pruefe('DB-Fehler: eine Logzeile mit Anlass', log.length === 1 && log[0]!.startsWith('Messwerte nicht geladen'), true)

  const w = { avg: 412, max: 1900, laeufe: 7 }
  pruefe('messText mit Verlauf', messText(w), '  (Ø 412 · max 1900 ms · 7 Läufe)')
  pruefe('messText ohne Verlauf', messText(undefined), '')
  const zelle = messZelle(w)
  pruefe('messZelle mit Verlauf: Inhalt', /^<td style="[^"]*">Ø 412 · max 1900 ms · 7×<\/td>$/.test(zelle), true)
  pruefe('messZelle mit Verlauf: rechtsbündig, ohne Umbruch', /text-align:right;/.test(zelle) && /white-space:nowrap;/.test(zelle), true)
  pruefe('messZelle ohne Verlauf: leere Zelle mit Stil', /^<td style="[^"]+"><\/td>$/.test(messZelle(undefined)), true)

  if (fehler) {
    console.error(`check-monitor-statistik: ${fehler} Fehler`)
    process.exit(1)
  }
  console.log('check-monitor-statistik: ok')
}

void main()
