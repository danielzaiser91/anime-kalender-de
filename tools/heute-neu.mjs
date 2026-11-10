/**
 * Was ist heute neu? Vergleicht `public/data` einer Basis (letzter Commit vor 00:00 Europe/Berlin des Tages)
 * mit dem Kopf von origin/main und liest dazu news, meldungen und die Anime2You-Vorschläge des Tages.
 * Aufruf: node tools/heute-neu.mjs [--tag JJJJ-MM-TT] [--basis <Commit>] [--ref origin/main] [--json] [--queue]
 * Prime-Wege mit `dub` undefined zählen nie als Synchro (eigene Liste `wegeOhneSprache`).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'

const TZ = 'Europe/Berlin'
const FORMAT = new Intl.DateTimeFormat('en-US', {
  timeZone: TZ,
  hour12: false,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

function offsetMinuten(utc) {
  const teile = FORMAT.formatToParts(utc)
  const g = (t) => Number(teile.find((p) => p.type === t).value)
  return (Date.UTC(g('year'), g('month') - 1, g('day'), g('hour') % 24, g('minute'), g('second')) - utc.getTime()) / 60000
}

/** "2026-11-08" → "2026-11-08T00:00:00+01:00" (Offset der Zone zu diesem Zeitpunkt, Sommerzeit inklusive). */
export function berlinMitternacht(tag) {
  const roh = new Date(`${tag}T00:00:00Z`)
  // Eine Messung am UTC-Mitternachtspunkt genügt: Umstellungen liegen in Berlin um 02:00/03:00, nie vor Ortsmitternacht.
  const off = offsetMinuten(roh)
  const betrag = Math.abs(off)
  const hh = String(Math.floor(betrag / 60)).padStart(2, '0')
  const mm = String(betrag % 60).padStart(2, '0')
  return `${tag}T00:00:00${off < 0 ? '-' : '+'}${hh}:${mm}`
}

export function heuteBerlin(jetzt) {
  const t = FORMAT.formatToParts(jetzt)
  const g = (n) => t.find((p) => p.type === n).value
  return `${g('year')}-${g('month')}-${g('day')}`
}

const name = (t) => t.titleDe || t.titleEn || t.titleRomaji || String(t.id)

/** Anbieter mit belegter deutscher Fassung (dub true), plus Disc-Synchro. */
export function synchroAnbieter(t) {
  const s = new Set()
  for (const x of t.streams || []) if (x.dub === true) s.add(x.platform)
  if (t.deErstausgabe && t.deErstausgabe.synchro) s.add('disc')
  return s
}

function wegeAnbieter(t) {
  const s = new Set()
  for (const x of t.streams || []) s.add(x.platform)
  for (const w of t.watchLinks || []) s.add(`wl:${w.kind || w.name}`)
  if (t.deErstausgabe) s.add('disc')
  return s
}

function streamDub(t, plattform) {
  const x = (t.streams || []).find((s) => s.platform === plattform)
  return x ? x.dub : undefined
}

function titelEintrag(t) {
  return { id: t.id, name: name(t), format: t.format, jahr: t.jpYear || null, dubConfidence: t.dubConfidence, synchro: [...synchroAnbieter(t)] }
}

/** Neue Titel, entfernte Titel, neue Synchro, verlorene Synchro, neue Wege (mit/ohne Sprachangabe). */
export function vergleicheTitel(alt, neu) {
  const am = new Map(alt.map((t) => [t.id, t]))
  const nm = new Map(neu.map((t) => [t.id, t]))
  const out = { neu: [], neuMitSynchro: [], entfernt: [], synchroNeu: [], synchroVerloren: [], wegeNeu: [], wegeOhneSprache: [], trailerNeu: [] }
  for (const t of neu) {
    const o = am.get(t.id)
    if (!o) {
      out.neu.push(titelEintrag(t))
      if (synchroAnbieter(t).size > 0) out.neuMitSynchro.push(titelEintrag(t))
      continue
    }
    vergleicheBestehenden(o, t, out)
  }
  out.trailerNeu = trailerNeu(am, neu)
  for (const t of alt) if (!nm.has(t.id)) out.entfernt.push({ id: t.id, name: name(t) })
  return out
}

/** Bestehende Titel, deren Trailer neu oder anders ist. */
function trailerNeu(altNachId, neu) {
  const aus = []
  for (const t of neu) {
    const o = altNachId.get(t.id)
    if (o && t.trailer && JSON.stringify(o.trailer) !== JSON.stringify(t.trailer)) {
      aus.push({ id: t.id, name: name(t), sprache: t.trailer.sprache || null })
    }
  }
  return aus
}

/** Katalogeinträge ohne Synchro (ohne-synchro.json), die gegenüber der Basis neu sind. */
export function katalogNeu(alt, neu) {
  const bekannt = new Set((alt || []).map((t) => t.id))
  return (neu || []).filter((t) => !bekannt.has(t.id)).map((t) => ({ id: t.id, name: name(t) }))
}

function vergleicheBestehenden(o, t, out) {
  const so = synchroAnbieter(o)
  const sn = synchroAnbieter(t)
  const gewonnen = [...sn].filter((x) => !so.has(x))
  const verloren = [...so].filter((x) => !sn.has(x))
  if (gewonnen.length || o.dubConfidence !== t.dubConfidence) {
    out.synchroNeu.push({ id: t.id, name: name(t), bei: gewonnen, dubConfidenceAlt: o.dubConfidence, dubConfidenceNeu: t.dubConfidence })
  }
  if (verloren.length) out.synchroVerloren.push({ id: t.id, name: name(t), bei: verloren })
  const wo = wegeAnbieter(o)
  for (const w of [...wegeAnbieter(t)].filter((x) => !wo.has(x))) {
    const eintrag = { id: t.id, name: name(t), weg: w }
    // Ohne `dub` ist die Sprache unbekannt: kein Synchro-Befund.
    if (streamDub(t, w) === undefined) out.wegeOhneSprache.push(eintrag)
    else out.wegeNeu.push({ ...eintrag, dub: streamDub(t, w) })
  }
}

/** Neue Termine (Schlüssel slug) und geänderte Zeitpläne. */
export function vergleicheTermine(alt, neu) {
  const am = new Map(alt.map((r) => [r.slug, r]))
  const out = { termineNeu: [], termineGeaendert: [] }
  for (const r of neu) {
    const o = am.get(r.slug)
    const kurz = { slug: r.slug, name: r.name, plattform: r.platform, art: r.releaseType }
    if (!o) out.termineNeu.push({ ...kurz, ab: r.schedule?.firstEpisodeDate || null, folgen: r.schedule?.episodeCount || null, quelle: (r.sources || [])[0] || null })
    else if (JSON.stringify(o.schedule || {}) !== JSON.stringify(r.schedule || {})) {
      out.termineGeaendert.push({ ...kurz, alt: o.schedule || null, neu: r.schedule || null })
    }
  }
  return out
}

/** Folgen-Meldungen des Tages: je Eintrag Titel und Meldungsart. */
export function newsDesTages(news, tag) {
  return (news || []).filter((n) => n.am === tag).map((n) => ({
    titelId: n.titelId,
    titel: n.titel,
    meldungen: (n.meldungen || []).map((m) => ({ art: m.art, plattform: m.platform || null, von: m.von ?? null, bis: m.bis ?? null, quelle: m.quelle || null })),
  }))
}

/** Verweise (meldungen.json), die gegenüber der Basis neu sind (Schlüssel: Adresse der Quelle). */
export function meldungenNeu(alt, neu) {
  const bekannt = new Set((alt || []).map((m) => m.quelle?.url))
  return (neu || []).filter((m) => !bekannt.has(m.quelle?.url)).map((m) => ({
    titleId: m.titleId,
    titel: m.titel,
    monat: m.monat || null,
    url: m.quelle?.url || null,
  }))
}

/** Anime2You-Vorschläge, die am Tag gelesen wurden (noch nicht als Handbeleg übernommen). */
export function vorschlaegeDesTages(proposals, tag) {
  return ((proposals && proposals.vorschlaege) || []).filter((v) => v.gelesenAm === tag).map((v) => ({
    titel: v.titel,
    art: v.art,
    sprache: v.sprache,
    plattform: v.plattform,
    anbieter: v.anbieter || null,
    datum: v.datum || null,
    quelle: v.quelle,
  }))
}

/** Offene PRs, die Datendateien berühren: Nummer, Titel, Art (Bau = public/data, Handdaten = data/). */
export function queueMitDaten(prs) {
  const aus = []
  for (const p of prs || []) {
    const dateien = (p.files || []).map((f) => f.path).filter((f) => f.startsWith('public/data/') || f.startsWith('data/'))
    if (dateien.length === 0) continue
    const art = dateien.some((f) => f.startsWith('public/data/')) ? 'Bau' : 'Handdaten'
    aus.push({ nummer: p.number, titel: p.title, art, dateien })
  }
  return aus
}

export const QUEUE_LIMIT = 100

/** Offene PRs über gh (eingespeist: ghFn bekommt die Argumente, liefert den JSON-Text). */
export function holeQueue(ghFn) {
  return queueMitDaten(JSON.parse(ghFn(['pr', 'list', '--state', 'open', '--limit', String(QUEUE_LIMIT), '--json', 'number,title,files'])))
}

export function textZeilen(r) {
  const z = [`Heute neu (${r.tag}), Basis ${r.basis.slice(0, 9)} gegen ${r.ref}:`]
  z.push(`- ${r.titel.neu.length} neue Titel, ${r.titel.neuMitSynchro.length} davon mit Synchro`)
  z.push(`- ${r.titel.synchroNeu.length} Titel mit neuer Synchro oder geändertem dubConfidence, ${r.titel.synchroVerloren.length} mit verlorener Synchro`)
  z.push(`- ${r.news.length} Titel mit Folgen-Meldungen am Tag: ${r.news.map((n) => n.titel).join('; ') || '-'}`)
  z.push(`- ${r.titel.wegeNeu.length} neue Wege mit Sprachangabe, ${r.titel.wegeOhneSprache.length} neue Wege ohne Sprachangabe (dub unbekannt)`)
  z.push(`- Termine: ${r.termine.termineNeu.length} neu, ${r.termine.termineGeaendert.length} geändert`)
  z.push(`- ${r.meldungen.length} Verweise (meldungen.json): ${r.meldungen.map((m) => m.titel).join('; ') || '-'}`)
  z.push(`- ${r.katalogNeu.length} neue Katalogeinträge ohne Synchro: ${r.katalogNeu.map((t) => t.name).join('; ') || '-'}`)
  z.push(`- ${r.titel.trailerNeu.length} Titel mit neuem Trailer: ${r.titel.trailerNeu.map((t) => `${t.name} (${t.sprache || '?'})`).join('; ') || '-'}`)
  z.push(`- ${r.vorschlaege.length} Vorschläge aus Anime2You, am Tag gelesen (Übernahme als Handbeleg offen oder schon erfolgt): ${r.vorschlaege.map((v) => `${v.titel} (${v.plattform || v.anbieter || '?'})`).join('; ') || '-'}`)
  if (r.queue) z.push(`- Queue: ${r.queue.length} offene PRs mit Datendateien`)
  for (const p of r.queue || []) z.push(`  #${p.nummer} ${p.art}: ${p.titel}`)
  return z
}

export function baueBericht({ tag, basis, ref, lies, queue }) {
  const lade = (r, p) => JSON.parse(lies(r, p))
  const p = (n) => `public/data/${n}`
  return {
    tag,
    basis,
    ref,
    titel: vergleicheTitel(lade(basis, p('titles.json')), lade(ref, p('titles.json'))),
    termine: vergleicheTermine(lade(basis, p('releases.json')), lade(ref, p('releases.json'))),
    news: newsDesTages(lade(ref, p('news.json')), tag),
    meldungen: meldungenNeu(lade(basis, p('meldungen.json')), lade(ref, p('meldungen.json'))),
    katalogNeu: katalogNeu(lade(basis, p('ohne-synchro.json')), lade(ref, p('ohne-synchro.json'))),
    vorschlaege: vorschlaegeDesTages(lade(ref, 'data/proposals/anime2you-extraktion.json'), tag),
    queue,
  }
}

const git = (args) => execFileSync('git', args, { encoding: 'utf8', maxBuffer: 1 << 29, timeout: 60000, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'] })

/** Letzter Commit von `ref` vor 00:00 Berlin des Tages. */
export function findeBasis(tag, ref, gitFn = git) {
  const hash = gitFn(['rev-list', '-1', `--before=${berlinMitternacht(tag)}`, ref]).trim()
  if (!hash) throw new Error(`Kein Commit vor ${tag} 00:00 Berlin auf ${ref}`)
  return hash
}

function arg(argv, name, vorgabe) {
  const i = argv.indexOf(name)
  return i >= 0 ? argv[i + 1] : vorgabe
}

const ghAufruf = (args) => execFileSync('gh', args, { encoding: 'utf8', timeout: 60000, windowsHide: true })

/** Baut die Ausgabe (JSON oder Textzeilen); `deps` speist git-Lesen und gh ein. */
export function erzeuge(argv, jetzt, deps = {}) {
  const gitFn = deps.git || git
  const tag = arg(argv, '--tag', heuteBerlin(jetzt))
  const ref = arg(argv, '--ref', 'origin/main')
  const basis = arg(argv, '--basis', null) || findeBasis(tag, ref, gitFn)
  const lies = (r, pfad) => gitFn(['show', `${r}:${pfad}`])
  const queue = argv.includes('--queue') ? holeQueue(deps.gh || ghAufruf) : undefined
  const bericht = baueBericht({ tag, basis: gitFn(['rev-parse', basis]).trim(), ref, lies, queue })
  return argv.includes('--json') ? JSON.stringify(bericht, null, 2) : textZeilen(bericht).join('\n')
}

export function main(argv, jetzt) {
  console.log(erzeuge(argv, jetzt))
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) process.exit(main(process.argv.slice(2), new Date()))
