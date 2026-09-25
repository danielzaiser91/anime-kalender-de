/**
 * PoC: Lässt sich eine Prime-Staffel im Hintergrund lesen, ohne die Seite zu öffnen?
 *
 * Daniel, 25.09.2026: „erst poc, robuster poc auch mit edge cases". Der Prime-Durchgang braucht
 * je Staffel rund 5–10 s, fast alles Seitenladen. Die Staffelseite trägt die Tonspuren je Folge im
 * Quelltext (`dv-web-page-hydration-data`). Dieses Skript holt Staffelseiten per Abruf, liest sie
 * mit **demselben Parser** wie die Erweiterung (`ausHydration` aus `extension/amazon-leser.js`)
 * und vergleicht mit dem, was der Meldeknopf auf der geöffneten Seite gemeldet hat.
 *
 * Gegenprobe: `pruefung` + `prime_folge` aus D1 (siehe --wahrheit), je Seitenkennung.
 *
 * Grenzen, bewusst:
 * - Nur `/gp/video/detail/…` (robots.txt erlaubt). Weitere Folgenabschnitte kämen über
 *   `/gp/video/api/getDetailWidgets` — der Pfad ist im `*`-Block gesperrt, also nicht von hier.
 *   Gemessen wird deshalb auch, wie oft der Quelltext allein schon alle Folgen trägt.
 * - Ohne Anmeldung. Was nur angemeldet anders aussieht (Zugang, gesperrte Folgen), fällt hier auf,
 *   ist aber kein Fehler des Weges — es wird getrennt ausgewiesen.
 * - Amazon sperrt nach Menge je Zeitfenster (docs/wissen/quellen.md: ~600 nach langer Ruhe, die
 *   Sperre trifft die ganze Leitung). Takt 2,5 s ±30 %, Abbruch beim ersten Sperrzeichen.
 *
 * Aufruf: node tools/prime-hintergrund-poc.mjs --wahrheit <datei.json> [--max 35] [--aus <ergebnis.json>]
 */
import { readFileSync, writeFileSync } from 'node:fs'
import vm from 'node:vm'

const arg = (name, vorgabe) => {
  const i = process.argv.indexOf(`--${name}`)
  return i > 0 ? process.argv[i + 1] : vorgabe
}
const WAHRHEIT = arg('wahrheit')
const MAX = Number(arg('max', 35))
const AUS = arg('aus')
if (!WAHRHEIT) throw new Error('--wahrheit fehlt')

/* Der Parser der Erweiterung, unverändert: namenAus + ausHydration. */
const leser = readFileSync(new URL('../extension/amazon-leser.js', import.meta.url), 'utf8')
const von = leser.indexOf('  function namenAus(')
const bis = leser.indexOf('  // --- Der Zustand')
if (von < 0 || bis < von) throw new Error('Parser in amazon-leser.js nicht gefunden')
const kontext = {}
vm.createContext(kontext)
vm.runInContext(leser.slice(von, bis), kontext)
const ausHydration = kontext.ausHydration
/* Abschnitte: Wie viele Folgenseiten nennt der Quelltext? Mehr als eine heißt: nicht alles da. */
const tokensAus = kontext.tokensAus

const roh = JSON.parse(readFileSync(WAHRHEIT, 'utf8'))
const seiten = (Array.isArray(roh) ? roh[0].results : roh).map((z) => ({
  kennung: z.seiten_kennung,
  liste: z.url.split('/').pop(),
  staffel: z.staffel,
  befund: z.befund,
  folgen: JSON.parse(z.folgen_roh ?? '[]').map((f) => ({
    n: f.n,
    deutsch: /(^|")Deutsch/.test(f.s ?? '') ,
    ton: f.t,
  })),
}))

/*
  **Stichprobe nach Grenzfällen, nicht nach Bequemlichkeit.** Je Titel alle bzw. gestreut, damit
  drin ist: die gesperrte Naruto-Staffel 4 (26 Zeilen, ein Befund ohne Deutsch), Bände mit
  Sortierschlüssel (Pokémon 201…, Diamant & Perl 1001…), große Staffeln mit 40–52 Folgen
  (Yu-Gi-Oh!), und die Staffeln mit 19–28 Folgen am Abschnittsrand.
*/
function stichprobe() {
  const jeListe = new Map()
  for (const s of seiten) jeListe.set(s.liste, [...(jeListe.get(s.liste) ?? []), s])
  const raus = []
  for (const [, l] of jeListe) {
    l.sort((a, b) => a.staffel - b.staffel)
    const gross = l.filter((s) => s.folgen.length >= 19)
    const rest = l.filter((s) => s.folgen.length < 19)
    const schritt = Math.max(1, Math.ceil(rest.length / 6))
    raus.push(...gross, ...rest.filter((_, i) => i % schritt === 0))
  }
  return raus.slice(0, MAX)
}

const warte = (ms) => new Promise((r) => setTimeout(r, ms))
const takt = () => 2500 * (0.7 + Math.random() * 0.6)

async function holen(kennung) {
  const antwort = await fetch(`https://www.amazon.de/gp/video/detail/${kennung}`, {
    headers: {
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/129.0 Safari/537.36',
      'accept-language': 'de-DE,de;q=0.9',
      accept: 'text/html',
    },
    redirect: 'follow',
  })
  const html = await antwort.text()
  const block = /id="dv-web-page-hydration-data"[^>]*>([\s\S]*?)<\/script>/.exec(html)?.[1] ?? null
  /* Sperrzeichen: kein 200, Captcha-Seite, oder eine Seite ohne Hydration-Block. */
  const gesperrt =
    antwort.status !== 200 || /captcha|api-services-support@amazon\.com/i.test(html.slice(0, 20000)) || !block
  return { status: antwort.status, zeichen: html.length, block, gesperrt, html }
}

const ergebnisse = []
const probe = stichprobe()
console.log(`${probe.length} Seiten in der Stichprobe (von ${seiten.length})\n`)
for (const [i, s] of probe.entries()) {
  if (i) await warte(takt())
  let r
  try {
    r = await holen(s.kennung)
  } catch (e) {
    console.log(`Abbruch: Netzfehler bei ${s.kennung} — ${e.message}`)
    break
  }
  if (r.gesperrt) {
    console.log(`Abbruch: Sperrzeichen bei ${s.kennung} (HTTP ${r.status}, ${r.zeichen} Zeichen)`)
    ergebnisse.push({ kennung: s.kennung, abbruch: true, status: r.status })
    break
  }
  const seite = ausHydration(r.block)
  const gelesen = new Map((seite?.folgen ?? []).map((f) => [f.nummer, f]))
  const erwartet = new Map(s.folgen.map((f) => [f.n, f]))
  const fehlen = [...erwartet.keys()].filter((n) => !gelesen.has(n)).sort((a, b) => a - b)
  const zuviel = [...gelesen.keys()].filter((n) => !erwartet.has(n)).sort((a, b) => a - b)
  const tonAnders = [...erwartet.values()]
    .filter((f) => gelesen.has(f.n))
    .filter((f) => {
      const g = gelesen.get(f.n)
      /* Gesperrt ohne Anmeldung: keine Tonspuren — das ist „hier nicht", nicht „kein Deutsch". */
      if (!g.verfuegbar && !g.sprachen.length) return false
      return g.sprachen.some((x) => /^Deutsch/.test(x)) !== f.deutsch
    })
    .map((f) => f.n)
  const gesperrtOhneAnmeldung = [...gelesen.values()].filter((g) => !g.verfuegbar).length
  /*
    **Das Signal, an dem die Erweiterung Unvollständiges erkennen müsste.** Zwei Kandidaten:
    die Zahl der Folgenabschnitte (`episodePages`) und `folgenGesamt` (episodeCount).
  */
  const abschnitte = tokensAus(r.html).tokens.length
  const gesamtLaut = seite?.folgenGesamt ?? null
  const vollstaendig = !fehlen.length
  const zeile = {
    kennung: s.kennung,
    liste: s.liste,
    staffel: s.staffel,
    seiteStaffel: seite?.staffel ?? null,
    band: seite?.band ?? null,
    erwartet: erwartet.size,
    gelesen: gelesen.size,
    fehlen,
    zuviel,
    tonAnders,
    gesperrtOhneAnmeldung,
    abschnitte,
    gesamtLaut,
    vollstaendig,
    zeichen: r.zeichen,
  }
  ergebnisse.push(zeile)
  const urteil = !fehlen.length && !zuviel.length && !tonAnders.length ? 'gleich' : 'ANDERS'
  console.log(
    `${urteil.padEnd(6)} ${s.kennung} S${s.staffel} (Seite sagt ${zeile.seiteStaffel ?? '?'}${zeile.band ? `, „${zeile.band}"` : ''}): ` +
      `${gelesen.size}/${erwartet.size} Folgen` +
      (fehlen.length ? ` · fehlen ${fehlen.join(',')}` : '') +
      (zuviel.length ? ` · zu viel ${zuviel.join(',')}` : '') +
      (tonAnders.length ? ` · Ton anders ${tonAnders.join(',')}` : '') +
      (gesperrtOhneAnmeldung ? ` · ${gesperrtOhneAnmeldung} ohne Anmeldung gesperrt` : '') +
      ` · Abschnitte ${abschnitte} · episodeCount ${gesamtLaut ?? '–'}`,
  )
}

const fertig = ergebnisse.filter((e) => !e.abbruch)
const gleich = fertig.filter((e) => !e.fehlen.length && !e.zuviel.length && !e.tonAnders.length)
const nurFehlend = fertig.filter((e) => e.fehlen.length && !e.zuviel.length && !e.tonAnders.length)
const tonFalsch = fertig.filter((e) => e.tonAnders.length)
console.log(
  `\n${fertig.length} gelesen · ${gleich.length} gleich · ${nurFehlend.length} nur mit fehlenden Folgen ` +
    `(Abschnitt nicht im Quelltext) · ${tonFalsch.length} mit abweichendem Ton`,
)
/* Trennt das Signal vollständig von unvollständig — ohne einen Fehlgriff in beide Richtungen? */
for (const [name, sagtVoll] of [
  ['Abschnitte ≤ 1', (e) => e.abschnitte <= 1],
  ['gelesen ≥ episodeCount', (e) => e.gesamtLaut != null && e.gelesen >= e.gesamtLaut],
]) {
  const falschVoll = fertig.filter((e) => sagtVoll(e) && !e.vollstaendig).length
  const falschUnvoll = fertig.filter((e) => !sagtVoll(e) && e.vollstaendig).length
  console.log(`Signal „${name}": ${falschVoll} fälschlich vollständig · ${falschUnvoll} fälschlich unvollständig`)
}
if (AUS) writeFileSync(AUS, JSON.stringify({ am: new Date().toISOString(), ergebnisse }, null, 1))
