/**
 * Macht aus Nachrichten-Vorschlägen **veröffentlichte Meldungen**.
 *
 * Der Bruch mit dem bisherigen Vorgehen: Bis zum 14.08.2026 landete jeder Fund
 * aus `scrape-anime2you.ts` in `data/proposals/` und wartete darauf, dass ein
 * Mensch ihn liest, bewertet und von Hand in `data/curated/*.yaml` überträgt.
 * Was nie übertragen wurde, war für Besucher nicht vorhanden — obwohl die
 * Information da war.
 *
 * Die Messung (14.08.2026, 29 Vorschläge) teilt sie in zwei Hälften, und beide
 * brauchen einen eigenen Weg:
 *
 * - **19 nennen einen Tag**, zehn davon sind nicht kuratiert. Diese Termine
 *   sind belegt und vollständig — sie gehören in den Kalender, nicht in eine
 *   Warteschlange. Dafür ist `releasesAus()` da.
 * - **Der Rest nennt nur einen Monat.** Aus „im September 2026" einen Tag zu
 *   machen wäre eine Falschangabe; auf einen Menschen zu warten, der es tut,
 *   heißt dauerhaft warten. Dafür ist `meldungenAus()` da: Es zeigt, was
 *   dasteht — mit Quelle, Zitat und der Ansage, dass wir den Tag nicht kennen.
 *
 * Beides zusammen befolgt den Grundsatz „nichts behaupten, was nicht belegt
 * ist", statt ihn zu verletzen: Behauptet wird nur der belegte Tag, alles
 * andere wird zitiert.
 *
 * Anime2You ist für Netflix, Disney+, Prime Video, WOW, Joyn, RTL+, Kino und
 * Disc die **einzige** Quelle — ohne diesen Weg bleiben diese Anbieter leer.
 */
import type { Meldung, Quelle, Release, ReleaseType, Title } from '../../shared/types.ts'
import { quelleAnzeigeName } from '../../shared/quelle.ts'
import type { Verschiebung } from './disc-verschiebungen.ts'
import type { SammelEintrag } from './sammelartikel.ts'
import { folgenzahlUeberWerk } from './pruefung.ts'
import { spracheDerMeldung, type Sprachbefund } from './sprachbefund.ts'

/** Ein Fund, wie ihn `scrape-anime2you.ts` ablegt. */
export interface Vorschlag {
  articleTitle: string
  articleUrl: string
  publishedAt: string
  titleId?: number
  category?: string
  platforms?: string[]
  dates?: { iso?: string; month?: string; context: string; /** Meldetag oder letzter Wochentag davor, kein genannter Starttag (`SammelEintrag.datumGeschaetzt`). */ geschaetzt?: boolean }[]
  dub?: string
  /** „pause", „verschoben", … — siehe `Proposal.pause`. */
  pause?: string
  /** Zeilen eines Sammelartikels „… Blu-ray-Termine verschoben". */
  verschiebungen?: Verschiebung[]
  alreadyCurated?: boolean
  /** Aus einem Sammelartikel (`lib/sammelartikel.ts`): alle Folgen an einem Tag … */
  folgen?: number
  /** … oder ein wöchentlicher Simulcast. */
  woechentlich?: boolean
  /** Der Prime-Zusatzkanal, den der Artikel nennt (z. B. Aniverse). */
  kanal?: string
  /** Die gelesenen Einträge, wenn der Vorschlag selbst ein Sammelartikel ist. */
  sammel?: SammelEintrag[]
}

/** Hostname als Anzeigename — „www." fällt weg, es sagt nichts. */
export function quellenName(url: string): string {
  try {
    const u = new URL(url)
    return quelleAnzeigeName(u.hostname.replace(/^www\./, ''), u.pathname)
  } catch {
    return url
  }
}

/**
 * Wörter, an denen eine Meldung als Termin-Meldung erkennbar ist.
 *
 * Der Filter ist bewusst eng: Eine Meldung ohne eines dieser Wörter mag
 * interessant sein, aber sie gehört nicht in einen Terminkalender. Lieber eine
 * Meldung weniger als eine Seite voller Ankündigungen ohne Terminbezug.
 */
/**
 * Die Kennung im Slug eines automatischen Termins bleibt die des aniSearch-Titels, der in einem AniList-Titel aufgegangen ist
 * (`data/anisearch-ids-hand.yaml`, Dubletten 08.10.2026): Der Slug ist die Teilen-Adresse `/r/<slug>/` und der Schlüssel von Termin-Verlauf und
 * Quellengedächtnis — ein neuer Slug ließe eine 404 zurück und meldete den Termin als zurückgezogen. `check:logic` hält die Tabelle zur Handdatei.
 */
export const ALTE_AUTO_KENNUNG: Record<number, number> = { 206814: 10_021_566, 213457: 10_021_751 }

const TERMIN_WOERTER =
  /\b(start(et|en)?|erschein(t|en|ung)|ver(ö|oe)ffentlich|termin|ab dem|ab \d|premiere|kommt|release|simulcast|synchro)/i

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '')

/** Ein zugeordneter Titel samt der Angabe, wie sicher die Zuordnung ist. */
export interface Treffer {
  titel: Title
  /**
   * `true` = der Name in den Guillemets ist genau dieser Titel. Nur dann darf
   * daraus ein Termin werden; ein Präfix-Treffer landet als Meldung.
   */
  genau: boolean
}

/**
 * Ordnet eine Meldung dem Anime zu, um den es geht.
 *
 * Anime2You setzt Titel in »Guillemets« — ein verlässliches Signal, das kein
 * Raten erfordert. Gemessen am 14.08.2026: 24 von 29 Meldungen tragen eines,
 * und mit dem Präfix-Rückfall unten sind **83 %** davon zuzuordnen.
 *
 * Der Rückfall ist nötig, weil in Überschriften die **Reihe** steht, nicht der
 * Titel: „Re:ZERO" statt „Re:ZERO -Starting Life in Another World-". Bei
 * mehreren Kandidaten gewinnt der älteste — das ist die Ausgangsserie, und auf
 * die bezieht sich der Reihenname.
 *
 * Was sich nicht zuordnen lässt, wird **verworfen**, nicht geraten. Eine
 * Meldung am falschen Anime wäre schlimmer als gar keine.
 */
export function findeTitel(artikelTitel: string, titel: Title[]): Treffer | undefined {
  const namen = [...artikelTitel.matchAll(/»([^«]+)«/g)].map((m) => m[1])
  if (!namen.length) return undefined

  const exakt = new Map<string, Title>()
  const alle: [string, Title][] = []
  for (const t of titel) {
    for (const n of [t.titleDe, t.titleEn, t.titleRomaji]) {
      if (!n) continue
      const k = norm(n)
      if (!exakt.has(k)) exakt.set(k, t)
      alle.push([k, t])
    }
  }

  for (const name of namen) {
    const k = norm(name)
    if (!k) continue
    const genau = exakt.get(k)
    if (genau) return { titel: genau, genau: true }
    // Kurze Bruchstücke treffen zu viel — „Air" fände ein Dutzend Serien.
    if (k.length < 4) continue
    const kandidaten = alle.filter(([n]) => n.startsWith(k)).map(([, t]) => t)
    if (kandidaten.length) {
      return {
        titel: kandidaten.sort((a, b) => (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id)[0],
        genau: false,
      }
    }
  }
  return undefined
}

const ORDINALZAHLEN: Record<string, number> = {
  erste: 1, ersten: 1, zweite: 2, zweiten: 2, dritte: 3, dritten: 3, vierte: 4, vierten: 4,
  fünfte: 5, fünften: 5, sechste: 6, sechsten: 6, siebte: 7, siebten: 7, achte: 8, achten: 8,
  neunte: 9, neunten: 9, zehnte: 10, zehnten: 10,
}

/**
 * Liest aus einer Überschrift, um welchen Teil einer Reihe es geht.
 *
 * Anime2You schreibt „Zweite Staffel von »The Dangers in My Heart«" oder „Design
 * der Blu-ray-Box der vierten »Rent-A-Girlfriend«-Staffel". Der Titel in den
 * Guillemets ist in beiden Fällen der der **ersten** Staffel — wer nur ihn
 * ausliest, hängt den Termin der zweiten oder vierten Staffel an die erste.
 *
 * Genau das ist beim ersten Lauf am 14.08.2026 passiert: Drei von fünf
 * automatisch übernommenen Terminen saßen an der falschen Staffel.
 *
 * `art` unterscheidet Staffel von Film, weil „der zweite Film" auf eine andere
 * Liste zeigt als „die zweite Staffel".
 */
export function teilAusUeberschrift(
  text: string,
): { nummer?: number; art: 'staffel' | 'film' } | undefined {
  const wort = /\b(erste[nr]?|zweite[nr]?|dritte[nr]?|vierte[nr]?|fünfte[nr]?|sechste[nr]?|siebte[nr]?|achte[nr]?|neunte[nr]?|zehnte[nr]?)\b/i
  const ziffer = /\b(\d{1,2})\.\s*(staffel|season)|staffel\s*(\d{1,2})\b/i
  const istFilm = /\bfilm\b|-film|\bmovie\b|\bkinostart\b/i.test(text)
  const istStaffel = /\bstaffel\b|\bseason\b/i.test(text)
  if (!istFilm && !istStaffel) return undefined

  const z = ziffer.exec(text)
  if (z) return { nummer: Number(z[1] ?? z[3]), art: 'staffel' }
  const w = wort.exec(text)
  const nummer = w ? ORDINALZAHLEN[w[1].toLowerCase().replace(/[nr]$/, '')] : undefined
  return { nummer, art: istFilm ? 'film' : 'staffel' }
}

/**
 * Sucht den gemeinten Teil einer Reihe — oder gibt auf.
 *
 * Aufgeben ist hier die richtige Antwort und keine Schwäche: Ein Termin an der
 * falschen Staffel ist schlimmer als kein Termin, weil er aussieht, als hätte
 * ihn jemand geprüft. Was hier durchfällt, erscheint als Meldung mit Zitat und
 * Quelle — der Leser sieht die Information trotzdem.
 */
function reihenTeil(basis: Title, alle: Title[], text: string): Title | undefined {
  const teil = teilAusUeberschrift(text)
  // Keine Staffel-/Film-Angabe: Die Überschrift meint den Titel selbst.
  if (!teil) return basis
  if (!teil.nummer) return undefined

  const reihe = basis.franchiseId ?? basis.id
  const inReihe = alle.filter((t) => (t.franchiseId ?? t.id) === reihe)

  /**
   * **Zuerst am Namen suchen, erst dann zählen.**
   *
   * Die Zählung über die Liste der TV-Einträge geht schief, sobald unsere
   * Staffelaufteilung nicht der des Artikels entspricht — und das ist der
   * Normalfall. Bei Re:ZERO führen wir „Season 2 Part 2" als eigenen Eintrag;
   * die vierte Position unserer Liste ist deshalb Staffel 3, und eine Meldung
   * über Staffel 4 landete am falschen Titel.
   *
   * Trägt ein Titel die Zahl im Namen — „Staffel 4", „Season 4" —, ist das die
   * verlässliche Auskunft. Sie kommt aus derselben Quelle wie der Artikel und
   * nicht aus unserer Sortierung.
   */
  if (teil.art === 'staffel') {
    // Doppelte Rückstriche sind Pflicht: In einem Template-Literal wäre ein
    // einfaches \\b ein Backspace-Zeichen statt einer Wortgrenze, und die
    // Suche träfe nie. Genau daran scheiterte der erste Anlauf (15.08.2026).
    const imNamen = new RegExp(`(staffel|season)\\s*0*${teil.nummer}\\b`, 'i')
    const treffer = inReihe.filter((t) =>
      [t.titleDe, t.titleEn, t.titleRomaji].some((n) => n && imNamen.test(n)),
    )
    if (treffer.length === 1) return treffer[0]
    if (treffer.length > 1) return undefined
  }

  const mitglieder = inReihe
    /**
     * „Staffel" heißt `TV`, nicht „alles außer Film". Specials und OVAs stehen
     * chronologisch zwischen den Staffeln und verschieben die Zählung: Beim
     * ersten Lauf landete „Zweite Staffel von The Dangers in My Heart" auf dem
     * Special, weil das 2023 zwischen S1 und S2 erschien.
     */
    .filter((t) => (teil.art === 'film' ? t.format === 'MOVIE' : t.format === 'TV'))
    .sort((a, b) => (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id)

  // „Erste Staffel" bei einer Reihe, die wir gar nicht als Reihe kennen, ist
  // trotzdem eindeutig — sie meint den Titel selbst.
  if (mitglieder.length < 2) return teil.nummer === 1 ? basis : undefined
  return mitglieder[teil.nummer - 1]
}

/**
 * Wandelt Vorschläge in Meldungen um — nur die mit Titelbezug und Terminbezug.
 *
 * `bekannt` bildet AniList-Kennungen auf Titel ab; ein Vorschlag ohne
 * zuordenbaren Titel wird verworfen. Eine Meldung, die niemand einem Anime
 * zuordnen kann, hilft auch niemandem.
 */
export function meldungenAus(vorschlaege: Vorschlag[], titel: Title[], heute: string): Meldung[] {
  const out: Meldung[] = []
  for (const v of vorschlaege) {
    const gefunden = v.titleId
      ? titel.find((t) => t.id === v.titleId)
      : findeTitel(v.articleTitle, titel)?.titel
    if (!gefunden) continue
    /**
     * Lässt sich die Staffel nicht auflösen, wird die Meldung **verworfen**.
     *
     * Vorher hing sie ersatzweise am Reihenkopf, mit der Begründung, sie
     * behaupte ja keinen Termin, sondern zitiere nur. Das war ein Trugschluss:
     * Ein Zitat über Staffel 4 unter Staffel 3 ist genauso falsch wie ein
     * Termin dort, nur schwerer zu bemerken.
     */
    const treffer = reihenTeil(gefunden, titel, v.articleTitle)
    if (!treffer) continue

    const text = `${v.articleTitle} ${(v.dates ?? []).map((d) => d.context).join(' ')}`
    if (!TERMIN_WOERTER.test(text)) continue

    /**
     * Nur Meldungen **ohne** exakten Termin werden hier gezeigt. Wo ein Tag
     * dasteht, gehört die Angabe in einen Release — nicht in einen Hinweis,
     * den der Leser selbst auswerten muss.
     */
    const mitTag = (v.dates ?? []).find((d) => d.iso)
    if (mitTag) continue

    const monat = (v.dates ?? []).find((d) => d.month)
    const quelle: Quelle = {
      url: v.articleUrl,
      name: quellenName(v.articleUrl),
      gesehenAm: heute,
      sagt: monat?.month,
      stand: 'aktuell',
    }
    out.push({
      titleId: treffer.id,
      quelle,
      titel: v.articleTitle,
      zitat: monat?.context ?? v.dates?.[0]?.context,
      monat: monat?.month,
      datum: v.publishedAt,
    })
  }

  // Neueste zuerst, und je Titel höchstens drei — sonst wird aus einem Hinweis
  // eine Nachrichtenübersicht.
  out.sort((a, b) => b.datum.localeCompare(a.datum))
  const jeTitel = new Map<number, number>()
  return out.filter((m) => {
    const n = (jeTitel.get(m.titleId) ?? 0) + 1
    jeTitel.set(m.titleId, n)
    return n <= 3
  })
}

/**
 * Macht aus Vorschlägen **mit belegtem Tag** fertige Releases.
 *
 * Das ist der Teil, der den Bot autonom macht: Bis hierher landete ein Termin
 * wie „Dragon Ball DAIMA ab dem 28. August auf RTL+" in einer Datei, die
 * niemand liest. Zehn solcher Termine lagen am 14.08.2026 ungenutzt herum.
 *
 * Drei Dinge werden bewusst **nicht** getan:
 *
 * - **Keine Folgenzahl erfinden.** `episodeCount` bleibt leer, wenn die Meldung
 *   keine nennt — daraus wird ein einzelner Termin statt einer erfundenen
 *   Wochenserie. Genau dieser Fehler hat am 10.08.2026 neun Reihen erfunden.
 * - **Nichts überschreiben.** Gibt es zum selben Titel auf derselben Plattform
 *   schon ein Release, gewinnt das vorhandene. Handarbeit schlägt Automatik.
 * - **Nicht raten, welcher Anbieter gemeint ist.** Ohne `platforms` fällt der
 *   Vorschlag durch.
 */
/**
 * **Ein Abschied ist kein Termin.** „Netflix entfernt »Kuromukuro« aus seinem Programm" (03.10.)
 * stand als „erscheint morgen" im Kalender — für eine Serie, die dort seit 2016 auf Deutsch läuft.
 * Das Datum einer solchen Meldung ist das Ende eines Angebots, nicht sein Anfang.
 */
export function istAbschied(ueberschrift: string): boolean {
  return /\b(?:entfernt|verlässt|verlassen|nimmt\b.*\braus\b|nicht mehr (?:verfügbar|abrufbar|im)|aus dem (?:Programm|Katalog|Angebot)|läuft aus)/i.test(ueberschrift)
}

const TV_UMFELD = /TV-Premiere|Free-TV|im (?:deutschen )?Fernsehen|TV-Ausstrahlung|auf (?:TOGGO plus|SUPER RTL|ProSieben MAXX|RTLZWEI|RTL II|Nicktoons|Nickelodeon|Disney Channel|KiKA)\b/i

/**
 * Der Tag, den eine Meldung für den Termin nennt — ohne Fernsehumfeld. **Eine Verschiebung nennt
 * alten und neuen Tag, der neue ist der spätere** („nicht wie geplant am 2. Oktober, sondern erst am
 * 20. November": Gantz stand bis 27.09.2026 auf dem alten).
 */
export function terminDerMeldung(v: Pick<Vorschlag, 'dates' | 'pause'>): string | undefined {
  const tage = (v.dates ?? []).filter((d) => d.iso && !TV_UMFELD.test(d.context ?? '')).map((d) => d.iso!)
  return v.pause === 'verschoben' ? tage.sort().at(-1) : tage[0]
}

/**
 * Der Anbieter muss zur Art der Meldung passen. Ein Disc-Artikel führt oft
 * beide Kennungen (`["crunchyroll","disc"]`, weil Crunchyroll der Verlag
 * ist) — `platforms[0]` machte daraus einen Streaming-Termin.
 */
function anbieterDerMeldung(v: Vorschlag): string | undefined {
  if (v.category === 'disc') return v.platforms?.includes('disc') ? 'disc' : undefined
  if (v.category === 'kino') return 'kino'
  return v.platforms?.find((p) => p !== 'disc' && p !== 'kino')
}

function artDerMeldung(v: Vorschlag, platform: string, treffer: Title): ReleaseType {
  if (v.category === 'kino' || treffer.format === 'MOVIE') return 'movie'
  return v.category === 'disc' || platform === 'disc' ? 'disc' : 'batch'
}

/**
 * **Ein Beleg steht nur bei der Aussage, die er trägt** (10.10.2026). Ein Release im Kalender sagt „auf Deutsch
 * am …“. Nennt die Meldung nur Originalton mit Untertiteln, widerlegt sie das selbst — kein Release
 * (`releasesAus`), eine früher daraus erschienene Ankündigung wird mit Grund zurückgezogen (`news-verlauf.ts`).
 * Nennt sie den Tag, aber keine Sprachfassung (oder lässt sie offen), trägt sie nur den Tag: Das Release bleibt,
 * die Notiz sagt es. Discs nicht — deutsche Ausgaben tragen fast immer deutschen Ton, und eine reine OmU-Ausgabe
 * nennt der Artikel (`nein`). Melden mehrere Artikel denselben Termin, gewinnt der mit Sprachzusage.
 */
const SPRACH_NOTIZ: Partial<Record<Sprachbefund, string>> = {
  unklar: 'Termin laut Quelle – ob mit deutscher Synchro, sagt sie nicht.',
  offen: 'Termin laut Quelle – ob mit deutscher Synchro, ist dort noch offen.',
}

function sprachHinweis(sprache: Sprachbefund, platform: string): Pick<Release, 'note' | 'sprache'> {
  const note = platform === 'disc' ? undefined : SPRACH_NOTIZ[sprache]
  return note ? { note, sprache: 'offen' } : {}
}

const nachSprachzusage = (vorschlaege: Vorschlag[]) =>
  [...vorschlaege].sort((a, b) => Number(spracheDerMeldung(b) === 'ja') - Number(spracheDerMeldung(a) === 'ja'))

/** Meldungen mit Termin, die nur Originalton nennen — für das Protokoll des Baus und den Grund in den News. */
export function nurOriginaltonMeldungen(vorschlaege: Vorschlag[]): Vorschlag[] {
  return vorschlaege.filter((v) => !v.alreadyCurated && terminDerMeldung(v) && spracheDerMeldung(v) === 'nein')
}

export function releasesAus(
  vorschlaege: Vorschlag[],
  titel: Title[],
  vorhanden: Release[],
  heute: string,
): Release[] {
  // Titel + Anbieter identifizieren ein Release eindeutig genug: Ein zweiter
  // Kinostart desselben Films ist kein eigener Termin, sondern ein Widerspruch.
  const belegt = new Set(vorhanden.map((r) => `${r.titleId}|${r.platform}`))
  const out: Release[] = []

  for (const v of nachSprachzusage(vorschlaege)) {
    const sprache = spracheDerMeldung(v)
    if (v.alreadyCurated || istAbschied(v.articleTitle) || sprache === 'nein') continue
    /*
      **Ein Fernsehtermin ist kein Streaming-Termin.** „Dragon Ball DAIMA" lief
      ab 28.08.2026 im TV bei TOGGO plus, abrufbar bei RTL+ erst ab 25.09. — der
      Artikel nennt beides, und genommen wurde das erste Datum für RTL+.
      Ein Datum, dessen Umfeld vom Fernsehen spricht,
      gilt deshalb für keinen Anbieter, den wir führen.
    */
    const tag = terminDerMeldung(v)
    if (!tag) continue

    /**
     * Für einen **Termin** reicht ein Präfix-Treffer nicht. „Re:ZERO" in einer
     * Überschrift sagt nicht, welche der vier Staffeln gemeint ist; als Meldung
     * ist das in Ordnung, als Kalendereintrag wäre es eine Falschangabe.
     */
    const basis = v.titleId
      ? titel.find((t) => t.id === v.titleId)
      : findeTitel(v.articleTitle, titel)?.genau
        ? findeTitel(v.articleTitle, titel)?.titel
        : undefined
    if (!basis) continue

    const treffer = reihenTeil(basis, titel, v.articleTitle)
    if (!treffer) continue

    const platform = anbieterDerMeldung(v)
    if (!platform) continue
    const schluessel = `${treffer.id}|${platform}`
    if (belegt.has(schluessel)) continue
    belegt.add(schluessel)

    const art = artDerMeldung(v, platform, treffer)

    const name = treffer.titleDe ?? treffer.titleEn ?? treffer.titleRomaji ?? `#${treffer.id}`
    const quelle: Quelle = {
      url: v.articleUrl,
      name: quellenName(v.articleUrl),
      gesehenAm: heute,
      sagt: tag,
      stand: 'aktuell',
    }

    out.push({
      /**
       * **Kein Datum im Slug.**
       *
       * Aus dem Slug wird die Teilen-Adresse `/r/<slug>/`, eine echte Datei im
       * Bauwerk. Stand das Datum darin, erzeugte jede Terminverschiebung eine
       * neue Adresse und ließ die alte als 404 zurück — bei Terminen, die sich
       * erfahrungsgemäß dauernd verschieben, ein eingebauter Fehlerlieferant.
       * Google hat genau das am 16.08.2026 gemeldet.
       *
       * Titel und Anbieter identifizieren das Release ohnehin eindeutig; mehr
       * als eines je Kombination lässt `releasesAus` nicht zu.
       */
      slug: `auto-${ALTE_AUTO_KENNUNG[treffer.id] ?? treffer.id}-${platform}`,
      titleId: treffer.id,
      name,
      platform: platform as Release['platform'],
      ...(v.kanal && platform === 'primevideo' ? { kanal: v.kanal } : {}),
      ...zeitplanGeschaetzt(zeitplanAusVorschlag(v, art, tag, treffer, platform), v.dates?.some((d) => d.iso === tag && d.geschaetzt)), ...sprachHinweis(sprache, platform),
      year: Number(tag.slice(0, 4)),
      herkunft: `Automatisch übernommen aus „${v.articleTitle}".`,
      automatisch: true,
      sources: [v.articleUrl],
      quellen: [quelle],
    })
  }
  return out
}

/** Ein Tag, der nur der Meldetag ist („Ab sofort bei Netflix“), steht als abgeleitet (`schedule.estimated`), nicht als bestätigt. */
function zeitplanGeschaetzt(plan: Pick<Release, 'releaseType' | 'schedule' | 'dateMeaning'>, geschaetzt?: boolean): Pick<Release, 'releaseType' | 'schedule' | 'dateMeaning'> {
  return geschaetzt && plan.schedule ? { ...plan, schedule: { ...plan.schedule, estimated: true } } : plan
}

/**
 * **Wie ein Sammelartikel-Eintrag in den Kalender kommt.** Ein Komplettpaket („Episoden: 13
 * (komplett)") trägt seine Folgenzahl; einer älteren Serie, die nur neu ins Angebot kommt, gilt
 * der Tag als „im Angebot seit", nicht als Erscheinen. Ein wöchentlicher Simulcast läuft
 * wöchentlich — mit AniLists Folgenzahl als Schätzung („≈"), ohne sie als einzelner Termin.
 *
 * **Eine Einzelmeldung ohne Folgenzahl ist ein Wochenstart, keine Komplettveröffentlichung** (10.10.2026): „Dragon Ball
 * Super: Beerus … im Simulcast … Neue Folgen erscheinen wöchentlich" stand als „Alle Folgen im Angebot morgen". Komplett
 * nur, wenn die Meldung es sagt (`taktDerMeldung`), das Werk in Japan aus einem früheren Jahr stammt (Katalogzugang) oder es eine
 * Netflix-Eigenproduktion ohne Fernsehausstrahlung ist (ONA bei Netflix: „Fool Night“ kommt am 26.11.2026 komplett).
 */
export function zeitplanAusVorschlag(
  v: Pick<Vorschlag, 'folgen' | 'woechentlich'> & Partial<Pick<Vorschlag, 'articleTitle' | 'dates'>>,
  art: ReleaseType,
  tag: string,
  treffer: Pick<Title, 'episodes' | 'jpYear'> & Partial<Pick<Title, 'format'>>,
  platform?: string,
): Pick<Release, 'releaseType' | 'schedule' | 'dateMeaning'> {
  if (art === 'batch' && !v.folgen && (v.woechentlich ?? wochenstartOhneAngabe(v, tag, treffer, platform)))
    return {
      releaseType: 'weekly',
      schedule: { firstEpisodeDate: tag, ...(treffer.episodes ? { episodeCount: treffer.episodes, episodeCountAssumed: true } : {}) },
    }
  const katalog = art === 'batch' && v.folgen && treffer.jpYear && treffer.jpYear < Number(tag.slice(0, 4))
  return {
    releaseType: art,
    /* Eine Zahl weit über dem Werk (86: 23 für Teil 1 mit 11) gehört dem ganzen Katalogeintrag, nicht diesem Titel — Keine Folgenzahl erfinden. */
    schedule: { firstEpisodeDate: tag, ...(v.folgen && art === 'batch' && !(treffer.episodes && folgenzahlUeberWerk(v.folgen, treffer.episodes)) ? { episodeCount: v.folgen } : {}) },
    ...(katalog ? { dateMeaning: 'available-from' as const } : {}),
  }
}

const WOCHENTAKT = /(wöchentlich|simulcast|wochentakt|jeden (?:montag|dienstag|mittwoch|donnerstag|freitag|samstag|sonntag)|(?:neue|weitere) (?:folgen|episoden))/i
const KOMPLETT = /(alle (?:\d+ )?(?:folgen|episoden)|sämtliche (?:folgen|episoden)|komplett|binge|auf einen schlag|auf einmal|gesamte staffel)/i

/** Was eine Meldung über den Takt sagt — aus Überschrift und Fundstellen; eine Komplett-Angabe schlägt den Wochentakt. */
export function taktDerMeldung(v: Partial<Pick<Vorschlag, 'articleTitle' | 'dates'>>): 'komplett' | 'woechentlich' | undefined {
  const text = [v.articleTitle ?? '', ...(v.dates ?? []).map((d) => d.context)].join('\n')
  return KOMPLETT.test(text) ? 'komplett' : WOCHENTAKT.test(text) ? 'woechentlich' : undefined
}

/** Ohne Folgenzahl: wöchentlich, außer die Meldung sagt „komplett", das Werk ist älter (Katalogzugang) oder eine Netflix-ONA. */
function wochenstartOhneAngabe(v: Partial<Pick<Vorschlag, 'articleTitle' | 'dates'>>, tag: string, treffer: Partial<Pick<Title, 'jpYear' | 'format'>>, platform?: string): boolean {
  const takt = taktDerMeldung(v)
  if (takt) return takt === 'woechentlich'
  if (platform === 'netflix' && treffer.format === 'ONA') return false
  return !treffer.jpYear || treffer.jpYear >= Number(tag.slice(0, 4))
}

/**
 * Führt Quellen zusammen, ohne je eine zu verlieren.
 *
 * Nach der Wikipedia-Regel: Eine Quelle, die eine neuere widerlegt hat, wird
 * markiert und bleibt stehen. Wer nur die neueste führt, kann später nicht mehr
 * sagen, woher der alte Stand kam — und genau diese Frage stellt sich, sobald
 * zwei Quellen sich widersprechen.
 */
export function quellenZusammenfuehren(alt: Quelle[], neu: Quelle[]): Quelle[] {
  const nachUrl = new Map<string, Quelle>()
  for (const q of alt) nachUrl.set(q.url, q)
  for (const q of neu) {
    const bisher = nachUrl.get(q.url)
    // Anhängend (01.10.2026): Der erste Beleg bleibt, wird nicht überschrieben.
    nachUrl.set(q.url, bisher ? { ...q, gesehenAm: bisher.gesehenAm, sagt: bisher.sagt ?? q.sagt } : q)
  }
  // Aktuelle zuerst, dann nach Sichtung absteigend.
  return [...nachUrl.values()].sort(
    (a, b) =>
      Number(a.stand === 'ueberholt') - Number(b.stand === 'ueberholt') ||
      b.gesehenAm.localeCompare(a.gesehenAm),
  )
}
