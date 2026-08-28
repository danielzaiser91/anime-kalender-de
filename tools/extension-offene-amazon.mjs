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
 * Aufruf: node tools/extension-offene-amazon.mjs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const wurzel = resolve(dirname(fileURLToPath(import.meta.url)), '..')
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
  B0GKFJXSLT: {
    titel: 'Golden Kamuy: Final Season',
    grund: '9 von 13 deutsch, obwohl Crunchyroll alle führt — derselbe Kanal',
  },
}

const JAHRESZEIT = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const offen = {}
for (const [asin, eintraege] of jeAsin) {
  // Ist unter dieser Adresse schon alles beantwortet, gibt es nichts zu tun.
  if (eintraege.every((e) => e.dub !== undefined)) continue
  const sortiert = eintraege
    .slice()
    .sort((a, b) => (a.t.jpYear ?? 0) - (b.t.jpYear ?? 0) || (JAHRESZEIT[a.t.jpSeason] ?? 0) - (JAHRESZEIT[b.t.jpSeason] ?? 0))
  offen[asin] = {
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
const suche = {}
for (const t of titel) {
  for (const s of t.streams ?? []) {
    if (s.platform !== 'primevideo' || !/\/s\?/.test(s.url ?? '')) continue
    if (s.dub !== undefined) continue
    suche[s.url] = {
      titel: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? String(t.id),
      id: t.id,
      folgen: t.episodes ?? null,
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
    suche[url] = { titel: v.titel, id: v.id, folgen: v.folgen, vorschlag: true }
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
console.log(`${Object.keys(suche).length} Prime-Suchadressen ohne Titelseite`)

for (const [asin, wert] of Object.entries(ERNEUT)) {
  if (offen[asin]) continue
  offen[asin] = {
    titel: wert.titel,
    url: `https://www.amazon.de/dp/${asin}`,
    erneut: wert.grund,
    eintraege: [{ id: null, name: wert.titel, folgen: null, offen: true }],
  }
}

writeFileSync(
  resolve(wurzel, 'extension/offene-amazon.js'),
  'globalThis.AK_OFFENE_AMAZON = ' + JSON.stringify(offen) + '\n',
)
const eintraege = Object.values(offen).reduce((n, o) => n + o.eintraege.filter((e) => e.offen).length, 0)
console.log(`${Object.keys(offen).length} Amazon-Adressen mit ${eintraege} offenen Einträgen`)
