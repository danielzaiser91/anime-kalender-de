/**
 * Zusicherung: Das Install-Angebot steht an genau einer Stelle oder an keiner (Daniel, 09.10.2026).
 * Alle 32 Lagen aus `install-stellen.ts` durchgespielt. Aufruf: `npm run check:logic`.
 */
import { installStellen, type InstallLage } from '../web/src/lib/install-stellen.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const b = [false, true]
let faelle = 0
for (const handheld of b) for (const installed of b) for (const canPrompt of b) for (const ios of b) for (const breit of b) {
  const lage: InstallLage = { handheld, installed, canPrompt, ios, breit }
  const { kopf, menue } = installStellen(lage)
  faelle++
  const stellen = (kopf ? 1 : 0) + (menue ? 1 : 0)
  pruefe('höchstens eine Stelle', stellen <= 1, lage)
  if (!handheld || installed) pruefe('Desktop oder installiert: keine Stelle', stellen === 0, lage)
  else if (canPrompt) {
    pruefe('Browser bietet an, breit: nur der Kopf-Knopf', breit ? kopf && !menue : !kopf && menue === 'direkt', lage)
  } else pruefe('Ohne Angebot: nie der Kopf, im Menü iOS-Anleitung bzw. Hinweis', !kopf && menue === (ios ? 'ios' : 'hinweis'), lage)
}

if (verletzt) {
  console.error(`\n${verletzt} Verstöße gegen die Install-Stellen.`)
  process.exit(1)
}
console.log(`Install-Stellen: ${faelle} Lagen, jede mit höchstens einer Stelle.`)
