/**
 * App-Token-Sperre (17.10.2026): Wer das Token der App anime-kalender-daten bekommt, legt diese Datei fest — strukturell, am geparsten YAML.
 * Warum: Nur die App mergt `main` am Ruleset `main-pruefweg` vorbei, und der Nachholer (`tools/daten-pr-mergen.sh`) mergt nur PRs, die sie angelegt hat.
 * Ein Weg zum Merge ohne Datenprüfung braucht also das Token. Eine Suche nach Befehlstext (`gh pr merge`) übersieht Array-Formen
 * (`execFileSync('gh', ['pr', 'merge'])`), Variablen und Anführungszeichen; diese Sperre fragt stattdessen, welcher Schritt das Token sieht.
 *  1. Die Secrets DATEN_APP_ID/KEY stehen nur als genauer Wert im `with` eines Schritts `actions/create-github-app-token@v3` (Job aus TOKEN_JOBS)
 *     oder der Aktion `einreichen`; kein `secrets: inherit`, kein `toJSON(secrets)`, kein `secrets[…]`.
 *  2. In einem Token-Job gibt genau ein Schritt das Token weiter (jede Nennung von `steps.<id>` zählt, auch in Job-Outputs), in fester Form je Art.
 *  3. In der Aktion `einreichen` sieht nur der Schritt `pr` das Token, und er ruft genau `tools/quellen-pr.sh`; keine andere Aktion holt ein App-Token.
 */
const APP_SCHRITT = 'actions/create-github-app-token@v3'
const EINREICHEN = '.github/actions/einreichen'
const SECRET_WERT = { 'app-id': '${{ secrets.DATEN_APP_ID }}', 'app-key': '${{ secrets.DATEN_APP_KEY }}', 'private-key': '${{ secrets.DATEN_APP_KEY }}' }

/**
 * Die einzigen Jobs, die das Token selbst holen, und was sie damit tun dürfen:
 *  - `checkout`: nur `actions/checkout` mit `token` (direkter Push auf main; der ganze Job ist Code von main und gilt als vertraut).
 *  - `daten-pr-mergen`: nur `bash tools/daten-pr-mergen.sh` (mergt nur App-PRs ohne Marke „[Prüfung rot]“).
 *  - `quellen-pr`: nur `tools/quellen-pr.sh` mit fester Nachricht, davor die Anmeldung für den Zweig-Push.
 */
export const TOKEN_JOBS = {
  'bestand-bauen.yml': { bauen: 'checkout' },
  'delta-wache.yml': { wache: 'checkout' },
  'claude-daten-merge.yml': { nachholen: 'daten-pr-mergen', zusammenfuehren: 'daten-pr-mergen' },
  'claude-anime2you-extraktion.yml': { lesen: 'quellen-pr' },
  'claude-verpasst-recherche.yml': { recherchieren: 'quellen-pr' },
  'claude-wache-urteil.yml': { urteilen: 'quellen-pr' },
}

const MERGEN_RUNS = ['bash tools/daten-pr-mergen.sh $NUMMERN', 'bash tools/daten-pr-mergen.sh ${NUMMERN//,/ }']
const ANMELDUNG = [
  'git config --local --unset-all http.https://github.com/.extraheader || true',
  'git remote set-url origin "https://x-access-token:${GH_TOKEN}@github.com/${GITHUB_REPOSITORY}.git"',
]
/* Feste Nachricht: In doppelten Anführungszeichen wirken nur `"`, `$`, Backtick, Backslash und `!` — keins davon darf vorkommen. */
const QUELLEN_PR_AUFRUF = /^bash tools\/quellen-pr\.sh "[^"$`\\!]*"$/
/* In der Aktion kommt die Nachricht über env: als `${{ inputs.nachricht }}` im Skripttext würde ein `"` im Wert Code (fund-nachliefern setzt `inputs.lauf` ein). */
export const QUELLEN_PR_AKTION = 'bash tools/quellen-pr.sh "$NACHRICHT"'
/* Job- und Workflow-env eines Jobs mit Token (auch über `einreichen`): NODE_OPTIONS oder BASH_ENV liefen sonst mit dem Token mit; `defaults` könnte die Shell tauschen. */
const UMGEBUNG = ['LAUF_ZWECK', 'LAUF_ZIEL', 'LAUF_SCHRITTE', 'LAUF_TOKEN', 'JOB_ANZEIGE']
const EINREICHEN_SCHLUESSEL = ['name', 'id', 'if', 'uses', 'with']
/* Schlüssel eines Weitergabe-Schritts: `shell`, `working-directory` oder fremde env (NODE_OPTIONS, BASH_ENV) könnten den Befehl umleiten. */
const RUN_SCHLUESSEL = ['name', 'id', 'if', 'env', 'run', 'continue-on-error', 'timeout-minutes']
const ENV_SCHLUESSEL = ['GH_TOKEN', 'FUND_DIR', 'NUMMERN']

const usesAlsPfad = (u) => String(u ?? '').replace(/@.*$/, '').replace(/^\.\//, '').replace(/\/$/, '')
const istAppSchritt = (s) => String(s?.uses ?? '').includes('create-github-app-token')

/** Alle Zeichenketten (Schlüssel und Werte) mit ihrem Pfad. */
function blaetter(wert, pfad = [], aus = []) {
  if (typeof wert === 'string') aus.push([pfad, wert])
  else if (wert && typeof wert === 'object') {
    for (const [k, v] of Object.entries(wert)) {
      aus.push([[...pfad, k], String(k)])
      blaetter(v, [...pfad, k], aus)
    }
  }
  return aus
}

/** Regel 1: Wo die Secrets der App stehen dürfen. */
function pruefeSecrets(datei, doc) {
  const fehler = []
  for (const [pfad, text] of blaetter(doc)) {
    if (/toJSON\(\s*secrets\s*\)|secrets\s*\[/.test(text)) fehler.push(`${datei}: liest Secrets als Ganzes (${text.trim().slice(0, 60)}) — das gäbe das App-Token frei`)
    if (!text.includes('DATEN_APP')) continue
    const [, job, , nr, , schluessel] = pfad
    const schritt = doc.jobs?.[job]?.steps?.[nr]
    const erlaubt =
      pfad.join('.') === `jobs.${job}.steps.${nr}.with.${schluessel}` && SECRET_WERT[schluessel] === text &&
      (usesAlsPfad(schritt?.uses) === EINREICHEN || (schritt?.uses === APP_SCHRITT && TOKEN_JOBS[datei]?.[job]))
    if (!erlaubt) fehler.push(`${datei}: nennt das App-Secret an ${pfad.join('.')} — erlaubt nur im with der Aktion einreichen oder eines Token-Jobs aus tools/app-token-sperre.mjs`)
  }
  for (const [job, j] of Object.entries(doc.jobs ?? {})) if (j.secrets !== undefined) fehler.push(`${datei}: Job ${job} reicht Secrets weiter (secrets:) — das App-Secret ginge mit`)
  return fehler
}

/** Prüft die Form des einen Weitergabe-Schritts je Art; `ausdruck` ist `${{ steps.<id>.outputs.token }}`. */
function formFehler(art, s, ausdruck) {
  if (art === 'checkout') {
    const ok = s.uses === 'actions/checkout@v4' && s.env === undefined && Object.keys(s.with ?? {}).every((k) => ['ref', 'token'].includes(k)) && s.with?.token === ausdruck
    return ok ? [] : ['nur actions/checkout@v4 mit with.token (und ref)']
  }
  const fehler = []
  if (Object.keys(s).some((k) => !RUN_SCHLUESSEL.includes(k))) fehler.push(`nur die Schlüssel ${RUN_SCHLUESSEL.join(', ')}`)
  if (s.env?.GH_TOKEN !== ausdruck || Object.keys(s.env ?? {}).some((k) => !ENV_SCHLUESSEL.includes(k))) fehler.push(`env nur ${ENV_SCHLUESSEL.join(', ')}, GH_TOKEN genau ${ausdruck}`)
  const zeilen = String(s.run ?? '').trim().split('\n').map((z) => z.trim())
  const passt =
    art === 'daten-pr-mergen'
      ? zeilen.length === 1 && MERGEN_RUNS.includes(zeilen[0])
      : QUELLEN_PR_AUFRUF.test(zeilen.at(-1)) && (zeilen.length === 1 || (zeilen.length === 3 && zeilen[0] === ANMELDUNG[0] && zeilen[1] === ANMELDUNG[1]))
  if (!passt) fehler.push(art === 'daten-pr-mergen' ? `run genau ${MERGEN_RUNS.join(' oder ')}` : 'run genau die Anmeldung und bash tools/quellen-pr.sh "<feste Nachricht>"')
  return fehler
}

/** Regel 2: Token-Jobs der Workflows. */
function pruefeTokenJobs(datei, doc) {
  const fehler = []
  for (const [job, j] of Object.entries(doc.jobs ?? {})) {
    const schritte = j.steps ?? []
    const holer = schritte.filter(istAppSchritt)
    const art = TOKEN_JOBS[datei]?.[job]
    const einreicher = schritte.filter((s) => usesAlsPfad(s.uses) === EINREICHEN)
    const umgebung = [...Object.keys(doc.env ?? {}), ...Object.keys(j.env ?? {})].filter((k) => !UMGEBUNG.includes(k))
    if ((holer.length || einreicher.length) && (umgebung.length || doc.defaults !== undefined || j.defaults !== undefined))
      fehler.push(`${datei}: Job ${job} holt ein App-Token${holer.length ? '' : ' (Aktion einreichen)'}; env nur ${UMGEBUNG.join(', ')} und keine defaults (gefunden: ${umgebung.join(', ') || 'defaults'})`)
    for (const s of einreicher) if (Object.keys(s).some((k) => !EINREICHEN_SCHLUESSEL.includes(k))) fehler.push(`${datei}: Job ${job}: der Schritt einreichen darf nur ${EINREICHEN_SCHLUESSEL.join(', ')} haben (seine env erbt der Schritt pr mit dem Token)`)
    if (!holer.length) {
      if (art) fehler.push(`${datei}: Job ${job} steht in TOKEN_JOBS, holt aber kein App-Token — Tabelle in tools/app-token-sperre.mjs nachführen`)
      continue
    }
    if (!art) fehler.push(`${datei}: Job ${job} holt ein App-Token, steht aber nicht in TOKEN_JOBS (tools/app-token-sperre.mjs)`)
    if (holer.length !== 1 || !holer[0].id || holer[0].uses !== APP_SCHRITT) {
      fehler.push(`${datei}: Job ${job} braucht genau einen Schritt ${APP_SCHRITT} mit id`)
      continue
    }
    const id = holer[0].id
    const nennt = new RegExp(`steps\\s*\\.\\s*${id}\\b|steps\\s*\\[|toJSON\\(\\s*steps`)
    const nenner = blaetter(j).filter(([, t]) => nennt.test(t)).map(([p]) => p.slice(0, 2).join('.'))
    const verbraucher = [...new Set(nenner)]
    if (verbraucher.length !== 1 || !/^steps\.\d+$/.test(verbraucher[0])) {
      fehler.push(`${datei}: Job ${job}: das App-Token sehen ${verbraucher.length} Stellen (${verbraucher.join(', ')}), erlaubt ist genau ein Schritt`)
      continue
    }
    const s = j.steps[Number(verbraucher[0].split('.')[1])]
    if (art) for (const f of formFehler(art, s, `\${{ steps.${id}.outputs.token }}`)) fehler.push(`${datei}: Job ${job}, Schritt „${s.name ?? s.uses ?? '?'}“ (${art}): ${f}`)
  }
  return fehler
}

/** Regel 3: In der Aktion einreichen sieht nur der Schritt `pr` das Token; andere Aktionen holen keins. */
function pruefeAktionen(aktionen) {
  const fehler = []
  for (const [name, doc] of Object.entries(aktionen)) {
    const holer = (doc?.runs?.steps ?? []).filter(istAppSchritt)
    if (name !== 'einreichen') {
      if (holer.length || blaetter(doc).some(([, t]) => t.includes('DATEN_APP'))) fehler.push(`.github/actions/${name}: holt oder nennt ein App-Token — nur die Aktion einreichen darf es`)
      continue
    }
    const schritte = doc.runs.steps
    const pr = schritte.find((s) => s.id === 'pr')
    const sicht = blaetter({ ...doc, runs: { ...doc.runs, steps: schritte.map((s) => (holer.includes(s) ? null : s)) } }).filter(([, t]) => /steps\s*\.\s*app\b|steps\s*\[|toJSON\(\s*steps|inputs\s*\.\s*app-|inputs\s*\[|toJSON\(\s*inputs/.test(t))
    const stellen = [...new Set(sicht.map(([p]) => p.slice(0, 3).join('.')))]
    const ok =
      holer.length === 1 && holer[0].id === 'app' && holer[0].uses === APP_SCHRITT &&
      holer[0].with?.['app-id'] === '${{ inputs.app-id }}' && holer[0].with?.['private-key'] === '${{ inputs.app-key }}' &&
      stellen.length === 1 && pr?.shell === 'bash' &&
      pr.run === QUELLEN_PR_AKTION && pr.env?.GH_TOKEN === '${{ steps.app.outputs.token }}' && pr.env.NACHRICHT === '${{ inputs.nachricht }}' &&
      Object.keys(pr.env).every((k) => [...ENV_SCHLUESSEL, 'NACHRICHT'].includes(k)) && Object.keys(pr).every((k) => [...RUN_SCHLUESSEL, 'shell'].includes(k))
    if (!ok) fehler.push(`.github/actions/einreichen: das App-Token darf nur der Schritt pr sehen (Stellen: ${stellen.join(', ') || 'keine'}), mit genau ${QUELLEN_PR_AKTION} und env.NACHRICHT`)
    for (const s of schritte) if (String(s.run).includes('${{')) fehler.push(`.github/actions/einreichen: Schritt „${s.name ?? s.id ?? '?'}“ setzt einen Ausdruck in den run-Text — Werte nur über env (ein Eingabewert mit " würde sonst Code)`)
  }
  return fehler
}

/** Eingabe: `workflows`, `aktionen` (Name → geparstes YAML). Ausgabe: Fehlertexte, leer = in Ordnung. */
export function pruefeAppToken({ workflows, aktionen }) {
  return [
    ...Object.entries(workflows).flatMap(([datei, doc]) => [...pruefeSecrets(datei, doc), ...pruefeTokenJobs(datei, doc)]),
    ...pruefeAktionen(aktionen),
  ]
}
