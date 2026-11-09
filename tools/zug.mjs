/**
 * Sammelzug (F105 = B, Daniel 06.11.2026): Unter-PRs gehen auf den Zweig `zug`, eine Kette läuft über den ganzen Zug, die Daten-App schiebt
 * main per Fast-Forward darauf. Dieses Werkzeug liefert die Entscheidungen als reine Funktionen; geschrieben wird hier nichts.
 *   zugPlan          welche freigegebenen PRs in welcher Reihenfolge in den Zug kommen
 *   schuldsuche      rote Fahrt: main allein rot? Ratsche? sonst Job + Dateien, sonst Halbierung
 *   revertPlan       Befehle, um Unter-PRs aus dem Zug zu nehmen (neuester zuerst)
 * Trockenlauf gegen echte Daten: node tools/zug-trocken.mjs trocken [--basis main|zug] [--max N]  (liest gh/git, schreibt nichts)
 * Anlass der Ratschen-Regel: daniel-zum-abarbeiten/berichte/rot-nach-gruen-2026-11-06.md (7 von 249 Köpfen erst grün, dann rot, 4 davon Ratschen).
 */
import { checkStand, urteile, urteileAufKopf } from './liegegut.mjs'

export const MAX_ZUG = 16 // Messung 06.11.2026: Kette Median 10 min, Maximum 16 min; 16 PRs je Fahrt ≈ 96 je Stunde bei zwei Läufen im Takt.

/** Gründe, aus denen ein offener PR (noch) nicht in den Zug darf; leer = freigegeben. */
export function sperrGruende(pr) {
  const gruende = []
  if (pr.isDraft) gruende.push('Entwurf')
  if (pr.mergeable === 'CONFLICTING') gruende.push('Konflikt')
  const kette = checkStand(pr.statusCheckRollup ?? []).art
  if (kette !== 'gruen') gruende.push(kette === 'rot' ? 'Kette rot' : 'Kette offen')
  const letztes = letztesUrteil(pr)
  if (!letztes) gruende.push('kein Urteil auf dem Kopf')
  else if (!letztes.gut) gruende.push('Prüfer: ändern')
  return gruende
}

/** Das jüngste Urteil auf dem aktuellen Kopf entscheidet: ein Nachtrag mit neuem Ok löst ein früheres Ändern auf (Nachtrag-Ablauf). */
function letztesUrteil(pr) {
  return urteileAufKopf(urteile(pr.comments ?? []), pr.headRefOid, pr.kopfZeit).at(-1)
}

/** Zeitpunkt der Freigabe: das jüngste Urteil (nur für freigegebene PRs gerufen, also ein Ok). */
const freigabeZeit = (pr) => letztesUrteil(pr).zeit

/**
 * Plan für die nächste Befüllung. `prs`: offene PRs mit Feldern von liegegut.offenePrs plus `kopfZeit` (ms).
 * Reihenfolge: früheste Freigabe zuerst, dann Nummer. Mehr als `max` freigegebene: der Rest wartet auf die nächste Fahrt.
 * `imZug`: Nummern, die schon im Zug liegen (zählen gegen `max`, kommen nicht doppelt).
 */
export function zugPlan(prs, { max = MAX_ZUG, imZug = [] } = {}) {
  const frei = []
  const zurueck = []
  for (const pr of prs) {
    if (imZug.includes(pr.number)) continue
    const gruende = sperrGruende(pr)
    if (gruende.length > 0) zurueck.push({ nr: pr.number, gruende })
    else frei.push({ nr: pr.number, titel: pr.title, seit: freigabeZeit(pr) })
  }
  frei.sort((a, b) => a.seit - b.seit || a.nr - b.nr)
  const platz = Math.max(0, max - imZug.length)
  const aufnehmen = frei.slice(0, platz)
  for (const f of frei.slice(platz)) zurueck.push({ nr: f.nr, gruende: ['Zug voll'] })
  return { aufnehmen, zurueck: zurueck.sort((a, b) => a.nr - b.nr) }
}

/**
 * Liest `git log -m --first-parent --name-only --format=%x01%H%x09%P%x09%s origin/main..origin/zug` (-m, damit Merge-Commits ihre Dateien zeigen).
 * Rückgabe, neuester zuerst: { sha, eltern, nr, titel, dateien }. `nr` ist null für Commits ohne PR-Nummer (z. B. „Merge branch 'main' into zug“).
 */
export function zugEintraege(log) {
  const eintraege = []
  for (const block of log.split('\x01').filter((b) => b.trim() !== '')) {
    const [kopf, ...dateien] = block.split('\n')
    const [sha, eltern, ...rest] = kopf.split('\t')
    const titel = rest.join('\t')
    const nr = /^Merge pull request #(\d+) /.exec(titel)?.[1] ?? /\(#(\d+)\)$/.exec(titel)?.[1] ?? null
    eintraege.push({ sha, eltern: eltern.split(' ').filter(Boolean).length, nr: nr === null ? null : Number(nr), titel, dateien: dateien.map((d) => d.trim()).filter(Boolean) })
  }
  return eintraege
}

/**
 * Befehle, um `nummern` aus dem Zug zu nehmen: neuester Eintrag zuerst (sonst wächst die Konfliktgefahr), Merge-Commits mit `-m 1`.
 * `risiko`: spätere Einträge, die dieselben Dateien berühren; der Revert kann dort einen Konflikt melden.
 * Fehlt eine Nummer im Zug, steht sie unter `fehlt` (kein stilles Weglassen).
 */
export function revertPlan(eintraege, nummern) {
  const ziel = eintraege.filter((e) => e.nr !== null && nummern.includes(e.nr))
  const befehle = ziel.map((e) => {
    const spaeter = eintraege.slice(0, eintraege.indexOf(e)).filter((s) => s.nr !== e.nr && s.dateien.some((d) => e.dateien.includes(d)))
    return { nr: e.nr, sha: e.sha, befehl: `git revert --no-edit${e.eltern > 1 ? ' -m 1' : ''} ${e.sha}`, risiko: spaeter.map((s) => s.nr) }
  })
  const fehlt = nummern.filter((n) => !ziel.some((e) => e.nr === n))
  return { befehle, fehlt }
}

// Meldungen der Ratschen-Wächter, wörtlich aus den roten Läufen vom 05./06.11.2026 (rot-nach-gruen-2026-11-06.md). Jede liefert { wert, grenze }.
// `schluessel` (nur Umfang: je Bereich und Art eine eigene Grenze in tools/umfang-grenzen.json) wählt die Basisgrenze in `grenzeBasis`.
// Cover: zwei Wächter melden es, check-teilseiten („Standardbild, erlaubt“) und check-cover-vorschau-bestand („Standardbild als Link-Vorschau, erlaubt“).
const RATSCHEN = [
  { name: 'cover-standardbild', suche: /(\d+) Titel mit Cover zeigen das Standardbild(?: als Link-Vorschau)?, erlaubt höchstens (\d+)/, wert: (m) => Number(m[1]), grenze: (m) => Number(m[2]) },
  { name: 'umfang', suche: /([\w/.-]+): Überlänge der (funktionen|dateien) (\d+) statt höchstens (\d+)/, wert: (m) => Number(m[3]), grenze: (m) => Number(m[4]), schluessel: (m) => `umfang:${m[1]}:${m[2]}` },
  { name: 'umfang', suche: /([\w/.-]+): Ketten \([^)]*\) (\d+) statt höchstens (\d+)/, wert: (m) => Number(m[2]), grenze: (m) => Number(m[3]), schluessel: (m) => `umfang:${m[1]}:ketten` },
  { name: 'start-budget', suche: /start-budget: ([\d.]+) KB[^\n]*?über der Grenze von ([\d.]+) KB/, wert: (m) => Number(m[1]), grenze: (m) => Number(m[2]) },
]

/** Erste Ratschen-Meldung im Text oder null: { name, wert, grenze } (Umfang zusätzlich `schluessel`). */
export function ratschenMeldung(text) {
  for (const r of RATSCHEN) {
    const m = r.suche.exec(text)
    if (m) return { name: r.name, wert: r.wert(m), grenze: r.grenze(m), ...(r.schluessel ? { schluessel: r.schluessel(m) } : {}) }
  }
  return null
}

/**
 * Grenzen der Ratschen am Basisstand. `lies(datei)` liefert den Text der Datei am Basisstand (git show <basis>:<datei>) oder null.
 * Rückgabe: { 'cover-standardbild', 'start-budget' (KB), 'umfang:<bereich>:<art>' }; was am Basisstand fehlt, fehlt auch hier (dann 'ratsche-pruefen').
 * Cover steht in zwei Wächtern: die strengere (kleinere) zählt.
 */
export function basisGrenzen(lies) {
  const grenzen = {}
  const cover = [
    ['pipeline/check-cover-vorschau-bestand.ts', /export const HOECHSTENS = (\d+)/],
    ['pipeline/check-teilseiten.ts', /const STANDARD_TROTZ_COVER_HOECHSTENS = (\d+)/],
  ].map(([datei, muster]) => muster.exec(lies(datei) ?? '')?.[1]).filter((w) => w !== undefined).map(Number)
  if (cover.length > 0) grenzen['cover-standardbild'] = Math.min(...cover)
  const budget = /export const GRENZE = (\d+(?:\.\d+)?) \* KB/.exec(lies('tools/start-budget.mjs') ?? '')?.[1]
  if (budget !== undefined) grenzen['start-budget'] = Number(budget)
  const umfang = lies('tools/umfang-grenzen.json')
  for (const [bereich, werte] of Object.entries(umfang ? JSON.parse(umfang).ueberlaenge ?? {} : {})) {
    for (const [art, wert] of Object.entries(werte)) grenzen[`umfang:${bereich}:${art}`] = wert
  }
  return grenzen
}

/**
 * Wer ist schuld an einer gerissenen Ratsche? Gemessen wird gegen die Grenze des Basisstands (die der PR beim Bauen sah), nicht gegen die
 * inzwischen gesenkte: hielt der Zug sie ein, ist die Senkung auf main der Fall ('ratsche'); riss er schon sie, ist es der Zug ('zug').
 * Ohne bekannte Basisgrenze: 'ratsche-pruefen' (kein Revert, Mensch oder Bestandsbau klärt).
 */
export function ratschenFall({ wert, grenze }, grenzeBasis) {
  if (wert <= grenze) return 'ok'
  if (grenzeBasis === null || grenzeBasis === undefined) return 'ratsche-pruefen'
  return wert <= grenzeBasis ? 'ratsche' : 'zug'
}

// Welche Dateien einen Job rot färben können (Eingrenzung, kein Beweis). null = jeder Eintrag kommt in Frage.
const JOB_PFADE = [
  { job: /Workflows/, pfad: /^(\.github\/|tools\/)/ },
  { job: /Typen und Worker/, pfad: /^(worker\/|shared\/|tools\/|pipeline\/|web\/src\/|tsconfig)/ },
  { job: /Aussehen/, pfad: /^(web\/|tools\/|docs\/ansicht)/ },
  { job: /Daten, Erweiterung, Belege/, pfad: /^(data\/|extension\/|pipeline\/|tools\/)/ },
]

/** Zug-PRs, die laut Job und Dateien in Frage kommen; ohne Eingrenzung (Logik, Bau, Datenbau, unbekannter Job) alle. */
export function verdaechtige(zugPrs, jobs) {
  const regeln = jobs.map((j) => JOB_PFADE.find((r) => r.job.test(j.name))?.pfad ?? null)
  if (regeln.length === 0 || regeln.includes(null)) return zugPrs.map((p) => p.nr)
  return zugPrs.filter((p) => p.dateien.some((d) => regeln.some((r) => r.test(d)))).map((p) => p.nr)
}

/**
 * Schuldsuche für eine rote Fahrt, in dieser Reihenfolge:
 *  1. main allein (Zug ohne Unter-PRs) rot → { art: 'main' }, nichts zurücknehmen
 *  2. eine Ratsche gerissen und nicht vom Zug selbst → { art: 'ratsche', ... }, nichts zurücknehmen
 *  3. Job + Dateien nennen genau einen Unter-PR → { art: 'pr', nr } (die nächste Fahrt bestätigt; bleibt sie rot, kommt er in `ausgeschlossen`)
 *  4. sonst Halbierung über die Verdächtigen (`halbierungStart`)
 * `fehlschlag.jobs`: [{ name, meldung }]; `grenzeBasis`: je Ratschen-Name die Grenze des Basisstands; `ausgeschlossen`: schon vergeblich zurückgenommen.
 */
export function schuldsuche({ zugPrs, fehlschlag, mainAllein, grenzeBasis = {}, ausgeschlossen = [] }) {
  if (mainAllein === 'rot') return { art: 'main' }
  for (const job of fehlschlag.jobs) {
    const r = ratschenMeldung(job.meldung ?? '')
    if (!r) continue
    const fall = ratschenFall(r, grenzeBasis[r.schluessel] ?? grenzeBasis[r.name])
    if (fall !== 'zug' && fall !== 'ok') return { art: 'ratsche', ratsche: r.name, fall, job: job.name }
  }
  const offen = zugPrs.filter((p) => !ausgeschlossen.includes(p.nr))
  const gefiltert = ausgeschlossen.length === 0 ? verdaechtige(offen, fehlschlag.jobs) : []
  const eng = gefiltert.length > 0 ? gefiltert : offen.map((p) => p.nr) // nichts passt zum Job: Eingrenzung war falsch, also alle
  if (eng.length === 1) return { art: 'pr', nr: eng[0], wie: 'job+dateien' }
  return { art: 'halbieren', zustand: halbierungStart(offen.map((p) => p.nr), eng) }
}

/** Halbierung: `bleibt` fährt sicher mit, `verdacht` wird geteilt, `draussen` ist zurückgestellt (kommt nach dem Fund wieder in den Zug). */
export function halbierungStart(alle, verdacht) {
  return { bleibt: alle.filter((n) => !verdacht.includes(n)), verdacht: [...verdacht], draussen: [] }
}

/** Zug für den nächsten Versuch: bleibt plus erste Hälfte (abgerundet) der Verdächtigen. Bei einem Verdächtigen ist er schuldig. */
export function halbierungVersuch(z) {
  if (z.verdacht.length === 1) return { schuldig: z.verdacht[0], zug: [...z.bleibt, ...z.draussen] }
  return { zug: [...z.bleibt, ...z.verdacht.slice(0, Math.floor(z.verdacht.length / 2))] }
}

/** Nächster Zustand nach dem Versuch: grün → Schuldiger in der zweiten Hälfte; rot → in der ersten, die zweite wird zurückgestellt. */
export function halbierungWeiter(z, gruen) {
  const h = Math.floor(z.verdacht.length / 2)
  const erste = z.verdacht.slice(0, h)
  const zweite = z.verdacht.slice(h)
  if (gruen) return { bleibt: [...z.bleibt, ...erste], verdacht: zweite, draussen: z.draussen }
  return { bleibt: z.bleibt, verdacht: erste, draussen: [...z.draussen, ...zweite] }
}

/** Fehlverdacht: wer vergeblich zurückgenommen wurde und nicht der Schuldige war, gehört wieder in den Zug. */
export function zurueckholen(ausgeschlossen, schuldig) {
  return ausgeschlossen.filter((n) => n !== schuldig)
}

/** Fast-Forward ist nur möglich, wenn main (Fernstand) im Zug-Kopf enthalten ist; sonst muss der Zug main erst hereinholen und neu fahren. */
export function ffEntscheidung({ mainImZug, kettenKopf, zugKopf }) {
  if (kettenKopf !== zugKopf) return { art: 'neu-fahren', grund: 'Kette lief auf einem anderen Kopf als der Zug jetzt hat' }
  if (!mainImZug) return { art: 'main-holen', grund: 'main ist weitergelaufen (Bots oder Direkt-Merge)' }
  return { art: 'ff', grund: 'main ist Vorfahr des Zug-Kopfs' }
}

// ── Fahrt (P2b): Zweige, Urteil über die Kette, Log. Die I/O liegt in tools/zug-fahrt.mjs, hier steht nur, was sich rechnen lässt. ──

export const FAHRT_ZWEIG = 'zug-fahrt' // Schnappschuss: Zug plus main; die Kette läuft als PR zug-fahrt → main, der Zug nimmt währenddessen weiter Unter-PRs auf.
export const PROBE_ZWEIG = 'zug-probe' // „main allein“: main-Kopf plus ein leerer Commit, Kette ohne Unter-PRs.

/** Urteil eines Kettenlaufs (`gh run`: status, conclusion): 'gruen', 'rot' oder 'offen' (läuft, abgebrochen, übersprungen: kein Urteil). */
export function ketteArt({ status, conclusion }) {
  if (status !== 'completed') return 'offen'
  if (conclusion === 'success') return 'gruen'
  return conclusion === 'failure' || conclusion === 'timed_out' ? 'rot' : 'offen'
}

/**
 * Nächster Schritt für das Ergebnis einer Fahrt-Kette. `ff`: Ergebnis von ffEntscheidung (nur bei grün gebraucht).
 * Rot ohne Probe → 'probe-starten' (main allein prüfen, sonst ist die Schuldsuche blind); rot mit Probe → 'schuldsuche'.
 */
export function fahrtSchritt({ kette, ff, mainAllein }) {
  if (kette === 'offen') return { art: 'abwarten' }
  if (kette === 'gruen') return ff.art === 'ff' ? { art: 'ff-pruefen' } : { art: ff.art, grund: ff.grund }
  return mainAllein === undefined ? { art: 'probe-starten' } : { art: 'schuldsuche' }
}

/** Basisstand für die Grenzen der Ratschen: der Zug vor dem Hereinholen von main (erster Elternteil des Merge-Commits), sonst main selbst. */
export const basisRef = (kopfEltern) => (kopfEltern > 1 ? `origin/${FAHRT_ZWEIG}^1` : 'origin/main')

/**
 * Zustand jeder gemeldeten Ratsche der roten Jobs gegen die Basisgrenzen, für das Fahrt-Log.
 * Rückgabe: [{ job, name, wert, grenze, basis, fall }]; `fall` wie ratschenFall ('ok', 'ratsche', 'zug', 'ratsche-pruefen').
 */
export function ratschenZustand(jobs, grenzeBasis) {
  const zeilen = []
  for (const job of jobs) {
    const r = ratschenMeldung(job.meldung ?? '')
    if (!r) continue
    const basis = grenzeBasis[r.schluessel] ?? grenzeBasis[r.name]
    zeilen.push({ job: job.name, name: r.schluessel ?? r.name, wert: r.wert, grenze: r.grenze, basis: basis ?? null, fall: ratschenFall(r, basis) })
  }
  return zeilen
}

const FALL_TEXT = { ok: 'eingehalten', ratsche: 'Senkung auf main (nicht der Zug)', zug: 'vom Zug gerissen', 'ratsche-pruefen': 'Basisgrenze unbekannt' }

/** Zeilen für das Fahrt-Log (Schrittzusammenfassung und PR-Kommentar). `kopf`: Zug-Kopf der Fahrt; `urteil`: Ergebnis von schuldsuche oder null. */
export function fahrtLog({ kopf, kette, schritt, ratschen = [], grenzeBasis = {}, urteil = null }) {
  const zeilen = [`## Fahrt ${String(kopf).slice(0, 9)}: Kette ${kette}, Schritt ${schritt.art}${schritt.grund ? ` (${schritt.grund})` : ''}`]
  if (urteil) zeilen.push(`Schuldsuche: ${JSON.stringify(urteil)}`)
  zeilen.push(`Ratschen am Basisstand: ${Object.keys(grenzeBasis).length === 0 ? 'keine gelesen' : Object.entries(grenzeBasis).map(([k, v]) => `${k}=${v}`).join(', ')}`)
  if (ratschen.length === 0) zeilen.push('Ratschen im Fehlschlag: keine gemeldet')
  for (const r of ratschen) zeilen.push(`Ratsche ${r.name} (${r.job}): Wert ${r.wert}, Grenze main ${r.grenze}, Basis ${r.basis ?? '?'} → ${FALL_TEXT[r.fall] ?? r.fall}`)
  return zeilen
}

/** Nach dem Schieben: Bau und Deploy starten, weil bestand-bauen.yml und deploy.yml push-Läufe des Daten-App-Akteurs überspringen (Befund P0). Bau zuerst: sein Ende startet über workflow_run schon den nächsten Deploy; der eigene deckt den Fall, dass der Bau rot endet. */
export const bauUndDeployBefehle = () => [
  ['workflow', 'run', 'bestand-bauen.yml', '--ref', 'main'],
  ['workflow', 'run', 'deploy.yml', '--ref', 'main'],
]
