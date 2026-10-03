const fs = require('fs')
const zlib = require('zlib')
const A = 'tools/archiv/analyse-2026-10-02/'
const assoc = JSON.parse(zlib.gunzipSync(fs.readFileSync(A + 'api-associated-2026-10-03.json.gz')).toString())
const titles = JSON.parse(zlib.gunzipSync(fs.readFileSync(A + 'api-titles-2026-10-03.json.gz')).toString())
const tit = JSON.parse(fs.readFileSync('.claude-scratch-titles.json', 'utf8'))
const norm = (s) => (s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9]+/g, ' ').trim()
const gleich = (t, a) => {
  const namen = [t.titleRomaji, t.titleEn, t.titleNative].filter(Boolean).map(norm)
  const api = [a.main, a.ja, a['ja-kanji'], a.en].filter(Boolean).map(norm)
  return namen.some((n) => api.some((m) => n === m || (n.length > 6 && (m.startsWith(n) || n.startsWith(m)))))
}
const neu = []
let abw = null
for (const t of tit) {
  if (!t.malId) continue
  const a = assoc[String(t.malId)]
  if (!a) continue
  const ids = a.map(Number)
  if (!t.anisearchId) {
    const treffer = ids.map((id) => ({ id, a: titles[id] })).filter((x) => x.a)
    const ok = treffer.filter((x) => gleich(t, x.a) && Math.abs((x.a.year || 0) - (t.jpYear || 0)) <= 1)
    neu.push({ slug: t.slug, ids, jahr: t.jpYear, format: t.format, ok: ok.length, mehrere: ids.length, namen: treffer.map((x) => `${x.id}:${x.a.main}(${x.a.year})`).join(' | ') })
  } else if (!ids.includes(t.anisearchId)) abw = { slug: t.slug, manami: t.anisearchId, api: ids, apiNamen: ids.map((i) => titles[i] && titles[i].main), manamiName: titles[t.anisearchId] && titles[t.anisearchId].main, name: t.titleRomaji }
}
const gut = neu.filter((n) => n.ok === 1 && n.mehrere === 1)
const mehrdeutig = neu.filter((n) => n.mehrere > 1)
const unklar = neu.filter((n) => n.mehrere === 1 && n.ok !== 1)
console.log('neu über API:', neu.length, '| eindeutig und Name+Jahr passt:', gut.length, '| mehrere IDs (Teile/Bündel):', mehrdeutig.length, '| eine ID, aber Name/Jahr passt nicht:', unklar.length)
console.log('\nUNKLAR (Name oder Jahr passt nicht):\n' + unklar.map((n) => `${n.slug} (${n.jahr}, ${n.format}) -> ${n.namen}`).join('\n'))
console.log('\nMEHRERE IDs:\n' + mehrdeutig.map((n) => `${n.slug} (${n.jahr}, ${n.format}) -> ${n.namen}`).join('\n'))
console.log('\nABWEICHUNG:', JSON.stringify(abw))
