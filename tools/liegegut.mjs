/**
 * Liegegut-Wächter: findet offene PRs, die liegen geblieben sind (Freigabe ohne Merge, Konflikt, rote Checks, Ändern-Urteil ohne Commit,
 * widersprüchliche Urteile, gleiche offene Entscheidung, überholt). Hinweisgeber, kein Tor: Exit 0 auch mit Funden, Exit 2 nur bei
 * Abruffehler (nie stilles „nichts gefunden“). Aufruf: node tools/liegegut.mjs
 * Signale und Anlass: daniel-zum-abarbeiten/berichte/liegegut-2026-10-21.md (PR 1676 lag freigegeben und grün 20.10. bis 21.10.).
 */
import { execFileSync } from 'node:child_process'
import { pathToFileURL } from 'node:url'
import { gh } from './pr-nachrechnen.mjs'

const STUNDE = 3600 * 1000
// Schwellen (Stand 21.10.2026, aus dem Liegegut-Bericht der 13 PRs vom 21.10.: kürzer meldet bei normalem Prüfer-Takt Fehlalarm).
export const RUHE_FREIGABE_H = 12 // Freigabe + grün + sauber, ohne Commit und Kommentar: nach einer halben Tagesschicht liegt es.
export const KONFLIKT_H = 24 // Konflikt ohne Aktivität; der Beginn des Konflikts ist nicht abrufbar, Näherung: letzte Aktivität.
export const ROT_H = 12 // Rote Checks auf dem aktuellen Kopf: ein Wiederholungslauf dauert weniger.
export const AENDERN_H = 24 // Ändern-Urteil ohne neuen Commit: der Bauer hatte einen Tag.
export const STICHWORT_MIN = 5 // Titelwörter ab dieser Länge zählen für die Überholt-Gegenprobe.
export const STICHWORT_STAMM = 6 // Vergleich über die ersten Buchstaben („Termine“ = „Terminen“).
export const STICHWORT_TREFFER = 2 // Gemeinsame Stämme zwischen Titel und main-Commit; eins allein ist Zufall (1386: 30 Commits an denselben Dateien).
export const FUELLWOERTER = new Set(['statt', 'nicht', 'keine', 'sowie', 'wieder', 'schon', 'gegen']) // Funktionswörter ohne Sachbezug (21.10.2026: 'statt' allein machte aus 1433 einen Treffer).

const GRUEN = new Set(['SUCCESS', 'NEUTRAL', 'SKIPPED'])
const ROT = new Set(['FAILURE', 'TIMED_OUT', 'STARTUP_FAILURE', 'ERROR'])

/** Urteile aus den Kommentaren: Bot „**Prüfer-Review** für <Kopf> - Urteil: **ok|aendern**“, Daniel „Prüfer …: freigeben|ändern“. */
export function urteile(comments) {
  const aus = []
  for (const c of comments) {
    const login = c.author?.login
    if (login === 'github-actions') {
      const m = /\*\*Prüfer-Review\*\* für ([0-9a-f]{7,40})\b[\s\S]*?Urteil: \*\*(ok|aendern)\b/.exec(c.body)
      if (m) aus.push({ zeit: Date.parse(c.createdAt), quelle: 'bot', kopf: m[1], gut: m[2] === 'ok' })
    } else if (login === 'danielzaiser91') {
      const m = /^Prüfer(?!\p{L}).*?(?<!\p{L})(freigeben|ändern)(?!\p{L})/iu.exec(c.body)
      if (m) aus.push({ zeit: Date.parse(c.createdAt), quelle: 'daniel', kopf: /Kopf ([0-9a-f]{7,40})/.exec(c.body)?.[1] ?? null, gut: m[1].toLowerCase() === 'freigeben' })
    }
  }
  return aus.sort((a, b) => a.zeit - b.zeit)
}

/** Urteile, die für den aktuellen Kopf gelten: genannter Kopf passt, sonst (Daniel ohne Kopf) jünger als der Kopf-Commit. */
export function urteileAufKopf(liste, kopf, kopfZeit) {
  return liste.filter((u) => (u.kopf === null ? u.zeit >= kopfZeit : kopf.startsWith(u.kopf)))
}

const zeitVon = (c) => Date.parse(c.completedAt ?? c.startedAt ?? 0) || 0

/** Je Check-Name nur der jüngste Eintrag (so wertet GitHub); ein Doppelstart lässt einen abgebrochenen Sammeljob neben dem neuen stehen. Einträge ohne Namen bleiben. */
export function jeNameJuengster(rollup) {
  const juengster = new Map()
  const ohneName = []
  for (const c of rollup) {
    if (!c.name) ohneName.push(c)
    else if (!juengster.has(c.name) || zeitVon(c) >= zeitVon(juengster.get(c.name))) juengster.set(c.name, c)
  }
  return [...juengster.values(), ...ohneName]
}

/** Checks des Kopfs: 'gruen' (alle fertig und grün), 'rot' (einer rot, mit Zeitpunkt) oder 'offen'. */
export function checkStand(alle) {
  const rollup = jeNameJuengster(alle)
  if (rollup.length === 0) return { art: 'offen' }
  const rote = rollup.filter((c) => ROT.has(c.conclusion) || ROT.has(c.state))
  if (rote.length > 0) return { art: 'rot', seit: Math.max(...rote.map((c) => Date.parse(c.completedAt ?? c.startedAt ?? 0) || 0)) }
  const alleGruen = rollup.every((c) => GRUEN.has(c.conclusion) || c.state === 'SUCCESS')
  return { art: alleGruen ? 'gruen' : 'offen' }
}

const stunden = (von, jetzt) => (jetzt - von) / STUNDE

/** Signale 1 bis 5 eines PR (rein). Rückgabe: Liste { nr, text, seit }. kopfZeit = Commit-Zeit des Kopfs in ms. */
export function signaleEinzel(pr, kopfZeit, jetzt) {
  const aufKopf = urteileAufKopf(urteile(pr.comments), pr.headRefOid, kopfZeit)
  const letzterKommentar = Math.max(0, ...pr.comments.map((c) => Date.parse(c.createdAt)))
  const ruhe = Math.max(kopfZeit, letzterKommentar)
  const checks = checkStand(pr.statusCheckRollup)
  const aus = []
  const alleGut = aufKopf.length > 0 && aufKopf.every((u) => u.gut)
  if (alleGut && checks.art === 'gruen' && pr.mergeStateStatus === 'CLEAN' && stunden(ruhe, jetzt) > RUHE_FREIGABE_H) {
    aus.push({ nr: 1, text: 'Freigabe + grün + ruhend', seit: ruhe })
  }
  // Widerspruch nur, wenn das jüngste Urteil schlecht ist und ein früheres gut war; ein späteres Ok löst ein Ändern auf (Nachtrag-Ablauf 1997/2007).
  const jüngstes = aufKopf.at(-1)
  if (jüngstes && !jüngstes.gut && aufKopf.some((u) => u.gut)) {
    aus.push({ nr: 2, text: 'Urteile widersprechen sich auf demselben Kopf', seit: aufKopf.at(-1).zeit })
  }
  if (pr.mergeable === 'CONFLICTING' && stunden(ruhe, jetzt) > KONFLIKT_H) aus.push({ nr: 3, text: 'Konflikt liegt', seit: ruhe })
  if (checks.art === 'rot' && stunden(checks.seit, jetzt) > ROT_H) aus.push({ nr: 4, text: 'Checks rot auf dem Kopf', seit: checks.seit })
  const letztes = aufKopf.at(-1)
  if (letztes && !letztes.gut && stunden(letztes.zeit, jetzt) > AENDERN_H) aus.push({ nr: 5, text: 'Ändern-Urteil ohne neuen Commit', seit: letztes.zeit })
  return aus
}

/** Signal 6: F-Nummern (offene Entscheidungen), die mehr als ein PR nennt. Rückgabe: Map PR-Nummer → Liste der geteilten F-Nummern. */
export function geteilteEntscheidungen(prs) {
  const je = new Map()
  for (const pr of prs) {
    const text = [pr.title, pr.body, ...pr.comments.filter((c) => c.author?.login === 'danielzaiser91' || c.body.includes('**Prüfer-Review**')).map((c) => c.body)].join('\n')
    for (const f of new Set(text.match(/\bF\d+\b/g) ?? [])) je.set(f, [...(je.get(f) ?? []), pr.number])
  }
  const aus = new Map()
  for (const [f, nummern] of je) {
    if (nummern.length < 2) continue
    for (const n of nummern) aus.set(n, [...(aus.get(n) ?? []), f])
  }
  return aus
}

/** Titelwörter als Stämme. */
export function stichwoerter(text) {
  const woerter = text.toLowerCase().match(/[a-zäöüß]+/g) ?? []
  return new Set(woerter.filter((w) => w.length >= STICHWORT_MIN && !FUELLWOERTER.has(w)).map((w) => w.slice(0, STICHWORT_STAMM)))
}

/** Liest `git log --name-only --format=%x01%h%x09%s` in Commits { hash, betreff, dateien }. */
export function mainCommits(log) {
  return log.split('\x01').filter((b) => b.trim() !== '').map((block) => {
    const [kopf, ...dateien] = block.split('\n')
    const [hash, betreff] = kopf.split('\t')
    return { hash, betreff: betreff ?? '', dateien: dateien.filter((d) => d.trim() !== '') }
  })
}

/** Signal 7 (Hinweis, kein Schluss): main-Commits seit PR-Datum mit gemeinsamer Datei und mindestens STICHWORT_TREFFER gemeinsamen Titelstämmen. */
export function ueberholtTreffer(titel, dateien, commits) {
  const eigene = new Set(dateien)
  const woerter = stichwoerter(titel)
  return commits.filter((c) => {
    if (!c.dateien.some((d) => eigene.has(d))) return false
    const gemeinsam = [...stichwoerter(c.betreff)].filter((w) => woerter.has(w))
    return gemeinsam.length >= STICHWORT_TREFFER
  })
}

const NAECHSTER = { UEBERHOLT: 'ÜBERHOLT?', DANIEL: 'DANIEL', MERGEN: 'MERGEN', NACHBESSERN: 'NACHBESSERN' }

/** Nächster Schritt aus Signalen und Gegenprobe; `daniel` = Signal 6 oder Signal 2 mit Bot-Urteil als letztem (nur Daniel löst das). */
export function naechsterSchritt(nummern, treffer, botLetzt) {
  const hat = (n) => nummern.includes(n)
  if (treffer.length > 0 && (hat(1) || hat(3) || hat(5))) return NAECHSTER.UEBERHOLT
  if (hat(6) || (hat(2) && botLetzt)) return NAECHSTER.DANIEL
  if (hat(1)) return NAECHSTER.MERGEN
  return NAECHSTER.NACHBESSERN
}

const berlin = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })
const zeitText = (ms) => berlin.format(new Date(ms)).replace(',', '')

const braucheGegenprobe = (nummern) => nummern.some((n) => n === 1 || n === 3 || n === 5)

/** Eine Zeile je auffälligem PR; `seit` = frühester Zeitpunkt der Signale. */
export function zeile(nr, schritt, texte, seit, treffer, geprueft) {
  const probe = !geprueft ? '' : treffer.length > 0 ? `; Gegenprobe: Treffer ${treffer.map((c) => `${c.hash} „${c.betreff}“`).join(' | ')}` : '; Gegenprobe: keine Treffer'
  return `PR ${nr}: ${schritt} – Signal ${texte.join('; ')} – seit ${zeitText(seit)}${probe}`
}

/** Bewertet einen PR; null, wenn nichts auffällt. */
function bewertePr(ghFn, gitFn, pr, geteilt, jetzt) {
  const kopfZeit = Date.parse(ghFn(['api', `repos/{owner}/{repo}/commits/${pr.headRefOid}`, '--jq', '.commit.committer.date']).trim())
  if (Number.isNaN(kopfZeit)) throw new Error(`PR ${pr.number}: Kopf-Zeit nicht lesbar`)
  const signale = signaleEinzel(pr, kopfZeit, jetzt)
  const texte = signale.map((s) => `${s.nr} ${s.text}`)
  const zeiten = signale.map((s) => s.seit)
  const nummern = signale.map((s) => s.nr)
  if (geteilt) {
    texte.push(`6 Gleiche offene Entscheidung ${geteilt.join(', ')}`)
    zeiten.push(kopfZeit)
    nummern.push(6)
  }
  if (nummern.length === 0) return null
  const geprueft = braucheGegenprobe(nummern)
  const treffer = geprueft ? probeFuer(ghFn, gitFn, pr) : []
  const botLetzt = urteileAufKopf(urteile(pr.comments), pr.headRefOid, kopfZeit).at(-1)?.quelle === 'bot'
  return zeile(pr.number, naechsterSchritt(nummern, treffer, botLetzt), texte, Math.min(...zeiten), treffer, geprueft)
}

/** Holt die offenen PRs über gh/git (einspeisbar) und rechnet alle. Rückgabe: Zeilen. */
export function liegegut(ghFn, gitFn, jetzt) {
  const felder = 'number,title,headRefOid,createdAt,mergeable,mergeStateStatus,isDraft,body,comments,statusCheckRollup'
  const offen = JSON.parse(ghFn(['pr', 'list', '--state', 'open', '--limit', '100', '--json', felder])).filter((p) => !p.isDraft)
  const geteilt = geteilteEntscheidungen(offen)
  return offen.map((pr) => bewertePr(ghFn, gitFn, pr, geteilt.get(pr.number), jetzt)).filter((z) => z !== null)
}

function probeFuer(ghFn, gitFn, pr) {
  const dateien = ghFn(['api', `repos/{owner}/{repo}/pulls/${pr.number}/files`, '--paginate', '--jq', '.[].filename']).split('\n').filter((d) => d !== '')
  const log = gitFn(['log', 'origin/main', `--since=${pr.createdAt}`, '--name-only', '--format=%x01%h%x09%s'])
  return ueberholtTreffer(pr.title, dateien, mainCommits(log))
}

export function git(args) {
  return execFileSync('git', args, { encoding: 'utf8', windowsHide: true, maxBuffer: 64 * 1024 * 1024 })
}

/** Startlogik: Fehler als Exit 2, Funde als Exit 0. */
export function main(ghFn, gitFn, melde, jetzt) {
  try {
    const zeilen = liegegut(ghFn, gitFn, jetzt)
    for (const z of zeilen) melde(z)
    melde(`liegegut: ${zeilen.length} auffällige PRs`)
    return 0
  } catch (e) {
    melde(`liegegut: FEHLER ${e.message}`)
    return 2
  }
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  process.exit(main(gh, git, (t) => console.log(t), Date.now()))
}
