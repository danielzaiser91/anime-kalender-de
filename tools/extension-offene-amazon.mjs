/**
 * Die Liste der Amazon-Adressen, bei denen eine Prüfung noch etwas bringt.
 *
 * ## Warum Amazon anders liegt als Netflix
 *
 * Bei Netflix muss Daniel **jede Folge einzeln** anspielen, damit der Player
 * seine Tonspuren preisgibt. Amazon nennt sie **im ausgelieferten HTML** — je
 * Folge ein `audioTracks`-Feld, dazu je Staffel ein `benefitId`, das sagt,
 * welches Abo nötig ist (gemessen am 23.08.2026 an „Naruto Shippuden").
 *
 * Ein Seitenaufruf trägt damit eine ganze Staffel statt einer Folge. Deshalb
 * braucht diese Liste auch keine Folgenempfehlungen wie die Netflix-Fassung —
 * es genügt, die Seite zu öffnen.
 *
 * ## Warum die Erweiterung und kein Abruf
 *
 * `amazon.de/robots.txt` wäre kein Hindernis, aber die Nutzungsbedingungen
 * untersagen „Data Mining, Robots oder ähnliche Datensammel- und
 * Extraktionsprogramme" ausdrücklich (Abschnitt 5, „Lizenz und Zugang").
 * Ein Mensch, der eine Seite ansieht, nutzt die Lizenz bestimmungsgemäß —
 * ein Abrufer nicht. Die vollständige Bewertung steht in `status.md`.
 *
 * **Aufruf: npm run data:extension-liste** — nicht dieses Werkzeug allein.
 *
 * Die Prüfliste der Erweiterung und der Prüfstand der Statusanzeige zählen
 * dasselbe aus zwei Dateien. Wer nur eine erneuert, erzeugt einen Widerspruch,
 * den niemand als Fehler erkennt: Am 31.08.2026 sagte die Erweiterung „alles
 * geprüft" und die Statusanzeige „3 Suchen" — beide hatten recht, nur stand
 * `public/data/pruefstand.json` noch auf dem Stand von vorher.
 *
 * Das npm-Skript ruft beide auf, dazu die Vorschläge und die Wiedervorlage.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
import { verdachtHinweis, verdachtsfaelle } from './verdacht.mjs'
/**
 * **Ein Verdachtsfall ist geprüft und trotzdem offen.**
 *
 * „Geprüft ist geprüft" nimmt beantwortete Titel aus der Liste — richtig, außer
 * wenn eine zweite Quelle dem Urteil widerspricht. Dann ist die Frage wieder da,
 * und sie gehört dorthin, wo sie mit einem Klick zu beantworten ist (Daniel,
 * 31.08.2026).
 */
const verdaechtig = verdachtsfaelle(wurzel, 'primevideo')

/**
 * **Geprüft ist geprüft — auch ohne Urteil.**
 *
 * Die Liste filterte über `stream.dub !== undefined`: Wer ein Urteil trägt,
 * fällt raus. Bei einem **Kanal-Titel** entsteht aber nie eins — Amazons
 * Sprachangabe gilt dort nicht (CLAUDE.md, 24.08.2026), und der Bau schreibt
 * deshalb bewusst kein `dub`.
 *
 * Folge: eine Schleife ohne Ausgang. „Kakushite! Makina-san!!" steht seit dem
 * 27.08.2026 in `dub-confirmed.yaml` — geprüft, mit Notiz — und stand am
 * 30.08.2026 immer noch auf der Prüfliste. Daniel: „entfern den eintrag, ich
 * hab es bereits gemeldet." Er hätte es beliebig oft melden können.
 *
 * Die Liste zeigt offene **Arbeit**, nicht offene **Urteile**. Wer einmal
 * hingesehen hat, sieht beim zweiten Mal dasselbe.
 */
const belege = readFileSync(resolve(wurzel, 'data/dub-confirmed.yaml'), 'utf8')
const geprueftePrime = (() => {
  const ids = new Set()
  const adressen = new Set()
  let id = null
  let istPrime = false
  for (const zeile of belege.split('\n')) {
    const neu = /^- anilistId: (\d+)/.exec(zeile)
    if (neu) {
      id = Number(neu[1])
      istPrime = false
      continue
    }
    if (/^  platform: primevideo\b/.test(zeile)) {
      istPrime = true
      if (id) ids.add(id)
      continue
    }
    const url = istPrime ? /^  url: (\S+)/.exec(zeile) : null
    if (url) adressen.add(url[1])
  }
  return { ids, adressen }
})()
const roh = JSON.parse(readFileSync(resolve(wurzel, 'public/data/titles.json'), 'utf8'))
const titel = Array.isArray(roh) ? roh : (roh.titles ?? Object.values(roh))

/**
 * Die Kennung aus einer Amazon-Adresse.
 *
 * Beide Formen kommen im Bestand vor: `/dp/B0CQ4VL364` und
 * `/gp/video/detail/B0DDJ1CH7R`. Suchadressen (`/s?k=…`) tragen keine und
 * fallen damit heraus — dort gibt es nichts zu öffnen.
 */
function kennung(url) {
  /*
    **Zehn Zeichen sind die ASIN — Prime Video führt daneben GTIs mit 26.**

    Dieselbe Annahme steckte in sieben Mustern der Erweiterung und hier noch
    einmal. Sie schnitt die Kennung ab, und weil beide Seiten gleich falsch
    kürzten, fiel es nicht auf. Erst als die Erweiterung am 25.08.2026 die
    volle Kennung las, fand sie den gekürzten Schlüssel dieser Liste nicht
    mehr: „Babylon" stand darin und galt trotzdem als „nicht auf der
    Prüfliste".

    Zwei gleich falsche Seiten sehen aus wie eine richtige — der Fehler wird
    erst sichtbar, wenn eine davon in Ordnung kommt.
  */
  return /\/(?:dp|detail)\/([A-Z0-9]{10,32})/.exec(url)?.[1]
}

/** Alle unsere Einträge je Amazon-Kennung — auch die schon beantworteten. */
const jeAsin = new Map()
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'primevideo') continue
    const asin = kennung(s.url)
    if (!asin) continue
    jeAsin.set(asin, [...(jeAsin.get(asin) ?? []), { t, dub: s.dub, url: s.url }])
  }
}

/**
 * Adressen, die trotz vorhandenem Urteil noch einmal drankommen.
 *
 * Der Regelfall ist, dass eine beantwortete Adresse aus der Liste fällt. Manche
 * Antworten verdienen aber einen zweiten Blick — und ohne diesen Weg gäbe es
 * keinen, sie erneut vorzulegen.
 *
 * Je Eintrag der Grund, damit in drei Monaten niemand rätselt, warum eine
 * geprüfte Adresse wieder dasteht.
 */
const ERNEUT = {
  /*
    Golden Kamuy Final Season auf Prime (Amazon zaehlt sie als Staffel 5), gemeldet am 25.08.2026 über den
    Crunchyroll-Kanal: Folgen 1–2 ohne deutschen Ton, 3 mit, 4–6 ohne, 7–13 mit.
    Neun von dreizehn.

    Daniel sieht bei Crunchyroll selbst **alle** Folgen auf Deutsch, nur die drei
    OADs nicht — und auf Prime läuft die Serie über genau dieses Kanal-Abo. Zwei
    Wege zu derselben Fassung dürfen nicht verschieden antworten.

    Die Meldung trug außerdem die falsche Staffel: zugeordnet zu AniList 99699
    (Staffel 1, 12 Folgen), obwohl 13 Folgen geprüft wurden.
  */
  /*
    **Golden Kamuy steht hier nicht mehr — Amazon kann die Frage nicht beantworten.**

    Der Auftrag lautete „9 von 13 deutsch, obwohl Crunchyroll alle führt — derselbe
    Kanal". Daniel hat ihn am 01.09.2026 zweimal gemeldet, und beide Male hat der
    Lauf die Meldung verworfen: „13 Kanal-Meldung(en) ohne Urteil ausgelassen".

    Zu Recht. Die Serie läuft auf Prime **über den Crunchyroll-Kanal**, und dort
    nennt Amazon die Sprachen des Kanals, nicht die der Folge (CLAUDE.md,
    24.08.2026, gemessen an „Kill Blue": Amazon sagt 12, zwei unabhängige Quellen
    sagen 4). Eine Wiedervorlage, die zu einer Quelle schickt, die bauartbedingt
    nicht antworten kann, ist eine Sackgasse — sie kostet Daniels Zeit und bleibt
    danach unverändert stehen.

    **Der Widerspruch löst sich woanders:** Crunchyroll ist für Crunchyroll-Inhalte
    die bessere Quelle, und der Beleg von dort führt alle Folgen. Die
    Prime-Angabe „9 von 13" stammt aus einer Kanal-Meldung, die nie hätte zählen
    dürfen.

    Was hier stehen darf, sind Aufträge an eine Quelle, die antworten **kann**:
    ein Kauftitel, eine zweite Ausgabe, eine eigene Prime-Produktion.
  */
  /*
    **Die zweite Prime-Ausgabe desselben Titels.**

    Prime führt „My First Girlfriend Is a Gal" zweimal: über den
    Crunchyroll-Kanal (FSK 18, 10 Folgen) und als Kauftitel (FSK 16, 11 Folgen
    mit OVA, KAZÉ) — andere Folgentitel, zwei Verlage, geprüft am 30.08.2026
    mit Bildern. Gemeldet ist bisher nur der Kanal-Weg, und bei einem
    Kanal-Titel nennt Amazon die Sprachen des **Kanals**, nicht der Folge; der
    Kauftitel ist die belastbarere Quelle.

    Unser Bestand kennt für den Titel nur einen Prime-Verweis, deshalb fiel der
    Auftrag nach der ersten Meldung aus der Liste (Daniel: „ich sehe keinen
    prüfliste eintrag für die kaufbare option?"). Die Adresse hat er von Hand
    nachgeliefert.

    Bis die Erweiterung eine zweite Ausgabe selbst meldet (status.md), steht sie
    hier — mit Kennung, nicht mit einer Suche: Sie ist bekannt.
  */
  B0GPD4GNLL: {
    titel: 'My First Girlfriend Is a Gal — Kauftitel (FSK 16, mit OVA)',
    grund: 'zweite Prime-Ausgabe; gemeldet ist bisher nur der Crunchyroll-Kanal',
    /*
      **Ohne Kennung findet die Meldung keinen Anker.**

      Unser Bestand führt für diesen Titel die Adresse `B0GV5SHH5P` (den
      Kanal-Weg); der Kauftitel steht nirgends. `fetch-pruefungen.ts` ordnet
      über die Adresse zu und meldete deshalb „im Datensatz nicht gefunden" —
      die Meldung vom 01.09.2026 blieb liegen, obwohl sie angekommen war.

      Die Kennung steht hier, damit der Lauf sie als Anker nehmen kann. Sobald
      die Erweiterung eine zweite Ausgabe selbst meldet (status.md), entfällt
      dieser Eintrag.
    */
    anilistId: 97863,
  },
}

const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
let schonGeprueft = 0
const offen = {}
for (const [asin, eintraege] of jeAsin) {
  /*
    **Ein Verdachtsfall ist beantwortet und trotzdem offen.**

    Widerspricht eine zweite Quelle unserem Urteil, ist die Frage wieder da —
    und sie gehört auf die Titelseite, wo ein Klick sie beantwortet. Beide
    Riegel darunter werden dafür übersprungen (Daniel, 31.08.2026).
  */
  const verdacht = eintraege.map((e) => verdaechtig.get(e.t?.id ?? e.id)).find(Boolean)
  // Ist unter dieser Adresse schon alles beantwortet, gibt es nichts zu tun.
  if (!verdacht && eintraege.every((e) => e.dub !== undefined)) continue
  /* Geprüft ist geprüft — auch wenn kein Urteil daraus wurde (Kanal-Titel). */
  if (!verdacht && eintraege.every((e) => geprueftePrime.ids.has(e.t?.id ?? e.id))) {
    schonGeprueft++
    continue
  }
  const sortiert = eintraege
    .slice()
    .sort((a, b) => (a.t.jpYear ?? 0) - (b.t.jpYear ?? 0) || (JAHRESZEIT[a.t.jpSeason] ?? 0) - (JAHRESZEIT[b.t.jpSeason] ?? 0))
  offen[asin] = {
    ...(verdacht ? { wiedervorlage: verdachtHinweis(verdacht) } : {}),
    titel: sortiert[0].t.titleRomaji ?? sortiert[0].t.titleEn ?? '?',
    url: sortiert[0].url,
    eintraege: sortiert.map((e) => ({
      id: e.t.id,
      name: e.t.titleRomaji ?? e.t.titleEn ?? '?',
      folgen: e.t.episodes ?? null,
      offen: e.dub === undefined,
    })),
  }
}

/**
 * Die Suchadressen — die andere Hälfte der offenen Prime-Verweise.
 *
 * 118 unserer Prime-Verweise sind keine Titelseiten, sondern Suchen
 * (`/s?k=Cowboy%20Bebop&i=instant-video`). Weder AniList noch aniSearch liefern
 * für diese Titel eine belastbare Produktseite, und weder MOTN noch TMDB führen
 * eine (beides am 27.08.2026 gemessen, beides null Treffer).
 *
 * Die Erweiterung kann dort nichts lesen — eine Suchseite hat keine Tonspuren.
 * Was sie kann: den Weg zeigen. Auf einer gelisteten Suchseite erscheint ein
 * Hinweis, und der Klick auf den richtigen Treffer hinterlegt, welcher Titel
 * gemeint war. Auf der Titelseite läuft dann die gewohnte Prüfung.
 *
 * Der Rest ist schon gebaut: `dub-confirmed.yaml` kennt ein Feld `url` für „die
 * richtige Adresse, falls die im Datensatz danebenliegt", und
 * `fetch-pruefungen.ts` ordnet eine unbekannte Adresse über den Namen zu.
 */
/**
 * **In die Prüfliste kommen Hauptserien, Filme und Specials — keine Staffeln.**
 *
 * Daniel am 28.08.2026: „mach das die prüfliste generell nur hauptserien, filme
 * und specials prüft, weil sowas wie bungo stray dogs 2, staffel 2 ist …
 * zuordnung kannst du getrennt von prüfliste machen, ist viel einfacher und
 * unkomplizierter."
 *
 * Der Anlass war ein Auftrag „Bungo Stray Dogs 2". Die Suche führt zur
 * **Serienseite**, und die zeigt Staffel 1 — Staffel 2 ließ sich von dort nicht
 * melden, und beim Wechsel stand am Knopf weiter „Staffel 1 melden", obwohl die
 * längst gemeldet war.
 *
 * Das ist kein Fehler der Erweiterung, sondern ein Auftrag, der eine
 * Unterscheidung verlangt, die auf dieser Seite nicht zu treffen ist: Prime
 * führt alle Staffeln unter einer Seite, unser Bestand jede als eigenen Titel.
 * Genau die Trennung, die `docs/prime-erfassung-neu.md` beschreibt — sammeln
 * und zuordnen sind zwei Arbeiten, und nur die erste passiert im Browser.
 *
 * **Ein Auftrag je Werk genügt deshalb.** Wer die Serienseite prüft, sieht dort
 * ohnehin alle Staffeln; welche Folge zu welcher gehört, entscheidet der Bau
 * über TMDBs Folgentitel (`pipeline/fetch-rohfolgen.ts`).
 *
 * **Aussortiert wird nur, was auch wirklich woanders erreichbar ist.** Eine
 * Fortsetzung fliegt heraus, wenn ihr Stammtitel selbst im Bestand steht —
 * sonst bliebe sie über keinen Weg mehr prüfbar, und ein Vorfilter, der
 * verschwinden lässt statt zu verschieben, ist genau der Fehler, vor dem
 * CLAUDE.md warnt.
 */
/*
  **Entschieden wird über `franchiseId`, nicht über den Namen.**

  Der erste Anlauf las die Staffelnummer aus dem Titel. Das trägt nicht weit:
  „Bungou Stray Dogs 2nd Season" nennt sie, „Digimon Adventure 02" auch — nur
  ist das zweite eine eigene Serie und das erste eine Fortsetzung. Der Datensatz
  weiß es besser: Alle Teile eines Werks teilen sich eine `franchiseId`.

  Innerhalb eines Franchise bekommt **eine** TV-Serie den Auftrag, und zwar die
  früheste — sie ist es, auf deren Serienseite Prime alle Staffeln führt. Filme,
  Specials, OVAs und ONAs bleiben ausgenommen: Sie haben bei Prime eigene Seiten
  und eigene Tonspuren.
*/
/*
  Namen, die sich selbst als Fortsetzung ausweisen. Bewusst eng: eine nackte Zahl
  am Ende zählt nur von 2 bis 9 („Bungo Stray Dogs 3"), denn „Digimon Adventure
  02" und „Mob Psycho 100" tragen ebenfalls Ziffern.
*/
/*
  **Und römisch gezählt wird genauso oft.** „Mob Psycho 100 II" und „III" stehen
  bei Prime unter einer Seite mit drei Staffeln, gemeldet waren sie längst — in
  der Prüfliste standen sie trotzdem, weil das Muster nur arabische Ziffern
  kannte (Daniel, 30.08.2026: „sie hätten entsprechend nicht in der prüfliste
  auftauchen dürfen … suche nicht nach titel, sondern nach logischer referenz").

  **Nur II, III und IV.** Von V an wird es unsicher, und `X` ist meistens gar
  keine Zahl: „Sonic X", „Triage X", „Mysterious Girlfriend X", „Tales of
  Zestiria the X" — vier von 39 Titeln mit römischer Endung im Bestand, alle
  eigenständig. Der zweite Riegel fängt den Rest: Es zählt nur, was sich eine
  `franchiseId` mit einer **anderen** Hauptserie teilt, und „Babel II" ist seine
  eigene.
*/
const STAFFEL_IM_TITEL =
  /\s(?:staffel|season|part|teil|cour)\s*([2-9]|\d{2})\b|\s([2-9])$|\s(?:2nd|3rd|4th|5th|second|third|fourth|fifth)\s+season\b|\s(?:II|III|IV)$/i

const NEBENFORM = new Set(['MOVIE', 'SPECIAL', 'OVA', 'ONA', 'MUSIC'])

/* Je Franchise die TV-Serie, die den Auftrag bekommt. */
const hauptSerieJeFranchise = new Map()
for (const t of titel) {
  const f = t.franchiseId
  if (!f) continue
  if (NEBENFORM.has(String(t.format ?? '').toUpperCase())) continue
  const bisher = hauptSerieJeFranchise.get(f)
  if (!bisher) {
    hauptSerieJeFranchise.set(f, t)
    continue
  }
  /*
    Die frühere gewinnt. Ohne Jahr entscheidet die kleinere Kennung — AniList
    vergibt sie aufsteigend, die erste Staffel ist also die kleinere Zahl.
  */
  const a = Number.isFinite(t.jpYear) ? t.jpYear : Infinity
  const b = Number.isFinite(bisher.jpYear) ? bisher.jpYear : Infinity
  if (a < b || (a === b && t.id < bisher.id)) hauptSerieJeFranchise.set(f, t)
}

/**
 * Ist das eine Fortsetzung, die über die Serienseite ihrer ersten Staffel
 * mitgeprüft wird?
 *
 * Ohne Franchise-Kennung oder als Nebenform: nein — dann bleibt der Auftrag, denn
 * ein Vorfilter darf verschieben, nicht verschwinden lassen.
 */
function istNachrangigeStaffel(t) {
  if (!t?.franchiseId) return false
  if (NEBENFORM.has(String(t.format ?? '').toUpperCase())) return false
  const haupt = hauptSerieJeFranchise.get(t.franchiseId)
  if (!haupt || haupt.id === t.id) return false
  /*
    **Ein Franchise allein genügt nicht — es muss sich auch als Staffel ausgeben.**

    Die erste Fassung filterte jede TV-Serie eines Franchise außer der frühesten.
    Damit fiel „Digimon Frontier" heraus, und das ist keine zweite Staffel,
    sondern eine eigenständige Reihe mit eigener Prime-Seite; über die der
    ersten wäre sie nie erreichbar gewesen.

    Beide Signale zusammen sind eindeutig: dasselbe Werk laut Datensatz **und**
    ein Name, der sich selbst als Fortsetzung ausweist („Bungou Stray Dogs 2nd
    Season", „Bungo Stray Dogs 3"). Ein Anthologie-Franchise trägt das nicht.
  */
  /*
    **Und der Name muss die Hauptserie fortsetzen, nicht nur bei ihr anfangen.**

    „Sword Art Online Alternative: Gun Gale Online II" teilt sich die
    `franchiseId` mit „Sword Art Online" und endet auf eine römische Zwei — nach
    beiden Signalen eine Fortsetzung, in Wahrheit ein Spin-off mit eigener
    Prime-Seite. Dasselbe bei „Pretty Guardian Sailor Moon Crystal Season III"
    unter „Sailor Moon". Beide haben keinen eigenen Verweis; sie wären als Suche
    verlorengegangen, und der Vorfilter darf verschieben, nicht verschwinden
    lassen.

    Der Prüfgriff: Vom Namen der Fortsetzung den der Hauptserie abziehen. Bleibt
    mehr übrig als die Staffelangabe, ist es ein eigenes Werk — „Mob Psycho 100
    II" lässt „II" übrig, das Spin-off oben „Alternative: Gun Gale Online II".
  */
  const hauptNamen = [haupt.titleDe, haupt.titleEn, haupt.titleRomaji].filter(Boolean).map((n) => n.toLowerCase())
  const setztFort = (n) => {
    const klein = n.toLowerCase()
    const passend = hauptNamen.find((h) => klein.startsWith(h))
    if (!passend) return false
    const rest = klein.slice(passend.length).trim().replace(/^[-:–—]\s*/, '')
    return /^(?:staffel|season|part|teil|cour)?\s*(?:[2-9]|\d{2}|ii|iii|iv|2nd|3rd|4th|5th|second|third|fourth|fifth)(?:\s+season)?$/i.test(
      rest,
    )
  }
  return [t.titleDe, t.titleEn, t.titleRomaji]
    .filter(Boolean)
    .some((n) => STAFFEL_IM_TITEL.test(n) && setztFort(n))
}

let wegenStaffel = 0

/*
  **Die aniSearch-Kennung gehört in die Prüfliste.**

  Daniel am 28.08.2026: „nimm für prüfliste titel anisearch statt anilist.co."
  aniSearch führt deutsche Titel, deutsche Beschreibungen und die deutschen
  Anbieter — für die Frage „ist das derselbe Titel, den Prime hier zeigt" ist das
  die brauchbarere Seite als AniList, das englisch und japanisch denkt.

  Die Zuordnung liegt seit jeher in `data/anisearch.json` (Schlüssel: unsere
  AniList-Kennung, Feld `anisearchId`), sie wurde nur nie weitergereicht.
*/
const anisearch = (() => {
  try {
    return JSON.parse(readFileSync(resolve(wurzel, 'data/anisearch.json'), 'utf8'))
  } catch {
    return {}
  }
})()

/**
 * **Ein Titel, der seinen Teil verschweigt, ist in der Liste wertlos.**
 *
 * Daniel am 28.08.2026: „ich hab girls und panzer: das finale part 1-3 bereits
 * gemeldet, wofür ist dieser eintrag? … im suchtreffer gibt es noch part 4,
 * dafür sehe ich keinen prüfliste eintrag."
 *
 * Es **war** Teil 4. Sein deutscher Titel lautet „Girls und Panzer: Das Finale"
 * — ohne Nummer, obwohl der englische „Part 4" nennt und die Geschwister sauber
 * „Teil 1", „Teil 2", „Teil 3" heißen. In der Liste stand Teil 4 damit unter dem
 * Namen der Reihe, und Daniel suchte einen Eintrag, den er längst vor sich hatte.
 *
 * Trägt eine der anderen Schreibweisen eine Teilnummer, die im gewählten Titel
 * fehlt, wird sie angehängt. Der **Suchbegriff** bleibt unberührt — er geht an
 * Prime, und dort findet „Das Finale" mehr als „Das Finale Part 4".
 */
const TEILNUMMER = /\b(?:part|teil|movie|film)\s*([1-9])\b/i

function mitTeilnummer(name, t) {
  if (!name || TEILNUMMER.test(name)) return name
  for (const andere of [t?.titleEn, t?.titleRomaji, t?.titleDe]) {
    const treffer = andere ? TEILNUMMER.exec(andere) : null
    if (treffer) return name + ' — Teil ' + treffer[1]
  }
  return name
}

/**
 * **Gesucht wird mit dem deutschen Titel, ohne Gattungswörter.**
 *
 * Daniel am 31.08.2026: „alle titel sollen im search mit ihrem deutschen titel
 * gesucht werden … und die generics sollen aus der search rausgenommen werden,
 * also in diesem fall movie und :"
 *
 * Gemessen: Von 51 Prime-Suchadressen im Bestand tragen **26 den englischen**
 * Titel. Der findet oft nichts — „Sailor Moon S Movie: Hearts in Ice" gibt bei
 * Prime null Anime-Treffer, obwohl der Film dort als „Sailor Moon S:
 * Schneeprinzessin Kaguya" liegt.
 *
 * **Die Adresse bleibt, wie sie ist.** Sie ist der Schlüssel, unter dem
 * Meldungen zugeordnet werden; wer sie ändert, verliert den Bezug zu allem, was
 * schon gemeldet wurde. Der Suchbegriff steht deshalb als eigenes Feld daneben,
 * und die Erweiterung baut daraus die Adresse, die sie **öffnet**.
 *
 * Dieselben Gattungswörter wie beim Titelabgleich in `amazon.js` — sie stehen
 * dort als `GATTUNG`. Zwei Listen liefen auseinander, also steht die
 * maßgebliche hier und wird mitgeliefert.
 */
const GATTUNG = new Set([
  'film', 'movie', 'serie', 'series', 'anime', 'animation', 'staffel', 'season',
  'komplett', 'komplette', 'complete', 'gesamtausgabe', 'edition', 'episoden', 'folgen',
  'the', 'der', 'die', 'das', 'des', 'dem', 'den', 'und', 'and',
])

/** „Sailor Moon S Movie: Hearts in Ice" → „Sailor Moon S Hearts in Ice" */
function suchbegriffAus(name) {
  const worte = (name ?? '')
    .split(/[^\p{L}\p{N}]+/u)
    .filter((w) => w && !GATTUNG.has(w.toLowerCase()))
  return worte.join(' ') || (name ?? '')
}

const suche = {}
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'primevideo' || !/\/s\?/.test(s.url ?? '')) continue
    if (s.dub !== undefined) continue
    if (!verdaechtig.has(t.id) && (geprueftePrime.ids.has(t.id) || geprueftePrime.adressen.has(s.url))) {
      schonGeprueft++
      continue
    }
    if (istNachrangigeStaffel(t)) {
      wegenStaffel++
      continue
    }
    const angezeigt = mitTeilnummer(t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id), t)
    const verdacht = verdaechtig.get(t.id)
    suche[s.url] = {
      titel: angezeigt,
      ...(verdacht ? { wiedervorlage: verdachtHinweis(verdacht) } : {}),
      /*
        Der Begriff, mit dem wirklich gesucht wird — deutscher Titel zuerst,
        Englisch nur als Rückfall, Gattungswörter raus.
      */
      suchbegriff: suchbegriffAus(t.titleDe ?? angezeigt),
      /* Die englische Schreibweise als zweiter Versuch, falls Prime sie führt. */
      suchbegriffEn: t.titleEn && t.titleEn !== t.titleDe ? suchbegriffAus(t.titleEn) : null,
      id: t.id,
      folgen: t.episodes ?? null,
      /*
        **Das Jahr trennt Gleichnamige.** „Elysium" steht bei uns als
        koreanischer Mecha-Film von 2003; die Prime-Suche führt auf den
        Hollywood-Film mit Matt Damon von 2013, und die Erweiterung bot an, den
        zu melden (Daniel, 28.08.2026). Titel und Typ stimmen dort überein — nur
        das Jahr nicht.
      */
      jahr: Number.isFinite(t.jpYear) ? t.jpYear : null,
      asId: anisearch[String(t.id)]?.anisearchId ?? null,
    }
  }
}
/*
  **Titel ohne jeden Verweis, für die TMDB Prime nennt.**

  1.331 Titel im Bestand haben keinen Verweis, 884 davon belegte deutsche
  Sprechrollen aus ANN — es gibt sie auf Deutsch, wir wissen nur nicht wo. Für
  einen Teil nennt TMDB einen deutschen Anbieter; daraus wird kein Verweis
  (TMDB sagt nicht, in welcher Sprache), aber eine Suchadresse.

  Die Vorschläge stehen in `data/anbieter-vorschlaege.json` und werden von
  `build.ts` nie gelesen. Was Daniel hier meldet, wird zum Beleg.
*/
let ausVorschlaegen = 0
try {
  const vorschlaege = JSON.parse(
    readFileSync(resolve(wurzel, 'data/anbieter-vorschlaege.json'), 'utf8'),
  )
  for (const v of vorschlaege) {
    if (!v.anbieter?.includes('primevideo')) continue
    const url =
      'https://www.amazon.de/s?k=' + encodeURIComponent(v.titel) + '&i=instant-video'
    if (suche[url]) continue
    /*
      **„Geprüft ist geprüft" gilt auch für Vorschläge.**

      Der Filter oben nimmt geprüfte Titel aus der Liste; dieser Zweig kannte
      ihn nicht. Am 31.08.2026 standen deshalb „Danganronpa 3 — Future Arc" und
      „— Hope Arc" weiter auf der Prüfliste, obwohl beide Minuten zuvor als
      Beleg eingetragen worden waren. Daniel hatte sie gemeldet und musste es
      zweimal sagen.
    */
    if (geprueftePrime.ids.has(v.id) || geprueftePrime.adressen.has(url)) continue
    const t = titel.find((x) => x.id === v.id)
    if (t && istNachrangigeStaffel(t)) {
      wegenStaffel++
      continue
    }
    const angezeigtV = mitTeilnummer(v.titel, t)
    suche[url] = {
      titel: angezeigtV,
      /* Deutscher Titel zuerst, Gattungswörter raus — siehe suchbegriffAus(). */
      suchbegriff: suchbegriffAus(t?.titleDe ?? angezeigtV),
      suchbegriffEn: t?.titleEn && t.titleEn !== t?.titleDe ? suchbegriffAus(t.titleEn) : null,
      id: v.id,
      folgen: v.folgen,
      jahr: Number.isFinite(t?.jpYear) ? t.jpYear : null,
      asId: anisearch[String(v.id)]?.anisearchId ?? null,
      vorschlag: true,
      /*
        **Warum dieser Vorschlag wackelig ist — im Klartext bis zum Kasten.**

        `vorschlaege-anbieter.ts` prüft Format und Jahr des TMDB-Treffers gegen
        unseren Eintrag. Passt beides nicht zusammen, gilt der Anbieter dem
        falschen Werk: Unsere OVA 20779 wurde auf die TV-Serie TMDB 61695
        abgebildet, und Daniel suchte bei Prime nach einer OVA, für die dort nie
        etwas stand (29.08.2026, 13 von 185 Vorschlägen).

        Gelöscht wird deshalb keiner — ein Vorfilter verschiebt (CLAUDE.md).
        Aber der Kasten sagt es, bevor jemand sucht.
      */
      ...(v.unsicher ? { unsicher: v.unsicher } : {}),
    }
    ausVorschlaegen++
  }
} catch {
  /* Ohne Vorschlagsdatei bleibt die Liste, wie sie war. */
}
if (ausVorschlaegen) console.log(`  ${ausVorschlaegen} Suchen aus TMDB-Vorschlägen`)

writeFileSync(
  resolve(wurzel, 'extension/offene-amazon-suche.js'),
  'globalThis.AK_PRIME_SUCHE = ' + JSON.stringify(suche) + '\n',
)
/*
  **Dieselbe Liste noch einmal als JSON — für die Erweiterung im Betrieb.**

  Die Fassung darüber steckt im Paket und altert ab dem Moment, in dem es
  gepackt wurde. Am 31.08.2026 sagte die Erweiterung „Prime: alles geprüft",
  während die Statusanzeige 24 offene Suchen zeigte: Dazwischen lag ein
  Tiefendurchlauf mit 25 neuen Aufträgen, und beide hatten recht. Die
  Erweiterung holt diese Datei jetzt beim Start; die gepackte bleibt Rückfall.
*/
writeFileSync(resolve(wurzel, 'public/data/prime-suche.json'), JSON.stringify(suche) + '\n')
console.log(`${Object.keys(suche).length} Prime-Suchadressen ohne Titelseite`)
if (schonGeprueft) {
  console.log(`  ${schonGeprueft} Auftrag/Aufträge ausgelassen — schon geprüft, auch ohne Urteil`)
}
if (wegenStaffel) {
  console.log(`  ${wegenStaffel} Fortsetzung(en) ausgelassen — ihre Serienseite steht als eigener Auftrag`)
}

/**
 * **Die zweite Prime-Ausgabe wird ein eigener Auftrag.**
 *
 * Prime führt denselben Anime regelmäßig zweimal — als Kauftitel und über ein
 * Kanal-Abo, mit verschiedenen Folgenzahlen, Altersfreigaben und sogar
 * verschiedenen Folgentiteln (zwei Verlage). Unser Bestand kennt nur einen
 * Verweis; nach der ersten Meldung fiel der Auftrag aus der Liste, und die
 * andere Ausgabe blieb ungeprüft (Daniel, 30.08.2026).
 *
 * Die Erweiterung schickt die Kennungen der übrigen Treffer derselben Suche
 * seit 4.0.22 als `weitere=` in der Notiz mit. Daraus entsteht hier je Kennung
 * ein Auftrag — es sei denn, sie ist längst geprüft.
 */
const AUS_NOTIZ = /weitere=([A-Z0-9,]+)/
let ausWeiteren = 0
for (const zeile of belege.split(String.fromCharCode(10))) {
  if (!/^  note:/.test(zeile)) continue
  const treffer = AUS_NOTIZ.exec(zeile)
  if (!treffer) continue
  for (const kennung of treffer[1].split(',')) {
    if (!kennung || offen[kennung] || geprueftePrime.adressen.has(`https://www.amazon.de/dp/${kennung}`)) continue
    offen[kennung] = {
      titel: `Zweite Prime-Ausgabe (${kennung})`,
      url: `https://www.amazon.de/dp/${kennung}`,
      erneut: 'zweite Ausgabe derselben Suche — Folgenzahl und Freigabe können abweichen',
      eintraege: [{ id: null, name: `Zweite Prime-Ausgabe (${kennung})`, folgen: null, offen: true }],
    }
    ausWeiteren++
  }
}
if (ausWeiteren) console.log(`  ${ausWeiteren} zweite Ausgabe(n) aus den Meldungen übernommen`)

for (const [asin, wert] of Object.entries(ERNEUT)) {
  if (offen[asin]) continue
  offen[asin] = {
    titel: wert.titel,
    url: `https://www.amazon.de/dp/${asin}`,
    erneut: wert.grund,
    ...(wert.anilistId ? { anilistId: wert.anilistId } : {}),
    eintraege: [{ id: null, name: wert.titel, folgen: null, offen: true }],
  }
}

/*
  **Die Liste trägt ihren Stand mit — sonst ist sie stumm veraltet.**

  Diese Datei ist Teil der Erweiterung, nicht des Servers: Was der Bau hier
  hineinschreibt, sieht Daniel erst nach einem Neuladen in `chrome://extensions`.
  Am 02.09.2026 kam „Karakai Jouzu no Takagi-san 2" um 08:53 in die Liste; um
  11:16 stand er auf dem Bildschirm, die Statusanzeige zählte ihn als offen — und
  der Knopf der Erweiterung sagte „Prime: alles geprüft". Beide hatten recht, nur
  aus verschiedenen Ständen.

  Der Zeitstempel ist der des Datensatzes (`meta.json`), nicht der der Datei:
  Die Erweiterung vergleicht ihn gegen genau diese Datei auf der Live-Seite und
  merkt so selbst, dass sie eine alte Liste führt.
*/
writeFileSync(
  resolve(wurzel, 'extension/offene-amazon.js'),
  'globalThis.AK_OFFENE_AMAZON = ' + JSON.stringify(offen) + '\n',
)
/*
  **Der Stand steht in einer eigenen Datei, nicht in der Prüfliste.**

  Der naheliegende Weg — eine zweite Zeile in `offene-amazon.js` — hat drei
  Leser gebrochen: Die Zusicherung schneidet dort nur das Präfix ab und parst den
  Rest als JSON, und `fetch-pruefungen.ts` wie `report-start.ts` schneiden
  zwischen der ersten und der letzten geschweiften Klammer. Eine Datei mit genau
  einem Wert darin ist der billigere Weg als drei angepasste Leser.
*/
const meta = JSON.parse(readFileSync(resolve(wurzel, 'public/data/meta.json'), 'utf8'))
writeFileSync(
  resolve(wurzel, 'extension/offene-amazon-stand.js'),
  'globalThis.AK_OFFENE_AMAZON_STAND = ' + JSON.stringify(meta.generatedAt ?? null) + '\n',
)
const eintraege = Object.values(offen).reduce((n, o) => n + o.eintraege.filter((e) => e.offen).length, 0)
console.log(`${Object.keys(offen).length} Amazon-Adressen mit ${eintraege} offenen Einträgen`)
