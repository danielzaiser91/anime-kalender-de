/**
 * Jede Datei unter `data/cache/`, die Code, Werkzeuge oder Workflows nennen, steht in `data/cache-register.json`
 * (Schreiber, Läufe, Intervall, Folge eines leeren Caches). `data/cache/` liegt nicht im Repo; was dort landet, kommt
 * nur durch einen Datenlauf an (Vorfall 08.10.2026: eine Cover-Zuordnung im Cache fehlte live, weil der Wochenlauf
 * sie erst Tage später geschrieben hätte). Eine Korrektur von Hand gehört nach `data/`, nicht in den Cache.
 *
 * Bricht ab bei: nicht eingetragener Datei, Eintrag ohne Fundstelle im Code, Eintrag ohne Schreiber, Läufe oder Intervall.
 */
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative, resolve } from 'node:path'

const WURZEL = resolve(import.meta.dirname, '..')
const WURZELN = ['pipeline', 'shared', 'tools', '.github']
const ENDUNGEN = /\.(ts|mjs|cjs|js|sh|yml|yaml)$/
const AUSGENOMMEN = new Set(['tools/check-cache-abhaengigkeit.mjs', 'tools/archiv'])

function dateien(ordner) {
  const aus = []
  for (const name of readdirSync(ordner)) {
    const pfad = join(ordner, name)
    const rel = relative(WURZEL, pfad).replaceAll('\\', '/')
    if (AUSGENOMMEN.has(rel) || name === 'node_modules') continue
    if (statSync(pfad).isDirectory()) aus.push(...dateien(pfad))
    else if (ENDUNGEN.test(name)) aus.push(pfad)
  }
  return aus
}

const register = JSON.parse(readFileSync(join(WURZEL, 'data/cache-register.json'), 'utf8')).dateien
const gefunden = new Map() // Name -> Fundstellen
for (const w of WURZELN) {
  for (const pfad of dateien(join(WURZEL, w))) {
    const rel = relative(WURZEL, pfad).replaceAll('\\', '/')
    readFileSync(pfad, 'utf8')
      .split('\n')
      .forEach((zeile, i) => {
        if (/^\s*(\/\/|\*|\/\*|#)/.test(zeile)) return // Kommentare nennen Dateien, ohne sie zu lesen
        for (const m of zeile.matchAll(/data\/cache\/([\w.-]+)(.?)/g)) {
          // Datei (mit Endung) oder Ordner, der vor einem Anführungszeichen endet
          if (!/\.\w+$/.test(m[1]) && !/['"`]/.test(m[2])) continue
          gefunden.set(m[1], [...(gefunden.get(m[1]) ?? []), `${rel}:${i + 1}`])
        }
      })
  }
}

let fehler = 0
for (const [name, stellen] of gefunden) {
  if (!register[name]) {
    console.error(`✗ data/cache/${name} fehlt in data/cache-register.json (${stellen[0]}). Wer schreibt sie, wie oft? Gehört sie stattdessen nach data/?`)
    fehler++
  }
}
for (const [name, e] of Object.entries(register)) {
  if (!gefunden.has(name)) {
    console.error(`✗ Registereintrag ${name} hat keine Fundstelle im Code mehr — streichen.`)
    fehler++
  }
  for (const feld of ['schreiber', 'intervall', 'fehlt']) {
    if (!e[feld]) {
      console.error(`✗ Registereintrag ${name}: Feld "${feld}" fehlt.`)
      fehler++
    }
  }
  if (!Array.isArray(e.laeufe) || !e.laeufe.length) {
    console.error(`✗ Registereintrag ${name}: "laeufe" leer — ohne Lauf wird die Datei nie befüllt.`)
    fehler++
  }
  if (typeof e.bauBraucht !== 'boolean') {
    console.error(`✗ Registereintrag ${name}: "bauBraucht" muss true oder false sein.`)
    fehler++
  }
}
if (fehler) process.exit(1)
console.log(`✓ Cache-Register: ${gefunden.size} Cache-Einträge, alle eingetragen (${Object.values(register).filter((e) => e.bauBraucht).length} vom Bau gebraucht)`)
