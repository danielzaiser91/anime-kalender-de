/**
 * Zusicherungen zur Rhythmus-Meldung (`lib/news-rhythmus.ts`, Handbeleg `Release.rhythmus`; Avatar: Die sieben Häfen, 12.10.2026):
 * eigene Meldung an dem Tag der Quelle, mit genau deren Beleg; falsche Handbelege brechen ab; der echte Eintrag besteht die Prüfung.
 */
import { CARTOON_NEWS_ARTEN } from './bau/cartoon-kern.ts'
import { istLink } from '../shared/quelle.ts'
import { rhythmusFehler, rhythmusMeldung } from './lib/news-rhythmus.ts'
import { loadCurated } from './lib/curated.ts'
import { leereListe } from './lib/leere-liste.ts'
import { pflegeTerminverlauf } from './lib/news-verlauf.ts'
import { newsSatz } from '../web/src/lib/news-text.ts'
import { newsSatz as mailSatz } from '../worker/src/mail-abschnitte.ts'
import type { Release } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const QUELLE = 'https://www.anime2you.de/news/2/b/'
function release(aus: Partial<Release> = {}): Release {
  return {
    slug: 'x-paramountplus',
    titleId: -1,
    platform: 'paramountplus',
    sources: ['https://www.anime2you.de/news/1/a/', QUELLE],
    schedule: { firstEpisodeDate: '2026-10-09', observed: { 1: '2026-10-09', 2: '2026-10-16', 3: '2026-10-16', 4: '2026-10-16', 5: '2026-10-23', 6: '2026-10-23', 7: '2026-10-23', 8: '2026-10-23' } },
    rhythmus: { stand: '2026-10-10', quelle: QUELLE, bis: '2026-10-30', proWoche: [3, 4] },
    ...aus,
  } as unknown as Release
}

const m = rhythmusMeldung(release())[0]!
pruefe('eine Meldung, am Tag der Quelle', rhythmusMeldung(release()).length === 1 && m.fallback === '2026-10-10')
pruefe('Art rhythmus mit Spanne und Ende als Datum', m.art === 'rhythmus' && m.proWoche?.join() === '3,4' && m.datum === '2026-10-30')
pruefe('Beleg ist genau die Quelle des Rhythmus (nicht die des Starts)', m.belege?.length === 1 && m.belege[0]!.url === QUELLE && m.quelle === QUELLE)
pruefe('Satz auf der Seite', newsSatz(m) === 'Bis 30.10.2026 wöchentlich 3–4 neue Folgen bei Paramount+', newsSatz(m))
pruefe('Satz in der Mail', mailSatz(m) === 'Bis 30.10.2026 wöchentlich 3–4 neue Folgen bei Paramount+', mailSatz(m))
pruefe('feste Zahl ohne Spanne', newsSatz({ ...m, proWoche: [3, 3] }) === 'Bis 30.10.2026 wöchentlich 3 neue Folgen bei Paramount+')
pruefe('ohne Handbeleg keine Meldung', rhythmusMeldung(release({ rhythmus: undefined })).length === 0)

/* Ein Cartoon (negative Kennung) mit Rhythmus-Handbeleg besteht `check-cartoon-news`: Art erlaubt, Quelle und Beleg mit Adresse, Release genannt (Anlass: Bestandsbau-Abbruch, #975). */
pruefe('Cartoon-Prüfung: Art der Rhythmus-Meldung ist für Cartoons erlaubt', CARTOON_NEWS_ARTEN.has(m.art), m.art)
pruefe('Cartoon-Prüfung: Quelle und Beleg sind Links, das Release ist genannt', istLink(m.quelle) && (m.belege ?? []).every((b) => istLink(b.url)) && m.release === 'x-paramountplus')

const mitFehler = (aus: Partial<Release>) => rhythmusFehler(release(aus)).length > 0
const x = release().rhythmus!
pruefe('Quelle nicht in sources: Fehler', mitFehler({ rhythmus: { ...x, quelle: 'https://www.anime2you.de/news/9/z/' } }))
pruefe('Ende vor dem Start: Fehler', mitFehler({ rhythmus: { ...x, bis: '2026-10-01' } }))
pruefe('Spanne verkehrt: Fehler', mitFehler({ rhythmus: { ...x, proWoche: [4, 3] } }))
pruefe('Folgenliste widerspricht (4 Folgen am Tag bei 2–3 genannt): Fehler', mitFehler({ rhythmus: { ...x, proWoche: [2, 3] } }))
pruefe('Tag kein Datum: Fehler', mitFehler({ rhythmus: { ...x, stand: '10.10.2026' } }))
let wirft = false
try {
  rhythmusMeldung(release({ rhythmus: { ...x, bis: '2026-10-01' } }))
} catch {
  wirft = true
}
pruefe('falscher Handbeleg bricht den Bau ab', wirft)

/* Wird der Rhythmus überholt, trägt die Verlaufsfassung ihre Spanne weiter (nicht „wöchentlich 0 neue Folgen“). */
const historie = { termine: { 'x-paramountplus': [{ datum: '2026-10-30', art: 'rhythmus', titelId: -1, name: 'X', wurzel: -1, platform: 'paramountplus', quelle: QUELLE, proWoche: [3, 4], am: '2026-10-10' }] } }
const verlauf = pflegeTerminverlauf({ datiert: [], nachId: new Map(), historie: historie as never, vorherige: [], name: () => 'X', wurzel: () => -1, grenze: '2026-01-01', heute: '2026-11-05', nurOriginalton: new Set() })
pruefe('überholte Rhythmus-Meldung behält proWoche', verlauf.length === 1 && newsSatz(verlauf[0]!) === 'Bis 30.10.2026 wöchentlich 3–4 neue Folgen bei Paramount+', verlauf.map((v) => newsSatz(v)))

const kuratiert = loadCurated()
const echt = kuratiert.filter((e) => e.rhythmus)
const lage = leereListe('Handbelege mit Rhythmus (Avatar: Die sieben Häfen)', echt.length, kuratiert.length)
console.log(`  ${lage.zeile}`)
pruefe('die echten Rhythmus-Einträge bestehen die Prüfung (leer: nichts zu tun)', lage.ok && echt.every((e) => rhythmusFehler(e as unknown as Release).length === 0), echt.map((e) => rhythmusFehler(e as unknown as Release)))

if (fehler) {
  console.error(`check-news-rhythmus: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-news-rhythmus: alles grün')
