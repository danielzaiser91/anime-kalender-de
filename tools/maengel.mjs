/**
 * Mängel-Register lesen (`data/maengel.json`, Entscheidung 16.11.2026, docs/wissen/maengel.md).
 *   node tools/maengel.mjs                          Übersicht je Art: offen, neu, behoben, Rückfall, Ausnahme, Wirkung, wer
 *   node tools/maengel.mjs --top 20 [--wer auto|hand|daniel]   die nächsten Titel nach Wirkung; gleiche Wirkung: Termin in 30 Tagen vor laufend vor Rang (`tr`)
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = join(dirname(fileURLToPath(import.meta.url)), '..')
const lies = (p) => JSON.parse(readFileSync(join(wurzel, p), 'utf8'))

/** Wer eine Zeile abbaut: `auto:…`, `hand:…` oder `daniel` → die Klasse davor. */
const klasse = (wer) => wer.split(':')[0]

/** Titel mit Termin ab heute: 0 = in 30 Tagen, 1 = später, 2 = keiner. */
export function terminStufe(kennung, events, heute) {
  const bis = new Date(Date.parse(heute) + 30 * 86_400_000).toISOString().slice(0, 10)
  const tage = events.filter((e) => e.titleId === kennung && e.date >= heute).map((e) => e.date)
  if (!tage.length) return 2
  return tage.some((d) => d <= bis) ? 0 : 1
}

/** Laufend (Stufe 1 der Rangfolge): Serie ohne Ende ab heute; ohne `jpEnd` gilt das Jahresende von `jpYear` (wie `titleStatus`), ein Film läuft nie (17.11.2026: Zorro und Eichhörnchen und Igel, 1977, standen als laufend). */
export const laeuft = (t, heute) => t.format !== 'MOVIE' && (t.jpEnd ?? (t.jpYear ? `${t.jpYear}-12-31` : '9')) >= heute

/** Die nächsten Titel: je Titel die höchste Wirkung seiner offenen Mängel, geordnet nach Wirkung, dann Termin in 30 Tagen vor laufend vor Titelrang `tr`. */
export function nextTop(register, titel, events, heute, n, wer) {
  const nachKennung = new Map(titel.map((t) => [t.id, t]))
  const je = new Map()
  for (const z of register.zeilen) {
    if (z.status !== 'offen' || (wer && klasse(z.wer) !== wer)) continue
    const e = je.get(z.t) ?? { t: z.t, wirkung: 0, arten: [] }
    e.wirkung = Math.max(e.wirkung, z.wirkung)
    e.arten.push(z.art)
    je.set(z.t, e)
  }
  const zeilen = [...je.values()].map((e) => {
    const t = nachKennung.get(e.t)
    return { ...e, name: t?.titleDe ?? t?.titleRomaji ?? '?', stufe: terminStufe(e.t, events, heute), laeuft: t ? laeuft(t, heute) : false, rang: t?.tr ?? Infinity }
  })
  const reihe = (e) => [-e.wirkung, e.stufe, e.laeuft ? 0 : 1, e.rang]
  zeilen.sort((a, b) => { const x = reihe(a), y = reihe(b); for (let i = 0; i < x.length; i++) if (x[i] !== y[i]) return x[i] < y[i] ? -1 : 1; return a.t - b.t })
  return zeilen.slice(0, n)
}

function main() {
  const args = process.argv.slice(2)
  const wert = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : undefined }
  const register = lies('data/maengel.json')
  if (args.includes('--top')) {
    const n = Number(wert('--top') ?? 10)
    const wer = wert('--wer')
    const titel = lies('public/data/titles.json')
    const events = lies('public/data/events.json')
    for (const e of nextTop(register, titel, events, register.stand, n, wer)) {
      console.log(`${String(e.t).padStart(9)}  W${e.wirkung}  ${['Termin ≤ 30 T', 'Termin später', 'kein Termin'][e.stufe].padEnd(13)}  ${e.laeuft ? 'laufend' : '       '}  ${e.name} — ${e.arten.join(', ')}`)
    }
    return
  }
  for (const zeile of uebersicht(register)) console.log(zeile)
}

/** Eine Zeile je Art; Wirkung und `wer` stammen aus dem Zähler, gelten also auch für Arten ohne offene Zeile. */
export function uebersicht(register) {
  const zeilen = [`Mängel am ${register.stand}`, 'art'.padEnd(24) + 'offen  neu  beh  rück  ausn  wirk  wer']
  for (const [art, z] of Object.entries(register.zaehler)) {
    zeilen.push(art.padEnd(24) + [z.offen, z.neu, z.behoben, z.rueckfall, z.ausnahme].map((x) => String(x).padStart(5)).join(' ') + `  W${z.wirkung}   ${z.wer}`)
  }
  if (register.hinweis) zeilen.push(`Hinweis: ${register.hinweis}`)
  return zeilen
}

if (process.argv[1] === fileURLToPath(import.meta.url)) main()
