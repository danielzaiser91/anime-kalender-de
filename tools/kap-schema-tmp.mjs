const post = async (query) => {
  const r = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${process.env.CLOUDFLARE_API_TOKEN}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query }),
  })
  return r.json()
}
const typ = async (name) => (await post(`{__type(name:"${name}"){name fields{name type{name kind ofType{name}}}}}`)).data?.__type
const konto = await typ('Account')
const felder = (konto?.fields ?? []).filter((f) => /workersInvocations/i.test(f.name))
for (const f of felder) {
  const t = f.type.name ?? f.type.ofType?.name
  console.log(`Account.${f.name}: ${t}`)
  const eintrag = await typ(t)
  console.log(`  ${(eintrag?.fields ?? []).map((x) => x.name).join(', ')}`)
  for (const sub of ['dimensions', 'sum', 'quantiles']) {
    const s = eintrag?.fields?.find((x) => x.name === sub)
    const st = s && (s.type.name ?? s.type.ofType?.name)
    if (st) console.log(`  ${sub} (${st}): ${((await typ(st))?.fields ?? []).map((x) => x.name).join(', ')}`)
  }
}
