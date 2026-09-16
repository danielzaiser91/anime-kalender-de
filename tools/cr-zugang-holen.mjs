/**
 * Ein Crunchyroll-Zugangspaket von dieser Leitung holen — und damit den
 * deutschen Katalog in die Cloud tragen.
 *
 * ## Warum es das gibt
 *
 * Crunchyroll leitet die Region aus der **IP des Abrufs** ab und schreibt sie in
 * zwei signierte Gebilde: das Token (`"country": "DE"`) und den CMS-Bucket
 * (`/DE/M2/-`). GitHub-Runner stehen in den USA und bekommen deshalb den
 * US-Katalog — für „Fairy Tail" meldet er `ja-JP, en-US`, während in Deutschland
 * 277 Folgen deutsch sind. Kein Parameter und kein Header ändert daran etwas
 * (20 Versuche, `docs/messung-crunchyroll-region.md`).
 *
 * Die CloudFront-Signatur enthält aber **nur eine Zeitbedingung, keine
 * IP-Bindung**. Ein Paket, das hier entsteht, trägt deshalb auch aus den USA —
 * gemessen am 22.08.2026 im Lauf 32537041109:
 *
 *     Fairy Tail (German Dub)          | ja-JP,de-DE
 *     Fairy Tail Staffel 2             | ja-JP,de-DE
 *     Fairy Tail Final Season          | ja-JP
 *
 * Genau der Stand, den Daniel von Hand gesehen hat.
 *
 * ## Zwei Dinge, die dabei mit auffielen
 *
 * - **`beta-api.crunchyroll.com` hat keine Bot-Sperre.** Derselbe Aufruf gegen
 *   `www.crunchyroll.com` endet in Cloudflares „Just a moment…" (HTTP 403) —
 *   auch von hier aus. Über die beta-api genügt ein gewöhnlicher `fetch`, kein
 *   Browser.
 * - **Das Bearer-Token braucht der CMS-Pfad nicht.** Die Signatur allein
 *   genügt, und sie gilt **24 Stunden** statt einer.
 *
 * ## Aufruf
 *
 *     node tools/cr-zugang-holen.mjs            # zeigt das Paket
 *     node tools/cr-zugang-holen.mjs --secret   # legt es als Repo-Secret ab
 *
 * Muss auf einem Rechner in Deutschland laufen. Kein Konto, keine
 * Anmeldedaten — das Token ist anonym.
 */
import { appendFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'

/*
  **In der Cloud über die Vercel-Weiche in Frankfurt** (16.09.2026, weiche-vercel/).
  Mit CR_WEICHE_TOKEN gehen beide Abrufe über sie; das Paket entsteht dann auf
  einem GitHub-Runner, ohne Daniels PC. `--github-env` legt es als
  CR_ZUGANG_FRISCH für die folgenden Schritte ab (maskiert), statt es auszugeben.
*/
const WEICHE = process.env.CR_WEICHE ?? 'https://cr-weiche.vercel.app/api/cr'
const WEICHE_TOKEN = process.env.CR_WEICHE_TOKEN
const holen = (url, init = {}) => {
  if (!WEICHE_TOKEN) return fetch(url, init)
  return fetch(`${WEICHE}?ziel=${encodeURIComponent(url)}`, {
    ...init,
    headers: { ...init.headers, 'x-weiche-token': WEICHE_TOKEN },
  })
}

const BASIS = 'https://beta-api.crunchyroll.com'
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'

const token = await holen(`${BASIS}/auth/v1/token`, {
  method: 'POST',
  headers: {
    authorization: 'Basic Y3Jfd2ViOg==',
    'content-type': 'application/x-www-form-urlencoded',
    'user-agent': UA,
  },
  body: 'grant_type=client_id',
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`Token: HTTP ${r.status}`))))

if (token.country !== 'DE') {
  console.error(`Dieser Rechner gilt Crunchyroll als "${token.country}", nicht als DE — Paket wäre wertlos.`)
  process.exit(1)
}

const index = await holen(`${BASIS}/index/v2`, {
  headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': UA },
}).then((r) => (r.ok ? r.json() : Promise.reject(new Error(`index/v2: HTTP ${r.status}`))))

const cms = index.cms ?? index.cms_web
const paket = {
  land: token.country,
  bucket: cms.bucket,
  policy: cms.policy,
  signature: cms.signature,
  key_pair_id: cms.key_pair_id,
  gueltig_bis: cms.expires,
}

console.log(`Zugangspaket für ${paket.land}, Bucket ${paket.bucket}, gültig bis ${paket.gueltig_bis}`)

if (process.argv.includes('--github-env')) {
  const wert = JSON.stringify(paket)
  console.log(`::add-mask::${paket.signature}`)
  console.log(`::add-mask::${paket.policy}`)
  appendFileSync(process.env.GITHUB_ENV, `CR_ZUGANG_FRISCH=${wert}\n`)
  console.log('Als CR_ZUGANG_FRISCH für die folgenden Schritte abgelegt.')
} else if (process.argv.includes('--secret')) {
  execFileSync('gh', ['secret', 'set', 'CR_ZUGANG', '--body', JSON.stringify(paket)], { stdio: 'inherit' })
  console.log('Als Repo-Secret CR_ZUGANG abgelegt.')
} else {
  console.log(JSON.stringify(paket))
}
