/**
 * Gegenprobe zu den 287 Verweisen, die entfernt wurden, weil der deutsche
 * Katalog "unter dieser Kennung keine einzige Staffel" führt.
 *
 * Die Kennung kann falsch sein — genau daran scheiterte Detektiv Conan
 * (englischer Slug -> englischer Eintrag -> "kein Deutsch"). Geprüft wird
 * deshalb über die *Suche*, mit allen Titelschreibweisen, die wir führen.
 */
import { readFileSync, writeFileSync } from 'node:fs'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const STICHPROBE = Number(process.argv[2] ?? 40)

const entfernt = JSON.parse(readFileSync('data/verweise-entfernt.json', 'utf8')).verweise
  .filter((v) => /keine einzige Staffel/.test(v.grund) && v.letzterWeg)
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const jeId = new Map(titles.map((t) => [t.id, t]))

const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA,
  },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch, sonst misst es den US-Katalog.'); process.exit(1) }

const norm = (s) => (s ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '')
const funde = []
let geprueft = 0

for (const v of entfernt.slice(0, STICHPROBE)) {
  const t = jeId.get(v.titleId)
  if (!t) continue
  geprueft++
  const namen = [...new Set([t.titleDe, t.titleEn, t.titleRomaji].filter(Boolean))]
  let treffer = null
  for (const n of namen) {
    const r = await fetch(
      `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(n)}&n=6&type=series&locale=de-DE`,
      { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } },
    ).then((x) => x.json()).catch(() => null)
    const items = r?.data?.[0]?.items ?? []
    /* Nur ein Treffer, dessen Name wirklich unserem entspricht — kein Ähnlichkeitsraten. */
    const passt = items.find((i) => namen.some((n2) => norm(i.title) === norm(n2)))
    await new Promise((r) => setTimeout(r, 700))
    if (passt) { treffer = passt; break }
  }
  if (treffer) {
    const md = treffer.series_metadata ?? {}
    funde.push({
      titleId: v.titleId,
      titel: t.titleDe ?? t.titleEn,
      alteKennung: v.seriesId,
      neueKennung: treffer.id,
      crTitel: treffer.title,
      folgen: md.episode_count ?? null,
      audio: md.audio_locales ?? [],
      deutsch: (md.audio_locales ?? []).includes('de-DE'),
    })
    console.log(`FUND  ${t.titleDe ?? t.titleEn}  ${v.seriesId} -> ${treffer.id}  ${(md.audio_locales ?? []).join(',')}`)
  }
}

console.log(`\n${geprueft} geprüft, ${funde.length} doch im deutschen Katalog, davon ${funde.filter((f) => f.deutsch).length} mit de-DE`)
writeFileSync('data/cr-wiedergefunden.json', JSON.stringify(funde, null, 2) + '\n')
