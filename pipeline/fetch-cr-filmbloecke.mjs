/**
 * **Filme und Specials über ihren eigenen Block im deutschen Katalog belegen.**
 *
 * Daniel am 29.08.2026: „wenn der lauf gesamten crunchy bestand hat und alles
 * sammelt, wieso kannst du dann nicht alle fragen selbst lösen? … also such
 * sicher, nicht grob."
 *
 * Der Schluss stimmt, und der Weg führt über eine Struktur, die wir bis dahin
 * nicht genutzt haben: Crunchyroll führt **Filmreihen als eigene Serie**, und
 * jeder Film ist dort ein Block mit eigener Sprachangabe. Gemessen:
 *
 *     G4PH0WMN7  Fairy Tail Movies
 *       GRGGCVMMK  Fairy Tail Movie 2 - Dragon Cry           de-DE, ja-JP
 *       G609CX33Q  Fairy Tail Movie 1 - Phoenix Priestess    ja-JP, de-DE
 *
 * Unser offener Eintrag heißt „Fairy Tail: The Movie - Phoenix Priestess" — der
 * zweite Block ist er. Dass die Serie „Fairy Tail" 175 deutsche Folgen hat,
 * sagt darüber nichts; der Block sagt es.
 *
 * **Verglichen wird das Kennwort, nicht der ganze Name.** „Phoenix Priestess"
 * steht in beiden Titeln; alles davor ist Reihenname und Nummerierung, und die
 * schreibt jede Seite anders („The Movie" gegen „Movie 1"). Das Kennwort muss
 * mindestens sechs Zeichen haben — sonst träfe „Teil 2" auf jeden zweiten Film.
 *
 * **Was nicht funktioniert, und warum es hierher gehört:** Der japanische
 * Originaltitel taugt bei Crunchyroll nicht als Suchanker. Vier Fälle geprüft,
 * kein einziger Treffer — die Suche indiziert nur lokalisierte Titel
 * („Gyakusatsu Kikan" findet KONOHANA KITAN). Und das Jahr in der Antwort ist
 * das der Aufnahme ins Angebot, nicht der Erstausstrahlung: „Ride Your Wave"
 * von 2019 steht dort mit 2021. Als Prüfstein ist beides unbrauchbar.
 *
 * Aufruf: npm run data:cr-filmbloecke
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { recordSource } from './lib/health.ts'
import { kennwortRoh } from './lib/cr-kennwort.ts'
import { sleep } from './lib/util.ts'
import { blockTreffer, bloeckeAusAntwort, folgenTreffer, fuehreZusammen, offeneFilme, reiheVon, sammleSerienIds, zaehlzeilen, zeichenVon } from './lib/cr-filmbloecke-lauf.ts'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const cr = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8'))

const offen = offeneFilme(titles, cr)
console.log(`${offen.length} offene Filme/OVAs/Specials`)

const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: { Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'), 'Content-Type': 'application/x-www-form-urlencoded', 'User-Agent': UA },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch.'); process.exit(1) }
const hol = (u) => fetch(u, { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } }).then((r) => r.json()).catch(() => null)

const blockCache = new Map()
async function bloeckeVon(serienId) {
  if (blockCache.has(serienId)) return blockCache.get(serienId)
  const r = await hol(`https://beta-api.crunchyroll.com/content/v2/cms/series/${serienId}/seasons?locale=de-DE`)
  await sleep(700)
  const bl = bloeckeAusAntwort(r)
  blockCache.set(serienId, bl)
  return bl
}

const funde = []
for (const o of offen) {
  const namen = [o.titel, o.en, o.romaji].filter(Boolean)
  /* Kandidaten-Serien: die eigene Kennung, dazu die Suche nach „<Reihe> Movies". */
  const serienIds = new Set()
  if (o.serie?.seriesId) serienIds.add(o.serie.seriesId)
  const reihe = reiheVon(o)
  for (const frage of [`${reihe} Movies`, reihe]) {
    const s = await hol(`https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(frage)}&n=8&type=series&locale=de-DE`)
    await sleep(700)
    sammleSerienIds(serienIds, s, reihe)
    if (serienIds.size > 3) break
  }

  /* In den Blöcken den Film suchen — über sein Kennwort, nicht über den ganzen Namen. */
  let treffer = null
  for (const sid of serienIds) {
    treffer = blockTreffer(sid, await bloeckeVon(sid), namen)
    if (treffer) break
  }
  /*
    **Dritter Weg: die OVA ist eine Folge, keine Serie.**

    „TONIKAWA: Over The Moon For You ~Uniform~" führt Crunchyroll als Episode
    innerhalb der Serie — und die Episode nennt in `versions` alle ihre
    Sprachfassungen, `de-DE` eingeschlossen. Gemessen am 29.08.2026: Zehn
    Treffer für dieselbe Folge, einer je Tonspur, und jeder trägt dieselbe
    vollständige `versions`-Liste.

    **Zwei Merkmale müssen zusammen passen**, sonst gilt der Treffer nicht: der
    Serienname und das Kennwort im Episodentitel. „Uniform" allein wäre zu
    wenig — in einer Serie mit fünfzig Folgen heißt leicht mehr als eine so.
  */
  if (!treffer) {
    const s2 = await hol(
      `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(`${reihe} ${kennwortRoh(o.titel ?? o.en)}`)}&n=12&type=episode&locale=de-DE`,
    )
    await sleep(700)
    treffer = folgenTreffer((s2?.data ?? []).flatMap((g) => g.items ?? []), reihe, namen)
  }

  funde.push({ ...o, serie: undefined, treffer })
  const z = zeichenVon(treffer)
  console.log(`  ${(o.format ?? '?').padEnd(7)} ${(o.titel ?? o.en ?? '').slice(0, 42).padEnd(44)} ${z.padEnd(8)} ${treffer ? treffer.blockTitel.slice(0, 34) : ''}`)
}

/*
  **Zusammengeführt, nicht ersetzt — sonst löscht dieser Lauf seinen eigenen
  Ertrag.**

  Die Kandidatenliste oben nimmt nur Titel **ohne** Urteil (`s.dub !== undefined`
  → überspringen). Wer beim letzten Lauf gefunden wurde und dadurch ein
  `dub: true` bekam, ist diesmal also kein Kandidat mehr. Wurde die Datei danach
  komplett neu geschrieben, fiel er heraus — beim nächsten Bau fehlte sein
  Beleg, er stand wieder ohne Urteil da, und beim übernächsten Lauf war er
  wieder Kandidat. Ein Kreislauf, der bei jedem Durchgang Belege kostet.

  Gemessen am 03.09.2026: Der Lauf vom Vortag (`f460e90c`, „13 neue Belege") hat
  die Datei von 32 auf 25 Einträge gebracht und dabei **15** Treffer verloren —
  darunter „Detektiv Conan: Der Magier des letzten Jahrhunderts", den Daniel am
  selben Tag mit „Synchro | Untertitel" auf der Crunchyroll-Seite belegt hat. Der
  Beleg war nie falsch; er war nur nicht mehr in der Datei.

  Das ist die Regel aus `CLAUDE.md` in ihrer schärfsten Form: **Ein Lauf ergänzt
  und berichtigt — er löscht keine Metadaten.**
*/
const vorher = (() => {
  try {
    return JSON.parse(readFileSync('data/cr-filmbloecke.json', 'utf8'))
  } catch {
    return []
  }
})()
/* Ein Lauf ohne Treffer überschreibt keinen alten Treffer: ein Schweigen ist kein Nein. */
const { gesamt, neuDazu, ersetzt, behalten } = fuehreZusammen(vorher, funde)
console.log(
  `\n${neuDazu} neu, ${ersetzt} aktualisiert, ${behalten} alter Treffer gegen ein Schweigen behalten, ` +
    `${gesamt.length} Einträge insgesamt`,
)
writeFileSync('data/cr-filmbloecke.json', JSON.stringify(gesamt, null, 2) + '\n')
const { mit, zeilen } = zaehlzeilen(funde)
for (const z of zeilen) console.log(z)

/* Warum der Lauf sich meldet: siehe `fetch-cr-einzelwerke.mjs` — dasselbe gilt hier. */
recordSource('cr-filmbloecke', mit, undefined, undefined, true)
