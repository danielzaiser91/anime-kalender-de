/**
 * **Welche Kennung eines Prime-Belegs ist die richtige Seite?** (18.09.2026)
 *
 * Vor dem 17.09.2026 schrieb der Import die Adresse aus dem Prüflisten-Eintrag, nicht
 * die der besuchten Seite. Seitdem tragen mehrere verschiedene Titel dieselbe URL — am
 * 18.09. waren es 28 Adressen mit 56 Belegen, darunter Arifureta und Babylon auf der
 * Seite von „Eine fröhliche Familie". Jeder Beleg nennt in seiner Notiz zusätzlich eine
 * „Seitenadresse".
 *
 * **Keine der beiden ist verlässlich.** Bei Arifureta und Babylon war die Seitenadresse
 * richtig, bei Clannad die gespeicherte URL — dort war die Seitenadresse die veraltete
 * Startseite nach einem Staffelwechsel. Eine Massenumstellung auf die Seitenadresse
 * hätte Clannad und After Story von richtig auf falsch gedreht. Entscheiden kann nur
 * der Titel auf der Seite selbst.
 *
 * Das Werkzeug **misst und schreibt nichts**: Je Beleg an einer geteilten Adresse holt
 * es beide Kandidaten (einmal je Adresse, 1,5 s Abstand) und stellt den Seitentitel mit
 * Staffel und Jahr neben den Belegtitel. Die Korrektur erfolgt von Hand, je Fall.
 *
 * **Amazon sperrt nach einigen hundert Abrufen am Tag.** Kommen fünf Seiten in Folge
 * ohne Kopfblock zurück, bricht der Lauf ab — sonst sähe eine Sperre aus wie „Titel
 * unbekannt".
 *
 * Aufruf: node tools/prime-geteilte-adressen.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8'))
const asin = (u) => /(?:\/dp\/|\/detail\/)([A-Z0-9]{10,26})/.exec(u ?? '')?.[1]

const prime = belege
  .filter((b) => b.platform === 'primevideo' && asin(b.url))
  .map((b) => ({ ...b, a: asin(b.url), seite: /Seitenadresse: ([A-Z0-9]{10,26})/.exec(b.note ?? '')?.[1] }))
const titelJe = new Map()
for (const b of prime) titelJe.set(b.a, (titelJe.get(b.a) ?? new Set()).add(b.anilistId))
const geteilt = prime.filter((b) => titelJe.get(b.a).size >= 2 && b.seite && b.seite !== b.a)
console.log(`${new Set(geteilt.map((b) => b.a)).size} geteilte Adressen, ${geteilt.length} Belege.\n`)

const cache = new Map()
let leerInFolge = 0
async function kopf(kennung) {
  if (cache.has(kennung)) return cache.get(kennung)
  const antwort = await fetch(`https://www.amazon.de/gp/video/detail/${kennung}`, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
      'Accept-Language': 'de-DE',
    },
  }).catch(() => undefined)
  const h = antwort ? await antwort.text() : ''
  const i = h.indexOf('"headerDetail":{')
  const s = i >= 0 ? h.slice(i, i + 8000) : ''
  const k = s
    ? {
        titel: /"title":"([^"]*)"/.exec(s)?.[1],
        staffel: /"seasonNumber":(\d+)/.exec(s)?.[1],
        jahr: /"releaseYear":(\d+)/.exec(s)?.[1],
      }
    : undefined
  leerInFolge = k ? 0 : leerInFolge + 1
  cache.set(kennung, k)
  await new Promise((r) => setTimeout(r, 1500))
  return k
}
const zeile = (k) => (k ? `${k.titel} · S${k.staffel ?? '?'} · ${k.jahr ?? '?'}` : '— kein Kopfblock —')

for (const b of geteilt) {
  const url = await kopf(b.a)
  const seite = await kopf(b.seite)
  if (leerInFolge >= 5) {
    console.log('\n⚠  Fünf Seiten in Folge ohne Kopfblock — Amazon sperrt. Abbruch, der Rest bleibt offen.')
    break
  }
  console.log(`${String(b.anilistId).padStart(6)} ${String(b.title).slice(0, 42)}`)
  console.log(`         url   ${b.a.padEnd(26)} ${zeile(url)}`)
  console.log(`         seite ${b.seite.padEnd(26)} ${zeile(seite)}`)
}
