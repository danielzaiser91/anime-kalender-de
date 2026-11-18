// Test für tools/anime2you-suche.mjs ohne Netz: Fixtures in der Form der WordPress-Schnittstelle (Abruf vom 18.11.2026).
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { main, kanalTitelOhneZweite, artikelId, textZeilen, artikelBloecke, holeJson } from './anime2you-suche.mjs'

const EINTRAEGE = [
  { anilistId: 1, title: 'Eins', dub: true, note: 'Tonspuren: Deutsch — Abos: Prime, aniversede, Seitenadresse: B0X, zugang=abo_und_kauf — ACHTUNG: Kanal-Titel, Amazons Sprachangabe ist hier kein Beleg' },
  { anilistId: 2, title: 'Zwei', dub: true, note: 'Abos: crunchyrollde, zugang=abo — ACHTUNG: Kanal-Titel' },
  { anilistId: 3, title: 'Drei', dub: true, note: 'Abos: aniversede — ACHTUNG: Kanal-Titel' },
  { anilistId: 3, title: 'Drei', dub: true, note: 'Abos: aniversede — ACHTUNG: Kanal-Titel', zweiteQuelle: 'Anime2You 17.11.2026' },
  { anilistId: 4, title: 'Vier', dub: true, note: 'Abos: Prime, zugang=abo' },
  { anilistId: 5, title: 'Fünf', note: 'Abos: aniversede — ACHTUNG: Kanal-Titel' },
]
const alle = kanalTitelOhneZweite(EINTRAEGE)
assert.deepEqual(alle.map((t) => t.anilistId), [1, 2], 'Titel 3 hat eine zweite Quelle (zweite Zeile), 4 ohne Kanal-Warnung, 5 ohne dub')
assert.deepEqual(kanalTitelOhneZweite(EINTRAEGE, 'AniVerse').map((t) => t.anilistId), [1], 'Kanalfilter ohne Groß-/Kleinschreibung')
assert.equal(alle[0].abos, 'Prime, aniversede')
assert.equal(alle[1].abos, 'crunchyrollde')

assert.equal(artikelId('1065078'), '1065078')
assert.equal(artikelId('https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/'), '1065078')
assert.equal(artikelId('https://www.anime2you.de/news/abc/'), '')

const HTML = '<p>1. November: &raquo;M.A.S.K.&laquo;</p><p>Sprache: Deutsch</p><p>Sprache: Japanisch (UT)</p><div>Stream: aniverse &amp; mehr</div>' +
  '<p>2. November: &raquo;Zweiter Titel&laquo;</p><p>Handlung: x</p><p>3. November: &raquo;Dritter&laquo;</p><p>Sprache: Japanisch (UT)</p><script>var a = 1</script>'
const zeilen = textZeilen(HTML)
assert.deepEqual(zeilen.slice(0, 2), ['1. November: »M.A.S.K.«', 'Sprache: Deutsch'])
assert.ok(zeilen.includes('Stream: aniverse & mehr') && !zeilen.some((z) => z.includes('var a')))
const bloecke = artikelBloecke(zeilen)
assert.deepEqual(bloecke.map((b) => [b.name, b.sprache]), [['M.A.S.K.', 'Deutsch'], ['Zweiter Titel', ''], ['Dritter', 'Japanisch (UT)']], 'Sprache gehört zum nächsten Kopf, nicht zum vorigen')

// Kulisse: fetch-Attrappe mit Schlüssel je Pfad, Pausen werden mitgeschrieben
const POST = { id: 1065078, link: 'https://www.anime2you.de/news/1065078/aniverse-november-2026-neuzugaenge/', title: { rendered: 'Neue Anime-Katalogtitel bei aniverse' }, date: '2026-10-28T14:00:00', content: { rendered: HTML } }
const SUCHE = [
  { id: 1065078, link: POST.link, title: POST.title, date: POST.date },
  { id: 7, link: 'https://www.anime2you.de/news/7/anderes/', title: { rendered: 'Etwas anderes' }, date: '2026-10-01T10:00:00' },
]
function kulisse(antwortFuer) {
  const aufrufe = []
  const pausen = []
  const fetchFn = async (url, opts) => {
    aufrufe.push({ url, ua: opts.headers['User-Agent'] })
    const a = antwortFuer(url, aufrufe.length)
    return { status: a.status ?? 200, ok: (a.status ?? 200) < 400, json: async () => a.body }
  }
  return { fetchFn, aufrufe, pausen, schlafen: async (ms) => { pausen.push(ms) } }
}
async function lauf(args, k) {
  const aus = []
  const code = await main(args, { fetchFn: k.fetchFn, schlafen: k.schlafen, schreibe: (s) => aus.push(s) })
  return { code, text: aus.join('\n') }
}

const k1 = kulisse((url) => (url.includes('/posts/1065078') ? { body: POST } : { body: SUCHE }))
const s = await lauf(['suche', 'aniverse', 'Katalog', '--filter', 'neue'], k1)
assert.equal(s.code, 0)
const sj = JSON.parse(s.text)
assert.deepEqual(sj.treffer.map((t) => t.id), [1065078], 'Filter behält nur den passenden Treffer')
assert.ok(k1.aufrufe[0].url.includes('search=aniverse%20Katalog') && k1.aufrufe[0].url.includes('/wp-json/wp/v2/posts'))
assert.ok(/anime-kalender\.de/.test(k1.aufrufe[0].ua) && !/@|Daniel/i.test(k1.aufrufe[0].ua), 'generischer User-Agent ohne persönliche Daten')

const k2 = kulisse((url) => (url.includes('/posts/1065078') ? { body: POST } : { body: SUCHE }))
const a = await lauf(['artikel', '1065078', POST.link, 'kaputt'], k2)
const aj = JSON.parse(a.text)
assert.equal(aj.length, 3)
assert.equal(aj[0].datum, '2026-10-28')
assert.deepEqual(aj[0].bloecke.map((b) => b.name), ['M.A.S.K.', 'Zweiter Titel', 'Dritter'])
assert.ok(aj[0].sprachstellen.includes('Sprache: Deutsch'))
assert.equal(aj[2].fehler, 'keine Artikelnummer in der Adresse')
assert.equal(a.code, 1, 'ein Fehler in der Liste gibt Exit 1')
assert.equal(k2.aufrufe.length, 2, 'für die unlesbare Eingabe kein Abruf')
assert.deepEqual(k2.pausen, [1500, 1500], 'Pause nach jedem abgerufenen Artikel')

// Sperre: 429 zweimal, dann Erfolg -> Pause statt Abbruch; Dauersperre -> Nichtauskunft
const k3 = kulisse((_url, n) => (n <= 2 ? { status: 429 } : { body: SUCHE }))
const r3 = await holeJson('https://x.example/', k3)
assert.ok(r3.daten && k3.aufrufe.length === 3)
assert.deepEqual(k3.pausen, [30000, 60000])
const k4 = kulisse(() => ({ status: 403 }))
const r4 = await holeJson('https://x.example/', k4)
assert.ok(/HTTP 403 nach 2 Wiederholungen \(Nichtauskunft/.test(r4.fehler) && k4.aufrufe.length === 3)
const k5 = kulisse(() => ({ status: 404 }))
assert.equal((await holeJson('https://x.example/', k5)).fehler, 'HTTP 404')
assert.equal(k5.aufrufe.length, 1, '404 ist eine eindeutige Antwort, keine Wiederholung')
const s4 = await lauf(['suche', 'x'], kulisse(() => ({ status: 429 })))
assert.equal(s4.code, 1)
assert.ok(JSON.parse(s4.text).fehler[0].includes('Nichtauskunft'))

// Seiten: volle Seite (20) führt zur nächsten, mit Pause dazwischen; Obergrenze 5
const voll = Array.from({ length: 20 }, (_, i) => ({ id: i, link: `https://www.anime2you.de/news/${i}/x/`, title: { rendered: 'T' + i }, date: '2026-01-01T00:00:00' }))
const k6 = kulisse(() => ({ body: voll }))
const s6 = JSON.parse((await lauf(['suche', 'x', '--seiten', '99'], k6)).text)
assert.equal(k6.aufrufe.length, 5, 'höchstens 5 Seiten')
assert.equal(s6.treffer.length, 100)
assert.equal(k6.pausen.length, 5)

// liste: liest die Datei, schreibt nichts
const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'a2y-'))
const datei = path.join(dir, 'dub.yaml')
fs.writeFileSync(datei, EINTRAEGE.map((e) => `- anilistId: ${e.anilistId}\n  title: "${e.title}"\n  ${e.dub ? 'dub: true\n  ' : ''}note: "${e.note}"\n${e.zweiteQuelle ? `  zweiteQuelle: "${e.zweiteQuelle}"\n` : ''}`).join(''))
const vorher = fs.readFileSync(datei, 'utf8')
const l = await lauf(['liste', '--datei', datei, '--kanal', 'aniverse'], kulisse(() => ({ status: 500 })))
const lj = JSON.parse(l.text)
assert.equal(l.code, 0)
assert.deepEqual([lj.anzahl, lj.titel.map((t) => t.anilistId)], [1, [1]])
assert.equal(fs.readFileSync(datei, 'utf8'), vorher)
fs.rmSync(dir, { recursive: true })

assert.equal((await lauf([], kulisse(() => ({})))).code, 2, 'ohne Befehl: Aufruf-Hinweis, Exit 2')
assert.equal((await lauf(['suche'], kulisse(() => ({})))).code, 2, 'suche ohne Titel')
console.log('anime2you-suche: Kanal-Titel-Liste, Suche, Artikel, Sperre (429/403) und Obergrenzen geprüft, Exit-Codes 0/1/2')
