// Schattenlauf AniList ↔ aniSearch (Daniel, 04.10.2026: „AniList so schnell wie möglich ablösen").
//
// Vergleicht Feld für Feld, was unser Bestand heute aus AniList trägt, mit dem, was aniSearch zum selben Titel führt
// (Brücke: `data/anisearch.json`, Schlüssel = AniList-ID). Es wird nichts umgestellt und nichts geschrieben außer dem
// Bericht. Aufruf: `node tools/schattenlauf-anisearch.mjs` → `docs/wissen/schattenlauf-anisearch.md` und `.json`.
import { readFileSync, writeFileSync } from 'node:fs'

const titel = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const liste = Array.isArray(titel) ? titel : titel.titles
const as = JSON.parse(readFileSync('data/anisearch.json', 'utf8'))

const norm = (s) =>
  (s ?? '')
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[^\p{L}\p{N} ]+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()

const sprachblock = (info, sprache) => (info?.languages ?? []).find((l) => l.language === sprache)
const startJahr = (released) => Number(/(\d{4})/.exec(released ?? '')?.[1]) || undefined

const felder = {
  format: { gleich: 0, anders: 0, fehltEiner: 0, kreuz: {} },
  folgen: { gleich: 0, anders: 0, nurAniList: 0, nurAniSearch: 0, keine: 0, anisearchSchaetzung: 0 },
  jahr: { gleich: 0, anders: 0, fehltEiner: 0 },
  studio: { gleich: 0, anders: 0, fehltEiner: 0 },
  nameDe: { gleich: 0, anders: 0, fehltEiner: 0 },
  nameEn: { gleich: 0, anders: 0, fehltEiner: 0 },
}
const abweichungen = { format: [], folgen: [], jahr: [], studio: [], nameDe: [], nameEn: [] }
let verglichen = 0

for (const t of liste) {
  const e = as[String(t.id)]
  if (!e?.info) continue
  verglichen++
  const i = e.info
  const zeile = (k, wert) => abweichungen[k].push({ id: t.id, titel: t.titleEn ?? t.titleRomaji, ...wert })

  // Format: nur Kreuztabelle — eine Zuordnung raten wir nicht.
  const kreuz = `${t.format ?? '–'} | ${i.format ?? '–'}`
  felder.format.kreuz[kreuz] = (felder.format.kreuz[kreuz] ?? 0) + 1

  // Folgen
  const fa = t.episodes
  const fs = i.episodes
  if (i.episodesEstimated) felder.folgen.anisearchSchaetzung++
  if (fa && fs) {
    if (fa === fs) felder.folgen.gleich++
    else {
      felder.folgen.anders++
      zeile('folgen', { anilist: fa, anisearch: fs, geschaetzt: Boolean(i.episodesEstimated) })
    }
  } else if (fa) felder.folgen.nurAniList++
  else if (fs) felder.folgen.nurAniSearch++
  else felder.folgen.keine++

  // Startjahr (Japan)
  const ja = startJahr(sprachblock(i, 'Japanisch')?.released)
  if (ja && t.jpYear) {
    if (ja === t.jpYear) felder.jahr.gleich++
    else {
      felder.jahr.anders++
      zeile('jahr', { anilist: t.jpYear, anisearch: ja })
    }
  } else felder.jahr.fehltEiner++

  // Studio: gleich, wenn sich die normalisierten Namensmengen schneiden
  const firma = (s) =>
    norm(s)
      .replace(/\b(co|ltd|inc|kk|corporation|corp|studio|studios|animation|pictures|production|productions|entertainment|limited)\b/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  const sa = new Set((t.studios ?? []).map(firma))
  const ss = new Set((i.studios ?? []).map(firma))
  if (sa.size && ss.size) {
    if ([...sa].some((x) => ss.has(x))) felder.studio.gleich++
    else {
      felder.studio.anders++
      zeile('studio', { anilist: [...sa].join(', '), anisearch: [...ss].join(', ') })
    }
  } else felder.studio.fehltEiner++

  // Namen
  const de = sprachblock(i, 'Deutsch')?.title
  if (de && t.titleDe) {
    if (norm(de) === norm(t.titleDe)) felder.nameDe.gleich++
    else {
      felder.nameDe.anders++
      zeile('nameDe', { anilist: t.titleDe, anisearch: de })
    }
  } else felder.nameDe.fehltEiner++
  const en = sprachblock(i, 'Englisch')?.title
  if (en && t.titleEn) {
    if (norm(en) === norm(t.titleEn)) felder.nameEn.gleich++
    else {
      felder.nameEn.anders++
      zeile('nameEn', { anilist: t.titleEn, anisearch: en })
    }
  } else felder.nameEn.fehltEiner++
}

const prozent = (n, g) => (g ? `${((100 * n) / g).toFixed(1)} %` : '–')
const gesamt = (o) => Object.entries(o).filter(([k]) => k !== 'kreuz').reduce((s, [, v]) => s + (typeof v === 'number' ? v : 0), 0)
const tabelle = (name, f) => {
  const zeilen = Object.entries(f).filter(([k]) => k !== 'kreuz')
  return `| ${name} | ${zeilen.map(([k, v]) => `${k} ${v}`).join(' · ')} |`
}
const kreuzZeilen = Object.entries(felder.format.kreuz)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 25)
  .map(([k, n]) => `| ${k.replace('|', '→')} | ${n} |`)
const beispiele = (k) =>
  abweichungen[k]
    .slice(0, 12)
    .map((x) => `- ${x.id} ${x.titel ?? ''}: AniList ${JSON.stringify(x.anilist)} ↔ aniSearch ${JSON.stringify(x.anisearch)}${x.geschaetzt ? ' (aniSearch: Schätzung)' : ''}`)
    .join('\n')

const stand = new Date().toISOString().slice(0, 10)
const md = `# Schattenlauf AniList ↔ aniSearch (Stand ${stand})

Verglichen: **${verglichen}** Titel, die der Bestand führt und zu denen \`data/anisearch.json\` eine geholte aniSearch-Seite hat. Erzeugt von \`tools/schattenlauf-anisearch.mjs\`; die vollständige Abweichungsliste steht in \`schattenlauf-anisearch.json\`. Nichts davon ist umgestellt.

| Feld | Ergebnis |
|---|---|
${tabelle('Folgenzahl', felder.folgen)}
${tabelle('Startjahr Japan', felder.jahr)}
${tabelle('Studio', felder.studio)}
${tabelle('Name deutsch', felder.nameDe)}
${tabelle('Name englisch', felder.nameEn)}

Gleichstand je Feld (wo beide Seiten einen Wert haben): Folgenzahl ${prozent(felder.folgen.gleich, felder.folgen.gleich + felder.folgen.anders)}, Startjahr ${prozent(felder.jahr.gleich, felder.jahr.gleich + felder.jahr.anders)}, Studio ${prozent(felder.studio.gleich, felder.studio.gleich + felder.studio.anders)}, deutscher Name ${prozent(felder.nameDe.gleich, felder.nameDe.gleich + felder.nameDe.anders)}, englischer Name ${prozent(felder.nameEn.gleich, felder.nameEn.gleich + felder.nameEn.anders)}.

## Format: AniList | aniSearch (häufigste 25 Paare)

| Paar | Titel |
|---|---|
${kreuzZeilen.join('\n')}

## Beispiele für Abweichungen

### Folgenzahl
${beispiele('folgen')}

### Startjahr
${beispiele('jahr')}

### Studio
${beispiele('studio')}

### Name deutsch
${beispiele('nameDe')}

### Name englisch
${beispiele('nameEn')}
`
writeFileSync('docs/wissen/schattenlauf-anisearch.md', md)
writeFileSync('docs/wissen/schattenlauf-anisearch.json', JSON.stringify({ stand, verglichen, felder, abweichungen }, null, 1))
console.log(`Verglichen: ${verglichen}`)
console.log(JSON.stringify({ ...felder, format: { kreuzPaare: Object.keys(felder.format.kreuz).length } }, null, 1))
