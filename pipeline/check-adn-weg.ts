/**
 * Direkte Zusicherungen zu `pipeline/lib/adn-weg.ts`: ohne `AK_ADN_PROXY` geht es direkt zu ADN und der Token bleibt
 * draußen; mit Proxy (Schrägstriche am Ende fallen weg) braucht der Weg `LAUF_TOKEN`; Herkunfts- und Wegzeile. Läuft in `check:logic`.
 */
import { ADN_DIREKT, adnWeg, herkunftZeile, wegZeile } from './lib/adn-weg.ts'

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

// adnWeg
pruefe('ohne Proxy direkt', adnWeg({}), { base: ADN_DIREKT, auth: {} })
pruefe('Token geht nie direkt zu ADN', adnWeg({ LAUF_TOKEN: 'geheim' }), { base: ADN_DIREKT, auth: {} })
pruefe('leerer Proxy zählt als nicht gesetzt', adnWeg({ AK_ADN_PROXY: '', LAUF_TOKEN: 'x' }), { base: ADN_DIREKT, auth: {} })
pruefe('Proxy mit Token', adnWeg({ AK_ADN_PROXY: 'https://w.example', LAUF_TOKEN: 't' }), { base: 'https://w.example', auth: { Authorization: 'Bearer t' } })
pruefe('Schrägstriche am Ende fallen weg', adnWeg({ AK_ADN_PROXY: 'https://w.example//', LAUF_TOKEN: 't' }).base, 'https://w.example')
let wurf = ''
try {
  adnWeg({ AK_ADN_PROXY: 'https://w.example' })
} catch (e) {
  wurf = (e as Error).message
}
pruefe('Proxy ohne Token wirft', wurf, 'AK_ADN_PROXY gesetzt, aber LAUF_TOKEN fehlt')

// herkunftZeile
const kopf = (o: Record<string, string>) => ({ get: (n: string) => o[n] ?? null })
pruefe('Herkunft leer beim direkten Weg', herkunftZeile(kopf({})), '')
pruefe('Herkunft beide', herkunftZeile(kopf({ 'X-Gw-Colo': 'FRA', 'X-Gw-Adn-Ray': 'abc' })), 'Worker-Colo FRA, ADN-cf-ray abc')
pruefe('Herkunft nur Colo', herkunftZeile(kopf({ 'X-Gw-Colo': 'FRA' })), 'Worker-Colo FRA, ADN-cf-ray ?')
pruefe('Herkunft nur Ray', herkunftZeile(kopf({ 'X-Gw-Adn-Ray': 'abc' })), 'Worker-Colo ?, ADN-cf-ray abc')

// wegZeile
pruefe('Wegzeile direkt', wegZeile({ base: ADN_DIREKT, auth: {} }), 'ADN direkt (kein AK_ADN_PROXY)')
pruefe('Wegzeile Worker zeigt nur den Host', wegZeile({ base: 'https://w.example/pfad', auth: {} }), 'ADN über Worker: w.example')

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-adn-weg: ok')
