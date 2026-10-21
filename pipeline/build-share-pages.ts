/**
 * Nachbereitung des Vite-Builds: legt je Release eine echte Seite unter
 * `dist/r/<slug>/index.html` an, damit ein geteilter Link eine eigene
 * Vorschau bekommt.
 *
 * Warum überhaupt: Diese App nutzt Hash-Routing. Alles hinter dem `#` schickt
 * ein Browser nie an den Server — WhatsApp, Discord, Telegram, Slack und die
 * Suchmaschinen sehen von `…/#/woche?t=123` also nur `…/anime-kalender-de/`
 * und ziehen für jeden Link dieselbe Vorschau. Eine eigene Vorschau je Titel
 * kann es nur geben, wenn es zu ihr einen eigenen Pfad und eine eigene Datei
 * gibt. Genau die entstehen hier.
 *
 * Die erzeugte Datei ist eine Kopie der gebauten index.html — dieselbe App,
 * dieselben Skripte. Getauscht werden nur die Angaben zwischen den
 * `social:`-Markern, und ein kurzes Skript setzt den Hash, bevor die App
 * startet. Für Besucher ist der Umweg unsichtbar.
 *
 * Läuft automatisch nach `npm run build`.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { SYNOPSIS_GROUPS, anbieterName, type Release, type Title } from '../shared/types.ts'
import { todayIso } from '../shared/time.ts'
import { ROOT, log, readJson } from './lib/util.ts'
import { ARTIKEL_STIL as STIL, SITE, esc, titelName, titelInhalt, titelKopf } from './lib/titel-seite.ts'
import { START_AUSSAGE, startseiteInhalt } from './lib/startseite.ts'
import { belegteTermine, uebersichtTexte } from './lib/termine-uebersicht.ts'
import { schreibeVerzeichnis, verzeichnisAdressen, type Buchstabe } from './lib/titel-verzeichnis.ts'
import { umfeldFuer, type UmfeldRahmen } from './lib/titel-umfeld.ts'
import { titelAenderung } from './lib/sitemap-datum.ts'
import { cartoonMitSynchroBeleg, teilenPfad } from '../shared/teilen.ts'
import { synchroBelegt } from '../shared/titles.ts'
import { OG_FASSUNG } from './lib/og-fassung.ts'
import { standardKennungFuer } from './lib/og-standard.ts'
import { seitenQuelle, type SynopsenFuerSeiten } from './lib/handlung-eigen.ts'
import { ladeAkVon, umleitungen, type AkVon, type KennungsZeile } from './lib/ausgabe-kennung.ts'
import { body, head } from './lib/termin-seite.ts'

const DIST = resolve(ROOT, 'dist')
/** Kennung des Standard-Vorschaubilds zum gebauten Bestand — dieselbe Rechnung wie `build-og.ts`, damit Bild und `?v=` zusammenpassen. */
function ladeStandardKennung(): string {
  const { belegtCount } = readJson<{ belegtCount: number }>('public/data/meta.json', { belegtCount: 0 })
  return standardKennungFuer(belegtCount)
}

function main(): void {
  const template = readFileSync(resolve(DIST, 'index.html'), 'utf8')
  const start = template.indexOf('<!-- social:start')
  const end = template.indexOf('<!-- social:end -->')
  if (start < 0 || end < 0) {
    console.error('build-share-pages: Marker <!-- social:start/end --> fehlen in web/index.html')
    process.exit(1)
  }
  const before = template.slice(0, start)
  const after = template.slice(end + '<!-- social:end -->'.length)

  const standardKennung = ladeStandardKennung()
  const releases = readJson<Release[]>('public/data/releases.json', [])
  const titles = readJson<Title[]>('public/data/titles-core.json', [])
  const titleById = new Map(titles.map((t) => [t.id, t]))
  // Die Synopsen liegen seit dem 10.08.2026 in Gruppen statt in einer Datei.
  // Hier werden alle gebraucht — die Seiten entstehen einmal im Build, nicht im
  // Browser, für ihn zählt die Aufteilung nicht.
  const synopses: SynopsenFuerSeiten = {}
  for (let gruppe = 0; gruppe < SYNOPSIS_GROUPS; gruppe++) {
    Object.assign(synopses, readJson<SynopsenFuerSeiten>(`public/data/synopses/${gruppe}.json`, {}))
  }
  const today = todayIso()
  /* Die Adresse eines Titels ist `/t/<ak>/` — unsere Kennung, ohne Namen (Stufe 1 der eigenen Kennungen). */
  const { akVon, zeilen: kennungsZeilen } = ladeAkVon(resolve(ROOT, 'data/kennungen.json'))
  /* Der Weg zur Seite eines Titels: Anime über ihre Kennung, Cartoons (negative Kennung) über den Slug mit Namen. */
  const adresseVon = (id: number): string => {
    const cartoonSlug = id < 0 ? titleById.get(id)?.slug : undefined
    return cartoonSlug ?? String(akVon(id))
  }

  // Nur der deutsche Text kommt auf die Seite. Ein englischer Absatz auf einer
  // durchweg deutschen Seite hilft weder dem Leser noch der Suche.
  const ROOT_TAG = '<div id="root"></div>'
  if (!before.includes(ROOT_TAG) && !after.includes(ROOT_TAG)) {
    console.error('build-share-pages: <div id="root"></div> nicht gefunden — Vorlage geändert?')
    process.exit(1)
  }

  /* Welche Ausgaben gehören zu demselben Titel? Einmal gruppiert statt je Seite gesucht. */
  const jeTitel = new Map<number, Release[]>()
  for (const r of releases) {
    if (!r.slug) continue
    const liste = jeTitel.get(r.titleId)
    if (liste) liste.push(r)
    else jeTitel.set(r.titleId, [r])
  }

  /**
   * Eine echte Übersicht, die jede Teilen-Seite intern verlinkt.
   *
   * Der Befund vom 17.08.2026 in der Search Console: **171 von 183 Seiten
   * „Gefunden – zurzeit nicht indexiert"**, dazu zwei „Gecrawlt – nicht
   * indexiert". Der Inhalt war nicht das Problem — die Teilen-Seiten tragen
   * Titel, Beschreibung und Terminliste im ausgelieferten HTML. Es fehlte etwas
   * anderes: **jeder interne Link**.
   *
   * Die Startseite ist eine Einzelseitenanwendung; ihre Verweise sind
   * Hash-Adressen und entstehen erst durch JavaScript. Im ausgelieferten HTML
   * stand `<div id="root"></div>` und sonst nichts. Google kannte die 183
   * Adressen also ausschließlich aus der Sitemap, und eine Seite, auf die
   * nirgends verlinkt wird, gilt als unwichtig. Genau das drückt „Gefunden –
   * zurzeit nicht indexiert" aus.
   *
   * Zwei Seiten schließen die Lücke: diese Übersicht verlinkt alle Termine, und
   * die Startseite verlinkt die Übersicht samt der nächsten Termine.
   */
  const volleTitel = new Map(ladeAlleTitel().map((t) => [t.id, t]))
  schreibeUebersicht(releases, titleById, belegteTermine(releases, volleTitel), today, before, after, ROOT_TAG, adresseVon)
  /* Zuerst die Titelseiten samt Verzeichnis: Die Startseite verlinkt dessen Buchstaben. */
  const buchstaben = schreibeAlleTitelSeiten(akVon, kennungsZeilen, { before, after, rootTag: ROOT_TAG, today, synopses, jeTitel, standardKennung })
  schreibeStartseite(releases, titleById, today, template, ROOT_TAG, adresseVon, buchstaben, standardKennung)
}

/** Was jede Titel-Seite gemeinsam hat: die Vorlage um die Marker, der Tag des Baus, Texte und Termine je Titel. */
interface SeitenRahmen {
  before: string
  after: string
  rootTag: string
  today: string
  synopses: SynopsenFuerSeiten
  jeTitel: Map<number, Release[]>
  standardKennung: string
}

/** Der volle Bestand (`titles.json`); `titles-core.json` kennt nicht jeden Titel, den ein Termin nennt. */
function ladeAlleTitel(): Title[] {
  const alleTitel = readJson<Title[] | { titles: Title[] }>('public/data/titles.json', [])
  return Array.isArray(alleTitel) ? alleTitel : alleTitel.titles
}

/** Die Seiten aller Titel — Hauptbestand unter ihrer Kennung, Cartoons unter ihrem Slug — samt Umleitungen und Sitemap. */
function schreibeAlleTitelSeiten(akVon: AkVon, kennungsZeilen: KennungsZeile[], rahmen: SeitenRahmen): Buchstabe[] {
  const titelListe = ladeAlleTitel().filter((t) => t.slug)
  const mitAk = titelListe.map((t) => ({ t, ak: akVon(t.id), adresse: String(akVon(t.id)) }))
  /* Cartoons (negative Kennung) behalten ihre Adresse mit Namen; dieselbe, die der Teilen-Knopf aus `title.slug` bildet. */
  const cartoons = readJson<Title[]>('public/data/cartoons.json', []).filter((t) => t.slug)
  const cartoonSeiten = cartoons.map((t) => ({ t, ak: t.id, adresse: t.slug }))
  /* Cartoon-Seiten nur mit belegter Synchro (`dub: true`) in Sitemap, Verzeichnis und Links; ohne Beleg bleibt die Seite erreichbar, wird aber nicht angeboten. */
  const angeboten = [...mitAk, ...cartoonSeiten.filter(({ t }) => cartoonMitSynchroBeleg(t))]
  const umfeld: UmfeldRahmen = {
    anime: titelListe,
    cartoons,
    adresseVon: new Map(angeboten.map(({ t, adresse }) => [t.id, adresse])),
    imVerzeichnis: new Set(angeboten.map(({ t }) => t.id)),
  }
  schreibeTitelSeiten([...mitAk, ...cartoonSeiten], rahmen, umfeld)

  /* Mails und Kalender-Einträge nennen `/t/<Kennung>/`: Bei Cartoons mit Termin (negative Kennung) führt das zur Seite mit Namen. */
  const cartoonUmleitungen = cartoonSeiten.filter(({ t }) => rahmen.jeTitel.has(t.id)).map(({ t, adresse }): [number, string] => [t.id, adresse])
  schreibeUmleitungen([...umleitungen(kennungsZeilen), ...cartoonUmleitungen])
  log(`${titelListe.length} Titel-Seiten und ${cartoons.length} Cartoon-Seiten, Übersicht und Startseite geschrieben`)
  const buchstaben = schreibeVerzeichnis(DIST, rahmen, angeboten.map(({ t, adresse }) => ({ name: titelName(t), adresse, belegt: synchroBelegt(t) })))
  writeSitemap(angeboten.map(({ t, adresse }) => ({ slug: adresse, lastmod: titelAenderung(t, rahmen.jeTitel.get(t.id) ?? [], rahmen.today) })), verzeichnisAdressen(buchstaben))
  return buchstaben
}

/** Eine Seite je Titel: Hat er Termine, trägt sie den nächsten (sonst den letzten) samt der übrigen; sonst die schlichte Titelseite. */
function schreibeTitelSeiten(mitAk: { t: Title; ak: number; adresse: string }[], r: SeitenRahmen, umfeldRahmen: UmfeldRahmen): void {
  for (const { t, ak, adresse } of mitAk) {
    const dir = resolve(DIST, teilenPfad(adresse))
    mkdirSync(dir, { recursive: true })
    const eigene = r.jeTitel.get(t.id) ?? []
    const haupt = naechsterTermin(eigene, r.today)
    /* Cartoons tragen ihre Beschreibung am Titel, nicht in `synopses/`. */
    const text = r.synopses[String(t.id)]?.de ?? (t.westlich ? t.synopsis : undefined)
    const synopsis = text ? { text, quelle: seitenQuelle(r.synopses[String(t.id)]) } : undefined
    const umfeld = umfeldFuer(t, `${SITE}${teilenPfad(adresse)}`, umfeldRahmen)
    const kopf = haupt ? head(haupt, t, r.today, ak, adresse, umfeld) : titelKopf({ ...t, id: ak, slug: adresse }, umfeld, r.standardKennung)
    const inhalt = haupt
      ? body(haupt, t, synopsis, r.today, eigene.filter((g) => g.slug !== haupt.slug), ak, adresse, umfeld)
      : titelInhalt({ ...t, id: ak, slug: adresse }, synopsis, eigene, umfeld)
    writeFileSync(resolve(dir, 'index.html'), (r.before + kopf + r.after).replace(r.rootTag, `<div id="root">${inhalt}</div>`), 'utf8')
  }
}

/*
  **Eine Teilen-Seite je Titel** (19.09.2026). Der Link-Knopf im Detail-Panel teilte
  `/r/<Titel-Slug>/` — diese Seite gab es für keinen Titel, denn unter `/r/` liegen nur
  Termine.
  Und wer die Adresse aus der Leiste kopierte, bekam die Startseiten-Vorschau, weil ein
  geöffneter Titel keinen eigenen Pfad hatte. Jetzt: `/t/<slug>/` für jeden Titel.
  Vorschaubild ist das Banner von AniList (breit, große Karte), ohne Banner das Cover
  (kleine Karte) — eigene Bilder für 2.774 Titel wären rund 170 MB im Repo.
*/
/**
 * Die alte Adresse einer zusammengeführten Kennung (`/t/<alt>/`, in Mails und Verlinkungen verschickt) leitet auf die neue weiter —
 * ohne Eintrag im Index (`noindex`) und ohne Sitemap.
 */
function schreibeUmleitungen(paare: [number, string | number][]): void {
  for (const [alt, neu] of paare) {
    const ziel = `${SITE}${teilenPfad(neu)}`
    const dir = resolve(DIST, teilenPfad(alt))
    mkdirSync(dir, { recursive: true })
    writeFileSync(
      resolve(dir, 'index.html'),
      `<!doctype html><html lang="de"><head><meta charset="utf-8"><title>Weiterleitung</title><meta name="robots" content="noindex"><link rel="canonical" href="${ziel}"><meta http-equiv="refresh" content="0; url=${ziel}"><script>location.replace(${JSON.stringify(ziel)}+location.hash)</script></head><body><a href="${ziel}">Weiter zum Titel</a></body></html>`,
      'utf8',
    )
  }
}

/** Der nächste Termin eines Titels, sonst der letzte. */
function naechsterTermin(rs: Release[], today: string): Release | undefined {
  const nachDatum = [...rs].sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
  return nachDatum.find((r) => r.schedule.firstEpisodeDate >= today) ?? nachDatum[nachDatum.length - 1]
}

function terminZeile(release: Release, titel: Title | undefined, adresse: string): string {
  const name = esc(release.name || titel?.titleDe || titel?.titleEn || release.slug)
  const datum = release.schedule.firstEpisodeDate.split('-').reverse().join('.')
  const anbieter = esc(anbieterName(release.platform, release.sender))
  return (
    `      <li><a href="${SITE}${teilenPfad(adresse)}" style="color:#7dd3fc;">${name}</a>` +
    ` — ${datum}, ${anbieter}</li>\n`
  )
}

function schreibeUebersicht(
  releases: Release[],
  titleById: Map<number, Title>,
  belegt: number,
  today: string,
  before: string,
  after: string,
  rootTag: string,
  adresseVon: (titleId: number) => string,
): void {
  const sortiert = [...releases].sort((a, b) =>
    b.schedule.firstEpisodeDate.localeCompare(a.schedule.firstEpisodeDate),
  )
  const kommend = sortiert.filter((r) => r.schedule.firstEpisodeDate >= today).reverse()
  const vergangen = sortiert.filter((r) => r.schedule.firstEpisodeDate < today)

  const liste = (rs: Release[]) =>
    rs.map((r) => terminZeile(r, titleById.get(r.titleId), adresseVon(r.titleId))).join('')
  const texte =uebersichtTexte(releases.length, belegt, kommend.length)
  const inhalt =
    `<article style="${STIL}">\n` +
    `      <h1 style="font-size:1.6rem;margin:0 0 .5rem;color:#fff;">${texte.ueberschrift}</h1>\n` +
    `      <p style="margin:0 0 1.5rem;color:#9aa5bd;">${texte.stand}</p>\n` +
    (kommend.length
      ? `      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Kommende Termine</h2>\n` +
        `      <ul style="margin:0 0 2rem;padding-left:1.2rem;">\n${liste(kommend)}      </ul>\n`
      : '') +
    `      <h2 style="font-size:1.1rem;margin:0 0 .5rem;color:#fff;">Bereits erschienen</h2>\n` +
    `      <ul style="margin:0 0 2rem;padding-left:1.2rem;">\n${liste(vergangen)}      </ul>\n` +
    `      <p><a href="${SITE}" style="color:#7dd3fc;">Zum Kalender</a> · <a href="${SITE}titel/" style="color:#7dd3fc;">Alle Titel von A bis Z</a></p>\n` +
    `    </article>`

  /**
   * **Die Übersicht ist eine Liste — dann soll sie das auch sagen.**
   *
   * Gemessen am 10.09.2026 über alle 643 erzeugten Seiten: Genau zwei trugen
   * kein `application/ld+json`, und eine davon war diese. Jede Teilen-Seite
   * beschreibt sich seit dem 07.09.2026 als `Movie` oder `TVSeries`; der
   * Einstieg zu allen 641 beschrieb sich gar nicht.
   *
   * `ItemList` ist der Typ dafür, und die zwanzig nächsten Termine reichen:
   * Die Liste soll die Sache benennen, nicht den ganzen Bestand wiederholen —
   * jeder Eintrag steht ohnehin auf seiner eigenen Seite.
   */
  const naechsteZwanzig = kommend.slice(0, 20)
  const listenDaten = {
    '@context': 'https://schema.org',
    '@type': 'ItemList',
    name: texte.listenName,
    description: texte.stand,
    numberOfItems: releases.length,
    itemListElement: naechsteZwanzig.map((r, i) => ({
      '@type': 'ListItem',
      position: i + 1,
      url: `${SITE}${teilenPfad(adresseVon(r.titleId))}`,
      name: titleById.get(r.titleId)?.titleDe ?? r.name,
    })),
  }
  const kopf =
    `    <title>${texte.seitenTitel}</title>\n` +
    `    <meta name="description" content="${texte.beschreibung}" />\n` +
    `    <link rel="canonical" href="${SITE}termine/" />\n` +
    /*
      Ohne Vorschaubild steht beim Teilen ein leerer Kasten. Das Bild der
      nächsten Veröffentlichung ist die ehrlichste Wahl — es zeigt, was die
      Liste als Erstes bringt. Gibt es keine, bleibt das Feld weg.
    */
    (naechsteZwanzig[0]
      ? `    <meta property="og:image" content="${SITE}og/${naechsteZwanzig[0].slug}.jpg?v=${OG_FASSUNG}" />\n` +
        `    <meta property="og:image:type" content="image/jpeg" />\n` +
        `    <meta property="og:image:width" content="1200" />\n` +
        `    <meta property="og:image:height" content="630" />\n`
      : '') +
    `    <script type="application/ld+json">${JSON.stringify(listenDaten)}</script>\n`

  const dir = resolve(DIST, 'termine')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    resolve(dir, 'index.html'),
    (before + kopf + after).replace(rootTag, `<div id="root">${inhalt}</div>`),
    'utf8',
  )
}

/**
 * Die Startseite bekommt Inhalt, den ein Crawler ohne JavaScript sieht.
 *
 * Vorher lieferte sie `<div id="root"></div>` — kein Text, kein Link, nichts,
 * wovon aus Google weiterlaufen könnte. React ersetzt den Inhalt beim Mounten,
 * für Besucher ändert sich also nichts.
 */
function schreibeStartseite(
  releases: Release[],
  titleById: Map<number, Title>,
  today: string,
  template: string,
  rootTag: string,
  adresseVon: (titleId: number) => string,
  buchstaben: Buchstabe[],
  standardKennung: string,
): void {
  const naechste = [...releases]
    .filter((r) => r.schedule.firstEpisodeDate >= today)
    .sort((a, b) => a.schedule.firstEpisodeDate.localeCompare(b.schedule.firstEpisodeDate))
    .slice(0, 20)

  const termine = naechste.map((r) => terminZeile(r, titleById.get(r.titleId), adresseVon(r.titleId))).join('')
  const inhalt = startseiteInhalt(termine, releases.length, buchstaben)

  /**
   * **Die Startseite sagt, was diese Seite ist.**
   *
   * `WebSite` mit `SearchAction` ist das, worauf Google seine Sitelinks-Suchbox
   * stützt, und `WebPage` mit `inLanguage: de` beantwortet die Frage, für
   * welchen Markt die Seite gilt — bei einem Kalender, der ausdrücklich nur
   * deutsche Fassungen führt, ist das die halbe Auskunft.
   *
   * Die Suchadresse zeigt auf `#/datenbank?q=`, weil dort die Volltextsuche
   * sitzt. Dass eine Suchmaschine hinter dem `#` nichts sieht, ändert daran
   * nichts: Die Angabe sagt einem **Menschen**, wo er landet.
   */
  const startDaten = {
    '@context': 'https://schema.org',
    '@type': 'WebSite',
    url: SITE,
    name: 'Anime-Kalender DE',
    alternateName: 'Deutscher Anime-Kalender',
    inLanguage: 'de-DE',
    description: START_AUSSAGE,
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: `${SITE}#/datenbank?q={search_term_string}` },
      'query-input': 'required name=search_term_string',
    },
  }
  writeFileSync(
    resolve(DIST, 'index.html'),
    template
      .replace(rootTag, `<div id="root">${inhalt}</div>`)
      .replaceAll('og/default.jpg"', `og/default.jpg?v=${standardKennung}"`)
      .replace(
        '</head>',
        `    <script type="application/ld+json">${JSON.stringify(startDaten)}</script>\n  </head>`,
      ),
    'utf8',
  )
}

/**
 * Schreibt `sitemap.xml` und `robots.txt`.
 *
 * Warum das hier steht und nicht als statische Datei im Repo: Eine Sitemap darf
 * nur Adressen enthalten, die es wirklich gibt. Die Teilen-Seiten entstehen
 * genau eine Zeile weiter oben aus dem Datenbestand — was dort nicht gebaut
 * wurde, gehört auch nicht in die Sitemap.
 *
 * Aufgenommen werden ausschließlich die vorgerenderten Seiten. Die Ansichten
 * der App (`#/woche`, `#/datenbank` …) fehlen bewusst: Alles hinter dem `#`
 * bekommt eine Suchmaschine nie zu sehen, sie würde für jede dieser Adressen
 * dieselbe Startseite indexieren.
 */
function writeSitemap(titel: { slug: string; lastmod?: string }[], verzeichnis: string[]): void {
  // Die Übersicht gehört dazu: Sie ist der Einstieg zu allen Teilen-Seiten.
  const today = todayIso()
  const urls = [
    { loc: SITE, priority: '1.0', changefreq: 'daily', lastmod: today },
    // Der Einstieg zu allen Teilen-Seiten — er muss selbst gefunden werden.
    { loc: `${SITE}termine/`, priority: '0.9', changefreq: 'daily', lastmod: today },
    // Das A–Z-Verzeichnis: der Einstieg zu jeder Titelseite.
    ...verzeichnis.map((loc) => ({ loc, priority: '0.8', changefreq: 'weekly', lastmod: undefined as string | undefined })),
    // Titelseiten: lastmod nur, wo die Daten des Titels ein Datum nennen (`titelAenderung`), nie „heute".
    ...titel.map((t) => ({ loc: `${SITE}${teilenPfad(t.slug)}`, priority: '0.6', changefreq: 'weekly', lastmod: t.lastmod })),
  ]

  const xml =
    `<?xml version="1.0" encoding="UTF-8"?>\n` +
    `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n` +
    urls
      .map(
        (u) =>
          `  <url>\n    <loc>${esc(u.loc)}</loc>\n${u.lastmod ? `    <lastmod>${u.lastmod}</lastmod>\n` : ''}` +
          `    <changefreq>${u.changefreq}</changefreq>\n    <priority>${u.priority}</priority>\n  </url>`,
      )
      .join('\n') +
    `\n</urlset>\n`

  writeFileSync(resolve(DIST, 'sitemap.xml'), xml, 'utf8')

  // Kein `Disallow` — die Seite soll gefunden werden. Der Sitemap-Verweis ist
  // der eigentliche Zweck dieser Datei: Ohne ihn muss jede Suchmaschine die
  // Adresse raten oder auf das Einreichen in der Search Console warten.
  writeFileSync(
    resolve(DIST, 'robots.txt'),
    ['User-agent: *', 'Allow: /', '', `Sitemap: ${SITE}sitemap.xml`, ''].join('\n'),
    'utf8',
  )

  log(`sitemap.xml mit ${urls.length} Adressen und robots.txt geschrieben`)
}

main()
