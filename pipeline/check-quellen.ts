/**
 * Robustheitstest aller Synchro-Quellen gegen die Handprüfungen.
 *
 * ## Warum
 *
 * Daniel am 23.08.2026: „Unsere Quellen auf Robustheit testen, das heißt
 * testweise jeden anbieter einmal abklopfen, wie es der automatische lauf
 * machen würde, dann prüfen ob wir genau das bekommen was wir erwarten. […]
 * trifft etwas nicht zu (quelle sagt kein deutsch obwohl deutsch, oder
 * andersrum), dann müssen wir genau das aufschreiben, und eine Lösung finden."
 *
 * Der Anlass war ein Fall, in dem beides schieflag: Für Tokyo Ghoul meldete
 * eine fremde Quelle „kein Deutsch", wo alle vier Reihen synchronisiert sind —
 * und für KONOSUBA sagten **wir** „unbekannt", obwohl unser eigener Abruf die
 * Antwort längst enthielt.
 *
 * ## Wie gemessen wird
 *
 * Für jede Quelle wird ihr Urteil **so erzeugt, wie der Build es täte** — mit
 * denselben Funktionen, nicht mit einer Nachbildung. Dann wird es gegen
 * `data/dub-confirmed.yaml` gehalten, also gegen das, was ein Mensch am
 * Bildschirm gesehen hat.
 *
 * Vier Ausgänge, und nur einer davon ist gefährlich:
 *
 * | Ausgang | Bedeutung |
 * |---|---|
 * | **einig** | Quelle und Hand sagen dasselbe |
 * | **falsch positiv** | Quelle sagt deutsch, Hand sagt nein — **schleust ein falsches `true` ein** |
 * | **falsch negativ** | Quelle sagt nein, Hand sagt deutsch — entfernt einen gültigen Verweis |
 * | **stumm** | Quelle sagt nichts, wo die Hand etwas weiß — Verzug, kein Fehler |
 *
 * Die dritte Zeile wiegt schwerer, als sie aussieht: Ein `dub: false` **entfernt
 * den Verweis**. Wer ihn zu Unrecht entfernt, nimmt einer Seite die Antwort,
 * ohne dass es jemandem auffällt.
 *
 * Der Lauf kostet kein Kontingent — er liest nur, was die Abrufe hinterlassen
 * haben.
 *
 * Aufruf: npm run check:quellen
 */
import { readJson, log, warn, ROOT } from './lib/util.ts'
import { resolve } from 'node:path'
import { loadDubChecks } from './lib/dub-confirmed.ts'
import { beurteile, type CrDubData } from './lib/crunchyroll-dub.ts'
import { beurteileAdnVerweis, ladeAdnArchiv } from './lib/adn-sprachen.ts'
import { anisearchPlatform } from '../shared/mappings.ts'
import type { Title } from '../shared/types.ts'

const roh = readJson<Title[] | Record<string, Title>>(resolve(ROOT, 'public/data/titles.json'), [])
const titel = Array.isArray(roh) ? roh : Object.values(roh)
const nachId = new Map(titel.map((t) => [t.id, t]))

/** Was ein Mensch gesehen hat: (anilistId, platform) → true/false. */
const hand = new Map<string, boolean>()
for (const b of loadDubChecks()) {
  if (typeof b.dub !== 'boolean') continue
  hand.set(`${b.anilistId}:${b.platform}`, b.dub)
}

interface Bilanz {
  einig: number
  falschPositiv: string[]
  falschNegativ: string[]
  stumm: number
  ohneKontrolle: number
}
const leer = (): Bilanz => ({ einig: 0, falschPositiv: [], falschNegativ: [], stumm: 0, ohneKontrolle: 0 })

function verbuche(b: Bilanz, titleId: number, platform: string, quelleSagt: boolean | undefined): void {
  const k = `${titleId}:${platform}`
  const wahrheit = hand.get(k)
  if (wahrheit === undefined) {
    if (quelleSagt === undefined) return
    b.ohneKontrolle++
    return
  }
  if (quelleSagt === undefined) {
    b.stumm++
    return
  }
  if (quelleSagt === wahrheit) {
    b.einig++
    return
  }
  const name = `${titleId} ${nachId.get(titleId)?.titleRomaji?.slice(0, 34) ?? '?'}`
  if (quelleSagt) b.falschPositiv.push(name)
  else b.falschNegativ.push(name)
}

// ── Crunchyroll: dieselbe Auswertung wie im Build ─────────────────────────
const cr = leer()
{
  const crDub = readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] })
  const nachUrl = new Map<string, Title[]>()
  for (const t of titel) for (const s of t.streams ?? []) {
    if (s.platform !== 'crunchyroll') continue
    nachUrl.set(s.url, [...(nachUrl.get(s.url) ?? []), t])
  }
  const geurteilt = new Set<number>()
  for (const serie of crDub.serien) {
    for (const u of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
      geurteilt.add(u.titleId)
      verbuche(cr, u.titleId, 'crunchyroll', u.dub)
    }
  }
  // Was die Hand kennt, die Quelle aber nie beurteilt hat
  for (const [k] of hand) {
    const [id, plattform] = k.split(':')
    if (plattform !== 'crunchyroll') continue
    if (!geurteilt.has(Number(id))) cr.stumm++
  }
}

// ── ADN: Sprachcode je Folge aus dem Archiv ───────────────────────────────
const adn = leer()
{
  const archiv = ladeAdnArchiv()
  const geurteilt = new Set<number>()
  for (const t of titel) for (const s of t.streams ?? []) {
    if (s.platform !== 'adn') continue
    const befund = beurteileAdnVerweis(s.url, archiv)
    if (befund.dub === undefined) continue
    geurteilt.add(t.id)
    verbuche(adn, t.id, 'adn', befund.dub)
  }
  for (const [k] of hand) {
    const [id, plattform] = k.split(':')
    if (plattform !== 'adn') continue
    if (!geurteilt.has(Number(id))) adn.stumm++
  }
}

// ── YouTube: Tonspur laut oEmbed-Lauf ──────────────────────────────────────
/**
 * Die drittgrößte Kontrollgruppe im Projekt — und bis zum 23.08.2026 im
 * Robustheitstest gar nicht vertreten.
 *
 * `data/youtube-befunde.json` trägt je Adresse `audioDeutsch` und den Kanal.
 * Beides stammt aus YouTubes eigener oEmbed-Auskunft, ist also weder geraten
 * noch gescrapt.
 */
const yt = leer()
{
  const befunde = readJson<Record<string, { audioDeutsch?: boolean; kanal?: string | null }>>(
    resolve(ROOT, 'data/youtube-befunde.json'),
    {},
  )
  const geurteilt = new Set<number>()
  for (const t of titel) for (const s of t.streams ?? []) {
    if (s.platform !== 'youtube') continue
    const b = befunde[s.url]
    if (!b || typeof b.audioDeutsch !== 'boolean') continue
    geurteilt.add(t.id)
    verbuche(yt, t.id, 'youtube', b.audioDeutsch)
  }
  for (const [k] of hand) {
    const [id, plattform] = k.split(':')
    if (plattform !== 'youtube') continue
    if (!geurteilt.has(Number(id))) yt.stumm++
  }
}

function zeige(name: string, b: Bilanz): boolean {
  const gesamt = b.einig + b.falschPositiv.length + b.falschNegativ.length
  const quote = gesamt ? Math.round((b.einig / gesamt) * 100) : 0
  log('')
  log(`── ${name} ──`)
  log(`   gegen Handprüfung verglichen : ${gesamt}${gesamt ? ` (${quote} % einig)` : ''}`)
  log(`   stumm, wo die Hand etwas weiß: ${b.stumm}`)
  log(`   Urteile ohne Kontrolle       : ${b.ohneKontrolle}`)
  if (b.falschPositiv.length) {
    warn(`   ✗ FALSCH POSITIV (${b.falschPositiv.length}) — Quelle sagt deutsch, Hand sagt nein:`)
    for (const f of b.falschPositiv.slice(0, 10)) warn(`       ${f}`)
  }
  if (b.falschNegativ.length) {
    warn(`   ✗ FALSCH NEGATIV (${b.falschNegativ.length}) — Quelle sagt nein, Hand sagt deutsch:`)
    for (const f of b.falschNegativ.slice(0, 10)) warn(`       ${f}`)
  }
  return b.falschPositiv.length + b.falschNegativ.length === 0
}

log('Robustheitstest der Synchro-Quellen — Maßstab ist data/dub-confirmed.yaml')
log(`Handprüfungen als Kontrolle: ${hand.size}`)
let alleSauber = [
  zeige('Crunchyroll Content-API', cr),
  zeige('ADN', adn),
  zeige('YouTube (oEmbed)', yt),
].every(Boolean)

/**
 * Die Stichprobe ist der eigentliche Zweck dieses Laufs.
 *
 * „Keine Widersprüche" klingt nach einem Freispruch, ist aber keiner, solange
 * die Kontrollgruppe klein ist: Crunchyroll steht 21 geprüften Fällen
 * gegenüber, ADN keinem einzigen — bei zusammen über fünfhundert Urteilen.
 * Was hier fehlt, ist nicht die Prüfung auf Widerspruch, sondern die Prüfung
 * **dort, wo niemand nachgesehen hat**. Genau dort kann eine Quelle ein
 * falsches `true` einschleusen, ohne dass es je auffällt.
 *
 * Ausgegeben werden deshalb Fälle **ohne** Handprüfung, gestreut über beide
 * Urteilsrichtungen — die `dub: false` zuerst, denn die entfernen einen
 * Verweis und sind damit die teureren.
 */
const stichprobe: string[] = []
{
  const crDub = readJson<CrDubData>(resolve(ROOT, 'data/crunchyroll-dub.json'), { scrapedAt: '', serien: [] })
  const nachUrl = new Map<string, Title[]>()
  for (const t of titel) for (const s of t.streams ?? []) {
    if (s.platform !== 'crunchyroll') continue
    nachUrl.set(s.url, [...(nachUrl.get(s.url) ?? []), t])
  }
  const nein: string[] = []
  const ja: string[] = []
  for (const serie of crDub.serien) {
    for (const u of beurteile(serie, nachUrl.get(serie.url) ?? [])) {
      if (hand.has(`${u.titleId}:crunchyroll`)) continue
      const t = nachId.get(u.titleId)
      if (!t) continue
      const url = (t.streams ?? []).find((s) => s.platform === 'crunchyroll')?.url
      const zeile = `${u.dub ? 'deutsch ' : 'KEIN dt.'} | ${(t.titleRomaji ?? '?').slice(0, 32).padEnd(32)} | ${u.grund.slice(0, 44).padEnd(44)} | ${url}`
      ;(u.dub ? ja : nein).push(zeile)
    }
  }
  const streue = (liste: string[], n: number) => {
    const schritt = Math.max(1, Math.floor(liste.length / n))
    return liste.filter((_, i) => i % schritt === 0).slice(0, n)
  }
  stichprobe.push('── Crunchyroll: Urteile ohne Handprüfung ──')
  stichprobe.push(...streue(nein, 4), ...streue(ja, 4))

  const archiv = ladeAdnArchiv()
  const adnZeilen: string[] = []
  for (const t of titel) for (const s of t.streams ?? []) {
    if (s.platform !== 'adn' || hand.has(`${t.id}:adn`)) continue
    const b = beurteileAdnVerweis(s.url, archiv)
    if (b.dub === undefined) continue
    adnZeilen.push(`${b.dub ? 'deutsch ' : 'KEIN dt.'} | ${(t.titleRomaji ?? '?').slice(0, 32).padEnd(32)} | ${(b.grund ?? '').slice(0, 44).padEnd(44)} | ${s.url}`)
  }
  stichprobe.push('', '── ADN: Urteile ohne Handprüfung ──')
  stichprobe.push(...streue(adnZeilen.filter((z) => z.startsWith('KEIN')), 3), ...streue(adnZeilen.filter((z) => z.startsWith('deutsch')), 3))
}

log('')
log('Stichprobe zum Gegenprüfen — hier hat noch niemand nachgesehen:')
for (const z of stichprobe) log('  ' + z)

/**
 * aniSearch als Gegenprobe: Wen kennt die Datenbank, den wir nicht führen?
 *
 * Die Prüfungen oben halten Quellen gegen **Handprüfungen** — sie finden, wo
 * eine Quelle etwas Falsches sagt. Sie finden nicht, wo eine Quelle etwas
 * **sagt, das bei uns nie ankommt**. Genau das ist am 24.08.2026 zweimal
 * passiert: Die deutschen Titel lagen seit Tagen in `data/anisearch.json` und
 * wurden nie ausgewertet (99 statt 2.553), und dieselbe Datei nennt
 * Anbieter-Verweise, die im Datensatz fehlen.
 *
 * Gemessen an jenem Tag: 1.665 aniSearch-Verweise führen wir, **366 nicht** —
 * davon 142 Crunchyroll, 77 Prime Video, 37 Netflix. Das ist kein Fehler an
 * sich: Ein Verweis kann bewusst verworfen worden sein, weil die Adresse den
 * Anbieter nicht trägt oder ins Leere führt. Ein **Anstieg** dagegen heißt, dass
 * die Übernahme klemmt.
 *
 * Die Schwelle ist deshalb großzügig und misst den Anteil, nicht die Zahl:
 * Wächst der Bestand, wächst beides mit.
 */
log('')
log('── aniSearch: was die Datenbank kennt und wir nicht ──')
{
  const as = readJson<Record<string, { streams?: { provider: string; url: string }[] }>>(
    resolve(ROOT, 'data/anisearch.json'),
    {},
  )
  let gefuehrt = 0
  let fehlt = 0
  const jePlattform: Record<string, number> = {}
  for (const t of titel) {
    const e = as[String(t.id)]
    if (!e?.streams?.length) continue
    const meine = new Set<string>([
      ...(t.streams ?? []).map((s) => s.platform),
      ...(t.watchLinks ?? []).map((w) => (w as { platform?: string }).platform ?? ''),
    ])
    for (const s of e.streams) {
      const p = anisearchPlatform(s.provider)
      if (!p) continue
      if (meine.has(p)) gefuehrt++
      else {
        fehlt++
        jePlattform[p] = (jePlattform[p] ?? 0) + 1
      }
    }
  }
  const anteil = gefuehrt + fehlt ? (fehlt / (gefuehrt + fehlt)) * 100 : 0
  log(`   von aniSearch genannt und geführt : ${gefuehrt}`)
  log(`   genannt, aber nicht geführt       : ${fehlt} (${anteil.toFixed(0)} %)`)
  log(
    `   davon: ${Object.entries(jePlattform)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([k, v]) => `${k} ${v}`)
      .join(', ')}`,
  )
  if (anteil > 35) {
    warn(`Mehr als ein Drittel der aniSearch-Verweise kommt nicht an (${anteil.toFixed(0)} %).`)
    alleSauber = false
  }
}

log('')
if (!alleSauber) {
  warn('Mindestens eine Quelle widerspricht einer Handprüfung — siehe oben.')
  process.exit(1)
}
log('✓ Keine Quelle widerspricht einer Handprüfung.')
