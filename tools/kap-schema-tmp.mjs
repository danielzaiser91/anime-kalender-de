const post = async (query, variables) => {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return r.json()
}
const bis = new Date().toISOString()
const von = new Date(Date.now() - 86_400_000).toISOString()
const probe = async (name, auswahl, filterFeld = 'datetime') => {
  const q = `query($k:String!,$v:Time!,$b:Time!){viewer{accounts(filter:{accountTag:$k}){${name}(limit:1,filter:{${filterFeld}_geq:$v,${filterFeld}_lt:$b}){${auswahl}}}}}`
  const a = await post(q, { k: process.env.CLOUDFLARE_ACCOUNT_ID, v: von, b: bis })
  const ok = a.errors?.length ? `FEHLER ${a.errors[0].message.slice(0, 150)}` : `ok ${JSON.stringify(a.data?.viewer?.accounts?.[0]?.[name] ?? null).slice(0, 200)}`
  console.log(`${name} {${auswahl}} -> ${ok}`)
}
for (const f of ['scriptName', 'cron', 'status', 'datetime', 'cpuTime', 'wallTime', 'cpuTimeUs', 'eventType', 'requests', 'errors', 'count', 'sum{requests}', 'quantiles{cpuTimeP99}', 'dimensions{scriptName}']) {
  await probe('workersInvocationsScheduled', f)
}
for (const f of ['dimensions{eventType}', 'dimensions{cron}', 'dimensions{scriptName eventType status}', 'dimensions{trigger}']) {
  await probe('workersInvocationsAdaptive', `${f} sum{requests}`)
}
