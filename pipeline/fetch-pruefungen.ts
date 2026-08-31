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
import { existsSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { echteAmazonAdresse } from './lib/amazon-adresse.js'
import { resolve } from 'node:path'
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
import { schluesselAdresse, titelSchluessel } from './lib/zuordnung.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN
/** Nur zeigen, was entstünde — nichts schreiben, nichts abhaken. */
const TROCKEN = process.argv.includes('--trocken')

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
}

if (!TOKEN) {
  warn('LAUF_TOKEN fehlt — ohne das Token gibt der Worker die Prüfungen nicht heraus.')
  process.exit(0)
}

const antwort = await fetch(`${WORKER}/pruefung?token=${encodeURIComponent(TOKEN)}`)
if (!antwort.ok) {
  warn(`Prüfungen nicht abrufbar: HTTP ${antwort.status}`)
  process.exit(1)
}
const { pruefungen } = (await antwort.json()) as { pruefungen: Pruefung[] }

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
  streams?: Array<{ platform: string; url: string }>
}> =
  Array.isArray(titles) ? titles : (titles.titles ?? Object.values(titles))

const nachUrl = new Map<string, number[]>()
for (const t of liste) {
  for (const s of t.streams ?? []) {
    if (!s.url) continue
    const k = schluesselAdresse(s.url)
    const liste2 = nachUrl.get(k) ?? []
    liste2.push(t.id)
    nachUrl.set(k, liste2)
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
/** Meldungen, deren Suchadresse den Titel im Klartext trug. */
let ausSuchadresseZugeordnet = 0
const offenGeblieben: string[] = []
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
  const serien = alle.filter((t) => t.format === 'TV' || t.format === 'ONA')
  const eintraege = serien.length ? serien : alle
  return eintraege
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
  const schluessel = `${p.plattform}\u0000${p.url}`
  jeAdresse.set(schluessel, [...(jeAdresse.get(schluessel) ?? []), p])
}

for (const gruppe of jeAdresse.values()) {
  const p = gruppe[gruppe.length - 1]!
  let ids = nachUrl.get(schluesselAdresse(p.url)) ?? []
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
  if (ids.length === 1) {
    const staffelNr = gruppe
      .map((x) => x.staffel)
      .find((n): n is number => typeof n === 'number' && Number.isFinite(n) && n >= 2 && n <= 50)
    /*
      Die Folgenzahl der **Staffel**: Bei je-Folge-Meldungen steht `folgen` auf
      1 und sagt nichts — dann zählt, wie viele Folgen gemeldet wurden.
    */
    const folgenZahl = Math.max(
      ...gruppe.map((x) => (typeof x.folgen === 'number' && Number.isFinite(x.folgen) ? x.folgen : 0)),
      gruppe.filter((x) => x.folge_nr != null).length,
    )
    const kopf = liste.find((x) => x.id === ids[0])
    const franchise = kopf?.franchiseId ?? ids[0]
    if (staffelNr && folgenZahl > 0 && franchise) {
      const reihe = staffelnDerAdresse(
        liste.filter((x) => (x.franchiseId ?? x.id) === franchise).map((x) => x.id),
      )
      const gedeckt: number[] = []
      let rest = folgenZahl
      for (const eintrag of reihe.slice(staffelNr - 1)) {
        if (rest <= 0) break
        gedeckt.push(eintrag.id)
        rest -= eintrag.folgen
      }
      if (gedeckt.length && rest === 0 && !(gedeckt.length === 1 && gedeckt[0] === ids[0])) {
        log(
          `Staffel ${staffelNr} von „${kopf?.titleDe ?? kopf?.titleEn ?? ids[0]}" gehört zu ` +
            `${gedeckt.join(', ')} — ${folgenZahl} Folgen gehen glatt auf`,
        )
        ids = gedeckt
        nachStaffelZugeordnet++
      }
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
  const weg = jueng[jueng.length - 1]?.befund === 'weg' ? jueng[jueng.length - 1] : undefined

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
  if (anbieterStaffeln && staffeln.length) {
    for (const m of gruppe) {
      if (m.befund === 'weg' || m.folge_nr == null || m.folge_nr < 1) continue
      const treffer = ordneMeldungZu(
        { folge: m.folge_nr, staffel: m.staffel },
        staffeln,
        anbieterStaffeln,
      )
      if (!treffer) continue
      const bisher = jeStaffel.get(treffer.staffel.id) ?? []
      bisher.push({ folge: treffer.folgeInStaffel, dub: m.befund === 'dub' })
      jeStaffel.set(treffer.staffel.id, bisher)
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
    const ohneAussage =
      !weg &&
      !echteAmazonAdresse(p) &&
      nachUrl.has(schluesselAdresse(p.url)) &&
      !eigene.length &&
      gruppe.some((x) => /Kanal-Titel/.test(x.notiz ?? ''))
    if (ohneAussage) {
      ausgelassenKanal++
      continue
    }

    zeilen.push('')
    zeilen.push(`- anilistId: ${id}`)
    if (t?.titleDe || t?.titleEn) zeilen.push(`  title: ${JSON.stringify(t.titleDe ?? t.titleEn)}`)
    zeilen.push(`  platform: ${p.plattform}`)
    // Kam die Zuordnung über den Namen zustande, kennt unser Datensatz die
    // Adresse noch nicht — dann gehört sie mit hinein, sonst bleibt der Befund
    // ohne Verweis stehen.
    const echte = echteAmazonAdresse(p)
    let adresseGeschrieben = false
    if (echte) {
      zeilen.push(`  url: ${echte}`)
      adresseGeschrieben = true
    } else if (!nachUrl.has(schluesselAdresse(p.url))) {
      zeilen.push(`  url: ${p.url}`)
      adresseGeschrieben = true
    }
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
      if (!adresseGeschrieben && !nachUrl.has(schluesselAdresse(p.url))) {
        zeilen.push(`  url: ${p.url}`)
      }
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
      p.notiz ?? '',
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
  const neu = alt.trimEnd() + '\n' + kopf + '\n' + zeilen.join('\n') + '\n'
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
  writeFileSync(p, neu)
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
    (selbstZugeordnet ? `, ${selbstZugeordnet} über den Namen zugeordnet` : '') +
    (ausSuchadresseZugeordnet
      ? `, ${ausSuchadresseZugeordnet} über den Titel in der Suchadresse`
      : '') +
    (nachStaffelZugeordnet
      ? `, ${nachStaffelZugeordnet} über die Staffelnummer an den Titel der Reihe`
      : '') +
    (ausgelassenKanal
      ? `, ${ausgelassenKanal} Kanal-Meldung(en) ohne Urteil ausgelassen (sie würden nur einen jüngeren Beleg verdecken)`
      : ''),
)
for (const o of offenGeblieben) warn(o)
if (TROCKEN) {
  console.log(zeilen.join('\n'))
  log(String(erledigteIds.size) + " Meldungen blieben im Briefkasten (Trockenlauf)")
  process.exit(0)
}
if (erledigteIds.size) {
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
