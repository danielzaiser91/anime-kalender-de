/**
 * Aufteilung von `tools/tests-alle.mjs` auf mehrere CI-Jobs (`--teil k/n`, package.json `check:tests-1` und `check:tests-2`).
 * Die langsamen Tests zuerst abwechselnd, dann der Rest der Reihe nach: Teil k nimmt jeden n-ten. Die Teile sind disjunkt und ergeben zusammen alle Tests.
 */

/** `--teil k/n` aus den Argumenten: { k, n } (1 <= k <= n), null ohne die Option; sonst Fehler. */
export function leseTeil(argv) {
  const i = argv.indexOf('--teil')
  if (i < 0) return null
  const m = /^(\d+)\/(\d+)$/.exec(argv[i + 1] ?? '')
  const k = Number(m?.[1])
  const n = Number(m?.[2])
  if (!m || k < 1 || k > n) throw new Error(`--teil verlangt k/n mit 1 <= k <= n, gefunden: ${argv[i + 1] ?? '(nichts)'}`)
  return { k, n }
}

/** Die Tests von Teil k (Reihenfolge wie in `tests`); `langsam` = Namen, die gleichmäßig verteilt werden. */
export function waehleTeil(tests, { k, n }, langsam = []) {
  const vorn = langsam.filter((t) => tests.includes(t))
  const folge = [...vorn, ...tests.filter((t) => !vorn.includes(t))]
  const meine = new Set(folge.filter((_, p) => p % n === k - 1))
  return tests.filter((t) => meine.has(t))
}
