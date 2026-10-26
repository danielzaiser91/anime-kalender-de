/**
 * **Prüfung: Ein leerer Crunchyroll-Kalender hinterlässt eine Diagnose** (26.10.2026: seit 21.10. 0 Kacheln, im Log nur
 * „Seitenaufbau geändert?“). Kein Netz: `scrapeWeek` läuft gegen einen Browser aus Attrappen (Methoden streng an ihr
 * Objekt gebunden), `source-health.json` liegt in einem Wegwerf-Ordner (`AK_ROOT`).
 *
 * Aufruf: npx tsx pipeline/check-cr-kalender-diagnose.ts
 */
import { mkdirSync, mkdtempSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const ordner = mkdtempSync(join(tmpdir(), 'cr-kalender-diagnose-'))
mkdirSync(join(ordner, 'data'))
process.env.AK_ROOT = ordner
const { fehlerText, kalenderDiagnose, meldeLeerenKalender } = await import('./lib/cr-kalender-diagnose.ts')
const { liesWochen, scrapeWeek } = await import('./scrape-crunchyroll.ts')

let fehler = 0
const pruefe = (bedingung: boolean, text: string) => {
  console.log(`  ${bedingung ? 'ok  ' : 'FEHL'} ${text}`)
  if (!bedingung) fehler++
}
const gesundheit = () => JSON.parse(readFileSync(join(ordner, 'data', 'source-health.json'), 'utf8'))

// Cloudflare-Prüfseite, wie sie ein Bot sieht (Titel und Skriptmerkmal sind die der echten Seite).
const CHALLENGE_HTML =
  '<html><head><title>Just a moment...</title></head><body><form id="challenge-form" action="/?__cf_chl_f_tk=abc"></form></body></html>'
const KACHEL_HTML = '<html><head><title>Simulcast-Kalender</title></head><body><article class="release"></article></body></html>'

console.log('kalenderDiagnose')
{
  const d = kalenderDiagnose({ status: 403, titel: 'Just a moment...', text: 'Verifying you are human', html: CHALLENGE_HTML })
  pruefe(d.startsWith('HTTP 403; '), 'Status vorn')
  pruefe(d.includes('Titel „Just a moment...“'), 'Seitentitel')
  pruefe(d.includes('Challenge-Merkmale: __cf_chl, challenge-form, Just a moment;'), 'Merkmale benannt (nur die vorhandenen)')
  pruefe(d.includes('Text „Verifying you are human“'), 'Text')
  const leer = kalenderDiagnose({ status: 200, titel: 'Kalender', text: 'Zeitplan kommt bald', html: '<html></html>' })
  pruefe(leer.includes('keine Challenge-Merkmale'), 'saubere Seite: keine Challenge-Merkmale')
  pruefe(kalenderDiagnose({ titel: '', text: '', html: '' }).startsWith('HTTP unbekannt; '), 'ohne Antwort: Status unbekannt')
  const textVon = (text: string) => /Text „(.*)“$/.exec(kalenderDiagnose({ status: 200, titel: 't', text, html: '' }))![1]
  const zweihundert = `${'x '.repeat(99)}xy`
  pruefe(zweihundert.length === 200 && textVon(zweihundert) === zweihundert, 'genau 200 Zeichen: unverändert')
  pruefe(textVon(`${zweihundert}z`) === `${zweihundert.slice(0, 200)}…`, '201 Zeichen: auf 200 gekürzt')
  const token = 'Xy9'.repeat(20)
  const geschwaerzt = kalenderDiagnose({ status: 200, titel: 't', text: `token ${token} ende`, html: '' })
  pruefe(!geschwaerzt.includes(token) && geschwaerzt.includes('token … ende'), 'lange Schlüsselfolge entfernt')
  const knapp = 'k'.repeat(39)
  pruefe(kalenderDiagnose({ status: 200, titel: 't', text: knapp, html: '' }).includes(`Text „${knapp}“`), '39 Zeichen am Stück bleiben')
  pruefe(kalenderDiagnose({ status: 200, titel: 't', text: `${knapp}k`, html: '' }).includes('Text „…“'), '40 Zeichen am Stück entfernt')
  pruefe(kalenderDiagnose({ status: 200, titel: 't', text: 'a\n\n  b\tc', html: '' }).includes('Text „a b c“'), 'Leerraum zusammengezogen')
  pruefe(kalenderDiagnose({ status: 200, titel: 't', text: '\n  a b \n', html: '' }).includes('Text „a b“'), 'Leerraum am Rand entfernt')
  pruefe(kalenderDiagnose({ status: 200, titel: 'Einen Moment…', text: '', html: '' }).includes('Challenge-Merkmale: Einen Moment'), 'Merkmal im Titel')
}

console.log('fehlerText')
{
  pruefe(fehlerText([]) === 'keine Kachel im Kalender gefunden', 'ohne Diagnose: alter Satz')
  pruefe(fehlerText(['2026-10-12: A']) === 'keine Kachel im Kalender gefunden — 2026-10-12: A', 'genau eine Diagnose')
  pruefe(fehlerText(['2026-10-12: A', '2026-10-19: B']) === 'keine Kachel im Kalender gefunden — 2026-10-12: A', 'erste Woche')
}

/** Browser-Attrappe: `goto` liefert den Status, `evaluate` je nach Aufruf Kacheln oder Text; jede Methode wirft ungebunden. */
function browserAttrappe(opts: { status: number | null; titel: string; html: string; kacheln: boolean; seiteKaputt?: boolean }) {
  const seite = {
    async goto(this: unknown) {
      if (this === undefined) throw new Error('ungebunden')
      return opts.status === null ? null : { status: () => opts.status }
    },
    async waitForSelector(this: unknown) {
      if (this === undefined) throw new Error('ungebunden')
      if (!opts.kacheln) throw new Error('timeout')
    },
    async evaluate(this: unknown, f: () => unknown) {
      if (this === undefined) throw new Error('ungebunden')
      const text = f.toString()
      if (text.includes('innerText')) {
        if (opts.seiteKaputt) throw new Error('Execution context was destroyed')
        return 'Verifying you are human'
      }
      return opts.kacheln
        ? [{ datetime: '2026-10-21T17:00:00Z', rawTitle: 'Beispiel (Deutsch)', episode: '3', seriesUrl: '/de/series/GXYZ/beispiel' }]
        : []
    },
    async title(this: unknown) {
      if (this === undefined) throw new Error('ungebunden')
      if (opts.seiteKaputt) throw new Error('Target closed')
      return opts.titel
    },
    async content(this: unknown) {
      if (this === undefined) throw new Error('ungebunden')
      if (opts.seiteKaputt) throw new Error('Target closed')
      return opts.html
    },
    async close(this: unknown) {
      if (this === undefined) throw new Error('ungebunden')
    },
  }
  return { seite, browser: { newPage: async () => seite } as never }
}

console.log('scrapeWeek')
{
  const leer = browserAttrappe({ status: 403, titel: 'Just a moment...', html: CHALLENGE_HTML, kacheln: false })
  const diagnosen: string[] = []
  const slots = await scrapeWeek(leer.browser, '2026-10-19', diagnosen)
  pruefe(slots.length === 0 && diagnosen.length === 1, 'leere Woche: eine Diagnose')
  pruefe(diagnosen[0].startsWith('2026-10-19: HTTP 403; Titel „Just a moment...“'), `Diagnose mit Woche und Status: ${diagnosen[0]}`)
  pruefe(diagnosen[0].includes('Text „Verifying you are human“'), 'Text aus innerText der Seite')

  const voll = browserAttrappe({ status: 200, titel: 'Kalender', html: KACHEL_HTML, kacheln: true })
  const d2: string[] = []
  const gefunden = await scrapeWeek(voll.browser, '2026-10-19', d2)
  pruefe(gefunden.length === 1 && gefunden[0].german, 'Woche mit Kachel: ein deutscher Slot')
  pruefe(d2.length === 0, 'Woche mit Kachel: keine Diagnose')

  const ohneAntwort = browserAttrappe({ status: null, titel: '', html: '', kacheln: false })
  const d3: string[] = []
  await scrapeWeek(ohneAntwort.browser, '2026-10-19', d3)
  pruefe(d3[0].startsWith('2026-10-19: HTTP unbekannt;'), 'goto ohne Antwortobjekt: Status unbekannt')

  // Titel, Text und HTML können einzeln scheitern (Seite schon zu): die Diagnose entsteht trotzdem, der Lauf bricht nicht ab.
  const kaputt = browserAttrappe({ status: 503, titel: 'x', html: 'x', kacheln: false, seiteKaputt: true })
  const d4: string[] = []
  await scrapeWeek(kaputt.browser, '2026-10-12', d4)
  pruefe(d4.length === 1 && d4[0] === '2026-10-12: HTTP 503; Titel „“; keine Challenge-Merkmale; Text „“', `Seite zu: ${d4[0]}`)
}

console.log('meldeLeerenKalender')
{
  const warnungen: string[] = []
  const alt = console.warn
  console.warn = (...a: unknown[]) => void warnungen.push(a.join(' '))
  meldeLeerenKalender(['2026-10-12: HTTP 403; Titel „Just a moment...“', '2026-10-19: HTTP 403; Titel „zweite“'])
  console.warn = alt
  pruefe(warnungen.filter((w) => w.includes('Diagnose 2026-10-12: HTTP 403')).length === 1, 'Diagnose der ersten Woche im Log')
  pruefe(warnungen.filter((w) => w.includes('Diagnose 2026-10-19: HTTP 403')).length === 1, 'Diagnose der zweiten Woche im Log')
  const eintrag = gesundheit().crunchyroll
  pruefe(eintrag.lastCount === 0, 'lastCount 0')
  pruefe(eintrag.lastOk === undefined, 'kein lastOk bei Fehlschlag')
  pruefe(eintrag.lastError === 'keine Kachel im Kalender gefunden — 2026-10-12: HTTP 403; Titel „Just a moment...“', `lastError trägt die Diagnose: ${eintrag.lastError}`)
}

console.log('liesWochen')
{
  // Heute ist Montag 26.10.2026; drei Wochen = 19.10., 26.10., 02.11.
  const voll = browserAttrappe({ status: 200, titel: 'Kalender', html: KACHEL_HTML, kacheln: true })
  const mitKacheln = await liesWochen(voll.browser, '2026-10-26', 3)
  pruefe(mitKacheln.slots.length === 3 && mitKacheln.weekStarts.join() === '2026-10-19,2026-10-26,2026-11-02', 'Wochen mit Kacheln: drei Slots, drei Wochen')
  pruefe(gesundheit().crunchyroll.lastError.includes('2026-10-12'), 'Wochen mit Kacheln: Gesundheit unberührt (alter Stand vom Fall davor)')

  const sperre = browserAttrappe({ status: 403, titel: 'Just a moment...', html: CHALLENGE_HTML, kacheln: false })
  const leer = await liesWochen(sperre.browser, '2026-10-26', 3)
  pruefe(leer.slots.length === 0, 'alle Wochen leer: keine Slots')
  const fehlerzeile = gesundheit().crunchyroll.lastError as string
  pruefe(fehlerzeile.startsWith('keine Kachel im Kalender gefunden — 2026-10-19: HTTP 403; Titel „Just a moment...“'), `alle Wochen leer: Gesundheit trägt die Diagnose der ersten Woche: ${fehlerzeile}`)
}

rmSync(ordner, { recursive: true, force: true })
if (fehler) {
  console.error(`${fehler} Fall/Fälle rot`)
  process.exit(1)
}
console.log('check-cr-kalender-diagnose: alle Fälle grün')
