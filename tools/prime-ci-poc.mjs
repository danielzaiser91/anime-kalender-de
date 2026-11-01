// PoC (01.11.2026): liefert Amazon die Prime-Titelseite an einen GitHub-Runner?
// Fünf Seiten, je einmal, Pause 5 s, kein Cookie, keine Anmeldung. Misst Status, Größe,
// Robot-Check und audioTracks je Folge; Gegenprobe gegen data/prime-zugeordnet.json.
// Die Leselogik ist eine Kopie von ausHydration() in extension/amazon-leser.js (Kopf + Folgen).
import fs from 'node:fs'

const SEITEN = [
  'https://www.amazon.de/dp/B0CK5N448R',
  'https://www.amazon.de/dp/B09MDQX4CW',
  'https://www.amazon.de/dp/B0F9FWKDXT',
  'https://www.amazon.de/gp/video/detail/amzn1.dv.gti.8ca9f6c3-21de-5225-749f-931196618766',
  'https://www.amazon.de/dp/B0C93YWD34',
]
const PAUSE_MS = 5000
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Safari/537.36'

const namen = (s) => (Array.isArray(s) ? s.map((x) => (typeof x === 'string' ? x : (x?.displayName ?? x?.language))).filter(Boolean) : [])

export function leseSeite(html) {
  const m = /<script id="dv-web-page-hydration-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)
  if (!m) return null
  let d
  try {
    d = JSON.parse(m[1])
  } catch {
    return { fehler: 'JSON kaputt' }
  }
  const body = d?.init?.preparations?.body
  const oben = body?.atf?.state
  const unten = body?.btf?.state
  if (!oben) return { fehler: 'kein atf' }
  const koepfe = { ...(oben.detail?.detail ?? {}), ...(oben.detail?.headerDetail ?? {}) }
  const kopf = koepfe[oben.pageTitleId] ?? Object.values(oben.detail?.headerDetail ?? {})[0] ?? Object.values(koepfe).find((x) => x?.audioTracks?.length)
  const folgen = []
  for (const e of Object.values(unten?.detail?.detail ?? {})) {
    if (e?.titleType !== 'episode' || !Number.isFinite(e.episodeNumber)) continue
    folgen.push({ nummer: e.episodeNumber, sprachen: namen(e.audioTracks) })
  }
  folgen.sort((a, b) => a.nummer - b.nummer)
  return { titel: kopf?.title ?? null, kopfSprachen: namen(kopf?.audioTracks), folgen }
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms))
const deutsch = (sp) => sp.some((s) => /^Deutsch$/.test(s))

async function main() {
  const soll = JSON.parse(fs.readFileSync('data/prime-zugeordnet.json', 'utf8'))
  const zeilen = []
  for (const [i, url] of SEITEN.entries()) {
    if (i > 0) await warte(PAUSE_MS)
    const z = { url }
    try {
      const r = await fetch(url, { headers: { 'user-agent': UA, 'accept-language': 'de-DE,de;q=0.9', accept: 'text/html,application/xhtml+xml;q=0.9,*/*;q=0.8' }, redirect: 'manual', signal: AbortSignal.timeout(30000) })
      const text = await r.text()
      z.status = r.status
      z.bytes = text.length
      z.ort = r.headers.get('location')
      z.captcha = /captcha|Robot Check|api-services-support@amazon|automated access/i.test(text)
      z.audioTracksImText = (text.match(/"audioTracks"/g) ?? []).length
      const s = leseSeite(text)
      z.gelesen = s
      const erwartet = soll[url]?.folgen ?? []
      if (s?.folgen) {
        z.folgenAnzahl = s.folgen.length
        z.folgenDeutsch = s.folgen.filter((f) => deutsch(f.sprachen)).length
        const ref = new Map(erwartet.filter((f) => f.unsere != null).map((f) => [f.unsere, deutsch(f.sprachen ?? [])]))
        z.gegenprobe = { verglichen: 0, abweichend: [] }
        for (const f of s.folgen) {
          if (!ref.has(f.nummer)) continue
          z.gegenprobe.verglichen++
          if (ref.get(f.nummer) !== deutsch(f.sprachen)) z.gegenprobe.abweichend.push(f.nummer)
        }
      } else if (s?.kopfSprachen) {
        z.gegenprobe = { kopfDeutsch: deutsch(s.kopfSprachen), erwartetDeutsch: erwartet.length ? deutsch(erwartet[0].sprachen ?? []) : null }
      }
      if (!s) z.kopf = text.slice(0, 300).replace(/\s+/g, ' ')
    } catch (err) {
      z.fehler = String(err?.message ?? err)
    }
    zeilen.push(z)
    console.log(JSON.stringify(z))
  }
  console.log('PRIME-POC ENDE', zeilen.length, 'Seiten,', zeilen.filter((z) => z.status === 200 && z.gelesen && !z.captcha).length, 'lesbar')
}

if (process.argv[1]?.endsWith('prime-ci-poc.mjs')) await main()
