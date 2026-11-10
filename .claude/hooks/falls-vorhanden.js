// Startet ein Node-Skript außerhalb des Repos (z. B. unter C:/code/ai/__assets), sofern es existiert.
// Fehlt es (anderer Rechner, öffentliches Repo), endet der Hook still mit Exit 0.
// Aufruf: node falls-vorhanden.js <skript> [argumente…]; stdin und stdout werden durchgereicht.
const { existsSync } = require('fs')
const { spawnSync } = require('child_process')

const [ziel, ...rest] = process.argv.slice(2)
if (!ziel || !existsSync(ziel)) process.exit(0)
const r = spawnSync(process.execPath, [ziel, ...rest], { stdio: 'inherit', windowsHide: true, timeout: 25000 })
process.exit(r.status ?? 0)
