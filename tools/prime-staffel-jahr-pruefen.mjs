/**
 * **Gehört eine Prime-„Staffel N" wirklich zu unserer Staffel N?** (18.09.2026)
 *
 * Am 16.09.2026 wurden 15 Prime-Belege vom Reihenkopf an „ihre" Staffel gehängt —
 * entschieden über die Staffelnummer im Namen. Bei „Berserk" war das falsch: Prime
 * teilt die Serie von 1997 (25 Folgen) in zwei Staffeln, und „Staffel 2" mit 12
 * Folgen landete bei der CGI-Serie „Berserk: Staffel 2" von 2017. Die Prime-Seite
 * trägt `releaseYear: 1998` — das hätte es entschieden, die Staffelnummer nicht.
 *
 * Dieses Werkzeug holt für jeden Beleg mit „umgehängt" in der Notiz die Prime-Seite
 * und vergleicht ihr Erscheinungsjahr mit dem japanischen Jahr des Titels, an dem der
 * Beleg jetzt hängt, und mit dem des Reihenkopfs. Liegt die Seite näher am Kopf, ist
 * das Umhängen verdächtig.
 *
 * Holt je Beleg **eine** Titelseite, 1,5 s Abstand. Amazons robots.txt erlaubt
 * `/gp/video/detail/`; die Sperre für Massenabrufe greift erst nach Hunderten.
 *
 * Aufruf: node tools/prime-staffel-jahr-pruefen.mjs
 */
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import yaml from 'js-yaml'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const belege = yaml.load(readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8'))
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = new Map((Array.isArray(roh) ? roh : roh.titles).map((t) => [t.id, t]))
const katalog = (() => {
  try {
    const k = JSON.parse(readFileSync(resolve(wurzel, 'data/cache/anilist-katalog.json'), 'utf8'))
    return new Map((Array.isArray(k) ? k : Object.values(k)).map((t) => [t.id, t]))
  } catch {
    return new Map()
  }
})()

const jahrVon = (id) => titel.get(id)?.jpYear ?? katalog.get(id)?.seasonYear ?? katalog.get(id)?.startDate?.year
const kopfAus = (note) => Number(/von AniList (\d+) \(Reihenkopf\) umgehängt/.exec(note ?? '')?.[1] ?? 0)

const faelle = belege.filter((b) => b.platform === 'primevideo' && kopfAus(b.note) && b.url)
console.log(`${faelle.length} umgehängte Prime-Belege.\n`)

let verdacht = 0
for (const b of faelle) {
  const kopf = kopfAus(b.note)
  let jahr
  try {
    const antwort = await fetch(b.url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/128 Safari/537.36',
        'Accept-Language': 'de-DE',
      },
    })
    const text = await antwort.text()
    jahr = Number(/"releaseYear":(\d{4})/.exec(text)?.[1] ?? 0) || undefined
  } catch {
    /* bleibt undefined */
  }
  const hier = jahrVon(b.anilistId)
  const dort = jahrVon(kopf)
  const naeherAmKopf = jahr && hier && dort && Math.abs(jahr - dort) < Math.abs(jahr - hier)
  if (naeherAmKopf) verdacht++
  console.log(
    `${naeherAmKopf ? '✕' : jahr ? '✓' : '?'}  ${String(b.anilistId).padStart(6)} ${String(b.title).slice(0, 44).padEnd(44)} Seite ${jahr ?? '—'} · hier ${hier ?? '—'} · Kopf ${kopf} ${dort ?? '—'}`,
  )
  await new Promise((r) => setTimeout(r, 1500))
}
console.log(`\n${verdacht} Beleg(e) liegen näher am Reihenkopf als an ihrer jetzigen Staffel.`)
