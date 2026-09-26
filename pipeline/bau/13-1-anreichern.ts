import { readJson, log } from '../lib/util.ts'
import { type WatchLink, type FolgenFenster, type Title, type Release } from '../../shared/types.ts'
import { amazonAdresseRichten } from '../lib/amazon-adresse.ts'
import { adressKern } from '../lib/dub-confirmed.ts'
import { providerName } from '../../shared/mappings.ts'

/** Handlung je Titel, mit belegter Herkunft der deutschen Fassung. */
export interface SynopsisEintrag {
  de?: string
  en?: string
  deSource?: { name: string; url: string }
}

export function schreibeSynopsenUndReichereAn({ allTitles, releases, kanalJeAdresse }: {
  allTitles: Title[]
  releases: Release[]
  kanalJeAdresse: Map<string, string | undefined>
}) {
  // Synopsen liegen getrennt, damit die Startseite nicht Megabytes laden muss.
  //
  // Drei Quellen, in dieser Reihenfolge: aniSearch schreibt redaktionelle
  // deutsche Texte, TMDB oft nur einen übersetzten Stummel, AniList gar kein
  // Deutsch. Vorher gewann TMDB — und bei „You and I Are Polar Opposites
  // Staffel 2" stand deshalb „The second season of …" auf der Seite, obwohl es
  // eine ausführliche deutsche Inhaltsangabe gibt.
  const synopses: Record<number, SynopsisEintrag> = {}


  /**
   * Die Quelle aus dem Beschreibungstext herauslösen.
   *
   * aniSearch hängt sie an den Text an: „… hinterher.\n\nQuelle:
   * www.anisearch.de/anime/1572". Das stand bei 2.385 von 2.683 deutschen
   * Beschreibungen mitten im Fließtext — und darunter dann noch einmal unsere
   * eigene, anders gestaltete Quellenzeile, die obendrein „themoviedb.org"
   * behauptete, obwohl der Text von aniSearch kam (Daniel, 12.08.2026).
   *
   * Herausgelöst wird sie hier, einmal beim Bauen, statt in der Oberfläche bei
   * jedem Öffnen eines Panels.
   */
  function trenneQuelle(text: string): { text: string; url?: string } {
    const treffer = /\n+\s*Quelle:\s*(\S+)\s*$/.exec(text)
    if (!treffer) return { text: text.trim() }
    const roh = treffer[1]
    return {
      text: text.slice(0, treffer.index).trim(),
      url: roh.startsWith('http') ? roh : `https://${roh}`,
    }
  }

  /* `data/ann-ids.json` führt die Zuordnung unter `ann`: AniList-Kennung -> ANN-Kennung. */
  const annKennungen = readJson<{ ann?: Record<string, number> }>('data/ann-ids.json', {}).ann ?? {}

  /*
    **Die Trailer, je Titel eine YouTube-Kennung.** Geholt von
    `fetch-trailer.ts` aus KinoChecks offizieller API und dem Index seines
    Kanals; hier wird nur zugeordnet. Ein Titel ohne Eintrag bekommt kein Feld
    — die Pille im Panel hängt an seinem Dasein.
  */
  const trailer = readJson<Record<string, { video: string; titel: string; sprache?: 'de' | 'en' | 'ja' }>>(
    'data/trailer.json',
    {},
  )

  /*
    **TOGGO: die Fenster je Folge an den TOGGO-Weg** (19.09.2026, `pipeline/fetch-toggo.ts`).
    Zusammengefasst zu Blöcken gleicher Fenster: Boruto hat 30 Folgen mit demselben Fenster
    bis 31.12.2026 (ein Block), Daima fünf Folgen mit je eigenem 7-Tage-Fenster (fünf Blöcke).
  */
  {
    const toggo = readJson<{
      titel?: Record<string, { adresse?: string; folgen: { staffel: number; folge: number; ab: string; bis: string }[] }>
    }>(
      'data/toggo.json',
      {},
    ).titel ?? {}
    let mitFenster = 0
    for (const t of allTitles) {
      const folgen = toggo[String(t.id)]?.folgen
      if (!folgen) continue
      const bloecke: NonNullable<WatchLink['toggo']> = []
      for (const f of [...folgen].sort((a, b) => a.staffel - b.staffel || a.folge - b.folge)) {
        const letzter = bloecke[bloecke.length - 1]
        if (letzter && letzter.staffel === f.staffel && letzter.bis === f.folge - 1 && letzter.ab === f.ab && letzter.ende === f.bis) letzter.bis = f.folge
        else bloecke.push({ staffel: f.staffel, von: f.folge, bis: f.folge, ab: f.ab, ende: f.bis })
      }
      const adresse = toggo[String(t.id)]?.adresse
      /*
        Kein TOGGO-Weg bekannt, aber die Serie steht im TOGGO-Katalog und hat gerade freie
        Folgen: Weg anlegen. TOGGO zeigt nur deutsche Fassungen (Daniel, 19.09.2026).
      */
      if (adresse && folgen.length && !(t.watchLinks ?? []).some((w) => /(^|\.)toggo\.de\//i.test(w.url.replace(/^https?:\/\//, ''))))
        (t.watchLinks ??= []).push({ name: 'TOGGO', url: adresse, kind: 'stream', zugang: 'kostenlos' })
      for (const w of t.watchLinks ?? []) {
        if (!/(^|\.)toggo\.de\//i.test(w.url.replace(/^https?:\/\//, ''))) continue
        /* Figuren- oder Übersichtsseite → Serienseite (Beyblade X, Daniel 19.09.2026). */
        if (adresse && /toggo\.de\/[a-z0-9-]+\/?$/i.test(w.url)) w.url = adresse
        w.toggo = bloecke
        mitFenster++
      }
    }
    if (mitFenster) log(`${mitFenster} TOGGO-Weg(e) mit Abruffenstern je Folge`)
  }

  /*
    **Joyn: Abruffenster je Folge aus den ProSieben-MAXX-Terminen** (22.09.2026).

    Joyn selbst lesen wir nicht (Impressum: TDM-Vorbehalt nach § 44b). Gemessen an der
    Dragon-Ball-Super-Seite (Folgen 108–127, docs/wissen/quellen.md): Eine Folge ist mit dem Sendeende
    auf ProSieben MAXX online und fällt heraus, wenn die Folge 20 Nummern später zu Ende gesendet
    ist, spätestens am 29. Tag nach der Ausstrahlung um 23:59. Daraus und aus den tv.de-Sichtungen
    (`releasesAusTvProgramm`, Nummern über die Wikipedia-Liste) entstehen die Fenster.

    **Eine Erstsichtung zwischen 0 und 5 Uhr ist kein Start.** Unser tv.de-Verlauf beginnt am
    19.09.2026; Folge 116–125 sahen wir zuerst im Nachtblock am 20.09., Joyn nennt für 116 aber den
    14.09. — die Nacht wiederholt. Solche Folgen bleiben ohne Fenster (die Pille zählt dann zu
    wenig, nie zu viel). Gemessen nur an ProSieben MAXX; andere Sender der Gruppe erst nach Messung.
  */
  {
    const SENDER = new Set(['prosieben maxx'])
    const titelNachId = new Map(allTitles.map((t) => [t.id, t]))
    const plusTage = (tag: string, n: number) => new Date(Date.parse(tag + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
    const plusMinuten = (ab: string, n: number) =>
      new Date(Date.parse(ab + ':00Z') + n * 60_000).toISOString().slice(0, 16)
    let joynFenster = 0
    for (const r of releases) {
      if (r.platform !== 'tv' || !r.folgenBelegt || !SENDER.has((r.sender ?? '').toLowerCase())) continue
      const t = titelNachId.get(r.titleId)
      const joyn = (t?.streams ?? []).find((s) => s.platform === 'joyn')
      const beobachtet = r.schedule.observed ?? {}
      if (!joyn || !Object.keys(beobachtet).length) continue
      const zeit = (nr: number) => r.schedule.zeiten?.[nr] ?? r.schedule.time
      const start = new Map<number, string>()
      for (const [nr, tag] of Object.entries(beobachtet)) {
        const z = zeit(Number(nr))
        if (!z || Number(z.slice(0, 2)) < 5) continue
        start.set(Number(nr), `${tag}T${z}`)
      }
      const fenster: FolgenFenster[] = []
      for (const [nr, ab] of [...start].sort((a, b) => a[0] - b[0])) {
        const frist = `${plusTage(ab.slice(0, 10), 29)}T23:59`
        /* Nachfolger +20 gesendet: Ende mit dessen Sendeende (gemessen: je 25 Minuten nach Beginn). */
        const nachfolger = start.get(nr + 20)
        const ende = nachfolger && plusMinuten(nachfolger, 25) < frist ? plusMinuten(nachfolger, 25) : frist
        /*
          Abrufbar ab dem **Sendeende**, nicht dem Sendebeginn: Joyns `airdate` ist der TV-Termin.
          Gemessen 22.09.2026 (Daniel): 128 lief 17:05–17:30, fehlte um 17:25 und 17:28, war um 17:31 da.
        */
        fenster.push({ nr, ab: plusMinuten(ab, 25), ende })
      }
      /*
        **Die 19 Folgen vor der ersten sicheren Sichtung** (Daniel, 22.09.2026: „die Folgen in der pill
        sind falsch" — „≈ Fg. 126–129", bei Joyn standen 110–129). Joyn hält die letzten 20 Folgen
        (bestätigt 22.09. 17:30: 108 fiel mit dem Sendeende von 128). Premieren laufen in
        Nummernfolge, also sind die 19 davor schon ausgestrahlt — wann genau, wissen wir nicht, wenn
        es vor unserem tv.de-Verlauf lag. Beginn ist dann „vor der ersten sicheren Sichtung", Ende
        das Sendeende von Folge +20, sonst höchstens 29 Tage nach der ersten sicheren Sichtung
        (obere Grenze; die Pille schreibt ohnehin „≈").
      */
      const erste = Math.min(...start.keys())
      const ersteAb = start.get(erste)
      if (ersteAb) {
        const obergrenze = `${plusTage(ersteAb.slice(0, 10), 29)}T23:59`
        const davor = `${plusTage(ersteAb.slice(0, 10), -1)}T00:00`
        for (let nr = Math.max(1, erste - 19); nr < erste; nr++) {
          const nachfolger = start.get(nr + 20)
          const ende = nachfolger && plusMinuten(nachfolger, 25) < obergrenze ? plusMinuten(nachfolger, 25) : obergrenze
          fenster.push({ nr, ab: davor, ende })
        }
        fenster.sort((a, b) => a.nr - b.nr)
      }
      if (!fenster.length) continue
      joyn.fenster = fenster
      joynFenster++
    }
    if (joynFenster) log(`${joynFenster} Joyn-Weg(e) mit Abruffenstern aus dem ProSieben-MAXX-Programm`)
  }
  let gerichtet = 0
  let kanalBenannt = 0
  for (const t of allTitles) {
    for (const s of t.streams ?? []) {
      if (s.platform !== 'primevideo') continue
      const neu = amazonAdresseRichten(s.url)
      if (neu !== s.url) gerichtet++
      s.url = neu
      /* Hier, hinter allen Quellen, trifft der Kanal auch Wege, deren Adresse spät entsteht. */
      const kanal = kanalJeAdresse.get(adressKern(s.url))
      if (kanal) s.kanal = kanal
    }
    /*
      **Und die Bezugswege zum Ansehen ebenso** (21.09.2026). JustWatchs „Amazon Prime
      (Aniverse)" und Verwandte standen unter `/dp/` — bei „The Legend of Hei" eine 404-Seite,
      während dieselbe Kennung unter der Video-Adresse lebt (Daniel mit Bild). Gegenprobe an
      fünf Kanal-Wegen: fünfmal lebendig unter `/gp/video/detail/`, einmal tot unter `/dp/`.
      Betroffen waren 597 Wege. Kaufwege (`kind: 'buy'`) bleiben: Eine DVD gibt es nur unter `/dp/`.
    */
    for (const w of t.watchLinks ?? []) {
      if (w.kind !== 'stream' || !/amazon\.de\/dp\//i.test(w.url)) continue
      const neu = amazonAdresseRichten(w.url)
      if (neu !== w.url) gerichtet++
      w.url = neu
    }
    /*
      **Ein Kanal mit Amazon-Adresse heißt „Amazon Prime (Kanal)"** (21.09.2026). aniSearch
      führt Kanäle teils unter dem Anbieter selbst (`anime-digital-network-(de)`, `aniverse`,
      `pokémon-(de)`), TMDB als „Anime Digital Network Amazon Channel". Bei „Super Cube" stand
      so eine zweite Pille „ADN", die zu Amazon führte (Daniel mit Bild). Gemessen am selben
      Tag: 16 solche Wege, gegen 600 richtig benannte „Amazon Prime (…)".
    */
    for (const w of t.watchLinks ?? []) {
      if (w.kind !== 'stream' || !/(^|\.)amazon\.de\//i.test(w.url.replace(/^https?:\/\//, '')) || /^amazon/i.test(w.name))
        continue
      const kanal = / Amazon Channel$/i.test(w.name) ? providerName(w.name.replace(/ Amazon Channel$/i, '')) : w.name
      w.name = `Amazon Prime (${kanal})`
      kanalBenannt++
    }
  }
  if (kanalBenannt) log(`${kanalBenannt} Kanal-Wege mit Amazon-Adresse als „Amazon Prime (Kanal)" benannt`)
  for (const r of releases) {
    if (r.platform !== 'primevideo' || !r.platformUrl) continue
    const neu = amazonAdresseRichten(r.platformUrl)
    if (neu !== r.platformUrl) gerichtet++
    r.platformUrl = neu
  }
  if (gerichtet) log(`${gerichtet} Prime-Verweise auf die Video-Adresse gerichtet`)
  return { trenneQuelle, synopses, annKennungen, trailer }
}
