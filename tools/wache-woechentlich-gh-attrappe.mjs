// gh-Attrappe für tools/wache-woechentlich-prozess.test.mjs: antwortet auf `run list --workflow <datei> …` mit dem
// createdAt eines Erfolgs vor N Stunden. ATTRAPPE_STUNDEN="datei=N,…", sonst 1 h.
const args = process.argv.slice(2)
const workflow = args[args.indexOf('--workflow') + 1]
const tabelle = Object.fromEntries((process.env.ATTRAPPE_STUNDEN ?? '').split(',').filter(Boolean).map((e) => e.split('=')))
const stunden = Number(tabelle[workflow] ?? 1)
console.log(new Date(Date.now() - stunden * 3600e3).toISOString())
