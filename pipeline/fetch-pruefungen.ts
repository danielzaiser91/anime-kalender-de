/**
 * Holt die Prüfergebnisse ab, die Daniel im Browser abgeschickt hat.
 *
 * Der Weg (21.08.2026): Er öffnet einen Titel beim Anbieter, die Erweiterung in
 * `extension/` blendet einen Knopf ein, der Klick schickt die gelesenen
 * Tonspuren an den Worker. Dieses Skript holt sie von dort und trägt sie in
 * `data/dub-confirmed.yaml` ein — die Datei bleibt die maßgebliche Fassung, der
 * Worker ist nur der Briefkasten dazwischen.
 *
 * Warum das kein Scraping ist: Die Seiten hat er selbst geöffnet, die
 * Erweiterung liest nur, was der Player ohnehin geladen hat. Für Netflix ist das
 * der einzige erlaubte Weg — deren `robots.txt` untersagt jeden automatisierten
 * Abruf.
 *
 * Aufruf: npm run data:pruefungen
 */
import { appendFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { wegGiltGanzerAdresse } from './lib/weg-entwerten.ts'
import yaml from 'js-yaml'
import { amazonTitelAdresse, echteAmazonAdresse } from './lib/amazon-adresse.js'
import { dirname, resolve } from 'node:path'
import {
  beschreibeBereiche,
  bildeBereiche,
  ordneMeldungZu,
  ordneNachStaffelliste,
  verteileAufStaffeln,
  type AnbieterStaffel,
  type Staffeleintrag,
} from './lib/folgenbereiche.ts'
import { log, ROOT, warn } from './lib/util.ts'
import { adressKern } from './lib/dub-confirmed.ts'
import { schluesselAdresse, titelSchluessel } from './lib/zuordnung.ts'
import { staffelNummern, type Reiheneintrag } from './lib/staffel-nummern.ts'
import { folgentitelAusNotiz, folgeUeberTitel } from './lib/folgentitel-anker.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN
/** Nur zeigen, was entstünde — nichts schreiben, nichts abhaken. */
const TROCKEN = process.argv.includes('--trocken')
/*
  **Abgehakt wird erst, wenn der Bau die neuen Belege angenommen hat** (17.09.2026).
  `--abhaken-spaeter` legt die Kennungen in eine Datei, `--nur-abhaken` schickt sie
  nach dem Commit ab. Verwirft der Bau die Belege, bleibt die Datei ungenutzt und
  die Meldungen liegen weiter im Briefkasten.
*/
const ABHAKEN_SPAETER = process.argv.includes('--abhaken-spaeter')
const ABHAKEN_DATEI = resolve(ROOT, 'data/cache/pruefungen-abhaken.json')

interface Pruefung {
  id: number
  plattform: string
  url: string
  sprachen: string | null
  befund: 'dub' | 'kein_dub' | 'weg'
  titel: string | null
  folgen: number | null
  folge_nr: number | null
  staffel: number | null
  staffeln: string | null
  serientitel: string | null
  notiz: string | null
  /* Der Teil der Anbieter-Liste, den dieser Eintrag meint — siehe DubCheck. */
  teil_von: number | null
  teil_bis: number | null
  gemeldet_am: string
  /**
   * **Welche Seite angesehen wurde — nicht, welcher Auftrag gemeint war.**
   *
   * Der Worker liefert das Feld seit Migration 021; hier stand es nicht, und
   * damit fehlte es auch in der Gruppierung. Zwei Ausgaben unter einer
   * Suchadresse wurden dadurch zu einem Beleg (Death Note: Relight,
   * 09.09.2026).
   */
  seiten_kennung?: string | null
  /**
   * **Der Titel der Folge, auf die sich die Meldung bezieht.**
   *
   * Die Erweiterung schickt ihn seit jeher mit (`folge: stand.folge`); der
   * Worker warf ihn beim Empfang weg und speichert ihn erst seit Migration 028.
   *
   * Er ist der Anker, den Nummern nicht ersetzen: Netflix zählt die
   * Haikyu!!-OVA als Folge 26 der ersten Staffel und nennt sie „Haikyu! OVA".
   * Über Zahlen allein ist das nicht von der 26. Folge einer 26-teiligen Serie
   * zu unterscheiden — der Titel sagt es in einem Wort.
   *
   * Daniel am 10.09.2026: „du musst doch eig nur die titel aller episoden
   * kennen, um es beim abgleich später korrekt zuordnen zu können?"
   */
  folge?: string | null
}

if (!TOKEN) {
  warn('LAUF_TOKEN fehlt — ohne das Token gibt der Worker die Prüfungen nicht heraus.')
  process.exit(0)
}

if (process.argv.includes('--nur-abhaken')) {
  if (!existsSync(ABHAKEN_DATEI)) {
    log('Nichts abzuhaken.')
    process.exit(0)
  }
  const ids = JSON.parse(readFileSync(ABHAKEN_DATEI, 'utf8')) as number[]
  const q = await fetch(`${WORKER}/pruefung`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
    body: JSON.stringify({ uebernommen: ids }),
  })
  log(q.ok ? `${ids.length} Meldungen im Worker abgehakt` : `Abhaken fehlgeschlagen (HTTP ${q.status})`)
  rmSync(ABHAKEN_DATEI)
  process.exit(0)
}

const antwort = await fetch(`${WORKER}/pruefung?token=${encodeURIComponent(TOKEN)}`)
if (!antwort.ok) {
  warn(`Prüfungen nicht abrufbar: HTTP ${antwort.status}`)
  /*
    **Ein nicht erreichbarer Briefkasten ist eine Störung, kein Befund** (24.09.2026). Ab 19:45
    antwortete der Worker mit HTTP 500 — D1s Tageskontingent an gelesenen Zeilen war aufgebraucht,
    bis Mitternacht UTC. Mit Exit 1 wäre jeder Bestandslauf bis dahin rot geworden, obwohl nichts
    am Bestand falsch war. Die Meldungen bleiben im Briefkasten und kommen mit dem nächsten Lauf;
    die Statusanzeige wird gelb und nennt den Grund.
  */
  if (antwort.status >= 500) {
    if (process.env.GITHUB_ENV) {
      const alt = process.env.DATEN_WARNUNG ? process.env.DATEN_WARNUNG + ' · ' : ''
      appendFileSync(process.env.GITHUB_ENV, `DATEN_WARNUNG=${alt}Briefkasten nicht erreichbar (HTTP ${antwort.status}) — Meldungen kommen mit dem nächsten Lauf\n`)
    }
    process.exit(0)
  }
  process.exit(1)
}
const { pruefungen } = (await antwort.json()) as { pruefungen: Pruefung[] }

/*
  **Welche gti trägt die gemeldete Amazon-Seite?** (gti-Brücke, 17.09.2026)
  Die Erweiterung schreibt sie seit 4.20.25 als `gti=` in die Notiz. Gesammelt wird
  unabhängig davon, ob die Meldung ein Urteil ergibt; der Bau stellt einen Verweis nur
  um, wenn diese gti mit JustWatchs übereinstimmt.
*/
{
  const datei = resolve(ROOT, 'data/amazon-gti-belegt.json')
  const bisher = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as Record<string, string>) : {}
  let neu = 0
  for (const p of pruefungen) {
    const gti = /\bgti=(amzn1\.dv\.gti\.[0-9a-f-]{36})/.exec(p.notiz ?? '')?.[1]
    const kennung = String(p.seiten_kennung ?? '').trim()
    if (p.plattform !== 'primevideo' || !gti || !/^[A-Z0-9]{10,26}$/i.test(kennung)) continue
    const k = adressKern(`https://www.amazon.de/dp/${kennung}`)
    if (bisher[k] === gti) continue
    bisher[k] = gti
    neu++
  }
  if (neu && !TROCKEN) {
    writeFileSync(datei, JSON.stringify(bisher, null, 2) + '\n')
    log(`${neu} Amazon-Seiten mit abgelesener gti`)
  }
}

if (!pruefungen.length) {
  log('Keine neuen Prüfungen.')
  process.exit(0)
}

/**
 * Von der Adresse zum Titel.
 *
 * Die Erweiterung meldet die Adresse, die im Browser stand. Unser Datensatz
 * führt dieselbe Adresse an einem oder mehreren Titeln — bei Demon Slayer teilen
 * sich fünf AniList-Einträge eine Netflix-Adresse, und eine Prüfung belegt dann
 * alle fünf.
 */
const titles = JSON.parse(readFileSync(resolve(ROOT, 'public/data/titles.json'), 'utf8'))
const liste: Array<{
  id: number
  titleDe?: string
  titleEn?: string
  titleRomaji?: string
  episodes?: number
  jpYear?: number
  /** Die Reihe, zu der der Titel gehört — der Bau rechnet sie aus den AniList-Relationen aus. */
  franchiseId?: number
  jpSeason?: string
  format?: string
  streams?: Array<{ platform: string; url: string; seite?: string }>
}> =
  Array.isArray(titles) ? titles : (titles.titles ?? Object.values(titles))

const nachUrl = new Map<string, number[]>()
for (const t of liste) {
  for (const s of t.streams ?? []) {
    /* Die Prüfliste öffnet die Amazon-Seite (`seite`), nicht JustWatchs gti-Adresse (17.09.2026). */
    for (const u of new Set([s.url, s.seite])) {
      if (!u) continue
      const k = schluesselAdresse(u)
      const liste2 = nachUrl.get(k) ?? []
      liste2.push(t.id)
      nachUrl.set(k, liste2)
    }
  }
}

/**
 * **Auch eine vorgeschlagene Adresse ist eine Adresse.**
 *
 * Die Prüfliste enthält nicht nur Titel mit Verweis, sondern auch Vorschläge
 * aus `data/anbieter-vorschlaege.json` — Titel, von denen wir vermuten, dass
 * Prime sie führt. Ihre Suchadresse baut der Listengenerator aus dem Namen,
 * und genau unter dieser Adresse meldet die Erweiterung.
 *
 * Der Bau kannte sie nicht: `nachUrl` entstand allein aus `titles.json`.
 * Meldungen zu Vorschlägen fanden deshalb keinen Anker und landeten in
 * `data/prime-unzugeordnet.json` — am 31.08.2026 waren das 887 Einträge.
 * „Hamatora: The Animation" stand am 30.08. als geprüft gemeldet und am
 * nächsten Tag unverändert auf der Prüfliste.
 *
 * Die Adresse wird hier **genauso** gebildet wie dort. Zwei Fassungen derselben
 * Formel liefen garantiert auseinander, deshalb steht die Begründung an beiden
 * Stellen.
 */
{
  const datei = resolve(ROOT, 'data/anbieter-vorschlaege.json')
  if (existsSync(datei)) {
    const vorschlaege = JSON.parse(readFileSync(datei, 'utf8')) as Array<{
      id: number
      titel: string
      anbieter?: string[]
    }>
    for (const v of vorschlaege) {
      if (!v.anbieter?.includes('primevideo') || !v.titel || !v.id) continue
      const k = schluesselAdresse(
        'https://www.amazon.de/s?k=' + encodeURIComponent(v.titel) + '&i=instant-video',
      )
      const bisher = nachUrl.get(k) ?? []
      if (!bisher.includes(v.id)) nachUrl.set(k, [...bisher, v.id])
    }
  }

  /*
    **Und dieselbe Brücke für die Wiedervorlagen mit eigener Adresse.**

    `tools/extension-offene-amazon.mjs` führt unter `ERNEUT` Adressen, die
    unser Datensatz **nicht** kennt — eine zweite Prime-Ausgabe etwa, die es
    dort gibt und bei uns nicht. Die Erweiterung meldet unter genau dieser
    Adresse, und der Lauf fand keinen Anker: „B0GPD4GNLL — im Datensatz nicht
    gefunden", die Meldung vom 01.09.2026 blieb liegen.

    Der Eintrag nennt seine `anilistId` selbst; sie steht dort, weil sie sich
    aus der Adresse nicht ableiten lässt.
  */
  const listenDatei = resolve(ROOT, 'extension/offene-amazon.js')
  if (existsSync(listenDatei)) {
    try {
      const roh = readFileSync(listenDatei, 'utf8')
      const daten = JSON.parse(roh.slice(roh.indexOf('{'), roh.lastIndexOf('}') + 1)) as Record<
        string,
        { url?: string; anilistId?: number; eintraege?: { id?: number | null }[] }
      >
      /*
        **Die Kennung steht zweimal in dieser Datei, und meistens nur an einer Stelle.**

        `anilistId` auf der äußeren Ebene trägt ein Auftrag nur, wenn sie von Hand
        ergänzt wurde — sie ist der Sonderfall für Adressen, die sich sonst nicht
        auflösen lassen. Der Regelfall ist `eintraege[].id`: Dort steht, welche
        Werke unter dieser Adresse zu prüfen sind, und das ist die Kennung, die der
        Bau braucht.

        **Derselbe Griff hat schon einmal drei Tage gekostet.** Am 28.08.2026 sendete
        die Erweiterung ein Feld `titelId`, das sie aus `eintrag?.id` las — auch dort
        die äußere Ebene, auch dort immer `undefined` (CLAUDE.md, „Ein neues Feld ist
        erst eingebaut, wenn es am Ziel angekommen ist"). Hier stand der gleiche
        Zugriff noch, und er ist am 02.09.2026 aufgefallen, als „Karakai Jouzu no
        Takagi-san 2" gemeldet wurde: saubere Meldung, Adresse in keinem Verweis des
        Datensatzes, Kennung 107068 im Auftrag — und niemand las sie.

        Gelesen werden deshalb beide. Mehrere Werke unter einer Adresse sind der
        Normalfall (eine Serienseite führt alle Staffeln); welches gemeint ist,
        entscheidet danach die Folgenzahl, nicht diese Liste.
      */
      for (const eintrag of Object.values(daten)) {
        if (!eintrag?.url) continue
        const k = schluesselAdresse(eintrag.url)
        const kennungen = [
          ...(eintrag.anilistId ? [eintrag.anilistId] : []),
          ...(eintrag.eintraege ?? []).map((e) => e?.id).filter((n): n is number => Number.isFinite(n)),
        ]
        if (!kennungen.length) continue
        const bisher = nachUrl.get(k) ?? []
        nachUrl.set(k, [...bisher, ...kennungen.filter((id) => !bisher.includes(id))])
      }
    } catch {
      /* Ohne lesbare Liste bleibt es bei den Ankern aus dem Datensatz. */
    }
  }
}

/**
 * Der Rückweg von einem Namen zu unseren Kennungen.
 *
 * Nur für Meldungen, deren Adresse nichts trifft — und nur als Vorschlag.
 */
const nachTitel = new Map<string, number[]>()
for (const t of liste) {
  for (const name of [t.titleDe, t.titleEn, t.titleRomaji]) {
    if (!name) continue
    const k = titelSchluessel(name)
    if (!k) continue
    nachTitel.set(k, [...(nachTitel.get(k) ?? []), t.id])
  }
}

/**
 * **Eine Suchadresse trägt den Titel, mit dem wir sie gebaut haben.**
 *
 * Unsere Prüfliste erzeugt Prime-Suchen als
 * `https://www.amazon.de/s?k=<Titel>&i=instant-video`. Der Titel steht dort im
 * Klartext, und er stammt aus **unserem** Bestand — nicht von Amazon. Wer ihn
 * zurückliest und im Bestand genau einen Treffer findet, hat keine Ähnlichkeit
 * geraten, sondern die Adresse gelesen.
 *
 * Das schließt eine Lücke, die der Namensabgleich nicht schließen kann: Die
 * Erweiterung meldet den Titel, den **Amazon** anzeigt. Bei „Code Geass: Akito
 * the Exiled - The Wyvern Arrives" führen wir „… - Der zerrissene Wyvern", der
 * Name trifft also nicht — die Adresse dagegen nennt genau unseren englischen
 * Titel. Am 31.08.2026 lagen 17 solcher Meldungen im Briefkasten, jede mit
 * eindeutigem Vorschlag und keine zugeordnet.
 *
 * `mitTeilnummer()` hängt an mehrteilige Titel „— Teil N" an; das fällt beim
 * zweiten Versuch weg.
 */
/**
 * **Eine Suchadresse ist kein Weg — die gelesene Seite schon.**
 *
 * Ein Suchauftrag wird auf der Titelseite gemeldet, die Meldung läuft aber unter
 * der Adresse aus dem Bestand: der Suchadresse. Kennt der Bau keinen besseren
 * Weg, schreibt er genau die als `url` in `dub-confirmed.yaml` — und damit landet
 * sie im Kalender.
 *
 * Fünf solche Wege stehen dort (Stand 02.09.2026), etwa bei „Shakugan no Shana:
 * Season III". Wer auf „Wo läuft es" klickt, landet in einer Amazon-Suche statt
 * beim Titel; das beantwortet die Frage nicht, die dieses Projekt stellt.
 *
 * Die Angabe fehlt nicht — sie wurde nur nicht gelesen: Jede Meldung trägt
 * `seiten_kennung`, die Kennung der Seite, auf der wirklich nachgesehen wurde.
 * Daraus wird der Weg gebaut, wo die Meldung selbst nur eine Suche nennt.
 *
 * Bei allem anderen bleibt die gemeldete Adresse stehen: Sie ist die aus unserem
 * Bestand, und die Pipeline sucht nach ihr.
 */
function wegAusMeldung(p: { url: string; seiten_kennung?: string | null; staffel?: number | null }): string {
  const kennung = String(p.seiten_kennung ?? '').trim()
  /*
    **Eine Staffel ab 2 bekommt die Adresse ihrer eigenen Seite** (17.09.2026,
    Golden Kamuy): Der Staffelwechsel läuft auf der Seite von Staffel 1, die
    Meldung trägt deren Adresse. Stünde sie im Beleg, zeigte der Weg der
    zweiten Staffel auf die erste.
  */
  if (
    /amazon\.de/.test(p.url) &&
    Number(p.staffel) >= 2 &&
    /^[A-Z0-9]{10,26}$/.test(kennung) &&
    !p.url.includes(kennung)
  ) {
    return amazonTitelAdresse(kennung)
  }
  if (!p.url.includes('/s?k=')) return p.url
  if (!/^[A-Z0-9]{8,}$/i.test(kennung)) return p.url
  return `https://www.amazon.de/gp/video/detail/${kennung}`
}

function ausSuchadresse(url: string): number[] {
  let begriff: string | null = null
  try {
    begriff = new URL(url).searchParams.get('k')
  } catch {
    return []
  }
  if (!begriff) return []
  const versuche = [begriff, begriff.replace(/\s+[—–-]\s+Teil\s+\d+\s*$/i, '')]
  for (const v of versuche) {
    const treffer = [...new Set(nachTitel.get(titelSchluessel(v)) ?? [])]
    if (treffer.length === 1) return treffer
  }
  return []
}

/** Ein Zeitpunkt als Datum in Ortszeit Europe/Berlin. */
function berlinDatum(iso: string): string {
  return new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Berlin' }).format(new Date(iso))
}

const heute = berlinDatum(new Date().toISOString())
const zeilen: string[] = []
/** Kanal-Meldungen ohne Urteil und ohne neue Adresse — sie würden nur verdecken. */
let ausgelassenKanal = 0
let uebernommen = 0
let selbstZugeordnet = 0
/** Meldungen, die über ihre Staffelnummer an den richtigen Titel der Reihe gingen. */
let nachStaffelZugeordnet = 0
let nachFolgentitelZugeordnet = 0
/** Meldungen, deren Suchadresse den Titel im Klartext trug. */
let ausSuchadresseZugeordnet = 0
/** Wie viele Adressen die Meldung selbst zugeordnet hat — der Weg ohne Raten. */
let ausMeldungZugeordnet = 0
const offenGeblieben: string[] = []
/*
  **Was nach einem Fehler der Erweiterung aussieht, wird sichtbar** (Daniel,
  17.09.2026: „bau es so, das wir direkt mitbekommen wenn die extension schuld
  ist"). Nichts davon hält den Import auf; der Lauf wird gelb, und die Liste
  steht in `data/meldungs-auffaelligkeiten.json`.
*/
const auffaellig: string[] = []
/** Meldungen, deren Adresse unser Datensatz nicht kennt — samt Namensvorschlag. */
/**
 * Wie der Anbieter seine Staffeln selbst einteilt, je Adresse.
 *
 * Das ist die einzige verlässliche Grundlage für die Frage „welche Folge soll
 * ich anklicken": Netflix führt BAKI-DOU als **eine** Staffel mit 25 Folgen,
 * unser Datensatz als zwei mit 13 und 12 (Daniel, 22.08.2026: „es gibt keine
 * staffel 2, wie die liste es behauptet"). Und bei My Hero Academia zählt
 * Netflix über alle Staffeln durch — Staffel 7 beginnt bei Folge 146.
 *
 * Wer hier rät, schickt jemanden zu einer Folge, die es nicht gibt.
 */
const anbieterStruktur: Record<string, unknown> = existsSync(resolve(ROOT, 'data/anbieter-staffeln.json'))
  ? JSON.parse(readFileSync(resolve(ROOT, 'data/anbieter-staffeln.json'), 'utf8'))
  : {}

const ohneZuordnung: Array<{
  url: string
  name: string
  plattform: string
  befund: string
  vorschlag: number[]
}> = []
/** Kennungen der Meldungen, die wirklich eingetragen wurden. */
const erledigteIds = new Set<number>()

/**
 * Die Staffeln hinter einer Anbieteradresse, in Ausstrahlungsreihenfolge.
 *
 * Die Reihenfolge entscheidet über jede Zuordnung: Rechnet sie falsch, landet
 * ein Befund an der falschen Staffel und sieht dabei aus wie geprüft. Sortiert
 * wird deshalb nach japanischer Erstausstrahlung, nicht nach AniList-Kennung —
 * die steigt zwar meistens mit der Zeit, aber eben nur meistens.
 */
const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
function staffelnDerAdresse(ids: number[]): Staffeleintrag[] {
  /*
    **Bei einem einzigen Titel braucht es keine Folgenzahl.**

    Die Zahl dient dazu, durchgezählte Meldungen auf mehrere Staffeln zu
    verteilen. Hängt nur einer an der Adresse, gibt es nichts zu verteilen —
    der Befund gehört ihm.

    Ohne diese Ausnahme fiel „Beyblade X" durch: AniList führt für den Titel
    keine Folgenzahl, damit blieb die Staffelliste leer, und die Zuordnung
    verweigerte sich. 86 Meldungen aus Daniels Durchgang lagen daraufhin im
    Briefkasten fest (26.08.2026). Vierzehn weitere Titel mit Verweis haben
    dieselbe Lücke.

    Die Folgenzahl kommt dann von der Meldung selbst: Der Anbieter hat gerade
    gezählt, wie viele es sind.
  */
  const einTitel = ids.length === 1
  const alle = ids
    .map((id) => liste.find((x) => x.id === id))
    .filter((t): t is NonNullable<typeof t> => Boolean(t?.episodes) || (einTitel && Boolean(t)))
  /**
   * OVAs und Specials zählen nicht als eigene Staffeln.
   *
   * Der Anbieter rechnet sie als Folgen der Staffel mit: Netflix meldet für
   * HAIKYU!! vier Staffeln zu 26, 26, 11 und 27 Folgen, unsere Einträge an
   * derselben Adresse sind 25, **1**, 25, **1** — die beiden Einsen sind OVAs.
   * Der Reihe nach gepaart ergibt das Unsinn, und die Zuordnung verweigerte
   * sich zu Recht (22.08.2026). Ohne sie stimmt die Reihenfolge.
   *
   * Ein Titel, an dessen Adresse **nur** Filme hängen, bleibt unberührt.
   */
  /**
   * **Sie zählen nicht als Staffeln — deshalb müssen sie hier bleiben.**
   *
   * Der Absatz darüber stimmt in der Beobachtung und irrte im Schluss: Weil der
   * Anbieter OVAs als Folgen seiner Staffeln mitrechnet, gehören sie in die
   * Rechnung — nicht aus ihr heraus. Sie zu entfernen machte aus „Netflix zählt
   * 26, wir 25" ein unlösbares Rätsel, statt es zu beantworten (die 26. ist die
   * OVA).
   *
   * `ordneNachStaffelliste()` verteilt seit dem 10.09.2026 kumulativ und
   * braucht dafür **alle** Einträge in ihrer Reihenfolge. Geht die Verteilung
   * nicht auf, fällt es dort auf die alten Wege zurück — ohne diese Liste fiel
   * es auf einen falschen.
   *
   * Filme bleiben draußen, wo Serien danebenstehen: Ein Film ist keine Folge
   * einer Staffel, und seine Eins würde die Rechnung um eins verschieben.
   */
  const ohneFilme = alle.filter(
    (t) => t.format !== 'MOVIE' || !alle.some((x) => x.format === 'TV' || x.format === 'ONA'),
  )
  return ohneFilme
    .sort((a, b) => {
      const jahr = (a.jpYear ?? 0) - (b.jpYear ?? 0)
      if (jahr) return jahr
      return (JAHRESZEIT[a.jpSeason ?? ''] ?? 0) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 0)
    })
    .map((t) => ({
      id: t.id,
      titel: t.titleDe ?? t.titleEn ?? String(t.id),
      /* Bei einem einzigen Titel ist die Zahl ohne Belang — siehe oben. */
      folgen: (t.episodes ?? Number.MAX_SAFE_INTEGER) as number,
    }))
}

/**
 * Meldungen zur selben Adresse gehören zusammen.
 *
 * Bis zum 22.08.2026 schrieb jede Meldung ein `dub` für die **ganze** Reihe.
 * Daniel prüfte sieben Folgen einer Serie, sechs davon ohne deutschen Ton — am
 * Ende stand „kein Deutsch", obwohl er die deutsche Fassung gesehen hatte. Sein
 * Urteil: „wenn die extension alle 7 auf kein deutsch gesetzt hat ist die logik
 * komplett schlecht". Deshalb wird jetzt erst gebündelt, dann gefolgert.
 */
const jeAdresse = new Map<string, Pruefung[]>()
for (const p of pruefungen) {
  /*
    **Und die Seitenkennung gehört dazu — sonst frisst die zweite Ausgabe die
    erste.**

    Eine Suchadresse steht für einen Auftrag, nicht für ein Angebot: Prime führt
    „Death Note: Relight" als zwei Kauftitel (`B0FVDZ286F`, `B0FWYWSS3M`), und
    beide Meldungen tragen dieselbe `url`. Ohne die Kennung landeten sie in
    einer Gruppe, aus der genau **ein** Beleg entsteht — der der jüngeren
    Meldung. Gemessen am 09.09.2026: Daniel meldete beide, im Bestand stand
    danach nur `B0FWYWSS3M`.

    Das ist dieselbe Trennung, die `loadDubChecks()` seit dem 07.09.2026 beim
    **Lesen** zieht („Ein Beleg gehört einer Ausgabe, nicht einem Titel", Date a
    Live IV). Beim Schreiben fehlte sie.

    **Meldungen ohne Kennung bleiben beieinander** (leerer Zusatz): Das sind die
    Folgen-Meldungen einer Reihe, und für die ist die Bündelung der Zweck dieser
    Gruppe.
  */
  /*
    **Bei Netflix trennt die Staffel, wo sie bekannt ist** (18.09.2026). Netflix führt
    alle Staffeln unter einer Adresse und hat keine Seitenkennung je Staffel; ohne
    diesen Zusatz landeten Staffel 1 und 2 von „The Quintessential Quintuplets" in
    einer Gruppe und damit in **einem** Beleg. Eine Meldung ohne Staffel bleibt bei den
    übrigen ihrer Adresse — für sie ist die Bündelung weiter der Zweck.
  */
  const staffelTeil = p.plattform === 'netflix' && typeof p.staffel === 'number' ? `\u0000S${p.staffel}` : ''
  const schluessel = `${p.plattform}\u0000${p.url}\u0000${p.seiten_kennung ?? ''}${staffelTeil}`
  jeAdresse.set(schluessel, [...(jeAdresse.get(schluessel) ?? []), p])
}

/** Wie viele Meldungen der Folgentitel zugeordnet hat — steht am Ende im Protokoll. */
let ueberFolgentitel = 0

/** Die Reihe je Titel, aus dem gebauten Datensatz. */
const reiheVon = new Map<number, Reiheneintrag[]>()
{
  const reihen = JSON.parse(readFileSync(resolve(ROOT, 'public/data/franchises.json'), 'utf8')) as Record<string, Reiheneintrag[]>
  for (const r of Object.values(reihen)) for (const m of r) reiheVon.set(m.id, r)
}
for (const gruppe of jeAdresse.values()) {
  const p = gruppe[gruppe.length - 1]!
  /**
   * **Die Meldung sagt selbst, für welches Werk sie gemeldet wurde.**
   *
   * Alles Weitere unten ist Rekonstruktion: die Adresse im Datensatz suchen, die
   * Suchadresse zerlegen, zuletzt Namen vergleichen. Das war nötig, solange die
   * Erweiterung nur meldete, *was* sie gesehen hat, und nicht, *wofür*.
   *
   * Anbieter führen denselben Anime unter mehreren Kennungen — Jujutsu Kaisen
   * meldete sich als `title/80237957`, bei uns steht `title/81278456`. Die
   * Adresse kann die Frage deshalb grundsätzlich nicht beantworten; der Auftrag
   * kann es immer. Am 02.09.2026 warteten 36 Meldungen in
   * `daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md` auf eine Bestätigung,
   * die niemand hätte geben müssen.
   *
   * Seit dem 02.09.2026 tragen alle drei Melder `titelId` mit (staffelgenau aus
   * ihrer Auftragsliste), der Worker speichert sie in `pruefung.titel_id`, und
   * hier steht sie an erster Stelle. Was von vorher liegen blieb, geht weiter
   * über die Wege darunter — die bleiben, für Meldungen ohne Auftrag und für den
   * Altbestand.
   */
  const ausMeldung = gruppe
    .map((m) => (m as { titel_id?: number | null }).titel_id)
    .filter((n): n is number => Number.isFinite(n as number))
  let ids = ausMeldung.length ? [...new Set(ausMeldung)] : (nachUrl.get(schluesselAdresse(p.url)) ?? [])
  if (ausMeldung.length) ausMeldungZugeordnet++
  if (!ids.length && p.url.includes('/s?k=')) {
    const ausAdresse = ausSuchadresse(p.url)
    if (ausAdresse.length) {
      ids = ausAdresse
      ausSuchadresseZugeordnet++
    }
  }
  if (!ids.length) {
    // Der Titel ist die letzte Chance — und nur ein Vorschlag: Ein Name ist
    // eine Ähnlichkeit, kein Beleg.
    /**
     * Der Namensvergleich darf unscharf sein — sonst findet er das Naheliegende
     * nicht.
     *
     * Daniel meldete „Magi – Netflix" als verschwunden; wir führen den Titel als
     * „Magi: The Labyrinth of Magic". Exakt verglichen passte nichts, und in der
     * Liste stand „Titel von Hand suchen" — dabei war die Antwort schlicht, dass
     * wir für diesen Titel gar keinen Netflix-Verweis haben und also nichts zu
     * tun ist (23.08.2026: „warum soll ich das nochmal prüfen").
     *
     * Erst exakt, dann als Anfang eines längeren Namens. Der Vorschlag bleibt
     * ein Vorschlag — er entscheidet nichts, er stellt nur die richtige Frage.
     */
    const name = p.serientitel ?? p.titel ?? ''
    const schluessel = name ? titelSchluessel(name) : ''
    let geraten = schluessel ? (nachTitel.get(schluessel) ?? []) : []
    if (!geraten.length && schluessel.length >= 4) {
      for (const [k, ids] of nachTitel) {
        // „magi" findet „magi the labyrinth of magic", nicht „imagination".
        if (k === schluessel || k.startsWith(schluessel + ' ')) geraten = [...geraten, ...ids]
      }
    }
    /**
     * Ein **exakter** Namenstreffer auf genau einen Titel entscheidet selbst.
     *
     * Daniel am 23.08.2026: „was soll ich genau machen ... was genau soll denn
     * verbunden werden". Bei „NANA", „The Disastrous Life of Saiki K." und „My
     * Love Story with Yamada-kun at Lv999" hiess der gemeldete Name **genau** so
     * wie unserer — da gibt es nichts zu entscheiden, nur etwas einzutragen.
     *
     * Vorgelegt wird nur noch, was mehrdeutig ist: mehrere Treffer, ein
     * ungefährer, oder gar keiner.
     */
    const eindeutig = [...new Set(geraten)]
    const unserName = eindeutig.length === 1 ? (liste.find((x) => x.id === eindeutig[0])?.titleDe ?? liste.find((x) => x.id === eindeutig[0])?.titleEn ?? '') : ''
    if (eindeutig.length === 1 && unserName && titelSchluessel(name) === titelSchluessel(unserName)) {
      // Der Name stimmt **genau** — da gibt es nichts zu entscheiden, nur
      // etwas einzutragen. Die Adresse ist neu und kommt gleich mit.
      ids = eindeutig
      selbstZugeordnet++
    } else {
      ohneZuordnung.push({ url: p.url, name, plattform: p.plattform, befund: p.befund, vorschlag: eindeutig })
      offenGeblieben.push(
        `${p.url} — im Datensatz nicht gefunden${eindeutig.length ? ` (Vorschlag: ${eindeutig.join(', ')})` : ''}`,
      )
      continue
    }
  }

  /**
   * **Eine Staffel gehört ihrem Titel, nicht dem Kopf der Reihe.**
   *
   * Prime nennt jede Staffel von „Tokyo Ghoul" schlicht „Tokyo Ghoul", also
   * fand der Namensabgleich immer nur AniList 20605. Am 31.08.2026 standen
   * daraufhin die Belege für Staffel 2, 3 und 4 unter der **ersten** Staffel,
   * während „Tokyo Ghoul √A" und „Tokyo Ghoul:re" weiter auf der Prüfliste
   * warteten. Daniel: „das sind staffel 2 und 3, beides ist gemeldet,
   * zuordnung passiert seperat, stell sicher das es korrekt klappt."
   *
   * Die Meldung sagt, welche Staffel gemeint ist; der Bestand kennt die Reihe
   * über `franchiseId`. Beides zusammen ergibt den Titel — sortiert nach
   * japanischer Erstausstrahlung, wie in `staffelnDerAdresse` auch.
   *
   * **Die Folgenzahl ist der Gegentest.** Zugeordnet wird nur, wenn die
   * gemeldeten Folgen ab dieser Staffel **glatt aufgehen**. Prime führt „Tokyo
   * Ghoul" Staffel 3 in zwei Ausgaben: eine mit 12 Folgen (das ist `:re`) und
   * eine mit 24 (das sind `:re` **und** `:re 2`). Die erste deckt einen
   * Titel, die zweite zwei — beide ohne Rest. Bleibt etwas übrig, war die
   * Annahme falsch, und es bleibt beim Reihenkopf.
   *
   * Angefasst wird nur der Fall **ein** Titel: Hängen schon mehrere an der
   * Adresse, hat die Adresse selbst die bessere Auskunft, und `verteileAufStaffeln`
   * arbeitet damit weiter wie bisher.
   */
  /**
   * **Nennt der Folgentitel die Ausgabenart, gehört die Meldung der Nebenausgabe.**
   *
   * Daniel am 10.09.2026: „das einzige problem war das netflix hier ova
   * reingemischt hat, aber diese info ist ohne in player reinzugehen bereits
   * scrape-bar … du musst doch eig nur die titel aller episoden kennen, um es
   * beim abgleich später korrekt zuordnen zu können?"
   *
   * Er hat recht, und die Information war die ganze Zeit unterwegs: Die
   * Erweiterung schickt `folge` mit, bei Haikyu!! Staffel 1 Folge 26 steht dort
   * „Haikyu! OVA". Der Worker speichert sie seit Migration 028.
   *
   * **Warum Zahlen es nicht können:** Netflix' Staffel 1 hat 26 Folgen, unsere
   * 25 — die 26. ist die OVA. Über Nummern ist das nicht von einer
   * 26-teiligen Serie zu unterscheiden, und zwei Zerlegungen mit derselben
   * Summe schon gar nicht (am selben Tag real: vier falsche Belege). Ein Wort
   * im Titel entscheidet es.
   *
   * **Zwei Bedingungen, beide notwendig:** Der Folgentitel nennt die Art, und
   * an der Adresse hängt **genau ein** Titel dieser Art. Sonst bleibt es beim
   * bisherigen Weg — ein erzwungener Treffer wäre schlimmer als keiner.
   */
  {
    const ausgabenart = (text: string): 'OVA' | 'SPECIAL' | null => {
      const t = text.toLowerCase()
      if (/\bova\b|\boav\b/.test(t)) return 'OVA'
      if (/\bspecial|\bsonderfolge|\bsonderbeitrag/.test(t)) return 'SPECIAL'
      return null
    }
    const gemeldeteArt = gruppe
      .map((x) => (x.folge ? ausgabenart(String(x.folge)) : null))
      .find((a): a is 'OVA' | 'SPECIAL' => Boolean(a))
    if (gemeldeteArt && ids.length) {
      /* Alle Titel dieser Adresse — auch die, die der Namensweg nicht fand. */
      const kandidaten = (nachUrl.get(schluesselAdresse(p.url)) ?? ids)
        .map((n) => liste.find((x) => x.id === n))
        .filter((t): t is NonNullable<typeof t> => Boolean(t))
        .filter((t) => t.format === gemeldeteArt)
      if (kandidaten.length === 1 && !ids.includes(kandidaten[0]!.id)) {
        log(
          `Folgentitel „${gruppe.find((x) => x.folge)?.folge}" nennt ${gemeldeteArt} — ` +
            `Meldung geht an ${kandidaten[0]!.id} („${kandidaten[0]!.titleDe ?? kandidaten[0]!.titleEn}") ` +
            `statt an ${ids.join(', ')}`,
        )
        ids = [kandidaten[0]!.id]
        nachFolgentitelZugeordnet++
      }
    }
  }

  /*
    **Die Staffel aus der Adresse entscheidet — über den Namen, nicht über die Summe.**

    Am 17.09.2026 machten Daniels Meldungen aller Staffeln jeden Deploy rot.
    Zwei Wege führten an den Reihenkopf: Die Erweiterung schickt `titelId` aus
    dem Auftrag, auch nachdem auf der Seite eine andere Staffel gewählt wurde
    (Golden Kamuy Staffel 4 landete als „Folgen 1–12" auf Staffel 1 und 2). Und
    der alte Weg ordnete nur zu, wenn die Folgen glatt aufgingen — Prime führt
    Schleim Staffel 3 mit 26 Folgen, wir mit 24, also blieb der Beleg am Kopf.
    Seitdem zählt `staffelBeschriftungen()` (dieselbe Rechnung wie im Panel),
    ergänzt um Namen wie „Golden Kamuy 4". Lässt sich die Staffel nicht
    bestimmen, wird die Meldung nicht geschrieben und bleibt im Briefkasten.
  */
  {
    /*
      **Nur, wenn die ganze Gruppe eine Staffel meint** (18.09.2026). Eine Gruppe ist
      alles zu einer Adresse; bei Prime ist das eine Staffel, bei Netflix die ganze
      Reihe. „The Quintessential Quintuplets" wurde mit S1 und S2 gemeldet, beide unter
      `/title/81152346` — der Block nahm die erste Staffelnummer ab 2 für alle 24
      Meldungen und hängte sie an Staffel 2. Staffel 1 war danach abgehakt und stand
      nirgends. Mehrere Staffeln verteilt der Weg über die Anbieterstaffeln weiter
      unten, je Meldung.
    */
    const staffelnDerGruppe = new Set(
      gruppe.map((x) => x.staffel).filter((n): n is number => typeof n === 'number' && Number.isFinite(n)),
    )
    const staffelNr =
      staffelnDerGruppe.size === 1
        ? [...staffelnDerGruppe].find((n) => n >= 2 && n <= 50)
        : undefined
    /*
      **Staffel 1 nach einem Wechsel auf einer Sammelseite gehört nicht dem Auftrag.**
      (19.09.2026, JoJo): Der Auftrag galt „Stardust Crusaders“ auf der Sammelseite
      B0CG7S59KL; gemeldet wurde auch Prime-Staffel 1 (Teil 1, Seite B0CH1GVRKK). Der
      Block unten greift erst ab Staffel 2, also landete Teil 1 als Beleg auf Stardust
      Crusaders. Erkennbar ist der Fall daran, dass die gemeldete Seite eine andere
      ist als die Auftragsadresse und der Auftragstitel in seiner Reihe nicht Staffel 1
      ist. Dann bleibt die Meldung liegen — eine Prime-Einzelseite („Staffel 1“ jeder
      Fortsetzung, etwa Motto To Love-Ru) trägt ihre eigene Adresse und fällt nicht darunter.
    */
    {
      const kennungDerAdresse = /amazon\.de\/(?:dp|gp\/video\/detail)\/([A-Z0-9]{10,26})/.exec(p.url)?.[1]
      const seite = String(p.seiten_kennung ?? '')
      const reihe1 = reiheVon.get(ids[0] ?? -1)
      if (
        staffelnDerGruppe.size === 1 &&
        staffelnDerGruppe.has(1) &&
        kennungDerAdresse &&
        seite &&
        seite !== kennungDerAdresse &&
        reihe1
      ) {
        const nr = staffelNummern(reihe1).get(ids[0]!)
        if (nr != null && nr !== 1) {
          offenGeblieben.push(`${p.url} — Staffel 1 der Seite ${seite} gehört nicht zum Auftragstitel ${ids[0]} (Staffel ${nr}), Meldung bleibt liegen`)
          continue
        }
      }
    }
    const reihe = staffelNr ? reiheVon.get(ids[0] ?? -1) : undefined
    if (staffelNr && reihe) {
      const nummern = staffelNummern(reihe)
      const ziel = [...nummern].filter(([, n]) => n === staffelNr).map(([id]) => id)
      for (const tid of ausMeldung) {
        const n = nummern.get(tid)
        if (n != null && n !== staffelNr) {
          auffaellig.push(`Meldung ${gruppe.map((x) => x.id).join(',')}: Titel ${tid} ist Staffel ${n}, die Seite ${p.seiten_kennung ?? p.url} Staffel ${staffelNr}`)
        }
      }
      const schonRichtig = ziel.length > 0 && ids.every((id) => ziel.includes(id))
      /*
        **Die Folgenzahl muss zur Zielstaffel passen** (19.09.2026, JoJo): Prime-Staffel 3
        der Sammelseite (Diamond is Unbreakable, 39 Folgen) wäre nach unserer Zählung
        „Staffel 3“ = Battle in Egypt mit 24 geworden. Weicht die gemeldete Zahl um mehr
        als die Hälfte ab, gilt die Nummer nicht — die Meldung bleibt liegen.
      */
      const gemeldetZahl = Math.max(0, ...gruppe.map((x) => (typeof x.folgen === 'number' ? x.folgen : 0)))
      const zielFolgen = ziel.map((id) => liste.find((x) => x.id === id)?.episodes ?? 0).reduce((a, b) => a + b, 0)
      if (ziel.length && gemeldetZahl && zielFolgen && (gemeldetZahl > zielFolgen * 1.5 || gemeldetZahl < zielFolgen / 1.5)) {
        offenGeblieben.push(`${p.url} — Staffel ${staffelNr}: ${gemeldetZahl} Folgen gemeldet, Zielstaffel ${ziel.join(', ')} hat ${zielFolgen}, Meldung bleibt liegen`)
        continue
      }
      if (ziel.length && !schonRichtig) {
        log(`Staffel ${staffelNr} von ${p.url} gehört zu ${ziel.join(', ')} statt ${ids.join(', ')}`)
        ids = ziel
        nachStaffelZugeordnet++
      } else if (!ziel.length && ids.some((id) => nummern.has(id))) {
        /*
          **Die Seite der Staffel kennt den Titel, auch wenn die Zählung ihn nicht kennt.**

          Unsere Staffelnamen ergeben nicht immer eine Nummer: „KonoSuba 2" trägt die Zwei,
          „KonoSuba: God's Blessing on This Wonderful World! 2" aber erst am Ende eines
          langen Namens, und `staffelNummern()` findet sie dort nicht. Die Meldung lag
          deshalb seit dem 19.09.2026 im Briefkasten, obwohl der Weg zur Staffel-2-Seite
          von Hand eingetragen war. Steht `seiten_kennung` als Verweis an genau einem
          Titel, ist die Frage beantwortet (20.09.2026).
        */
        const kennung = String(p.seiten_kennung ?? '').trim()
        const ausSeite = /^[A-Z0-9]{10,26}$/.test(kennung)
          ? (nachUrl.get(schluesselAdresse(amazonTitelAdresse(kennung))) ?? [])
          : []
        const eindeutig = [...new Set(ausSeite)]
        /*
          **Kennt die Adresse Netflix' eigene Staffelaufteilung, verteilt die weiter unten**
          (22.09.2026). Haikyu!! TO THE TOP ist bei Netflix „Staffel 4" (E1–13, E14–25, OVA
          E26–27); unsere Titel heißen „To the Top" ohne Zahl, `staffelNummern()` findet keine 4,
          und 25 Meldungen blieben liegen — obwohl `anbieter-staffeln.json` die Aufteilung kennt
          und `ordneMeldungZu()` genau damit am 10.09.2026 richtig zugeordnet hatte.
        */
        const netflixKennung = /netflix\.com\/title\/(\d+)/.exec(p.url)?.[1]
        const bekannt = netflixKennung
          ? ((anbieterStruktur[netflixKennung] as { staffeln?: { seq: number }[] } | undefined)?.staffeln ?? [])
          : []
        if (eindeutig.length === 1) {
          log(`Staffel ${staffelNr} von ${p.url}: Seite ${kennung} gehört zu ${eindeutig[0]}`)
          ids = eindeutig
          nachStaffelZugeordnet++
        } else if (bekannt.some((st) => st.seq === staffelNr)) {
          log(`Staffel ${staffelNr} von ${p.url}: über Netflix' Staffelaufteilung verteilt`)
        } else {
          offenGeblieben.push(`${p.url} — Staffel ${staffelNr} in der Reihe nicht zu bestimmen, Meldung bleibt liegen`)
          continue
        }
      }
    }
  }

  /* Folgenzahl der Meldung gegen den Titel — nur grobe Abweichungen, Prime schneidet oft anders zu. */
  if (ids.length === 1) {
    const t = liste.find((x) => x.id === ids[0])
    const gemeldet = Math.max(
      ...gruppe.map((x) => (typeof x.folgen === 'number' && Number.isFinite(x.folgen) ? x.folgen : 0)),
      gruppe.filter((x) => x.folge_nr != null).length,
    )
    /*
      **Weniger Folgen als der Titel ist bei Netflix kein Befund** (24.09.2026). Der Melde-Durchgang
      prüft je Netflix-Staffel; Naruto (220) meldete 26, Shippuden (500) 21, Boruto (293) 15 — jede
      Nacht als „auffällig" gelb in der Statusanzeige, obwohl genau das der Ablauf ist. Mehr
      Folgen als der Titel bleibt verdächtig (falsche Zuordnung), bei allen Anbietern.
    */
    const zuWenig = gemeldet < (t?.episodes ?? 0)
    if (
      t?.episodes &&
      gemeldet > 1 &&
      !(zuWenig && p.plattform === 'netflix') &&
      Math.abs(gemeldet - t.episodes) > Math.max(2, t.episodes * 0.25)
    ) {
      auffaellig.push(`Meldung ${gruppe.map((x) => x.id).join(',')}: ${gemeldet} Folgen gemeldet, Titel ${t.id} hat ${t.episodes} (${p.seiten_kennung ?? p.url})`)
    }
  }

  /**
   * **Ein „weg" hebt alles auf — aber nur, solange nichts Jüngeres widerspricht.**
   *
   * Was der Anbieter nicht mehr zeigt, hat keine Folgenbereiche mehr. Der Satz
   * stimmt; die Umsetzung fragte nur nicht, **wann** das gemeldet wurde.
   *
   * Am 31.08.2026 hat Daniel „Die Schatzinsel: Das große Abenteuer der Tiere"
   * um 14:39 als „nicht bei Prime" gemeldet, den Titel eine Minute später unter
   * einem anderen Suchbegriff gefunden und um 14:40 mit deutscher Tonspur
   * gemeldet. Herausgekommen wäre `available: false` — die ältere, widerlegte
   * Auskunft hätte gewonnen, und der Titel stünde als verschwunden im Bestand.
   *
   * Ein Nachschlagen ist eine Momentaufnahme. Die jüngere ist die bessere.
   */
  const jueng = [...gruppe].sort((a, b) => (a.gemeldet_am < b.gemeldet_am ? -1 : 1))
  /*
    **Ein „weg" für eine Staffel streicht nicht den ganzen Weg** (Daniel, 23.09.2026).

    Prime führt Fairy Tail unter einer Adresse: Staffel 1 regionsgesperrt, 2 bis 9 zum Kauf.
    Eine Meldung zu Staffel 1 als letzte hätte den ganzen Prime-Weg entfernt. Die Regel steht
    in `lib/weg-entwerten.ts` und ist dort zugesichert.
  */
  const weg = wegGiltGanzerAdresse(jueng, ids.length) ? jueng[jueng.length - 1] : undefined

  const meldungen = gruppe
    .filter((x) => x.befund !== 'weg' && x.folge_nr != null)
    .map((x) => ({ folge: x.folge_nr as number, dub: x.befund === 'dub' }))
  const { bereiche, widersprueche } = meldungen.length
    ? bildeBereiche(meldungen)
    : { bereiche: [], widersprueche: [] as number[] }

  const sprachen = p.sprachen ? (JSON.parse(p.sprachen) as string[]) : []
  /**
   * Eine durchgezählte Folgennummer gehört genau **einer** Staffel.
   *
   * Netflix zählt Jujutsu Kaisen durch bis 59 (Daniel, 22.08.2026: „staffel 1
   * (bis 24) staffel 2 (bis 47) staffel 3 (bis 59)"). Unser Datensatz führt
   * dieselbe Adresse an drei AniList-Einträgen. Vorher bekamen alle drei
   * denselben Befund — eine Prüfung an Folge 59 hätte also auch Staffel 1 als
   * geprüft ausgewiesen, obwohl niemand sie angesehen hat.
   */
  /*
    **Abgehakt wird nur, was auch angekommen ist.**

    Bis zum 26.08.2026 hakte diese Funktion am Ende **jede** Gruppe ab, ganz
    gleich ob ein Eintrag entstanden war. An dem Abend meldete der Lauf „54
    Prüfungen abgeholt, 0 Einträge geschrieben" — und leerte den Briefkasten
    trotzdem. 508 Disney-Meldungen aus Daniels Arbeit eines ganzen Abends waren
    damit unerreichbar, und die Prüfliste bot dieselben Titel erneut an.

    Der Worker macht es richtig: Er hakt nur ab, was die Pipeline nennt (siehe
    dort, 22.08.2026). Genannt wurde nur zu viel.

    Bleibt eine Meldung liegen, taucht sie beim nächsten Lauf wieder auf — mit
    derselben Warnung. Das ist gewollt: Eine Meldung, die niemand zuordnen kann,
    ist ein offener Punkt und kein erledigter.
  */
  let geschrieben = 0
  const staffeln = staffelnDerAdresse(ids)

  /**
   * Was der Anbieter selbst über seine Staffeln sagt — wenn er es gesagt hat.
   *
   * Seit Erweiterung v0.23.0 liest der Browser die Metadaten der Seite mit und
   * schickt die Aufteilung mit. Sie schlägt jede Rechnung: Netflix zählt bei
   * Jujutsu Kaisen über die Staffeln hinweg durch (bis 59), bei Sword Art
   * Online fängt jede Staffel wieder bei 1 an. Wer das umrechnet statt es zu
   * lesen, schreibt Befunde an die falsche Staffel.
   */
  const anbieterStaffeln: AnbieterStaffel[] | undefined = (() => {
    const roh = [...gruppe].reverse().find((x) => x.staffeln)?.staffeln
    if (!roh) return undefined
    try {
      const liste = JSON.parse(roh) as AnbieterStaffel[]
      return Array.isArray(liste) && liste.length ? liste : undefined
    } catch {
      return undefined
    }
  })()

  /**
   * Die Meldungen den Staffeln zuschlagen, je eine Liste von Bereichen.
   *
   * Ohne die Aufteilung des Anbieters bleibt es beim alten Weg: Bereiche über
   * die ganze Reihe, danach über die Folgenzahlen verteilt.
   */
  const jeStaffel = new Map<number, Array<{ folge: number; dub: boolean }>>()
  /*
    **Die Notiz gehört der Meldung ihres Titels** (22.09.2026). Zwei Randproben unter einer
    Adresse (Haikyu!! TO THE TOP E1–13 und E14–25) bekamen beide die Notiz der letzten Meldung —
    „gemessen: Folge 14 und 25" stand auch am Titel, dessen Ränder 1 und 13 waren.
  */
  const notizJeStaffel = new Map<number, string>()
  if (anbieterStaffeln && staffeln.length) {
    for (const m of gruppe) {
      if (m.befund === 'weg' || m.folge_nr == null || m.folge_nr < 1) continue
      /*
        **Zuerst der Folgentitel, dann die Zahl** (18.09.2026, `lib/folgentitel-anker.ts`).
        Er nennt Titel und Folgennummer direkt; die Rechnung über Staffel und Zählung
        bleibt der Weg für Meldungen ohne Treffer.
      */
      const anker =
        m.plattform === 'netflix' ? folgeUeberTitel(folgentitelAusNotiz(m.notiz), staffeln.map((x) => x.id)) : null
      const ankerStaffel = anker ? staffeln.find((x) => x.id === anker.id) : undefined
      const treffer = ankerStaffel
        ? { staffel: ankerStaffel, folgeInStaffel: anker!.nr }
        : ordneMeldungZu({ folge: m.folge_nr, staffel: m.staffel }, staffeln, anbieterStaffeln)
      if (!treffer) continue
      if (ankerStaffel) ueberFolgentitel++
      const bisher = jeStaffel.get(treffer.staffel.id) ?? []
      bisher.push({ folge: treffer.folgeInStaffel, dub: m.befund === 'dub' })
      jeStaffel.set(treffer.staffel.id, bisher)
      if (m.notiz) notizJeStaffel.set(treffer.staffel.id, m.notiz)
    }
  }

  /**
   * Unsere Einträge, für die der Anbieter gar keine Staffel führt.
   *
   * Bei Sword Art Online meldet Netflix zwei Staffeln (25 und 24 Folgen),
   * unser Datensatz führt vier Einträge an derselben Adresse. Die beiden
   * „War of Underworld"-Staffeln laufen dort also nicht — der Verweis zeigt
   * auf eine Seite, die sie nicht enthält. Das ist Netflix' eigene Auskunft,
   * kein Rückschluss, und wird wie die Tonspuren behandelt.
   */
  // Was der Anbieter über sich sagt, wird behalten — auch wenn die Zuordnung
  // danach scheitert. Es ist die Grundlage für die nächste Prüfrunde.
  const kennungHier = /\/title\/(\d+)/.exec(p.url)?.[1]
  if (anbieterStaffeln?.length) {
    if (kennungHier) {
      anbieterStruktur[kennungHier] = { staffeln: anbieterStaffeln, gemeldetAm: heute }
    }
  } else if (kennungHier && !anbieterStruktur[kennungHier]) {
    /**
     * **Wie viele Folgen der Anbieter führt — auch ohne Staffelangabe.**
     *
     * „Eyeshield 21" hat 145 Folgen; Netflix zeigt 36. Nach dem Melden standen
     * 1–36 als geprüft in der Liste und 37–145 als offen, obwohl es sie dort
     * gar nicht gibt. Daniel am 31.08.2026: „145 erwartet, 36 existieren, was
     * jetzt?"
     *
     * Die Staffelstruktur kommt aus dem Player und fehlt bei vielen Meldungen —
     * für „Eyeshield 21" und „7 Seeds" stand in `anbieter-staffeln.json` gar
     * nichts. Die **Zahl** dagegen kennt der Durchlauf immer: Es ist die Länge
     * seiner eigenen Folgenliste, und die Erweiterung schickt sie seit 4.8.1
     * als `folgen` mit.
     *
     * Daraus wird ein Block: ein Eintrag mit dieser Folgenzahl. Das genügt für
     * die Frage, die offen war — führt der Anbieter alles oder nur einen Teil.
     */
    const zahl = Math.max(...gruppe.map((x) => (typeof x.folgen === 'number' ? x.folgen : 0)), 0)
    if (zahl > 0) {
      anbieterStruktur[kennungHier] = {
        staffeln: [{ seq: 1, name: 'Staffel 1', folgen: zahl, erste: 1 }],
        gemeldetAm: heute,
        /* Kein Staffelblock, nur eine Zahl — die Herkunft gehört dazu. */
        nurFolgenzahl: true,
      }
    }
  }

  const zuordnung =
    anbieterStaffeln && staffeln.length ? ordneNachStaffelliste(anbieterStaffeln, staffeln) : undefined
  const nichtGefuehrt = new Set(zuordnung?.ohneEntsprechung.map((x) => x.id) ?? [])
  /**
   * **„Keine eigene Staffel" heißt nicht „läuft dort nicht".**
   *
   * Der Zweig weiter unten macht aus einem Eintrag ohne Entsprechung ein
   * `available: false` und entfernt damit den Verweis. Das ist richtig, wo der
   * Anbieter die Staffel wirklich nicht hat — und falsch, wo er sie der
   * **Vorstaffel zurechnet**.
   *
   * Widerlegt am 10.09.2026 an „HAIKYU!! TO THE TOP Part 2" (Daniel, mit vier
   * Bildern): Netflix führt Staffel 4 mit **27** Folgen. Unsere TO THE TOP hat
   * 13, die OVA „LAND VS. AIR" 2, Part 2 zwölf — zusammen genau 27. Der Titel
   * läuft dort sehr wohl; der Anbieter fasst nur zusammen, was AniList trennt.
   * Der Verweis war seit dem 22.08.2026 entfernt, und weil er fehlte, ging die
   * Folgenrechnung der Prüfliste nicht mehr auf: vier Haikyu!!-OVAs blieben
   * unzuordenbar.
   *
   * Gemessen standen **sechs** solcher Belege in `dub-confirmed.yaml`, alle
   * nach demselben Muster (eine Fortsetzung, die der Anbieter der Vorstaffel
   * zurechnet): SAO Alicization War of Underworld und Part 2, BEASTARS Final
   * Season Part 2, Dr. STONE New World und Part 2, HAIKYU!! Part 2.
   *
   * **Die Rechnung, die beide Fälle trennt:** Wie viele Folgen führt der
   * Anbieter mehr, als die gepaarten Titel hergeben? Passt der überzählige
   * Titel in diesen Platz, ist er dort — nur anders geschnitten. Sonst bleibt
   * es beim bisherigen Schluss.
   */
  if (nichtGefuehrt.size && zuordnung?.paare.length) {
    const platz = zuordnung.paare.reduce(
      (n, paar) => n + Math.max(0, (paar.anbieter.folgen ?? 0) - (paar.unser.folgen ?? 0)),
      0,
    )
    const fehlend = zuordnung.ohneEntsprechung.reduce((n, u) => n + (u.folgen ?? 0), 0)
    if (fehlend > 0 && platz >= fehlend) nichtGefuehrt.clear()
  }

  /**
   * Eine Meldung, die niemand zuordnen kann, ist trotzdem Arbeit gewesen.
   *
   * Bei „My Hero Academia" führt Netflix sieben Staffeln, an unserer Adresse
   * hängen zwei Einträge — die Paarung verweigert sich zu Recht. Ohne diesen
   * Zweig wäre Daniels Befund („Staffel 7, Folge 170, kein deutscher Ton")
   * lautlos verfallen, obwohl er die eigentliche Auskunft enthält: Uns fehlen
   * fünf Verweise, und die Serie läuft dort weiter, als wir wissen.
   */
  // Ein Problemtext neben gültigen Paaren ist nur eine Anmerkung — abgebrochen
  // wird erst, wenn gar keine Zuordnung zustande kam.
  if (zuordnung?.problem && !zuordnung.paare.length && gruppe.some((x) => x.folge_nr != null)) {
    const name = p.serientitel ?? p.titel ?? ''
    ohneZuordnung.push({
      url: p.url,
      name: name ? `${name} — ${zuordnung.problem}` : zuordnung.problem,
      plattform: p.plattform,
      befund: gruppe.map((x) => `St.${x.staffel ?? '?'}/Flg.${x.folge_nr ?? '?'} ${x.befund}`).join(', '),
      vorschlag: ids,
    })
    offenGeblieben.push(`${p.url} — ${zuordnung.problem}`)
    continue
  }

  const verteilbar = bereiche.length > 0 && staffeln.length > 1 && !anbieterStaffeln

  for (const id of ids) {
    const t = liste.find((x) => x.id === id)
    /** Die Bereiche dieser Staffel, in ihrer eigenen Zählung. */
    let eigene = bereiche
    if (nichtGefuehrt.has(id)) {
      // Der Anbieter führt diese Staffel nicht — dann ist der Verweis falsch,
      // und über den deutschen Ton ist damit nichts gesagt.
      zeilen.push('')
      zeilen.push(`- anilistId: ${id}`)
      if (t?.titleDe || t?.titleEn) zeilen.push(`  title: ${JSON.stringify(t.titleDe ?? t.titleEn)}`)
      zeilen.push(`  platform: ${p.plattform}`)
      zeilen.push('  available: false')
      zeilen.push(`  checkedAt: '${berlinDatum(p.gemeldet_am)}'`)
      zeilen.push(
        `  note: ${JSON.stringify(`Der Anbieter führt unter dieser Adresse nur ${anbieterStaffeln!.length} Staffel(n); diese ist nicht darunter`)}`,
      )
      uebernommen++
      geschrieben++
      continue
    }
    if (anbieterStaffeln) {
      const meldungen = jeStaffel.get(id)
      if (!meldungen?.length) continue
      eigene = bildeBereiche(meldungen).bereiche
    } else if (verteilbar) {
      eigene = bereiche
        .flatMap((b) => verteileAufStaffeln(b, staffeln))
        .filter((v) => v.staffel.id === id)
        .map((v) => ({ von: v.von, bis: v.bis, dub: v.dub, belegt: [] as number[] }))
      // Keine geprüfte Folge in dieser Staffel — dann gibt es auch nichts zu
      // melden. Schweigen ist hier die richtige Antwort.
      if (!eigene.length) continue
    }

    /**
     * **Ein Eintrag ohne Aussage darf gar nicht erst entstehen.**
     *
     * Bei einem Kanal-Titel ohne eigenen Beleg gibt es kein Urteil (richtig so),
     * und der Ersatz — die Adresse — entfällt, wenn unser Datensatz sie schon
     * kennt. Übrig bleibt ein Eintrag aus Kennung, Titel und Datum, den der Bau
     * mit einer Warnung überspringt.
     *
     * **Und ein übersprungener Eintrag verschwindet nicht, er verdeckt.** Am
     * 30.08.2026 hat das den Wochenlauf rot gemacht: Sechs Verweise trugen einen
     * Beleg vom 24. bis 28.08., während der jüngste vom 30.08. übersprungen
     * wurde — die Zusicherung „es gilt immer der jüngste" schlug zu Recht an.
     * Derselbe Fehler wie am 29.08. bei „Fullmetal Alchemist", damals nur an
     * einer Stelle behoben.
     *
     * Hier steht die Prüfung vor dem Schreiben: Wo weder Urteil noch Adresse
     * herauskommen, wird der ganze Eintrag ausgelassen. Der ältere Beleg bleibt
     * gültig, und das ist die richtige Auskunft — die Kanal-Meldung hat ihn ja
     * nicht widerlegt.
     */
    /*
      **Eine Kanal-Meldung mit deutschem Ton ist eine Aussage** (Daniel,
      17.09.2026: „Unsere Meldung per Extension sollte höchste Confidence
      haben"). Ausgelassen wird nur noch das Nein aus einem Kanal — sonst legt
      die Prüfliste dieselbe Seite endlos wieder vor.
    */
    const ohneAussage =
      !weg &&
      !gruppe.some((x) => x.befund === 'dub') &&
      !echteAmazonAdresse(p) &&
      nachUrl.has(schluesselAdresse(p.url)) &&
      !eigene.length &&
      gruppe.some((x) => /Kanal-Titel/.test(x.notiz ?? ''))
    if (ohneAussage) {
      ausgelassenKanal++
      /*
        **Ausgelassen heißt abgehakt — sonst liest sie jeder Lauf wieder.**

        `geschrieben` bleibt hier null, und ganz unten hakt nur ab, wer etwas
        geschrieben hat. Eine Kanal-Meldung ohne Aussage blieb damit für immer
        im Briefkasten liegen: Am 05.09.2026 lagen dort **16 Meldungen auf 13
        Adressen**, die älteste (`B09MDQX4CW`) seit Wochen — jeder Lauf holte
        sie, ließ sie aus, ließ sie liegen. Die Wache zählte sie als Rückstand,
        und niemand konnte etwas damit anfangen.

        **Die Entscheidung ist endgültig, deshalb darf sie abgehakt werden.**
        Sie hängt an drei Dingen, von denen keines sich zurückdreht: Der Titel
        ist ein Kanal-Angebot (Amazons Sprachangabe belegt dort nichts, siehe
        `CLAUDE.md`), unser Datensatz kennt die Adresse bereits, und die Meldung
        trägt keinen Folgenbefund. Morgen käme dasselbe heraus.

        **Nicht abgehakt wird, was nur heute nicht zuzuordnen ist.** Eine
        Meldung ohne Titel steht in `11-meldungen-ohne-zuordnung.md` und bleibt
        liegen — dort kann der nächste Bestand die Antwort bringen.
      */
      for (const x of gruppe) erledigteIds.add(x.id)
      continue
    }

    zeilen.push('')
    zeilen.push(`- anilistId: ${id}`)
    if (t?.titleDe || t?.titleEn) zeilen.push(`  title: ${JSON.stringify(t.titleDe ?? t.titleEn)}`)
    zeilen.push(`  platform: ${p.plattform}`)
    /**
     * **Die Adresse steht immer dabei — seit dem 10.09.2026.**
     *
     * Vorher wurde sie nur geschrieben, wenn unser Datensatz sie **nicht**
     * kannte. Der Gedanke war: Was ohnehin bekannt ist, muss nicht wiederholt
     * werden. Genau umgekehrt wird ein Beleg gebraucht — er sagt, **woran**
     * gemessen wurde, und das ist bei einer bekannten Adresse genauso wichtig
     * wie bei einer neuen.
     *
     * **Der Fall ist real eingetreten.** 854 Belege nennen in ihrer Notiz eine
     * Amazon-Kennung („Amazon-Seite B07L1CMH2D: alle 0 Folgen geprüft"), 497
     * davon ohne `url`-Feld — und ohne das gilt der Befund für **jede**
     * Adresse dieser Plattform, auch für später hinzukommende. Bei 47 ist das
     * folgenreich, weil ihr Urteil den Verweis **entfernt**. „Haikyu!! 3rd
     * Season" bekam am 10.09.2026 die Prime-Adresse `B0D544CDK6`, und ein
     * Beleg vom 25.08. zu einer ganz anderen Seite warf sie sofort wieder
     * hinaus.
     *
     * **Warum das gefahrlos ist:** `loadDubChecks()` unterscheidet seit dem
     * 07.09.2026 selbst, was die Adresse im Beleg bedeutet — bei einem Titel
     * mit **einem** Verweis dieser Plattform ist sie eine **Korrektur**, ab
     * zwei Wegen eine **Unterscheidung**. Ein erster, strengerer Anlauf hätte
     * damals 60 Belege weggeworfen, darunter lauter berechtigte Korrekturen;
     * die Leseseite trägt beide Fälle also längst.
     */
    const echte = echteAmazonAdresse(p)
    /*
      `wegAusMeldung()` löst eine Suchadresse über die `seiten_kennung` auf — die
      Kennung der Seite, auf der wirklich nachgesehen wurde. Ohne sie stünde im
      Beleg eine Amazon-Suche, und die beantwortet die Frage nicht, die dieses
      Projekt stellt.
    */
    zeilen.push(`  url: ${echte ?? wegAusMeldung(p)}`)
    /*
      Der Teilbereich steht vor dem Befund: Er sagt, worüber der Befund
      überhaupt spricht. Gemeldet wird er einmal je Adresse; die neueste
      Meldung gewinnt, wie bei allem anderen hier auch.
    */
    const teil = gruppe.map((x) => x).reverse().find((x) => x.teil_von && x.teil_bis)
    if (teil) zeilen.push(`  teilBereich: { von: ${teil.teil_von}, bis: ${teil.teil_bis} }`)
    /*
      **Aus einem Kanal-Titel wird nie ein Nein.**

      Prime führt zweierlei unter derselben Oberfläche: eigene Inhalte und
      Kanal-Abos (ADN, aniverse, Crunchyroll). Bei einem Kanal-Titel zeigt
      Amazon die Sprachen, die der **Kanal** führt, nicht die der Folge —
      gemessen an „Kill Blue": Amazon sagte 12 deutsche Folgen, ADN und Netflix
      unabhängig je 4 (CLAUDE.md, 24.08.2026). Die Erweiterung markiert solche
      Meldungen seitdem mit „⚠ Kanal" und schreibt die Warnung in die Notiz.

      **Nur ist hier nie etwas daraus gefolgt.** Am 29.08.2026 gemessen: 239
      Handbelege tragen die Warnung, **19 davon ein `dub: false`** — und ein Nein
      entfernt den Verweis. „Fullmetal Alchemist" verlor so seinen letzten Weg,
      obwohl die Notiz desselben Eintrags sagt, dass die Angabe kein Beleg ist.

      Ein Ja bleibt zulässig: „Es gibt dort deutsche Folgen" stimmt auch dann,
      wenn es weniger sind als angegeben. Ein Nein wäre eine Aussage über die
      ganze Staffel, gestützt auf eine Quelle, die über die Folge nichts sagt —
      dieselbe Asymmetrie wie bei jedem Ausschnitt.

      Ohne `dub`-Zeile bleibt der Verweis mit „🇩🇪 ?" stehen. Das ist die
      ehrliche Antwort und besser als beides: besser als ein erfundenes Ja und
      besser als ein Nein, das einen richtigen Weg löscht.
    */
    const ueberKanal = gruppe.some((x) => /Kanal-Titel/.test(x.notiz ?? ''))
    const neinAusKanal = ueberKanal && !eigene.some((b) => b.dub) && p.befund !== 'dub'

    if (weg) {
      zeilen.push('  available: false')
    } else if (neinAusKanal) {
      /*
        **Kein Urteil — aber der Eintrag braucht trotzdem eine Aussage.**

        `dub-confirmed.yaml` verlangt je Eintrag mindestens `dub`, `available`
        oder eine `url`; ohne das überspringt der Bau ihn mit einer Warnung. Am
        29.08.2026 hat das den Tageslauf rot gemacht — und zwar nicht wegen der
        Warnung, sondern wegen ihrer Folge: „Fullmetal Alchemist" hat zwei
        Belege (24.08. und 27.08.), der jüngere wurde übersprungen, und die
        Zusicherung „es gilt immer der jüngste" schlug zu Recht an.

        Ein übersprungener Eintrag verschwindet also nicht — er verdeckt einen
        anderen. Die Adresse macht ihn zu einem gültigen Eintrag ohne Urteil,
        und sie ist die nützlichste Angabe, die eine Kanal-Meldung hat: Sie sagt,
        **welche Seite** angesehen wurde.
      */
      /* Die Adresse steht seit dem 10.09.2026 weiter oben — bei jedem Beleg. */
    } else if (eigene.length) {
      const ganz = eigene.length === 1 && eigene[0]!.von === 1 && eigene[0]!.bis === (t?.episodes ?? -1)
      zeilen.push(`  dub: ${eigene.some((b) => b.dub)}`)
      // Deckt ein einziger Bereich die Staffel vollständig, sagt `dub` schon
      // alles — dann wären Bereiche nur Rauschen.
      if (!ganz) {
        zeilen.push('  dubRanges:')
        for (const b of eigene) {
          zeilen.push(`    - from: ${b.von}`)
          zeilen.push(`      to: ${b.bis}`)
          zeilen.push(`      dub: ${b.dub}`)
          if (b.belegt.length) zeilen.push(`      checked: [${b.belegt.join(', ')}]`)
        }
      }
    } else {
      zeilen.push(`  dub: ${p.befund === 'dub'}`)
    }
    // Ortszeit, nicht UTC: Eine Meldung um 00:41 Uhr trug sonst das Datum
    // des Vortags (22.08.2026).
    zeilen.push(`  checkedAt: '${berlinDatum(p.gemeldet_am)}'`)
    const notiz = [
      eigene.length ? beschreibeBereiche(eigene) : '',
      verteilbar ? `Anbieter zählt durch, hier auf die Staffel umgerechnet` : '',
      sprachen.length ? `Tonspuren: ${sprachen.join(', ')}` : '',
      widersprueche.length ? `Widersprüchliche Meldungen zu Folge ${widersprueche.join(', ')}` : '',
      notizJeStaffel.get(id) ?? p.notiz ?? '',
    ]
      .filter(Boolean)
      .join(' — ')
    if (notiz) zeilen.push(`  note: ${JSON.stringify(notiz)}`)
    uebernommen++
    geschrieben++
  }
  if (geschrieben) for (const x of gruppe) erledigteIds.add(x.id)
}

if (zeilen.length && !TROCKEN) {
  const p = resolve(ROOT, 'data/dub-confirmed.yaml')
  const alt = readFileSync(p, 'utf8')
  const kopf = `\n# --- Aus dem Browser gemeldet, abgeholt am ${heute} ---`
  /*
    **Ein Beleg, der wörtlich schon dasteht, wird nicht noch einmal angehängt.**

    Solo Leveling, 15.09.2026: Daniel meldete dieselbe Seite um 11:07 und beim
    Test um 20:51 — gleicher Tag, gleiche Notiz, also derselbe Beleg zweimal. Die
    Zusicherung „kein Beleg steht zweimal in der Datei" machte den Deploy rot.
    Verglichen wird das gelesene Objekt, nicht der Text: Kommentare und
    Anführungszeichen dürfen sich unterscheiden.
  */
  const vorhanden = new Set(((yaml.load(alt) as unknown[] | null) ?? []).map((b) => JSON.stringify(b)))
  const bloecke: string[][] = []
  for (const z of zeilen) {
    if (z.startsWith('- ')) bloecke.push([z])
    else if (bloecke.length) bloecke[bloecke.length - 1]!.push(z)
  }
  const neueBloecke = bloecke.filter((b) => {
    try {
      const eintrag = (yaml.load(b.join('\n')) as unknown[] | null)?.[0]
      return !vorhanden.has(JSON.stringify(eintrag))
    } catch {
      return true
    }
  })
  const uebersprungen = bloecke.length - neueBloecke.length
  if (uebersprungen) log(`${uebersprungen} Beleg(e) standen wörtlich schon da — nicht erneut angehängt`)
  const neueZeilen = neueBloecke.flatMap((b) => ['', ...b.filter((z, i) => i === 0 || z !== '')])
  const neu = alt.trimEnd() + '\n' + kopf + '\n' + neueZeilen.join('\n') + '\n'
  /*
    **Erst lesen, dann schreiben — sonst fällt der Fehler drei Schritte später.**

    Am 30.08.2026 bekam ein Eintrag zwei `url:`-Zeilen: Eine Amazon-Suchadresse
    mit zugeordneter `/dp/`-Adresse durchlief oben den Zweig für die echte
    Adresse und unten noch einmal den für „Kanal-Meldung ohne Urteil". YAML
    verbietet doppelte Schlüssel, und der stündliche Lauf brach ab — nicht hier,
    sondern beim Bau, mit einer Zeilennummer aus 24.000 Zeilen und ohne Hinweis
    darauf, wer sie geschrieben hat.

    Ein Parse-Versuch kostet Millisekunden und meldet den Fehler dort, wo er
    entsteht. Geschrieben wird nur, was sich danach auch wieder lesen lässt.
  */
  try {
    yaml.load(neu)
  } catch (e) {
    throw new Error(
      `Die erzeugten Zeilen ergeben kein gültiges YAML — nichts geschrieben. ${(e as Error).message}`,
    )
  }
  if (neueZeilen.some((z) => z.startsWith('- '))) writeFileSync(p, neu)
}

/**
 * Was keine Zuordnung fand, wird sichtbar abgelegt statt vergessen.
 *
 * Bis zum 22.08.2026 fielen solche Meldungen lautlos aus dem Lauf und blieben
 * für immer im Briefkasten liegen — die Arbeit war getan und ging verloren.
 * Die Datei ist Arbeitsvorrat, kein Datensatz: Jede Zeile braucht ein
 * menschliches Ja, bevor die Adresse in `data/` landet.
 */
/**
 * Ist nichts mehr offen, verschwindet die Datei.
 *
 * Sie blieb sonst mit dem letzten Stand liegen und behauptete Arbeit, die es
 * nicht mehr gibt — am 23.08.2026 standen dort drei Zeilen, deren Meldungen
 * längst abgehakt waren.
 */
if (!ohneZuordnung.length && !TROCKEN && existsSync(resolve(ROOT, 'daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md'))) {
  rmSync(resolve(ROOT, 'daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md'))
  log('daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md entfernt — nichts mehr offen')
}
if (ohneZuordnung.length && !TROCKEN) {
  const kopf = [
    '# Meldungen ohne Zuordnung',
    '',
    'Der Browser hat diese Seiten gemeldet, unser Datensatz kennt die Adresse aber',
    'nicht. Anbieter führen denselben Titel oft unter mehreren Kennungen — Jujutsu',
    'Kaisen meldete sich als `title/80237957`, bei uns steht `title/81278456`.',
    '',
    'Der Vorschlag stammt aus einem Namensvergleich und ist **kein Beleg**:',
    '„Beyblade Burst Surge" und „Beyblade Burst Rise" trennt ein Wort. Stimmt er,',
    'gehört die gemeldete Adresse als zusätzlicher Verweis an den Titel; stimmt er',
    'nicht, gehört die Zeile gestrichen.',
    '',
    `Stand: ${heute}`,
    '',
    '## Was hier zu tun ist',
    '',
    'Die Erweiterung hat einen Befund gemeldet, aber unser Datensatz kennt die Adresse',
    'nicht. Drei Fälle, drei Handgriffe:',
    '',
    '- **„nichts"** — erledigt sich von selbst, nur der Vollständigkeit halber aufgeführt.',
    '- **„Vorschlag bestätigen"** — stimmt der vorgeschlagene Titel? Dann sag Bescheid,',
    '  ich trage die Adresse als Verweis ein und übernehme den Befund.',
    '- **„Titel von Hand suchen"** — die Seite hat keinen Serientitel gemeldet. Öffne die',
    '  Adresse und sag mir, welcher Anime das ist; den Rest mache ich.',
    '',
    '| Anbieter | Gemeldete Adresse | Name laut Seite | Befund | Vorschlag | Zu tun |',
    '|---|---|---|---|---|---|',
  ]
  const tabelle = ohneZuordnung.map((o) => {
    /**
     * Kein `#` vor der Kennung.
     *
     * Markdown-Ansichten deuten `#154965` als Verweis auf ein GitHub-Ticket und
     * führen ins Leere (Daniel, 23.08.2026: „die hashtag-nummern führen zu
     * github 404"). Verlinkt wird stattdessen die Titelseite bei AniList — dort
     * steht, worum es geht.
     */
    const namen = o.vorschlag.map((id) => {
      const t = liste.find((x) => x.id === id)
      const name = t?.titleDe ?? t?.titleEn ?? String(id)
      return `[${name}](https://anilist.co/anime/${id})`
    })
    // Ein „weg" an einem Titel, der diesen Anbieter ohnehin nicht führt, ist
    // schon abgebildet — dann bleibt nichts zu tun, und das gehört dazu.
    // Sonst liest jemand die Zeile, öffnet den Verweis und stellt fest, dass
    // die Arbeit längst getan ist.
    const erledigt =
      o.befund === 'weg' &&
      o.vorschlag.length > 0 &&
      o.vorschlag.every((id) => {
        const t = liste.find((x) => x.id === id)
        return !t?.streams?.some((st) => st.platform === o.plattform)
      })
    /**
     * Ein „weg" zu einer Adresse, die wir nicht führen, ist gegenstandslos.
     *
     * Das gilt **ohne** Titelvergleich: Wenn kein Verweis auf diese Adresse
     * zeigt, kann auch keiner entfernt werden. Wer den Titel dahinter kennt,
     * gewinnt nichts dazu.
     *
     * Bis zum 23.08.2026 stand bei solchen Meldungen „Titel von Hand suchen" —
     * dreiundzwanzig Zeilen Arbeit, die keine war. Daniel: „deshalb habe ich sie
     * auch als weg gemeldet. also warum soll ich das nochmal prüfen."
     */
    const zuTun =
      o.befund === 'weg'
        ? 'nichts — diese Adresse steht bei uns nirgends'
        : !o.vorschlag.length
          ? 'Titel von Hand suchen'
          : erledigt
            ? 'nichts — wir führen dort keinen Verweis'
            : 'Vorschlag bestätigen, dann Adresse eintragen'
    return `| ${o.plattform} | ${o.url} | ${o.name || '—'} | ${o.befund} | ${namen.join('<br>') || '—'} | ${zuTun} |`
  })
  writeFileSync(resolve(ROOT, 'daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md'), [...kopf, ...tabelle, ''].join('\n'))
  log(`${ohneZuordnung.length} Meldung(en) ohne Zuordnung in daniel-zum-abarbeiten/11-meldungen-ohne-zuordnung.md`)
}

if (Object.keys(anbieterStruktur).length && !TROCKEN) {
  writeFileSync(
    resolve(ROOT, 'data/anbieter-staffeln.json'),
    JSON.stringify(anbieterStruktur, null, 1) + '\n',
  )
  log(`Staffelaufteilung von ${Object.keys(anbieterStruktur).length} Adressen gesichert`)
}

log(
  `${pruefungen.length} Prüfungen abgeholt, ${uebernommen} Einträge geschrieben` +
    (ausMeldungZugeordnet ? `, ${ausMeldungZugeordnet} von der Meldung selbst benannt` : '') +
    (selbstZugeordnet ? `, ${selbstZugeordnet} über den Namen zugeordnet` : '') +
    (ueberFolgentitel ? `, ${ueberFolgentitel} Folge(n) über den Folgentitel` : '') +
    (ausSuchadresseZugeordnet
      ? `, ${ausSuchadresseZugeordnet} über den Titel in der Suchadresse`
      : '') +
    (nachStaffelZugeordnet
      ? `, ${nachStaffelZugeordnet} über die Staffelnummer an den Titel der Reihe`
      : '') +
    (nachFolgentitelZugeordnet
      ? `, ${nachFolgentitelZugeordnet} über den Folgentitel an die Nebenausgabe`
      : '') +
    (ausgelassenKanal
      ? `, ${ausgelassenKanal} Kanal-Meldung(en) ohne Urteil ausgelassen (sie würden nur einen jüngeren Beleg verdecken)`
      : ''),
)
for (const o of offenGeblieben) warn(o)
for (const a of auffaellig) warn(`Auffällig: ${a}`)
if (auffaellig.length && !TROCKEN) {
  const datei = resolve(ROOT, 'data/meldungs-auffaelligkeiten.json')
  const grenze = new Date(Date.now() - 60 * 864e5).toISOString().slice(0, 10)
  const bisher = existsSync(datei) ? (JSON.parse(readFileSync(datei, 'utf8')) as { am: string; text: string }[]) : []
  /* Jeder Befund einmal: Der Lauf sah dieselbe Meldung sonst bei jedem Durchgang neu (81 Einträge, viele doppelt). */
  const schon = new Set(bisher.map((x) => x.text))
  const dazu = [...new Set(auffaellig)].filter((text) => !schon.has(text)).map((text) => ({ am: heute, text }))
  const neu = [...bisher.filter((x) => x.am >= grenze), ...dazu]
  writeFileSync(datei, JSON.stringify(neu, null, 2) + '\n')
  /* Gelb wird die Statusanzeige nur für einen neuen Befund — ein bekannter steht schon in der Datei. */
  if (process.env.GITHUB_ENV && dazu.length) {
    const alt = process.env.DATEN_WARNUNG ? process.env.DATEN_WARNUNG + ' · ' : ''
    appendFileSync(process.env.GITHUB_ENV, `DATEN_WARNUNG=${alt}${dazu.length} Meldung(en) auffällig, siehe data/meldungs-auffaelligkeiten.json\n`)
  }
}
if (TROCKEN) {
  console.log(zeilen.join('\n'))
  log(String(erledigteIds.size) + " Meldungen waeren abgehakt worden (Trockenlauf: der Briefkasten bleibt, wie er ist)")
  process.exit(0)
}
if (erledigteIds.size && ABHAKEN_SPAETER) {
  mkdirSync(dirname(ABHAKEN_DATEI), { recursive: true })
  writeFileSync(ABHAKEN_DATEI, JSON.stringify([...erledigteIds]))
  log(`${erledigteIds.size} Meldungen werden nach dem Commit abgehakt`)
} else if (erledigteIds.size) {
  const quittung = await fetch(`${WORKER}/pruefung`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
    body: JSON.stringify({ uebernommen: [...erledigteIds] }),
  })
  log(quittung.ok
    ? `${erledigteIds.size} Meldungen im Worker abgehakt`
    : `Abhaken fehlgeschlagen (HTTP ${quittung.status}) — sie kommen beim nächsten Lauf erneut`)
}
if (offenGeblieben.length) {
  warn(`${offenGeblieben.length} Meldung(en) bleiben im Briefkasten, bis sie zugeordnet sind.`)
}
