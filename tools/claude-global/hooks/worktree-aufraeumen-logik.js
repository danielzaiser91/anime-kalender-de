// Reine Entscheidungslogik für hooks/worktree-aufraeumen.js (kein Dateizugriff, kein Prozess): was mit einem Worktree geschieht.
// Anlass 18.10.2026: 274 Worktrees im Hauptordner à ~49 000 Dateien, Windows hielt ~8 KB Kernel-Dateicache je Datei (~3 GB RAM).

/** Änderungen jünger als das: dort arbeitet vielleicht noch ein Agent. */
const SCHONFRIST_MS = 2 * 60 * 60 * 1000
/** Schonfrist seit Merge/Schließen des PR (größer als die Höchstfrist 4 h des Prozess-Registers). */
const SCHONFRIST_PR_MS = 24 * 60 * 60 * 1000
/** Ab so vielen Worktrees meldet der Sitzungsstart eine Warnzeile. */
const WARN_AB = 20
/** Eine Sperre älter als das gilt als verwaist (die Registerfrist des Abbaus ist kürzer). */
const SPERRE_MAX_MS = 60 * 60 * 1000

/** Zerlegt `git worktree list --porcelain` in { pfad, zweig, kopf }; Pfade mit Schrägstrichen. */
function leseWorktrees(porcelain) {
  return porcelain
    .split(/\r?\n\r?\n/)
    .map((block) => ({
      pfad: (/^worktree (.+)$/m.exec(block) || [])[1]?.replace(/\\/g, '/'),
      zweig: (/^branch refs\/heads\/(.+)$/m.exec(block) || [])[1] ?? null,
      kopf: (/^HEAD (\w+)$/m.exec(block) || [])[1] ?? null,
    }))
    .filter((w) => w.pfad)
}

const norm = (p) => p.replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase()
/** Nur Arbeitsbäume unter `.../_worktrees/<repo>/<thema>` kommen in Frage (seit 25.10.2026) — nie der Hauptordner. */
const istWtName = (pfad) => /\/_worktrees\/[^/]+\/[^/]+$/.test(norm(pfad))

/**
 * Positives Erledigt-Zeichen (Lesen hinterlässt kein Lebenszeichen, darum reicht „lange nichts geändert“ nie): ein PR mit
 * `headRefOid === kopf`, gemergt oder geschlossen. Rückgabe: { stand: 'offen' } | { stand: 'ohne' } | { stand: 'erledigt', grund, seitMs }.
 * Ein offener PR zählt auch über den Zweignamen. Mehrere passende PRs: der jüngste Abschluss zählt.
 */
function bewertePr(w, prs, jetzt) {
  if (prs.some((p) => p.state === 'OPEN' && ((w.zweig && p.headRefName === w.zweig) || (w.kopf && p.headRefOid === w.kopf)))) return { stand: 'offen' }
  const passend = prs.filter((p) => (p.state === 'MERGED' || p.state === 'CLOSED') && w.kopf && p.headRefOid === w.kopf)
  if (passend.length === 0) return { stand: 'ohne' }
  const mitZeit = passend.map((p) => ({ p, zeit: Date.parse(p.mergedAt ?? p.closedAt) }))
  if (mitZeit.some((x) => Number.isNaN(x.zeit))) return { stand: 'ohne' }
  const jung = mitZeit.reduce((a, b) => (b.zeit > a.zeit ? b : a))
  return { stand: 'erledigt', grund: `pr-${jung.p.state.toLowerCase()}`, seitMs: jetzt - jung.zeit, abschlussMs: jung.zeit }
}

/**
 * Entscheidung für einen Worktree: { aktion: 'weg' | 'prune' | 'behalten', grund }.
 * w: { pfad, zweig, kopf, existiert, juengsteAenderungMs, kopfZeitMs (letzte HEAD-Bewegung) }; ctx: { haupt, jetzt, prs, cacheLeer(pfad), sauber(pfad) }.
 * Reihenfolge: billige Prüfungen zuerst, `sauber` (git status, berührt alle Dateien) nur für Kandidaten zum Entfernen.
 */
function entscheide(w, ctx) {
  if (norm(w.pfad) === norm(ctx.haupt)) return { aktion: 'behalten', grund: 'haupt' }
  if (!istWtName(w.pfad)) return { aktion: 'behalten', grund: 'fremd' }
  if (!w.existiert) return { aktion: 'prune', grund: 'ordner-fehlt' }
  if (ctx.jetzt - w.juengsteAenderungMs < SCHONFRIST_MS) return { aktion: 'behalten', grund: 'jung' }
  const pr = bewertePr(w, ctx.prs, ctx.jetzt)
  if (pr.stand === 'offen') return { aktion: 'behalten', grund: 'pr-offen' }
  if (pr.stand === 'ohne') return { aktion: 'behalten', grund: 'ohne-pr' }
  if (pr.seitMs < SCHONFRIST_PR_MS) return { aktion: 'behalten', grund: 'pr-jung' }
  // Erst nach dem Abschluss auf diesen Kopf gesetzt (Nachprüfung, neuer Zweig) gehört nicht zum erledigten PR; fehlende Zeit = behalten.
  if (!(w.kopfZeitMs <= pr.abschlussMs)) return { aktion: 'behalten', grund: 'kopf-nach-abschluss' }
  if (ctx.cacheLeer(w.pfad) !== true) return { aktion: 'behalten', grund: 'cache-inhalt' }
  if (ctx.sauber(w.pfad) !== true) return { aktion: 'behalten', grund: 'geaendert' }
  return { aktion: 'weg', grund: pr.grund }
}

/**
 * Loser Ordner unter `_worktrees/<repo>/` ohne Git-Registrierung. eintraege: [{ name, istVerknuepfung }] (lstat, Verknüpfung nicht verfolgt).
 * Weg nur: leer, oder nur Verknüpfungen (Junctions/Symlinks, jeder Name) und leere Ordner, beliebig tief.
 * Alles andere wird nur aufgelistet. Eintrag mit `kinder` (Namen und Verknüpfungs-Flags) = echter Unterordner.
 */
function bewerteLosen(ordner) {
  if (ordner.jetzt - ordner.juengsteAenderungMs < SCHONFRIST_MS) return { aktion: 'behalten', grund: 'jung' }
  const e = ordner.eintraege
  if (e.length === 0) return { aktion: 'weg', grund: 'leer' }
  if (e.every(nurVerknuepfung)) return { aktion: 'weg', grund: 'nur-junction' }
  return { aktion: 'behalten', grund: 'inhalt' }
}

/** Rest: eine Verknüpfung (jeder Name) oder ein Ordner, in dem nur Reste oder nichts liegen; echte Dateien nie. */
const nurVerknuepfung = (x) => (x.kinder ? x.kinder.every(nurVerknuepfung) : x.istVerknuepfung === true)

/** Löst der Bash-Befehl einen PR-Merge aus? Zu großzügiges Erkennen kostet nur einen unnötigen (gesperrten) Abbaulauf. */
function istMerge(befehl) {
  return /(^|[\s;&|("'`\/])gh(\.exe)?["']?\s+pr\s+merge\b/.test(befehl ?? '')
}

/** Darf ein neuer Abbau starten? sperre: { pid, zeit } oder null. */
function sperreFrei(sperre, jetzt, lebt) {
  if (!sperre) return true
  if (jetzt - sperre.zeit > SPERRE_MAX_MS) return true
  return !lebt(sperre.pid)
}

/** Warnzeile für den Sitzungsstart; null bis einschließlich WARN_AB. */
function warnzeile(anzahl) {
  return anzahl > WARN_AB ? `Worktree-Wächter: ${anzahl} Worktrees (Grenze ${WARN_AB}); Abbau läuft im Hintergrund, Rest: node ~/.claude/hooks/worktree-aufraeumen.js --liste` : null
}

module.exports = { SCHONFRIST_MS, SCHONFRIST_PR_MS, WARN_AB, SPERRE_MAX_MS, leseWorktrees, bewertePr, entscheide, bewerteLosen, nurVerknuepfung, istMerge, sperreFrei, warnzeile, istWtName, norm }
