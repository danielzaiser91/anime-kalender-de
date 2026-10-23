const post = async (query, variables) => {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  })
  return r.json()
}
const bis = new Date().toISOString()
const von = new Date(Date.now() - 7 * 86_400_000).toISOString()
const probe = async (name, auswahl, filterFeld = 'datetime') => {
  const q = `query($k:String!,$v:Time!,$b:Time!){viewer{accounts(filter:{accountTag:$k}){${name}(limit:3,filter:{${filterFeld}_geq:$v,${filterFeld}_lt:$b}){${auswahl}}}}}`
  const a = await post(q, { k: process.env.CLOUDFLARE_ACCOUNT_ID, v: von, b: bis })
  const ok = a.errors?.length ? `FEHLER ${a.errors[0].message.slice(0, 150)}` : `ok ${JSON.stringify(a.data?.viewer?.accounts?.[0]?.[name] ?? null).slice(0, 200)}`
  console.log(`${name} {${auswahl}} -> ${ok}`)
}
await probe('workersInvocationsScheduled', 'scriptName cron status datetime cpuTimeUs')
for (const d of ['datetimeHour', 'usageModel', 'scriptVersion', 'dispatchNamespaceName', 'datetimeMinute', 'date']) {
  await probe('workersInvocationsAdaptive', `dimensions{${d}} sum{requests}`)
}
await probe('workersInvocationsAdaptive', 'dimensions{scriptName} sum{requests wallTime} quantiles{cpuTimeP99 wallTimeP99}')
