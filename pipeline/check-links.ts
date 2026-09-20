/**
 * Prüft, ob die Anbieter-Verweise überhaupt noch irgendwohin führen.
 *
 * Anlass war eine Stichprobe am 20.08.2026: Von 41 Verweisen zu Joyn und
 * Aniverse antworteten **18 mit 404** — bei Joyn 9 von 11, bei Aniverse 9 von
 * 30. Ein toter Verweis ist schlimmer als keiner: Er verspricht ein Angebot und
 * führt auf eine Fehlerseite.
 *
 * **Zwei Anbieter bleiben absichtlich außen vor.** Crunchyroll und ADN
 * beantworten jede Anfrage ohne Browser mit `403` — für sie ist ein solcher
 * Test kein Befund, sondern nur der Nachweis, dass wir kein Browser sind. Sie
 * hier trotzdem zu prüfen hieße, reihenweise gültige Verweise zu verwerfen.
 * (Bei ADN ist das ohne Belang: Dessen Bestand kommt ohnehin aus der offiziellen
 * Schnittstelle, die sauber antwortet.)
 *
 * **Zwei Befunde entfernen einen Verweis: ein hartes 404 — und Amazons Satz „In
 * deiner Region nicht mehr auf Prime Video verfügbar", der mit HTTP 200 kommt.**
 * Zeitüberschreitung, 403 und Netzfehler beweisen dagegen nichts über den
 * Verweis, sondern etwas über den Weg dorthin; sie ändern nichts. Das ist
 * derselbe Grundsatz wie überall hier: gestrichen wird nur, was eine Quelle
 * aktiv widerlegt.
 *
 * Aufruf: npx tsx pipeline/check-links.ts [--alter 30] [--limit 300]
 */
import { readFileSync } from 'node:fs'
import type { PlatformId, Title } from '../shared/types.ts'
import { log, readJson, sleep, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const DATEI = 'data/link-check.json'

/**
 * Anbieter, deren Antwort auf eine schlichte Anfrage etwas bedeutet.
 *
 * YouTube fehlt hier mit Absicht: Dafür gibt es `check-youtube.ts`, das die
 * offizielle Schnittstelle fragt und dabei auch die Ländersperre sieht — die
 * ein Seitenabruf gar nicht zeigen würde.
 */
const PRUEFBAR = new Set<PlatformId>(['netflix', 'primevideo', 'disneyplus', 'rtlplus', 'joyn', 'aniverse', 'wow'] as PlatformId[])

const args = process.argv.slice(2)
const zahl = (name: string, fallback: number) => {
  const i = args.indexOf(name)
  return i >= 0 ? Number(args[i + 1]) : fallback
}
const ALTER = zahl('--alter', 30)
const LIMIT = zahl('--limit', 0)
/**
 * **Takt zwischen zwei Abrufen, in Millisekunden** (`--pause`, Standard 700).
 *
 * Er ist einstellbar, weil noch nicht belegt ist, woran Amazons Abwehr hängt:
 * am **Takt** (dann hilft langsamer) oder an der **Menge je Zeitfenster** (dann
 * hilft nur eine lange Pause zwischen Blöcken). Zwei Läufe mit 700 ms kamen auf
 * 668 (07.09.2026) und 669 Adressen (20.09.2026) — so dicht beieinander, dass
 * eine Mengengrenze näher liegt als eine Taktgrenze. Der Lauf meldet deshalb
 * beim Zumachen, wie viele **Amazon**-Abrufe er bei welchem Takt geschafft hat;
 * daraus wird die Antwort gemessen statt geraten.
 *
 * Dazu kommt ein Zufallsanteil von ±30 %: Ein exakt gleichmäßiger Takt ist für
 * sich genommen schon ein Bot-Merkmal.
 */
const PAUSE = zahl('--pause', 700)

interface Befund {
  /** HTTP-Status, oder ein Wort, wenn es gar nicht erst dazu kam. */
  status: number | string
  geprueftAm: string
  /**
   * Ist diese Amazon-Seite ein **Prime-Video-Eintrag**?
   *
   * Der Unterschied entscheidet, ob die Adresse einen Suchlink ersetzen darf.
   * Amazon schreibt ihn in den Seitentitel: „Amazon.de: <Titel> ansehen | Prime
   * Video" steht über einem Video, über einer Disc steht er nicht. aniSearch
   * führt beide unter demselben Anbieternamen `amazon`, deshalb lässt sich das
   * nicht aus den Daten ableiten — nur an der Seite ablesen.
   */
  prime?: boolean
}

type Bestand = Record<string, Befund>

const heute = () => new Date().toISOString().slice(0, 10)

/**
 * Prime-Video-Seiten sagen „nicht verfügbar" mit HTTP **200**.
 *
 * Daniel öffnete am 20.08.2026 unseren Verweis auf Staffel 2 von „The Dangers in
 * My Heart" und fand dort: „In deiner Region nicht mehr auf Prime Video
 * verfügbar." Die Seite lädt tadellos, der Statuscode ist 200 — die reine
 * Statusprüfung sieht davon nichts.
 *
 * Deshalb wird bei Amazon-Video-Seiten der Text mitgelesen. Der Griff bleibt
 * eng: **eine** feste Wendung, kein Herumraten an verschlüsselten Klassennamen.
 * Daniels kopierter Selektor lautete `#dv-action-box > div > div > div > div >
 * div.FrkFbz > div.ZsR2Ti > div > button > span` — solche Namen wechseln mit
 * jedem Deploy, der Satz nicht.
 *
 * Erlaubt ist der Blick: Amazons robots.txt sperrt `/gp/video/api`, `/settings`,
 * `/library` und `/watchlist` — die Detailseite ausdrücklich **nicht**. Und es
 * ist derselbe Abruf wie bisher, nur dass die Antwort auch gelesen wird.
 */
const AMAZON_VIDEO = /amazon\.[a-z.]+\/(gp\/video\/detail|dp)\//i
const NICHT_IN_REGION = /In deiner Region nicht mehr auf Prime Video verfügbar/i

/**
 * **Amazons Fehlerseite kommt auch mit HTTP 200 — und ein leeres 200 ist kein Ja.**
 *
 * Gefunden am 07.09.2026, nachdem Daniel vier tote Aniverse-Verweise an „Date a
 * Live" gemeldet hatte („aniverse pill hier führt auf toten link", dann Staffel
 * 4, dann Staffel 3) und dazu die entscheidende Frage stellte: „kannst du das
 * auch selbst mitbekommen und evtl generisch fixen? weil ich nicht alle manuell
 * prüfen kann."
 *
 * Der Bestand sagte für `amazon.de/dp/B0C9VS255F`: **HTTP 200, geprüft am
 * 24.08.2026**. Derselbe Abruf am 07.09.2026 lieferte 404 mit dem Titel „Seite
 * wurde nicht gefunden" — die ASIN gab es also schon damals nicht. Amazon hatte
 * beim Massenlauf eine Zwischenseite ausgeliefert, 200 und ohne Inhalt, und der
 * Lauf hat sie als „lebt" gebucht. Danach war die Adresse dreißig Tage lang
 * nicht mehr fällig.
 *
 * Das ist derselbe Fehlgriff, den der Kommentar zu `prime` unten für **ein
 * Feld** schon beschreibt — nur trifft er hier den Status selbst, und der
 * entscheidet über den Verbleib des Verweises.
 *
 * **Zwei Riegel, beide messbar:**
 *
 * - `NICHT_GEFUNDEN` — Amazons Wortlaut der Fehlerseite. Sie kommt meist mit
 *   404, aber nicht immer; der Text ist die verlässlichere Angabe.
 * - `PRODUKTSEITE` — eine echte Amazon-Detailseite trägt eines dieser Merkmale.
 *   Fehlen sie **alle** bei einem 200, war es keine Produktseite: Dann wird
 *   `unklar` gespeichert statt einer Zusage, und die Adresse ist beim nächsten
 *   Lauf sofort wieder fällig (siehe `offen` in `main`).
 *
 * Gemessen an zwei Adressen: die tote Seite ist 2.299 Zeichen lang und trägt
 * keines der Merkmale, die lebende (`B0DML22FHP`, „Date A Live") 936.253 mit
 * allen.
 *
 * **Und ein Einzelabruf einer wirklich toten Seite liefert echtes 404** — die
 * 200er-Leerseite ist Abwehr unter Last, nicht der Normalfall (20.09.2026,
 * Daniels Frage „die 404/leere seite, liefert doch auch 200 oder nicht?"):
 * `/dp/B0CGS2DRMV` → 404, Titel „Seite wurde nicht gefunden", beide Muster
 * greifen wie erwartet; `/gp/video/detail/B0GXK7RJFW` → 200 mit Produktseite.
 * Daraus folgt für die Auswertung: 404 und 200-mit-Produktseite sind Befunde,
 * 200 ohne Produktseite ist keiner.
 */
const NICHT_GEFUNDEN = /keine funktionsfähige Seite auf unserer Website|Seite wurde nicht gefunden/i
const PRODUKTSEITE = /dp-container|productTitle|av-detail-section|\|\s*Prime Video/i

/**
 * **Amazon wird unter der Video-Adresse gefragt, nicht unter `/dp/`** (18.09.2026).
 *
 * Viele Prime-Titel gibt es nur als Video-Seite: `/dp/B0CH8YTK4T` antwortet mit
 * 404 „Seite wurde nicht gefunden", `/gp/video/detail/B0CH8YTK4T` mit „Mob Psycho
 * 100 – Staffel 1 ansehen". Gemessen an zwölf zufälligen der 403 als tot geführten
 * `/dp/`-Adressen: elf von elf erreichbaren lebten unter der Video-Adresse. Der Bau
 * hat die zugehörigen Verweise über Wochen als tot entfernt. Gefunden hat es
 * `check:tote-adressen`, als Horimiya und Mob Psycho 100 — eine Stunde zuvor von
 * Daniel gemeldet — als tot im Datensatz standen.
 *
 * **Aber nur als zweiter Versuch.** Unter `/dp/` liegen auch DVDs und Blu-rays, und
 * die gibt es nur dort — sie unter der Video-Adresse zu fragen, gäbe den
 * umgekehrten Fehler. Erst die Adresse, wie sie im Bestand steht; antwortet sie
 * mit „nicht gefunden", entscheidet die Video-Seite derselben Kennung.
 *
 * Gespeichert wird der Befund unter der Adresse, wie sie im Bestand steht.
 */
function videoAdresse(url: string): string | undefined {
  const asin = /amazon\.de\/dp\/([A-Z0-9]{10})(?:[/?#]|$)/.exec(url)?.[1]
  return asin ? `https://www.amazon.de/gp/video/detail/${asin}` : undefined
}

async function pruefe(url: string): Promise<Befund> {
  const erst = await pruefeEinmal(url)
  const video = erst.status === 404 ? videoAdresse(url) : undefined
  if (!video) return erst
  const zweit = await pruefeEinmal(video)
  return zweit.status === 404 ? erst : zweit
}

async function pruefeEinmal(url: string): Promise<Befund> {
  try {
    const res = await fetch(url, {
      redirect: 'follow',
      signal: AbortSignal.timeout(8000),
      headers: { 'User-Agent': 'anime-kalender.de/1.0 (+https://anime-kalender.de; danielzaiser91@googlemail.com)' },
    })
    if (res.ok && AMAZON_VIDEO.test(url)) {
      const text = await res.text()
      if (NICHT_IN_REGION.test(text)) return { status: 'region', geprueftAm: heute() }
      /* Fehlerseite trotz 200 — dieselbe Aussage wie ein 404, nur anders verpackt. */
      if (NICHT_GEFUNDEN.test(text)) return { status: 404, geprueftAm: heute() }
      /*
        Ein 200 ohne jedes Produktmerkmal beweist nichts über die Adresse,
        sondern nur, dass Amazon uns diesmal etwas anderes geschickt hat. Als
        `unklar` gespeichert bleibt es beim nächsten Lauf fällig — als 200
        gespeichert wäre es dreißig Tage lang eine falsche Zusage.
      */
      if (!PRODUKTSEITE.test(text)) return { status: 'unklar', geprueftAm: heute() }
      /**
       * `prime` wird nur gesetzt, wenn es **zutrifft** — nie auf `false`.
       *
       * Der erste Anlauf am 20.08.2026 schrieb bei jedem Nicht-Treffer ein
       * `false`, und davon standen 427 im Bestand. Bei der Gegenprobe lieferten
       * dieselben Adressen dann `true`: Amazon hatte beim Massenlauf offenbar
       * zwischendurch etwas anderes ausgeliefert — eine Zwischenseite, keine
       * Produktseite. Der Statuscode war trotzdem 200.
       *
       * Damit war es derselbe Fehler wie beim Crunchyroll-Scraper, den Daniel am
       * selben Abend fand: ein misslungener Abruf, gespeichert als Befund. Für
       * den einzigen Zweck dieses Feldes — darf diese Adresse einen Suchlink
       * ersetzen? — genügt das Ja. Ein fehlendes `prime` heißt „unbekannt", und
       * unbekannt ersetzt nichts.
       */
      const titel = /<title>([^<]{0,160})/.exec(text)?.[1] ?? ''
      const befund: Befund = { status: res.status, geprueftAm: heute() }
      if (/\|\s*Prime Video/i.test(titel)) befund.prime = true
      return befund
    }
    return { status: res.status, geprueftAm: heute() }
  } catch (err) {
    return { status: (err as Error).name === 'TimeoutError' ? 'timeout' : 'fehler', geprueftAm: heute() }
  }
}

async function main(): Promise<void> {
  const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8')) as unknown
  const titles = (Array.isArray(roh) ? roh : Object.values(roh as object).find(Array.isArray)) as Title[]

  const bestand = readJson<Bestand>(DATEI, {})

  /**
   * Vereinigung aus Datensatz und allem, was je geprüft wurde.
   *
   * Ein als tot erkannter Verweis verschwindet aus `titles.json` — käme die
   * Schlange allein von dort, wäre er nie wieder prüfbar und ein Falschbefund
   * für immer einer. Genau diesen Fehler hatte `check-youtube.ts` beim ersten
   * Anlauf am 20.08.2026.
   */
  const adressen = new Set<string>(Object.keys(bestand))
  for (const t of titles) {
    /* Nach der gti-Brücke steht die Amazon-Seite in `seite`; geprüft wird sie, nicht JustWatchs Adresse. */
    for (const s of t.streams ?? []) if (PRUEFBAR.has(s.platform)) adressen.add(s.seite ?? s.url)
    /**
     * Auch die Amazon-Adressen aus `watchLinks` — sie sind der Ersatz für die
     * Suchlinks.
     *
     * Am 20.08.2026 waren **225 von 226** Prime-Verweisen bloße Suchen: AniList
     * liefert für die meisten Titel keinen Deeplink. Für 137 davon steht die
     * echte Adresse längst in unserem aniSearch-Bestand, nur unter dem
     * Anbieternamen `amazon`, der bei uns als Kauf gilt. Ob dahinter ein Video
     * oder eine Disc liegt, verrät erst der Seitentitel — also wird sie hier
     * mitgeprüft, und `build.ts` entscheidet danach.
     */
    for (const w of t.watchLinks ?? []) if (AMAZON_VIDEO.test(w.url)) adressen.add(w.url)
  }

  /**
   * **Die Adresse, die eine Suche ablösen könnte, steht oft gar nicht mehr im
   * Datensatz** — und wurde deshalb nie geprüft.
   *
   * Der Bestand oben kommt aus `titles.json`. Eine aniSearch-Amazon-Adresse
   * schafft es dorthin aber nur als Kaufweg, und Kaufwege werden im Bau
   * aussortiert, sobald die Seite tot oder hier gesperrt ist. Was übrig bleibt,
   * ist die Prime-**Suchadresse** — und die echte Adresse liegt weiter in
   * `data/anisearch.json`, unsichtbar für diesen Lauf.
   *
   * Real am 25.08.2026: „The Ghost in the Shell" (177699) zeigte im Kalender auf
   * `amazon.de/s?k=THE%20GHOST%20IN%20THE%20SHELL`. Daniel schickte die richtige
   * Adresse — `amazon.de/gp/video/detail/B0GZD5N2GP`. Dieselbe Kennung stand seit
   * dem aniSearch-Abruf im Haus: `amazon.de/dp/B0GZD5N2GP`. Sie war nur nie
   * geprüft worden, und ohne Beleg ersetzt `build.ts` keine Suche — zu Recht,
   * denn hinter `/dp/` kann auch eine DVD liegen.
   *
   * Gemessen über den ganzen Bestand: 167 Suchadressen, für **90** davon führt
   * aniSearch eine echte Amazon-Adresse. Davon waren 33 ungeprüft, 15 belegt
   * Prime Video, 30 Discs, 12 tot. Die 33 sind der Ertrag dieses Blocks.
   */
  const anisearch = readJson<Record<string, { streams?: Array<{ url?: string }> }>>(
    'data/anisearch.json',
    {},
  )
  const SUCHADRESSE = /amazon\.[a-z.]+\/s\?|[?&]k=/i
  const vorrang = new Set<string>()
  for (const t of titles) {
    const sucht = (t.streams ?? []).some((s) => s.platform === 'primevideo' && SUCHADRESSE.test(s.url))
    if (!sucht) continue
    for (const s of anisearch[String(t.id)]?.streams ?? []) {
      const u = s.url?.split('?')[0]
      if (!u || !AMAZON_VIDEO.test(u) || SUCHADRESSE.test(u)) continue
      adressen.add(u)
      vorrang.add(u)
    }
  }
  if (vorrang.size) log(`${vorrang.size} Adressen könnten eine Suche ablösen — sie kommen zuerst dran`)

  const grenze = new Date(Date.now() - ALTER * 86_400_000).toISOString().slice(0, 10)
  const offen = [...adressen].filter((u) => {
    const alt = bestand[u]
    /*
      **`unklar` ist kein Befund, sondern eine offene Frage.** Es steht dort, wo
      Amazon mit 200 geantwortet, aber keine Produktseite geliefert hat. Wäre es
      wie ein echter Befund dreißig Tage haltbar, hätte der Riegel nur den
      falschen Eintrag umbenannt statt ihn zu beheben.
    */
    return !alt || alt.status === 'unklar' || alt.geprueftAm < grenze
  })
  /*
    Vorrang vor der Reihenfolge des Bestands: Ein Lauf mit `--limit` würde diese
    Adressen sonst nie erreichen — der wöchentliche Lauf prüft 400 von mehreren
    Tausend, und die neuen stehen hinten.
  */
  offen.sort((a, b) => Number(vorrang.has(b)) - Number(vorrang.has(a)))
  const arbeit = LIMIT > 0 ? offen.slice(0, LIMIT) : offen
  log(`Verweise: ${adressen.size} bekannt, ${offen.length} fällig, ${arbeit.length} in diesem Lauf.`)

  /**
   * **Ab einer Sperre bringt Weiterlaufen nichts — außer einer längeren Sperre.**
   *
   * Gemessen am 07.09.2026: Ein Lauf über 1.286 Amazon-Adressen lieferte 552
   * gute und 116 tote Befunde — und danach **623 mal `unklar` am Stück**. Die
   * Gegenprobe im Einzelabruf zeigte, woran das lag: Auch eine nachweislich
   * lebende Adresse (`B0DML22FHP`, „Date a Live II", zuvor 936.253 Zeichen)
   * kam nur noch als 3.815-Zeichen-Seite ohne Titel zurück. Amazons Bot-Abwehr
   * hatte nach rund 660 Abrufen zugemacht, und zwar für alles Weitere.
   *
   * Ein zweiter Versuch nach ein paar Sekunden half bei keinem von zwölf
   * Testfällen — die Sperre gilt nicht der einzelnen Anfrage. Also wird
   * abgebrochen statt weitergeklopft: Die restlichen Adressen bleiben fällig
   * (`unklar` zählt als ungeprüft) und kommen im nächsten Lauf dran, wenn die
   * Sperre abgelaufen ist.
   *
   * Zwanzig in Folge, nicht fünf: Einzelne Zwischenseiten kommen auch im
   * gesunden Betrieb vor, eine Serie von zwanzig ist die Abwehr.
   *
   * **Die Sperre gilt Amazon, nicht dem Lauf.** Bis zum 17.09.2026 brach sie die
   * ganze Schleife ab. Vom GitHub-Runner aus sperrt Amazon fast sofort (14.09.:
   * nach 41 Adressen), und damit blieben seit dem 07.09. auch alle übrigen
   * Anbieter ungeprüft — zehn Nicht-Amazon-Befunde in zehn Tagen bei über
   * tausend fälligen. Seitdem werden nach der Sperre nur die Amazon-Adressen
   * übersprungen; sie bleiben fällig.
   */
  const SPERR_SCHWELLE = 20
  const AMAZON = /(^|\.)amazon\./i
  /**
   * **Die Sperre wird ausgesessen, nicht umgangen** (20.09.2026).
   *
   * Bis heute brach der Lauf Amazon endgültig ab, und der Rest blieb für den
   * nächsten Anlauf liegen. Gemessen ist inzwischen beides, was dafür fehlte:
   * Sie kommt nach rund 670 Abrufen (668 am 07.09., 669 am 20.09., beide bei
   * 700 ms), und sie ist **nach fünfzehn Minuten wieder offen** — eine Probe an
   * einer lebenden und einer toten Adresse kam mit vollem Inhalt und mit 404
   * zurück. Also: warten, weitermachen, und die zwanzig Adressen aus der
   * Sperrphase hinten wieder anhängen, damit die Sperre keine Lücke hinterlässt.
   *
   * Nach `--sperren` Sperren in einem Lauf wird Amazon doch übersprungen; dann
   * hilft Warten offenbar nicht mehr, und die Adressen bleiben fällig.
   */
  const SPERR_PAUSE = zahl('--sperrpause', 900) * 1000
  const MAX_SPERREN = zahl('--sperren', 3)
  let sperren = 0
  const nachgeholt = new Set<string>()
  let unklarFolge: string[] = []
  let inFolgeUnklar = 0
  let amazonGesperrt = false
  let uebersprungen = 0
  let tot = 0
  let geprueft = 0
  /* Messgröße für die Sperrschwelle: nur Amazon zählt, denn nur Amazon sperrt. */
  let amazonAbrufe = 0
  for (let i = 0; i < arbeit.length; i++) {
    const url = arbeit[i]
    const istAmazon = AMAZON.test(new URL(url).hostname)
    if (amazonGesperrt && istAmazon) {
      uebersprungen++
      continue
    }
    if (istAmazon) amazonAbrufe++
    const neu = await pruefe(url)
    /*
      **Eine Nichtauskunft löscht keinen Befund.**

      `unklar` heißt „Amazon hat uns diesmal nichts gezeigt" — das ist keine
      Aussage über die Adresse und darf deshalb keine ersetzen. Am 07.09.2026
      genau so passiert: Zwei als 404 gemessene Aniverse-Adressen standen im
      Bestand, ein Testlauf lief zwanzig Minuten später gegen die Abwehr, und
      danach stand dort wieder `unklar`. Die beiden toten Verweise waren damit
      zurück auf der Seite.

      Der alte Eintrag bleibt also stehen; nur sein Datum wird nicht erneuert,
      damit die Adresse fällig bleibt. Ein **echter** Befund — 200 mit
      Produktseite, 404, Regionssperre — überschreibt weiterhin alles.
    */
    const altStatus = bestand[url]?.status
    const behalten =
      neu.status === 'unklar' && altStatus !== undefined && altStatus !== 'unklar'
    if (!behalten) bestand[url] = neu
    if (neu.status === 'unklar') {
      if (istAmazon) unklarFolge.push(url)
      if (++inFolgeUnklar >= SPERR_SCHWELLE) {
        /* Die Zahl, an der sich Takt gegen Menge entscheidet — je Lauf eine Zeile. */
        warn(`Sperrschwelle gemessen: ${amazonAbrufe} Amazon-Abrufe bei ${PAUSE} ms Takt.`)
        if (++sperren > MAX_SPERREN) {
          warn(`${sperren - 1} Sperren in einem Lauf — weiter ohne Amazon, der Rest bleibt fällig.`)
          amazonGesperrt = true
        } else {
          /* Die Adressen aus der Sperrphase sind ungeprüft, nicht unbrauchbar. */
          const wieder = unklarFolge.filter((u) => !nachgeholt.has(u))
          wieder.forEach((u) => nachgeholt.add(u))
          arbeit.push(...wieder)
          warn(
            `Amazon sperrt (Sperre ${sperren} von ${MAX_SPERREN}) — ${SPERR_PAUSE / 60000} min Pause, ${wieder.length} Adressen kommen danach erneut dran.`,
          )
          await sleep(SPERR_PAUSE)
        }
        inFolgeUnklar = 0
        unklarFolge = []
      }
    } else if (istAmazon) {
      inFolgeUnklar = 0
      unklarFolge = []
    }
    /* Gezählt wird, was dieser Lauf gefunden hat — nicht, was schon dastand. */
    if (neu.status === 404 || neu.status === 'region') tot++
    if (++geprueft % 100 === 0) log(`  ${geprueft}/${arbeit.length} — ${tot} unbrauchbar`)
    await sleep(Math.round(PAUSE * (0.7 + Math.random() * 0.6)))
  }

  /*
    **Vor dem Schreiben wird neu eingelesen** (17.09.2026). Der Lauf hält seinen
    Stand vom Start und schreibt ihn am Ende zurück; läuft daneben ein zweiter,
    verliert der spätere Schreiber die Befunde des früheren. Genau so sind an
    diesem Abend 401 Befunde eines Laufs unter 148 eines zweiten verschwunden —
    derselbe Mechanismus wie bei einem Datenlauf, der auf `main` committet, nur
    innerhalb einer Datei. Was inzwischen dazukam, bleibt stehen; nur dieser
    Lauf hat neuere Auskünfte über die Adressen, die er selbst gefragt hat.
  */
  const inzwischen = readJson<Bestand>(DATEI, {})
  for (const [url, b] of Object.entries(inzwischen)) {
    const eigen = bestand[url]
    if (!eigen || (b.geprueftAm ?? '') > (eigen.geprueftAm ?? '')) bestand[url] = b
  }
  writeJson(DATEI, bestand)
  const gesamtTot = Object.values(bestand).filter((b) => b.status === 404 || b.status === 'region').length
  log(`Verweise: ${geprueft} geprüft, ${tot} davon unbrauchbar. Im Bestand insgesamt ${gesamtTot} unbrauchbar.`)
  if (uebersprungen) log(`${uebersprungen} Amazon-Adressen wegen der Sperre übersprungen — sie bleiben fällig.`)
  if (!geprueft && offen.length) warn('Nichts geprüft, obwohl etwas fällig war — Aufruf prüfen.')
  /* Nichts faellig ist der Normalfall, sobald alle Adressen geprueft sind —
     kein Grund, den Lauf als stumm zu melden (29.08.2026). */
  recordSource('link-check', geprueft, undefined, undefined, true)
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
