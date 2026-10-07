import { readFileSync } from 'node:fs'
const W = '' + new URL('../', import.meta.url).pathname.slice(1) + ''
const dubs = JSON.parse(readFileSync(W + 'data/anisearch-dubs.json', 'utf8'))
const lad = async (f) => { const j = await (await fetch('https://anime-kalender.de/data/' + f + '?x=' + Date.now())).json(); return Array.isArray(j) ? j : j.titles }
const haupt = await lad('titles.json')
const hinter = await lad('ohne-synchro.json')
const kenn = (t) => dubs[String(t.id)] ?? '?'
const hatBeleg = (t) => (t.streams ?? []).some((s) => s.dub === true) || t.deErstausgabe?.synchro || t.hasVoices
const z = (a) => a.reduce((m, t) => ((m[kenn(t)] = (m[kenn(t)] ?? 0) + 1), m), {})
console.log('Hauptbestand nach aniSearch-Kennzeichen:', z(haupt))
console.log('hinter dem Toggle nach Kennzeichen:', z(hinter))
const aAnzahl = haupt.filter((t) => kenn(t) === '-' && !hatBeleg(t))
const bAnzahl = hinter.filter((t) => ['d', 'c'].includes(kenn(t)))
console.log('A) Hauptbestand, aniSearch "-", ohne jeden eigenen Beleg:', aAnzahl.length, aAnzahl.slice(0, 12).map((t) => t.titleEn ?? t.titleRomaji).join(' | '))
console.log('B) hinter dem Toggle, aber aniSearch d/c:', bAnzahl.length, bAnzahl.slice(0, 12).map((t) => `${t.titleEn ?? t.titleRomaji} [${kenn(t)}]`).join(' | '))
