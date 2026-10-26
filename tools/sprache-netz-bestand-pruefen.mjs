/**
 * Bestandsteil von `pipeline/check-sprache-netz.ts`: kein „Sprache offen“ im gebauten Bestand fällt durch beide Netze (belegt oder auf der Prüfliste).
 * Liest `public/data` und die Listen in `extension/` und gehört deshalb in `check:bestand`, nicht in `check:logic`.
 *
 * Rot wird nur `luecke`: ein Listenanbieter (Netflix, Prime, Disney+) mit Adresse, aber weder Beleg noch Listeneintrag.
 * `ohne-liste` (Anbieter ohne Prüfliste) und `ohne-adresse` (nichts zum Öffnen) werden gezählt und ausgegeben, aber nicht rot:
 * dort gibt es keine Prüfliste, die den Eintrag aufnehmen könnte; eine Zunahme würde sonst den ganzen Bestandsbau sperren (Entscheidung offen, PR-Text).
 * Aufruf: node tools/sprache-netz-bestand-pruefen.mjs [--bericht]  (mit `--bericht` steht jede Lücke samt Titel in der Ausgabe)
 */
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { wartet } from './offen-erschienen.mjs'
import { kennungAusAdresse, netzKlasse, netzZaehlung, offeneWege, pruefliste, vereinige } from '../pipeline/lib/sprache-netz.ts'

const WURZEL = process.cwd()
const lies = (datei, rueckfall) => (existsSync(`${WURZEL}/${datei}`) ? JSON.parse(readFileSync(`${WURZEL}/${datei}`, 'utf8')) : rueckfall)

/** Das Objekt hinter `globalThis.<name> = …` in einer Datei der Erweiterung. */
function ladeListe(datei, name) {
  return JSON.parse(readFileSync(`${WURZEL}/${datei}`, 'utf8').replace(new RegExp(`^globalThis\\.${name} = `), ''))
}

const belegeLaden = () => yaml.load(readFileSync(`${WURZEL}/data/dub-confirmed.yaml`, 'utf8')) ?? []

function geprueftSet(belege) {
  const urteile = Object.keys(lies('data/urteile.json', {})).map((k) => k.split('|').slice(0, 2).join('|'))
  return new Set([...belege.filter((b) => b?.anilistId && b.platform).map((b) => `${b.anilistId}|${b.platform}`), ...urteile])
}

/** Dieselben Seiten, die `tools/extension-offene-amazon.mjs` als angesehen zählt: Adresse des Belegs und „Seitenadresse: …“ in der Notiz. */
function geprueftSeiten(belege) {
  const seiten = belege.filter((b) => b?.platform === 'primevideo').flatMap((b) => [b.url ? kennungAusAdresse(b.url) : undefined, /Seitenadresse: ([A-Z0-9]{10,26})/.exec(b.note ?? '')?.[1]])
  return new Set(seiten.filter(Boolean))
}

function releasesJeTitel(releases) {
  const je = new Map()
  for (const r of releases) je.set(r.titleId, [...(je.get(r.titleId) ?? []), r])
  return je
}

function ladeKontext() {
  const amazon = pruefliste(ladeListe('extension/offene-amazon.js', 'AK_OFFENE_AMAZON'))
  const suche = pruefliste(ladeListe('extension/offene-amazon-suche.js', 'AK_PRIME_SUCHE'))
  const belege = belegeLaden()
  return {
    listen: {
      primevideo: vereinige(amazon, suche),
      netflix: pruefliste(ladeListe('extension/offene-netflix.js', 'AK_OFFENE_TITEL')),
      disneyplus: pruefliste(ladeListe('extension/offene-disney.js', 'AK_OFFENE_DISNEY')),
    },
    geprueft: geprueftSet(belege),
    geprueftSeiten: geprueftSeiten(belege),
    wartet: (t, s) => wartet(WURZEL, t, s.platform, s),
    releasesJeTitel: releasesJeTitel(lies('public/data/releases.json', [])),
  }
}

if (existsSync(`${WURZEL}/public/data/titles.json`) && existsSync(`${WURZEL}/public/data/cartoons.json`)) {
  const titel = [...lies('public/data/titles.json', []), ...lies('public/data/cartoons.json', [])]
  const kontext = ladeKontext()
  const wege = offeneWege(titel, kontext.releasesJeTitel)
  const zaehler = netzZaehlung(wege, kontext)
  const luecken = wege.filter((w) => netzKlasse(w, kontext) === 'luecke')
  console.log(`Sprache offen: ${wege.length} Einträge (Titel × Anbieter)`)
  for (const [k, n] of [...zaehler].sort()) console.log(`  ${n}\t${k}`)
  if (process.argv.includes('--bericht')) for (const { t, s } of luecken) console.log(`LÜCKE ${t.id} ${t.titleDe ?? t.titleEn} ${s.platform} ${s.url}`)
  if (luecken.length) {
    console.error(`FEHLER: ${luecken.length} Einträge „Sprache offen“ weder belegt noch auf der Prüfliste (Netflix, Prime, Disney+ mit Adresse): ${luecken.slice(0, 5).map(({ t, s }) => `${t.id}|${s.platform}`).join(', ')}`)
    console.log(`VERSTÖSSE: ${luecken.length}`)
    process.exit(1)
  }
}
console.log('sprache-netz-bestand-pruefen: ok')
console.log('VERSTÖSSE: 0')
