/**
 * Erzeugt `data/synchron-forum-treffer.yaml` aus der Synchron-Forum-Liste (einmalig; die Liste ist auf Stand 24.12.2023 eingefroren).
 * Aufruf: node tools/synchron-forum-treffer.mjs <liste.tsv> [--pruefen] — `--pruefen` druckt nur die Zeilen, die von Hand zu entscheiden sind.
 * Namensabgleich wie `bewerteTreffer` (pipeline/lib/adn.ts): Wortmengen, der beste Treffer gewinnt; Jahr höchstens 2 daneben,
 * Folgenzahl muss zur AniList-Angabe passen. Unscharfes und Mehrdeutiges entscheidet `HAND` (null = lieber unzugeordnet).
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const daten = (n) => JSON.parse(readFileSync(resolve(ROOT, 'public/data', n), 'utf8'))

/** Von Hand entschiedene Zeilen: Listentitel|Jahr -> AniList-ID oder null (nicht zuordnen). */
const HAND = {
  'Gamera: Rebirth|2023': 160831,
  'Petit Play It Cool, Guys|2023': 162716,
  'Arifureta: From Commonplace to World’s Strongest OVA 2|2022': null,
  'Arifureta: From Commonplace to World’s Strongest: Über Umwege zum …|2022': null,
  'Bastard!! Der Gott der Zerstörung|2022': 144677,
  'Bastard!! Der Gott der Zerstörung: Teil 2|2022': 10017505,
  'Bibliophile Princess (Eliana: Prinzessin der Bücher)|2022': 144533,
  'JoJo’s Bizarre Adventure: Stone Ocean (Teil 2)|2022': null,
  'JoJo’s Bizarre Adventure: Stone Ocean (Teil 3)|2022': 10017775,
  'Kaguya-sama: Love Is War - The First Kiss That Never Ends|2022': null,
  'Magia Record: Puella Magi Madoka Magica Side Story Final Season - Dawn of …|2022': 136080,
  'Miss Kobayashi’s Dragon Maid S: Japanische Gastfreundschaft OVA|2022': 136436,
  'My Isekai Life: I Gained a Second Character Class and Became the Strongest Sage …|2022': 129192,
  'Free! The Final Stroke|2021': [107203, 133124],
  'Princess Principal: Crown Handler|2021': [101595, 129759, 137612],
  'That Time I Got Reincarnated as a Slime: Veldoras Tagebuch 2|2021': null,
  'Burn the Witch|2020': 116673,
  'Date a Bullet|2020': 111852,
  'Fate/Grand Order: The Movie - Divine Realm of the Round Table: Camelot|2020': [103276, 103277],
  'Psycho-Pass 3: First Inspector|2020': 113917,
  'Special 7: Special Crime Investigation Unit - Ein Jahr zuvor: Die Leiden …|2020': null,
  'Meine Wiedergeburt als Schleim in einer anderern Welt OAD|2019': 106509,
  'Psycho-Pass: Sinners of the System|2019': [102649, 104382],
  'That Time I Got Reincarnated as a Slime: Veldoras Tagebuch|2019': null,
  'Flavors of Youth: Liebe in Shanghai|2018': 101231,
  'K: Seven Stories|2018': 21798,
  'Code Geass: Lelouch of the Rebellion (Filme)|2017': [101811, 101812, 101813],
  'Fate/Stay Night: Heaven’s Feel|2017': [20791, 21718],
  'Free! Take Your Marks|2017': 98497,
  'Free! The Movie: Timeless Medley|2017': [98495, 98496],
  'Girls und Panzer: Das Finale|2017': [99938, 107208],
  'Recovery of an MMO Junkie 2 OVAS|2017': null,
  'Saekano: How to Raise a Boring Girlfriend.flat OVA|2017': null,
  'Thus Spoke Kishibe Rohan: Das Millionärsdorf|2017': null,
  'Unterm Wolkenhimmel: Laughing Under the Clouds - Gaiden|2017': [98452, 99196, 99197],
  '91 Days|2016': 21711,
  'Kabaneri of the Iron Fortress: Compilation Movies|2016': null,
  'Digimon Adventure tri.|2015': [20802, 21500, 21596, 97734],
  'One Piece: Episode of Sabo - Das Band der 3 Brüder, die wundersame Wiedervereinigung …|2015': 21230,
  'Love, Chunibyo & Other Delusions: Heart Throb - Offenbarung des wahren Auges …|2014': 20889,
  'Ghost in the Shell: Arise|2013': null,
  'Hakuoki: Demon of the Fleeting Blossom|2013': null,
  'Love, Chunibyo & Other Delusions! Extra Episode - Funkelndes …|2013': 16934,
  'Maken-Ki! Battling Venus: Staffel 2 - OVA|2013': null,
  'Berserk: Das Goldene Zeitalter|2012': [10218, 12113, 12115],
  'Code Geass: Akito the Exiled|2012': [8888, 15197],
  'Detektiv Conan: Der elfte Stürmer|2012': 12117,
  'One Piece: Episode of Nami - Die Tränen der Navigatorin. Die Verbundenheit …|2012': 15323,
  'Appleseed XIII: Tartaros & Ouranos|2011': null,
  'Spirit of Wonder (Specials)|2001': 2420,
  'Reporter Blues|1991': 10003873,
  'Ranma 1/2 (Staffel 2+)|1989': 149939,
  'Odysseus 31|1988': 2331,
  'Das Ende aller Tage (Null-Zeit – Der III. Weltkrieg)|1982': 8584,
}

const KURZ = new Set(['ova', 'ona', 'oad', 'tv'])
const STOP = new Set(['staffel', 'teil', 'zweite', 'dritte', 'vierte', 'funfte', 'season', 'part', 'zweiter', 'dritter'])
const tokens = (s) => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').split(/[^a-z0-9]+/).filter(Boolean)
const wortmenge = (s, voll) => new Set(tokens(s).filter((x) => (voll ? true : x.length >= 4 || KURZ.has(x)) && !STOP.has(x)))
const FORMATE = { Film: ['MOVIE'], OVA: ['OVA', 'ONA', 'SPECIAL'], 'TV-Serie': ['TV', 'TV_SHORT', 'ONA'], Web: ['ONA', 'TV'], 'TV-Spezial': ['SPECIAL', 'TV', 'MOVIE'], Bonus: ['SPECIAL', 'OVA'], Anderes: ['SPECIAL', 'OVA', 'ONA'] }

function ladeTitel() {
  const syn = daten('synonyme.json')
  const alle = [...daten('titles.json').map((t) => ({ ...t, menge: 'haupt' })), ...daten('ohne-synchro.json').map((t) => ({ ...t, menge: 'ohne' }))]
  const index = new Map()
  for (const [i, t] of alle.entries()) {
    const namen = [t.titleRomaji, t.titleEn, t.titleDe, ...(syn[t.id] ?? [])].filter(Boolean)
    t.varianten = []
    t.vollMengen = namen.map((n) => wortmenge(n, true))
    for (const n of namen) {
      let s = wortmenge(n)
      if (!s.size) s = wortmenge(n, true)
      if (!s.size) continue
      t.varianten.push(s)
      for (const x of s) (index.get(x) ?? index.set(x, new Set()).get(x)).add(i)
    }
  }
  return { alle, index }
}

const jaccard = (a, b) => { let sh = 0; for (const x of b) if (a.has(x)) sh++; return sh / (a.size + b.size - sh) }

function liesListe(pfad) {
  return readFileSync(pfad, 'utf8').split(/\r?\n/).slice(2).filter((l) => l.trim()).map((l) => {
    const c = l.split('\t')
    return { name: c[0], fmt: c[1], eps: Number(c[2]) || 0, jahr: Math.round(+c[3]), sender: c[5] }
  })
}

function kandidaten(r, { alle, index }) {
  const marker = /staffel|season|\bteil\b|\bpart\b|\d\s*$|zweite|dritte|vierte/i.test(r.name)
  let A = wortmenge(r.name)
  if (!A.size) A = wortmenge(r.name, true)
  const voll = wortmenge(r.name, true)
  const ids = new Set()
  for (const x of A) for (const i of index.get(x) ?? []) ids.add(i)
  const kand = []
  for (const i of ids) {
    const t = alle[i]
    let sim = 0, sc = -1e9
    for (const B of t.varianten) {
      const sh = [...B].filter((x) => A.has(x)).length
      if (4 * sh - A.size - B.size > sc) { sc = 4 * sh - A.size - B.size; sim = sh / (A.size + B.size - sh) }
    }
    if (sim < 0.6 || Math.max(...t.vollMengen.map((B) => jaccard(voll, B))) < 0.5) continue
    const d = t.jpYear ? Math.abs(t.jpYear - r.jahr) : 99
    const stufe = d <= 2 ? 'direkt' : marker && t.jpYear && t.jpYear <= r.jahr + 1 ? 'basis' : null
    if (!stufe) continue
    const folgen = r.eps && t.episodes ? Math.max(r.eps, t.episodes) / Math.min(r.eps, t.episodes) : 1
    kand.push({ id: t.id, menge: t.menge, stufe, sc, sim, d, folgen, fm: (FORMATE[r.fmt] ?? []).includes(t.format) ? 1 : 0, franchise: t.franchiseId ?? t.id, jahr: t.jpYear, name: t.titleRomaji, format: t.format, episodes: t.episodes })
  }
  const direkt = kand.some((k) => k.stufe === 'direkt')
  return kand.filter((k) => !direkt || k.stufe === 'direkt').sort((a, b) => b.sc - a.sc || b.fm - a.fm || a.d - b.d)
}

/** Zuordnung einer Zeile: sicher (exakter Name, Folgenzahl passt, ein Franchise), sonst zu prüfen. */
function ordneZu(r, ctx) {
  const k = kandidaten(r, ctx)
  if (!k.length) return { art: 'keiner' }
  const spitze = k.filter((x) => x.sc === k[0].sc && x.fm === k[0].fm && x.d === k[0].d)
  if (new Set(spitze.map((x) => x.franchise)).size > 1) return { art: 'mehrdeutig', k: spitze }
  const t = k[0]
  const scharf = t.sim === 1 && t.stufe === 'direkt' && t.folgen <= 2.5
  return { art: scharf ? 'sicher' : 'pruefen', t, k }
}

function lauf() {
  const [pfad, flag] = process.argv.slice(2)
  const ctx = ladeTitel()
  const treffer = new Map()
  const zuPruefen = []
  for (const r of liesListe(pfad)) {
    const z = ordneZu(r, ctx)
    const schluessel = `${r.name}|${r.jahr}`
    if (schluessel in HAND) {
      for (const id of [HAND[schluessel]].flat()) if (id) treffer.set(id, { ...r, id })
      continue
    }
    if (z.art === 'sicher') { if (!treffer.has(z.t.id)) treffer.set(z.t.id, { ...r, id: z.t.id }) } else if (z.art !== 'keiner') zuPruefen.push({ r, z, schluessel })
  }
  if (flag === '--pruefen') {
    for (const { r, z, schluessel } of zuPruefen) {
      console.log(`\n${schluessel} [${r.fmt}, ${r.eps} Ep., ${r.sender}] -> ${z.art}`)
      for (const k of (z.k ?? []).slice(0, 4)) console.log(`   ${k.id} ${k.name} (${k.format}, ${k.jahr}, ${k.episodes ?? '?'} Ep.) ${k.stufe} sim=${k.sim.toFixed(2)} folgen=${k.folgen.toFixed(1)}`)
    }
    console.log(`\nSicher: ${treffer.size}, zu prüfen: ${zuPruefen.length}`)
    return
  }
  schreibe(treffer)
}

function schreibe(treffer) {
  const kopf = `# Treffer der Synchron-Forum-Liste „Synchronisierte Anime-Titel" (Nutzer „Chat Noir").
# Quelle: https://215072.homepagemodules.de/t528765f11776745-uebersicht-Synchronisierte-Anime-Titel.html (auch forum.seriensynchron.de), Stand 24.12.2023.
# Nur japanische Anime; fehlt ein Titel hier, ist das kein Befund. Gespeichert sind nur die zugeordneten AniList-IDs mit Listentitel, Jahr und Sender,
# nicht die Liste. Erzeugt einmalig mit tools/synchron-forum-treffer.mjs; Unscharfes wurde von Hand entschieden (null = nicht zugeordnet).
# Wirkung: Beleg „mittel" in pipeline/lib/belegstaerke.ts. Dokumentation: docs/wissen/quellen.md.
`
  const q = (s) => JSON.stringify(s)
  const zeilen = [...treffer.values()].sort((a, b) => a.id - b.id).map((t) => `- anilistId: ${t.id}\n  liste: ${q(`${t.name}, ${t.jahr}`)}\n  sender: ${q(t.sender)}`)
  writeFileSync(resolve(ROOT, 'data/synchron-forum-treffer.yaml'), `${kopf}\n${zeilen.join('\n')}\n`)
  console.log(`${treffer.size} Treffer geschrieben.`)
}

lauf()
