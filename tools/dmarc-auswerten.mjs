/**
 * Die DMARC-Aggregatberichte auswerten.
 *
 * Jeder Bericht ist eine gezippte XML-Datei mit einem `<record>` je
 * Absender-IP. Entscheidend sind drei Dinge:
 *
 *   1. **`dkim` und `spf` je Datensatz** — steht dort irgendwo `fail`, würde
 *      `p=quarantine` diese Mail künftig aussortieren. Das muss vorher klar
 *      sein, sonst blockiert die Umstellung eigene Post.
 *   2. **Die Absender-IPs** — eine fremde bedeutet, dass jemand im Namen der
 *      Domain schreibt. Dann ist `p=quarantine` erst recht richtig, aber man
 *      will es wissen.
 *   3. **Die Lückenlosigkeit** — ein fehlender Tag ist kein Beleg für „nichts
 *      passiert", sondern für „nicht nachgesehen".
 */
import { readdirSync, readFileSync } from 'node:fs'
import { gunzipSync, inflateRawSync } from 'node:zlib'

/**
 * Wo die ZIPs liegen. Ohne Argument der Übergabeordner — dort legt Daniel die
 * Berichte aus seinem Gmail-Postfach ab.
 */
const ORDNER = process.argv[2] ?? 'C:/code/ai/__assets/_shared files user to agent'

/**
 * Eine ZIP-Datei mit genau einem Eintrag auspacken — ohne Fremdbibliothek.
 *
 * Das Format ist hier denkbar einfach: lokaler Kopf, dann die Nutzdaten. Bei
 * `method 8` sind sie roh-deflate-komprimiert, bei `0` liegen sie unverändert.
 */
function ausZip(puffer) {
  if (puffer.readUInt32LE(0) !== 0x04034b50) throw new Error('kein ZIP')
  const methode = puffer.readUInt16LE(8)
  const komprimiert = puffer.readUInt32LE(18)
  const namensLaenge = puffer.readUInt16LE(26)
  const extraLaenge = puffer.readUInt16LE(28)
  const start = 30 + namensLaenge + extraLaenge
  const daten = puffer.subarray(start, start + komprimiert)
  if (methode === 0) return daten.toString('utf8')
  if (methode === 8) return inflateRawSync(daten).toString('utf8')
  if (methode === 12 || methode === 93) throw new Error(`Kompression ${methode} nicht lesbar`)
  return gunzipSync(daten).toString('utf8')
}

const dateien = readdirSync(ORDNER)
  .filter((n) => n.toLowerCase().endsWith('.zip'))
  .sort()

console.log(`${dateien.length} Berichte gefunden\n`)

const alleIps = new Map()
const probleme = []
const tage = []

for (const datei of dateien) {
  let xml
  try {
    xml = ausZip(readFileSync(`${ORDNER}/${datei}`))
  } catch (err) {
    probleme.push(`${datei}: ${err.message}`)
    continue
  }

  const von = Number(/<begin>(\d+)<\/begin>/.exec(xml)?.[1] ?? 0)
  const tag = new Date(von * 1000).toISOString().slice(0, 10)
  const politik = /<p>(\w+)<\/p>/.exec(xml)?.[1] ?? '?'

  let mails = 0
  let dkimFail = 0
  let spfFail = 0
  const ips = []

  for (const satz of xml.split('<record>').slice(1)) {
    const anzahl = Number(/<count>(\d+)<\/count>/.exec(satz)?.[1] ?? 0)
    const ip = /<source_ip>([^<]+)<\/source_ip>/.exec(satz)?.[1] ?? '?'
    const dkim = /<dkim>(\w+)<\/dkim>/.exec(satz)?.[1] ?? '?'
    const spf = /<spf>(\w+)<\/spf>/.exec(satz)?.[1] ?? '?'
    mails += anzahl
    ips.push(ip)
    alleIps.set(ip, (alleIps.get(ip) ?? 0) + anzahl)
    if (dkim !== 'pass') dkimFail += anzahl
    if (spf !== 'pass') spfFail += anzahl
    if (dkim !== 'pass' || spf !== 'pass') {
      probleme.push(`${tag}: ${anzahl} Mail(s) von ${ip} — dkim=${dkim}, spf=${spf}`)
    }
  }

  tage.push({ tag, mails, dkimFail, spfFail, politik })
  const zeichen = dkimFail || spfFail ? '✗' : '✓'
  console.log(
    `  ${zeichen} ${tag}  ${String(mails).padStart(3)} Mail(s)  p=${politik.padEnd(10)} ${[...new Set(ips)].join(', ')}`,
  )
}

console.log()
console.log('--- Zusammenfassung ---')
const gesamt = tage.reduce((n, t) => n + t.mails, 0)
console.log(`Zeitraum:        ${tage[0]?.tag} bis ${tage[tage.length - 1]?.tag} (${tage.length} Berichte)`)
console.log(`Mails insgesamt: ${gesamt}`)
console.log(`dkim-Fehler:     ${tage.reduce((n, t) => n + t.dkimFail, 0)}`)
console.log(`spf-Fehler:      ${tage.reduce((n, t) => n + t.spfFail, 0)}`)
console.log()
console.log('Absender-IPs:')
for (const [ip, n] of [...alleIps].sort((a, b) => b[1] - a[1])) {
  const bekannt = /^54\.240\.(3|6|7|8|9|10|11)\./.test(ip) ? 'Amazon SES' : '⚠ UNBEKANNT'
  console.log(`  ${ip.padEnd(16)} ${String(n).padStart(3)} Mail(s)  ${bekannt}`)
}

// Lückenlosigkeit prüfen: ein fehlender Tag ist kein Beleg.
const luecken = []
for (let i = 1; i < tage.length; i++) {
  const a = new Date(tage[i - 1].tag)
  const b = new Date(tage[i].tag)
  const abstand = Math.round((b - a) / 86400000)
  if (abstand > 1) luecken.push(`${tage[i - 1].tag} → ${tage[i].tag} (${abstand - 1} Tag(e) fehlen)`)
}
console.log()
if (luecken.length) {
  console.log('Lücken in der Kette:')
  for (const l of luecken) console.log(`  ⚠ ${l}`)
} else {
  console.log('✓ Kette lückenlos — kein Tag fehlt.')
}

if (probleme.length) {
  console.log()
  console.log('Auffälligkeiten:')
  for (const p of probleme) console.log(`  ✗ ${p}`)
}
