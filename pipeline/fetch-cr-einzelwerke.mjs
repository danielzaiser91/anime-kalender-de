/**
 * **Filme, OVAs und Specials im deutschen Crunchyroll-Katalog suchen.**
 *
 * `tools/cr-kennungen-suchen.mjs` sucht mit `type=series` — Filme findet es
 * deshalb nie. Genau die machen aber den Großteil der offenen Verweise aus: Am
 * 29.08.2026 hatten 26 der 56 offenen Crunchyroll-Verweise **keine
 * Serienkennung**, davon 18 Filme, 5 OVAs, 3 Specials.
 *
 * Ohne Typ-Filter gesucht, findet der Katalog sie als `movie_listing` — mit
 * ihren Tonspuren. Gemessen: **8 von 26 tragen `de-DE`**, darunter die drei
 * Project-Itoh-Filme, „Ride Your Wave" und „Kase-san and Morning Glories".
 *
 * **Der Namensvergleich ist exakt**, nicht ähnlich: Verglichen wird nach
 * Kleinschreibung ohne Sonderzeichen, und nur ein Volltreffer zählt. Ein
 * Beinahe-Treffer wäre hier besonders teuer, weil ein Film keinen zweiten
 * Prüfstein hat — keine Folgenzahl, keine Staffelstruktur.
 *
 * **Nur aus Deutschland.** Das anonyme Token trägt die Region der abrufenden
 * IP; aus den USA käme der US-Katalog, und dessen Schweigen belegt nichts
 * (CLAUDE.md). Der Lauf bricht ab, wenn `country` nicht `DE` ist.
 *
 * Aufruf: `npm run data:cr-einzelwerke`
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { recordSource } from './lib/health.ts'
import { formeFund, offeneOhneSerienkennung, suchNamen, trefferInAntwort, zeichenVon, zusammenfassung } from './lib/cr-einzelwerke-lauf.ts'

const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0 Safari/537.36'
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const cr = JSON.parse(readFileSync('data/crunchyroll-dub.json', 'utf8'))

const offen = offeneOhneSerienkennung(titles, cr)
console.log(`${offen.length} Verweise ohne Serienkennung`)

const tok = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
  method: 'POST',
  headers: {
    Authorization: 'Basic ' + Buffer.from('noaihdevm_6iyg0a8l0q:').toString('base64'),
    'Content-Type': 'application/x-www-form-urlencoded',
    'User-Agent': UA,
  },
  body: 'grant_type=client_id',
}).then((r) => r.json())
if (tok.country !== 'DE') { console.error('Nicht aus Deutschland — Abbruch.'); process.exit(1) }
console.log('Token für', tok.country)

const funde = []
for (const o of offen) {
  const namen = suchNamen(o)
  let treffer = null
  for (const n of namen) {
    const r = await fetch(
      `https://beta-api.crunchyroll.com/content/v2/discover/search?q=${encodeURIComponent(n)}&n=8&locale=de-DE`,
      { headers: { Authorization: `Bearer ${tok.access_token}`, 'User-Agent': UA } },
    ).then((x) => x.json()).catch(() => null)
    await new Promise((r2) => setTimeout(r2, 700))
    treffer = trefferInAntwort(r, namen)
    if (treffer) break
  }
  funde.push(formeFund(o, treffer))
  console.log(`  ${(o.format ?? '?').padEnd(7)} ${(o.titel ?? '').slice(0, 44).padEnd(46)} ${zeichenVon(treffer)}`)
}
writeFileSync('data/cr-einzelwerke.json', JSON.stringify(funde, null, 2) + '\n')
const { mitTreffer, zeilen } = zusammenfassung(funde)
for (const z of zeilen) console.log(z)

/*
  **Der Lauf meldet sich — sonst merkt niemand, dass er ausfällt.**

  Dieses Skript kann nur von einer deutschen IP laufen: Das anonyme Token trägt
  die Region der abrufenden Leitung, und aus den USA käme der US-Katalog, dessen
  Schweigen nichts belegt. Im wöchentlichen Cloud-Lauf brach es deshalb ab, und
  weil die drei cr-Skripte dort mit `&&` verkettet waren, riss es die beiden
  anderen mit. Gemessen am Lauf vom 31.08.2026: „Nicht aus Deutschland —
  Abbruch.", Exit 1 — und so jede Woche.

  Aufgefallen ist es erst am 02.09.2026, weil jemand die 36 offenen
  Crunchyroll-Verweise nachgezählt hat. Ein Skript, das sich nirgends meldet,
  kann beliebig lange nichts tun: `check-sources.ts` sieht nur, was in
  `data/source-health.json` steht.

  `leerIstOk` ist gesetzt, weil null Treffer hier ein gültiges Ergebnis sind —
  irgendwann ist jeder Verweis aufgelöst.
*/
recordSource('cr-einzelwerke', mitTreffer, undefined, undefined, true)
