// Reine Entscheidungslogik für hooks/worktree-aufraeumen.js (kein Dateizugriff, kein Prozess): was mit einem Worktree geschieht.
// Anlass 18.10.2026: 274 `_wt-*`-Worktrees à ~49 000 Dateien, Windows hielt ~8 KB Kernel-Dateicache je Datei (~3 GB RAM).

/** Änderungen jünger als das: dort arbeitet vielleicht noch ein Agent. */
const SCHONFRIST_MS = 2 * 60 * 60 * 1000
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
/** Nur Arbeitsbäume mit `_wt-`-Ordnernamen kommen in Frage — nie der Hauptordner. */
const istWtName = (pfad) => /\/_wt-[^/]+$/.test(norm(pfad))

/** Zweig → Stand; ein offener PR schlägt jeden anderen. `prs`: [{ headRefName, state }]. */
function prStandKarte(prs) {
  const karte = new Map()
  for (const p of prs) if (!karte.has(p.headRefName) || p.state === 'OPEN') karte.set(p.headRefName, p.state)
  return karte
}

/**
 * Entscheidung für einen Worktree: { aktion: 'weg' | 'prune' | 'behalten', grund }.
 * w: { pfad, zweig, kopf, existiert, juengsteAenderungMs }; ctx: { haupt, jetzt, prStand (Map), inMain(kopf), sauber(pfad) }.
 * Reihenfolge: billige Prüfungen zuerst, `sauber` (git status, berührt alle Dateien) nur für Kandidaten zum Entfernen.
 */
function entscheide(w, ctx) {
  if (norm(w.pfad) === norm(ctx.haupt)) return { aktion: 'behalten', grund: 'haupt' }
  if (!istWtName(w.pfad)) return { aktion: 'behalten', grund: 'fremd' }
  if (!w.existiert) return { aktion: 'prune', grund: 'ordner-fehlt' }
  if (ctx.jetzt - w.juengsteAenderungMs < SCHONFRIST_MS) return { aktion: 'behalten', grund: 'jung' }
  const pr = w.zweig ? ctx.prStand.get(w.zweig) : undefined
  if (pr === 'OPEN') return { aktion: 'behalten', grund: 'pr-offen' }
  let grund
  if (pr === 'MERGED' || pr === 'CLOSED') grund = `pr-${pr.toLowerCase()}`
  else if (w.kopf && ctx.inMain(w.kopf)) grund = 'in-main'
  else return { aktion: 'behalten', grund: 'ohne-pr' }
  if (ctx.sauber(w.pfad) !== true) return { aktion: 'behalten', grund: 'geaendert' }
  return { aktion: 'weg', grund }
}

/**
 * Loser `_wt-*`-Ordner ohne Git-Registrierung. eintraege: [{ name, istVerknuepfung }] (lstat, Verknüpfung nicht verfolgt).
 * Weg nur: leer, oder nur `node_modules` als Verknüpfung (Junction). Alles andere wird nur aufgelistet.
 */
function bewerteLosen(ordner) {
  if (ordner.jetzt - ordner.juengsteAenderungMs < SCHONFRIST_MS) return { aktion: 'behalten', grund: 'jung' }
  const e = ordner.eintraege
  if (e.length === 0) return { aktion: 'weg', grund: 'leer' }
  if (e.length === 1 && e[0].name === 'node_modules' && e[0].istVerknuepfung) return { aktion: 'weg', grund: 'nur-junction' }
  return { aktion: 'behalten', grund: 'inhalt' }
}

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

module.exports = { SCHONFRIST_MS, WARN_AB, SPERRE_MAX_MS, leseWorktrees, prStandKarte, entscheide, bewerteLosen, istMerge, sperreFrei, warnzeile, istWtName, norm }
