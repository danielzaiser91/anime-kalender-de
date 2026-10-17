/**
 * Hakt die Rohfolgen ab, die `fetch-rohfolgen.ts` zugeordnet hat — erst nach „Änderungen committen" (17.10.2026).
 * Bis dahin hakte der Zuordner selbst ab; scheiterte danach der Bau, war die Zuordnung weg und die Rohfolgen auch.
 *
 * Aufruf: `npm run data:rohfolgen-abhaken`
 */
import { warn } from './lib/util.ts'
import { quittiereGemerkte, ROHFOLGEN_ABHAKEN } from './lib/spaeter-quittieren.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''

if (!TOKEN) warn('LAUF_TOKEN fehlt — ohne Token hakt der Worker nichts ab.')
else await quittiereGemerkte({ datei: ROHFOLGEN_ABHAKEN, url: `${WORKER}/pruefung`, methode: 'POST', feld: 'rohfolgenUebernommen', token: TOKEN })
