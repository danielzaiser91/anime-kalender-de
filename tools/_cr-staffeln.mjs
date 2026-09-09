/** Was liefert die Staffel-Ebene für Kaguya-sama? */
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  body: 'grant_type=client_id',
}).then((r) => r.json())
console.log('Land:', tok.country)
const hol = (u) => fetch(u, { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } }).then((r) => r.json()).catch(() => null)

for (const [name, id] of [['Kaguya-sama', 'GRJ0J828Y'], ['Fruits Basket', 'G6ZJMGEXY'], ['Promised Neverland', 'GYVD2K1WY']]) {
  const r = await hol(`https://beta-api.crunchyroll.com/content/v2/cms/series/${id}/seasons?locale=de-DE`)
  console.log(`\n${name} (${id}) — ${r?.data?.length ?? 0} Staffeln`)
  for (const s of r?.data ?? []) {
    const versionen = [...new Set((s.versions ?? []).map((v) => v.audio_locale))]
    console.log(`   seq ${String(s.season_sequence_number ?? '?').padStart(3)} | ${String(s.number_of_episodes ?? '?').padStart(3)} Fg | ${(s.title ?? '').slice(0, 44).padEnd(44)} | ${versionen.join(',') || s.audio_locale}`)
  }
  await new Promise((x) => setTimeout(x, 700))
}
