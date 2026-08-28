/**
 * Für Titel ohne Verweis nachsehen, ob Crunchyroll sie auf Deutsch führt.
 *
 * **Der Fall.** 1.331 Titel im Bestand haben keinen einzigen Verweis; für 101
 * davon nennt TMDB Crunchyroll als deutschen Anbieter. Der reguläre Lauf
 * (`data:cr-dub`) erreicht sie nicht — er arbeitet über Titel, die bereits einen
 * Crunchyroll-Verweis tragen.
 *
 * **Warum das hier läuft und nicht in der Cloud.** Crunchyroll leitet die Region
 * aus der IP ab. Ein GitHub-Runner steht in den USA und bekommt den US-Katalog,
 * in dem „Fairy Tail" nur `ja-JP, en-US` führt, während Daniel hier die Folgen 1
 * bis 277 auf Deutsch sieht. Die Suche muss von einer deutschen Leitung kommen —
 * dieselbe Ausnahme, die schon für `cr-zugang-holen.mjs` gilt.
 *
 * **Was hier nicht passiert.** Es entsteht kein Verweis und kein `dub`-Urteil.
 * Geschrieben wird `data/cr-vorschlaege.json`: je Titel die gefundene
 * Serienkennung und die Tonspuren, die Crunchyroll nennt. Was daraus wird,
 * entscheidet der Bau — und ein Treffer mit `de-DE` ist ein Beleg, ein fehlendes
 * `de-DE` nur dann, wenn die Antwort aus dem deutschen Katalog stammt.
 *
 * Aufruf: `node tools/cr-vorschlaege-pruefen.mjs [--limit N]`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const args = process.argv.slice(2)
const LIMIT = Number(args[args.indexOf('--limit') + 1]) || 120

const BASIC = Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64')

const schlaf = (ms) => new Promise((r) => setTimeout(r, ms))

async function token() {
  const r = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: { Authorization: `Basic ${BASIC}`, 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'grant_type=client_id',
  })
  if (!r.ok) throw new Error(`Token: HTTP ${r.status}`)
  const j = await r.json()
  return { zugang: j.access_token, land: j.country }
}

async function suche(zugang, begriff) {
  const url =
    'https://beta-api.crunchyroll.com/content/v2/discover/search' +
    `?q=${encodeURIComponent(begriff)}&n=6&type=series&locale=de-DE`
  const r = await fetch(url, { headers: { Authorization: `Bearer ${zugang}` } })
  if (!r.ok) return []
  const d = await r.json()
  return (d.data ?? []).flatMap((x) => x.items ?? [])
}

/** Kürzung wie beim Serienabgleich — Zusätze über die Tonspur fallen weg. */
const kurz = (t) =>
  (t ?? '')
    .toLowerCase()
    .replace(/\((german dub|dt\. opening|deutscher dub)\)/g, '')
    .replace(/[^a-z0-9]/g, '')

async function main() {
  const vorschlaege = JSON.parse(readFileSync(resolve(wurzel, 'data/anbieter-vorschlaege.json'), 'utf8'))
  const titel = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
  const arr = Array.isArray(titel) ? titel : (titel.titles ?? Object.values(titel))
  const jeId = new Map(arr.map((t) => [t.id, t]))

  const bestand = (() => {
    try {
      return JSON.parse(readFileSync(resolve(wurzel, 'data/cr-vorschlaege.json'), 'utf8'))
    } catch {
      return {}
    }
  })()

  const offen = vorschlaege
    .filter((v) => v.anbieter?.includes('crunchyroll'))
    .filter((v) => !bestand[v.id])
    .slice(0, LIMIT)

  if (!offen.length) {
    console.log('Nichts offen — alle Crunchyroll-Vorschläge sind geprüft.')
    return
  }

  const { zugang, land } = await token()
  if (land !== 'DE') {
    console.error(`Abbruch: Crunchyroll antwortet als "${land}", nicht als DE.`)
    console.error('Dieser Lauf muss von einer deutschen Leitung kommen — sonst kommt der US-Katalog.')
    process.exit(1)
  }
  console.log(`${offen.length} Vorschläge, Katalog ${land}`)

  let mitDeutsch = 0
  let ohneTreffer = 0

  for (const v of offen) {
    const t = jeId.get(v.id)
    /*
      Vier Schreibweisen, dieselbe Reihenfolge wie bei TMDB: Was zuerst trifft,
      gewinnt. Der japanische Titel steht hinten — er trifft selten, aber wenn,
      dann eindeutig.
    */
    const namen = [t?.titleDe, t?.titleEn, t?.titleRomaji, t?.titleNative].filter(Boolean)
    let treffer = null
    for (const n of namen) {
      const items = await suche(zugang, n)
      await schlaf(350)
      const genau = items.find((i) => kurz(i.title) === kurz(n))
      if (genau) {
        treffer = genau
        break
      }
    }

    if (!treffer) {
      bestand[v.id] = { titel: v.titel, gefunden: false, geprueftAm: new Date().toISOString().slice(0, 10) }
      ohneTreffer++
      continue
    }

    const spuren = treffer.series_metadata?.audio_locales ?? []
    const deutsch = spuren.includes('de-DE')
    if (deutsch) mitDeutsch++
    bestand[v.id] = {
      titel: v.titel,
      gefunden: true,
      seriesId: treffer.id,
      crTitel: treffer.title,
      spuren,
      deutsch,
      geprueftAm: new Date().toISOString().slice(0, 10),
    }
  }

  writeFileSync(resolve(wurzel, 'data/cr-vorschlaege.json'), JSON.stringify(bestand, null, 2) + '\n')
  console.log(
    `${offen.length} geprüft: ${mitDeutsch} mit deutscher Tonspur, ` +
      `${offen.length - mitDeutsch - ohneTreffer} gefunden ohne Deutsch, ${ohneTreffer} nicht gefunden`,
  )
  console.log(`Bestand jetzt ${Object.keys(bestand).length}`)
}

await main()
