/**
 * Einzahl „1 Folge“ statt „1 Folgen“ in der Web-App: jeder Text mit „{Zahl} Folgen“ bei n = 1 und n = 2.
 * Aufruf: npx tsx pipeline/check-einzahl-folge.ts
 */
import { readdirSync, readFileSync } from 'node:fs'
import { translate, einzahlFolge, type TranslationKey } from '../web/src/lib/i18n.tsx'
import { googleCalendarUrl } from '../shared/ics.ts'
import type { ReleaseEvent } from '../shared/types.ts'

let verletzt = 0
let gezaehlt = 0
function pruefe(name: string, ist: string, soll: string): void {
  gezaehlt++
  if (ist === soll) return
  verletzt++
  console.error(`  ✖ ${name}: ${JSON.stringify(ist)} statt ${JSON.stringify(soll)}`)
}

type Fall = [TranslationKey, Record<string, string | number>, string, string]
const FAELLE: Fall[] = [
  ['card.missedCount', { n: 1 }, 'beim Anbieter stehen 1 Folge', 'beim Anbieter stehen 2 Folgen'],
  ['detail.dubKopfVon', { n: 1, m: 1 }, '1 von 1 Folge auf Deutsch', '2 von 2 Folgen auf Deutsch'],
  ['detail.dubKopf', { n: 1 }, '1 Folge auf Deutsch', '2 Folgen auf Deutsch'],
  ['antwort.alleFolgen', { count: 1 }, 'Alle 1 Folge', 'Alle 2 Folgen'],
  ['antwort.nochFolgen', { count: 1, datum: 'x' }, 'noch 1 Folge bis zum Finale am x', 'noch 2 Folgen bis zum Finale am x'],
  ['antwort.erschienenZahl', { raus: 1, gesamt: 1 }, '1 von 1 Folge erschienen', '2 von 2 Folgen erschienen'],
  ['antwort.erschienenRest', { gesamt: 1 }, 'von 1 Folge erschienen', 'von 2 Folgen erschienen'],
  ['antwort.fertigZahl', { count: 1 }, 'Alle 1 Folge auf Deutsch', 'Alle 2 Folgen auf Deutsch'],
  ['antwort.teilweiseZahl', { raus: 1, gesamt: 1 }, '1 von 1 Folge auf Deutsch', '2 von 2 Folgen auf Deutsch'],
  ['kostenlos.zahl', { frei: 1, von: 1 }, '1 von 1 Folge', '2 von 2 Folgen'],
  ['antwort.fertigUngefaehr', { count: '≈ 1' }, 'Auf Deutsch, ≈ 1 Folge', 'Auf Deutsch, ≈ 2 Folgen'],
  ['kal.buendelStream', { n: 1 }, '+1 Folge', '+2 Folgen'],
  ['kal.folgen', { n: 1 }, '1 Folge', '2 Folgen'],
]
for (const [schluessel, params, eins, zwei] of FAELLE) {
  const zahlen = Object.fromEntries(Object.entries(params).map(([k, v]) => [k, v === '≈ 1' ? '≈ 2' : 2]))
  pruefe(`${schluessel} n=1`, translate(schluessel, params), eins)
  pruefe(`${schluessel} n=2`, translate(schluessel, typeof params.datum === 'string' ? { ...zahlen, datum: 'x' } : zahlen), zwei)
}
pruefe('11 und 21 bleiben Mehrzahl', translate('kal.folgen', { n: 11 }) + translate('kal.folgen', { n: 21 }), '11 Folgen21 Folgen')
/* Das Zahlwort vor „Folgen“ entscheidet, nicht der erste Parameter. */
pruefe('dubKopfVon n=1, m=12', translate('detail.dubKopfVon', { n: 1, m: 12 }), '1 von 12 Folgen auf Deutsch')
pruefe('dubKopfVon n=12, m=1', translate('detail.dubKopfVon', { n: 12, m: 1 }), '12 von 1 Folge auf Deutsch')
pruefe('erschienenZahl raus=1, gesamt=12', translate('antwort.erschienenZahl', { raus: 1, gesamt: 12 }), '1 von 12 Folgen erschienen')
/* Nur genau 1 (auch „≈ 1“) ist Einzahl: keine Teilzahlen, kein Komma, kein Endanker-Verlust. */
pruefe('n=1,5 bleibt Mehrzahl', translate('kal.folgen', { n: '1,5' }), '1,5 Folgen')
pruefe('n=10 bleibt Mehrzahl', translate('kal.folgen', { n: '10' }), '10 Folgen')
pruefe('n=100 bleibt Mehrzahl', translate('kal.folgen', { n: '100' }), '100 Folgen')
pruefe('Folgenliste ohne Wortgrenze bleibt', einzahlFolge('{n} Folgenliste', { n: 1 }), '{n} Folgenliste')
pruefe('Wort „Folgen“ ohne Zahl bleibt', einzahlFolge('Alle Folgen {n}', { n: 1 }), 'Alle Folgen {n}')

/* Google-Link: „Die N Folge(n) danach“ über die echte Aufrufstelle. */
const ev = (date: string, time: string, episode: number) =>
  ({ id: 'x' + episode, releaseSlug: 'x', name: 'Serie', platform: 'disneyplus', releaseType: 'weekly', date, time, episode, episodeCount: 13 }) as unknown as ReleaseEvent
for (const [rest, soll] of [[1, 'Die 1 Folge danach kommt'], [2, 'Die 2 Folgen danach kommen']] as const) {
  const details = new URL(googleCalendarUrl(ev('2026-10-09', '19:00', 2), {}, { anzahl: 3, rest })).searchParams.get('details') ?? ''
  pruefe(`ics rest=${rest}`, details.includes(soll) ? soll : details, soll)
}

/** Zeilen mit „${…} Folgen“ im Quelltext: dort fehlt die Einzahl, wenn die Zahl 1 sein kann. */
export function rohFolgenZeilen(text: string): string[] {
  return text.split('\n').filter((z) => /\$\{[^}]*\}\s+Folgen\b/.test(z))
}
const probeRoh = ['a', 'x = `${n} Folgen`', 'b'].join('\n')
pruefe('Wächter findet Rohtext', `${rohFolgenZeilen(probeRoh).length}:${rohFolgenZeilen('translate("{n} Folgen")').length}`, '1:0')

/* Zahl ist hier immer ≥ 2 (Datei:Grund); alles andere in web/src, shared, worker/src muss Einzahl können. */
const MEHRZAHL_GARANTIERT = [
  'web/src/lib/toggo.ts', // nur bei mehr als zwei Bereichen, also ≥ 3 Folgen
  'worker/src/push-text.ts', // „N neue Folgen“ erst ab zwei Teilen (Einzelfall davor beendet)
  'shared/ics.ts', // else-Zweig von restHinweis (rest !== 1)
  'shared/takt-text.ts', // „N Folgen auf einmal“ gilt nur für n ≥ 2
  'shared/folgen-anker.ts', // Diagnosezeile für die Pflege, kein Besuchertext
]
function dateien(ordner: string): string[] {
  return readdirSync(ordner, { withFileTypes: true }).flatMap((d) => {
    if (d.isDirectory()) return dateien(`${ordner}/${d.name}`)
    return /\.tsx?$/.test(d.name) ? [`${ordner}/${d.name}`] : []
  })
}
let geprueft = 0
for (const ordner of ['web/src', 'shared', 'worker/src']) {
  for (const datei of dateien(ordner)) {
    if (MEHRZAHL_GARANTIERT.includes(datei)) continue
    geprueft++
    pruefe(`rohe „N Folgen“-Zeile in ${datei}`, rohFolgenZeilen(readFileSync(datei, 'utf8')).join(' | '), '')
  }
}
pruefe('Wächter hat Dateien gesehen', geprueft > 50 ? 'ja' : String(geprueft), 'ja')


if (verletzt) {
  console.error(`${verletzt} Zusicherung(en) verletzt.`)
  process.exit(1)
}
console.log(`check-einzahl-folge: ${gezaehlt} Zusicherungen erfüllt (${FAELLE.length} Texte je n = 1 und n = 2)`)
