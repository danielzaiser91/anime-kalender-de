/**
 * Zusicherung (Assassination Classroom: Our Time, 13.10.2026): Ein Titel ohne Streaming- oder Disc-Weg bekommt keinen Satz, der die Lücke
 * als Aussage schreibt (Daniel, 13.10.2026: Zeigen wir keine Bezugswege, ist uns keiner bekannt). Der Hinweis ist `''` — kein Text, aber der
 * TV-Rückblick darf erscheinen. Ein Film nennt weiter „Deutsch synchronisiert“. Aufruf: `npm run check:logic`.
 */
import type { Title } from '../shared/types.ts'
import { wegeHinweisVon } from '../web/src/components/detail/kasten-hinweise.ts'
import { TEXTE_ZEILEN } from '../web/src/lib/i18n-zeilen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (extra: Partial<Title> = {}): Title => ({ id: 1, streams: [], watchLinks: [], hasVoices: true, ...extra }) as unknown as Title
const hinweis = (title: Title, antwort: object) =>
  wegeHinweisVon({ title, antwort: antwort as never, favorites: new Set(), verbindung: { verbunden: false } as never, releases: [], today: '2026-10-13', t: (k) => k })

pruefe('Film mit Synchro ohne Weg: kein Satz, aber gesetzt (TV-Rückblick)', hinweis(titel(), { art: 'film', hatSynchro: true, ohneWeg: true }) === '')
pruefe('Film mit Synchro ohne Sprecher: ebenso', hinweis(titel({ hasVoices: false }), { art: 'film', hatSynchro: true, ohneWeg: true }) === '')
pruefe('Serie mit Sprechern ohne Weg: kein Satz, aber gesetzt (TV-Rückblick)', hinweis(titel(), { art: 'fertig' }) === '')
pruefe('Serie ohne Sprecher ohne Weg: ebenso', hinweis(titel({ hasVoices: false }), { art: 'fertig' }) === '')
pruefe('Serie ohne Sprecher, Antwort „ohne“: weiter undefiniert', hinweis(titel({ hasVoices: false }), { art: 'ohne' }) === undefined)
pruefe('Film mit Weg: keine Zeile', hinweis(titel({ streams: [{ platform: 'netflix', url: 'u' }] }), { art: 'film', hatSynchro: true }) === undefined)
const texte = TEXTE_ZEILEN as Record<string, string>
pruefe('Wortlaut', texte['antwort.filmSynchronisiert'] === 'Deutsch synchronisiert')
if (verletzt) {
  console.error(`\n${verletzt} Prüfung(en) verletzt`)
  process.exit(1)
}
