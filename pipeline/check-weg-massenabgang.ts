/**
 * Netflix-Fehltakt (15.–17.11.2026): 170 Wege fielen über Handbelege „Vom Durchgang als nicht bei Netflix gemeldet“ weg, ohne dass
 * es jemand bemerkte. Zwei Zusicherungen: (1) eine einzelne Browser-Totmeldung zählt im Bau nicht (`ladeHandbelege`),
 * (2) die Delta-Wache meldet eine Massenentfernung auch dann, wenn jede einzelne begründet ist (`findeAuffaelliges`).
 * Grenzen stehen hier als Zahl, nicht aus dem Modul gelesen.
 */
import { mkdirSync, mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { findeAuffaelliges, type Kennzahlen } from './lib/bestand-delta.ts'
import { istEinzelneBrowserTotmeldung } from './lib/browser-tot-einzeln.ts'

let fehler = 0
const pruefe = (name: string, ok: boolean, gefunden?: unknown) => {
  if (ok) return console.log(`  ✓ ${name}`)
  fehler++
  console.log(`  ✗ ${name}${gefunden === undefined ? '' : ` — ${JSON.stringify(gefunden)}`}`)
}

const DURCHGANG = 'Vom Durchgang als nicht bei Netflix gemeldet — Umleitung auf Startseite'
const UEBERSICHT = 'Aus der Übersicht als toter Verweis gemeldet — leitet auf die Startseite um'
const b = (rest: Record<string, unknown> = {}) => ({ platform: 'netflix', available: false, note: DURCHGANG, ...rest })

console.log('Browser-Totmeldung')
pruefe('Durchgang, Netflix, available false: zählt nicht', istEinzelneBrowserTotmeldung(b()))
pruefe('Übersicht-Meldung (Daniels Klick): bleibt gültig', !istEinzelneBrowserTotmeldung(b({ note: UEBERSICHT })))
pruefe('Netflix-Handbeleg mit anderer Notiz: bleibt', !istEinzelneBrowserTotmeldung(b({ note: 'Daniels Sichtung: Netflix führt die Staffel nicht' })))
pruefe('andere Plattform: bleibt', !istEinzelneBrowserTotmeldung(b({ platform: 'primevideo' })))
pruefe('Netflix mit Urteil (available fehlt): bleibt', !istEinzelneBrowserTotmeldung(b({ available: undefined })))
pruefe('available true: bleibt', !istEinzelneBrowserTotmeldung(b({ available: true })))
pruefe('ohne Notiz: bleibt', !istEinzelneBrowserTotmeldung(b({ note: undefined })))
pruefe('leer/undefiniert: bleibt', !istEinzelneBrowserTotmeldung(undefined) && !istEinzelneBrowserTotmeldung(null))

console.log('Stichtag (UMLEITUNG_GILT_AB = 17.11. 18:15Z, Beleg trägt nur ein Datum)')
pruefe('Umleitung, Beleg vom 18.11.: zählt (behobene Erweiterung)', !istEinzelneBrowserTotmeldung(b({ checkedAt: '2026-11-18' })))
pruefe('Umleitung, Beleg vom Stichtag-Tag 17.11.: zählt nicht (mehrdeutig)', istEinzelneBrowserTotmeldung(b({ checkedAt: '2026-11-17' })))
pruefe('Umleitung, Beleg vom 16.11. (Fehltakt): zählt nicht', istEinzelneBrowserTotmeldung(b({ checkedAt: '2026-11-16' })))
pruefe('Umleitung ohne checkedAt: zählt nicht', istEinzelneBrowserTotmeldung(b({ checkedAt: undefined })))
pruefe('Durchgang mit anderem Grund (404), 18.11.: zählt weiter nicht (nicht Fehltakt-Sache)', istEinzelneBrowserTotmeldung(b({ note: 'Vom Durchgang als nicht bei Netflix gemeldet — Titelseite 404', checkedAt: '2026-11-18' })))

/* Kulisse: AK_ROOT vor dem Import setzen (ROOT wird beim Laden festgelegt). */
const wurzel = mkdtempSync(join(tmpdir(), 'ak-browser-tot-'))
mkdirSync(join(wurzel, 'data'))
const eintrag = (id: number, platform: string, url: string, note: string, urteil = '  available: false', am = '2026-11-16') =>
  `- anilistId: ${id}\n  title: "T${id}"\n  platform: ${platform}\n  url: ${url}\n${urteil}\n  checkedAt: '${am}'\n  note: ${JSON.stringify(note)}\n`
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  [
    eintrag(900001, 'netflix', 'https://www.netflix.com/title/900001', DURCHGANG),
    eintrag(900002, 'netflix', 'https://www.netflix.com/title/900002', UEBERSICHT),
    eintrag(900003, 'netflix', 'https://www.netflix.com/title/900003', 'Tonspuren: Deutsch', '  dub: true'),
    eintrag(900004, 'primevideo', 'https://www.amazon.de/dp/B000000004', DURCHGANG),
    eintrag(900005, 'netflix', 'https://www.netflix.com/title/900005', DURCHGANG, '  available: false', '2026-11-18'),
    eintrag(900006, 'netflix', 'https://www.netflix.com/title/900006', DURCHGANG, '  available: false', '2026-11-17'),
    eintrag(900007, 'netflix', 'https://www.netflix.com/title/900007', 'Vom Durchgang als nicht bei Netflix gemeldet — Titelseite 404', '  available: false', '2026-11-18'),
  ].join('\n'),
)
process.env.AK_ROOT = wurzel
const { ladeHandbelege } = await import('./lib/dub-confirmed.ts')
const geladen = ladeHandbelege()
  .map((c) => c.anilistId)
  .sort()
pruefe('ladeHandbelege: Fehltakt-Meldungen (16./17.11., 404-Notiz) fehlen; Übersicht, Urteil, Prime und Umleitung vom 18.11. bleiben', geladen.join() === '900002,900003,900004,900005', geladen)

console.log('Delta-Wache')
const kz = (entfernt: Record<string, number>): Kennzahlen => ({
  titel: 500,
  titelMitVerweis: 500,
  verweise: 1000,
  mitUrteil: 900,
  ohneUrteil: 100,
  titelMitSynchro: 400,
  entferntProtokolliert: Object.values(entfernt).reduce((a, n) => a + n, 0),
  releases: 10,
  termine: 100,
  jeAnbieter: { netflix: 300 },
  entferntJeAnbieter: entfernt,
})
const wache = (vorher: Record<string, number>, jetzt: Record<string, number>) =>
  findeAuffaelliges(kz(jetzt), kz(vorher)).auffaellig.filter((z) => /in einem Lauf entfernt/.test(z))
pruefe('Anlass: 170 Netflix-Wege in einem Lauf: Alarm mit Zahl', wache({ netflix: 10 }, { netflix: 180 }).join().startsWith('netflix: 170 Wege'), wache({ netflix: 10 }, { netflix: 180 }))
pruefe('Grenze: 40 melden', wache({ netflix: 0 }, { netflix: 40 }).length === 1)
pruefe('Grenze: 39 bleiben still', wache({ netflix: 0 }, { netflix: 39 }).length === 0)
pruefe('Zuwachs, nicht Stand: 100 → 120 bleibt still', wache({ netflix: 100 }, { netflix: 120 }).length === 0)
pruefe('je Anbieter: 25 Netflix + 25 Prime bleiben still', wache({}, { netflix: 25, primevideo: 25 }).length === 0)
pruefe('zwei Anbieter über der Grenze: zwei Zeilen', wache({}, { netflix: 50, primevideo: 60 }).length === 2)
pruefe('ohne vorherigen Stand: keine Zeile', findeAuffaelliges(kz({ netflix: 500 }), null).auffaellig.length === 0)
pruefe('Kennzahl ohne entferntJeAnbieter (alte Zeile): keine Zeile', findeAuffaelliges({ ...kz({}), entferntJeAnbieter: undefined }, { ...kz({}), entferntJeAnbieter: undefined }).auffaellig.length === 0)

if (fehler) {
  console.error(`FEHL check-weg-massenabgang: ${fehler} Fälle`)
  process.exit(1)
}
console.log('check-weg-massenabgang: Browser-Totmeldung (13 Fälle, Kulisse mit 7 Einträgen) und Massenabgang (Grenze 39/40, je Anbieter) geprüft.')
