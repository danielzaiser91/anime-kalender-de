/**
 * Zusicherungen zu den Prüfungen der Titel-Quarantäne (18.10.2026), je als eigener Prozess in einem Wegwerf-Ordner (`AK_ROOT`):
 * Die Zeilen-Prüfungen melden genau die verletzten Titel (Marken, `tools/quarantaene.mjs`), und die Prüfungen „Titel nicht im Bestand“
 * kennen die zurückgestellten aus `meta.quarantaene` — mit der Handdatei aus dem Repo und einem Bestand, dem ein Titel in der Mitte fehlt.
 * Dazu der Verlust-Riegel des Baus mit `BAU_QUARANTAENE`. Läuft in `check:logic`; liest `data/`, nie `public/data`.
 */
import { spawnSync } from 'node:child_process'
import { cpSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import yaml from 'js-yaml'
import { liesMarken } from './quarantaene.mjs'

const WURZEL = join(dirname(fileURLToPath(import.meta.url)), '..')
const TSX = createRequire(join(WURZEL, 'package.json')).resolve('tsx/cli')

let fehler = 0
function pruefe(name: string, ok: boolean, ist?: unknown): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name}`, ist === undefined ? '' : JSON.stringify(ist))
}
const gleich = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b)
/** Jede genannte Prüfung meldet sich rot (Zeile mit Präfix), damit keine Bedingung im Schatten einer anderen roten überlebt. */
const alleRot = (aus: string, praefix: string, namen: string[]): boolean => namen.every((n) => aus.includes(`${praefix}${n}`))

type Lauf = { code: number; marken: number[]; aus: string }
/** Dateien: Pfad im Wegwerf-Ordner → JSON-Wert; `kopien`: Dateien und Ordner aus dem Repo; `umgebung` bekommt den Ordner. */
type Aufbau = { dateien?: Record<string, unknown>; kopien?: string[]; umgebung?: (wo: string) => Record<string, string> }

/** Startet `skript` (Pfad im Repo, oder aus dem Wegwerf-Ordner berechnet) mit tsx im Wegwerf-Ordner; Exit-Code, gemeldete Kennungen und Ausgabe. */
function lauf(skript: string | ((wo: string) => string), { dateien = {}, kopien = [], umgebung = () => ({}) }: Aufbau): Lauf {
  const wo = mkdtempSync(join(tmpdir(), 'quarantaene-pruefungen-'))
  try {
    for (const datei of kopien) {
      mkdirSync(dirname(join(wo, datei)), { recursive: true })
      cpSync(join(WURZEL, datei), join(wo, datei), { recursive: true })
    }
    for (const [pfad, inhalt] of Object.entries(dateien)) {
      mkdirSync(dirname(join(wo, pfad)), { recursive: true })
      writeFileSync(join(wo, pfad), typeof inhalt === 'string' ? inhalt : JSON.stringify(inhalt))
    }
    const ziel = typeof skript === 'string' ? join(WURZEL, skript) : skript(wo)
    const env = { ...process.env, AK_ROOT: wo, ...umgebung(wo) }
    const r = spawnSync(process.execPath, [TSX, ziel], { cwd: wo, env, encoding: 'utf8' })
    return { code: r.status ?? -1, marken: liesMarken(r.stdout).map((m) => m.titleId), aus: `${r.stdout}${r.stderr}` }
  } finally {
    rmSync(wo, { recursive: true, force: true })
  }
}

const ok = { url: 'https://www.netflix.com/title/81234567', dubQuelle: 'justwatch', dubStand: '2026-10-01', dubHintOnly: true }
function titel(id: number, rest: object = {}): { id: number } {
  return { id, ...rest }
}

// jw-vertrauen: je Bedingung ein Titel in der Mitte, Titel 4 mit zwei verletzten Wegen meldet einmal, Titel 6 mit dem verletzten Weg
// hinten (zweiter Datum-Fall); Cartoons zählen mit.
{
  const titles = [
    titel(1, { streams: [ok] }),
    titel(2, { streams: [{ ...ok, dub: true }] }),
    titel(3, { streams: [{ ...ok, url: 'https://beispiel.example/x', dubHintOnly: undefined }] }),
    titel(4, { streams: [{ ...ok, dubStand: 'gestern' }, ok, { ...ok, dubStand: '' }] }),
    titel(5, { streams: [ok, { url: 'https://beispiel.example/y' }] }),
    titel(6, { streams: [ok, { ...ok, dubStand: 'x' }] }),
  ]
  const cartoons = [titel(-6, { streams: [ok] }), titel(-7, { streams: [{ ...ok, dubStand: undefined }] }), titel(-8)]
  const rot = lauf('pipeline/check-jw-vertrauen-bestand.ts', { dateien: { 'public/data/titles.json': titles, 'public/data/cartoons.json': cartoons } })
  pruefe('jw-vertrauen: Marken je Bedingung, Titel 4 einmal', gleich(rot.marken, [2, 4, 6, 3, -7]), rot.marken)
  pruefe('jw-vertrauen: rot mit Kennungen im Fehler', rot.code === 1 && rot.aus.includes('Kennzeichnung mit Datum 4, 6'), rot)
  const gruen = lauf('pipeline/check-jw-vertrauen-bestand.ts', { dateien: { 'public/data/titles.json': [titles[0], titles[4]] } })
  pruefe('jw-vertrauen: sauber ohne Marke', gruen.code === 0 && gruen.marken.length === 0, gruen)
}

// schwester-shop: Kennzeichnung an fremdem Weg (2) und ungekennzeichneter freenet-Weg mit Schwester-Beleg (4).
{
  const deutsch = { name: 'maxdome', dubRanges: [{ from: 1, to: 1, dub: true }] }
  const richtig = [deutsch, { name: 'freenet meinVOD', dubAbgeleitet: 'schwester-shop' }]
  const titles = [
    titel(1, { watchLinks: richtig }),
    titel(2, { watchLinks: [{ name: 'Videoload', dubAbgeleitet: 'schwester-shop' }] }),
    titel(3, { watchLinks: richtig }),
    titel(4, { watchLinks: [deutsch, { name: 'freenet meinVOD' }] }),
    titel(5),
  ]
  const rot = lauf('pipeline/check-schwester-shop-bestand.ts', { dateien: { 'public/data/titles.json': titles } })
  pruefe('schwester-shop: Marken 2 und 4', gleich(rot.marken, [2, 4]) && rot.code === 1, rot)
  const namen = ['keine Kennzeichnung ohne Schwester-Beleg', 'jeder freenet-Weg ohne eigene Angabe']
  pruefe('schwester-shop: beide Prüfungen rot', alleRot(rot.aus, 'FEHLER: Bestand: ', namen), rot.aus)
  const gruen = lauf('pipeline/check-schwester-shop-bestand.ts', { dateien: { 'public/data/titles.json': [titles[0], titles[2], titles[4]] } })
  pruefe('schwester-shop: sauber ohne Marke', gruen.code === 0 && gruen.marken.length === 0, gruen)
}

// telekom-annahme: Annahme an fremdem Weg (2), freenet-Kennzeichnung unzulässig (3), Antwort allein aus der Annahme (4).
{
  const annahme = { name: 'Videoload', dubRanges: [{ from: 1, to: 12, dub: true }], dubAbgeleitet: 'telekom-annahme' }
  const titles = [
    titel(1, { hasVoices: true, watchLinks: [annahme] }),
    titel(2, { hasVoices: true, watchLinks: [{ ...annahme, name: 'Netflix' }] }),
    titel(3, { hasVoices: true, watchLinks: [{ name: 'Videoload', dubAbgeleitet: 'schwester-shop' }] }),
    titel(4, { watchLinks: [annahme] }),
    titel(5),
  ]
  const rot = lauf('pipeline/check-telekom-annahme-bestand.ts', { dateien: { 'public/data/titles.json': titles } })
  pruefe('telekom-annahme: Marken 2, 3, 4', gleich(rot.marken, [2, 3, 4]) && rot.code === 1, rot)
  const namen = ['Annahme nur an Telekom-Wegen', 'freenet-Kennzeichnung weiter zulässig', 'kein Titel hängt mit seiner Deutsch-Antwort']
  pruefe('telekom-annahme: alle drei Prüfungen rot', alleRot(rot.aus, 'FEHLER: Bestand: ', namen), rot.aus)
  const gruen = lauf('pipeline/check-telekom-annahme-bestand.ts', { dateien: { 'public/data/titles.json': [titles[0], titles[4]] } })
  pruefe('telekom-annahme: sauber ohne Marke', gruen.code === 0 && gruen.marken.length === 0, gruen)
}

// cartoon-ton-bestand: ohne Beleg (-2, damit auch Anbieter ohne Beleg), fremder Anbieter (-3), doppelt (-4); unter 400 Hinweisen bleibt
// die Prüfung rot, aber ohne Marke.
{
  const hinweis = (...anbieter: string[]) => ({ dubHinweis: { anbieter } })
  const cartoons = [titel(-1, hinweis('Netflix')), titel(-2, hinweis('Netflix')), titel(-3, hinweis('Netflix', 'Disney+')), titel(-4, hinweis('Netflix', 'Netflix')), titel(-5)]
  const flatrate = { angebote: [{ art: 'FLATRATE', anbieter: 'Netflix', audio: ['de'] }] }
  const audio = { '-1': flatrate, '-2': { angebote: [{ art: 'BUY', anbieter: 'Netflix', audio: ['de'] }] }, '-3': flatrate, '-4': flatrate }
  const rot = lauf('pipeline/check-cartoon-ton-bestand.ts', { dateien: { 'public/data/cartoons.json': cartoons, 'data/justwatch-audio.json': audio } })
  pruefe('cartoon-ton-bestand: Marken je Bedingung (-2 zweimal)', gleich(rot.marken, [-2, -2, -3, -4]) && rot.code === 1, rot)
  const namen = ['jeder Ton-Hinweis hat einen Flatrate-Beleg', 'Ton-Hinweis nennt nur Anbieter mit Beleg', 'kein Anbieter doppelt']
  pruefe('cartoon-ton-bestand: alle drei Prüfungen rot', alleRot(rot.aus, 'FEHLER: Bestand: ', namen), rot.aus)
  const ohne = lauf('pipeline/check-cartoon-ton-bestand.ts', { dateien: { 'public/data/cartoons.json': [cartoons[0], cartoons[4]], 'data/justwatch-audio.json': audio } })
  pruefe('cartoon-ton-bestand: sauberer Hinweis ohne Marke', ohne.marken.length === 0 && ohne.aus.includes('mindestens 400'), ohne)
}

// cartoon-news: vier Cartoons mit Termin, der zweite und vierte mit einer Quelle ohne Adresse; nur sie werden gemeldet (ohne Quelle,
// ohne Belege).
{
  const termin = (titleId: number, quelle: string) => ({
    slug: `cartoon${titleId}`,
    titleId,
    name: `Cartoon ${titleId}`,
    platform: 'paramountplus',
    platformUrl: 'https://www.paramountplus.com/de/shows/x/',
    releaseType: 'weekly',
    schedule: { firstEpisodeDate: '2099-03-02', episodeCount: 13 },
    year: 2099,
    sources: [quelle],
  })
  const url = 'https://www.anime2you.de/news/1/x/'
  const releases = [termin(-1, url), termin(-2, 'Pressemitteilung'), termin(-3, url), termin(-4, 'Pressemitteilung')]
  const cartoons = [-1, -2, -3, -4].map((id) => titel(id, { slug: `c${id}`, titleDe: `Cartoon ${id}`, format: 'TV', streams: [] }))
  const dateien = { 'public/data/releases.json': releases, 'public/data/cartoons.json': cartoons, 'data/offizielle-meldungen.yaml': 'eintraege: []' }
  const rot = lauf('pipeline/check-cartoon-news.ts', { dateien, kopien: ['data/kino-ankuendigungen.yaml', 'data/ankuendigungen.yaml'] })
  pruefe('cartoon-news: Marke am Cartoon ohne Quellen-Adresse', rot.code === 1 && gleich(rot.marken, [-2, -4, -2, -4]), { marken: rot.marken, aus: rot.aus.slice(-1500) })
  const namen = ['jede Cartoon-Meldung hat eine Quelle (Link)', 'jede Cartoon-Meldung hat Belege mit Adresse']
  pruefe('cartoon-news: beide Prüfungen rot', alleRot(rot.aus, '✗ ', namen), rot.aus.slice(-1500))
  const gruen = lauf('pipeline/check-cartoon-news.ts', { dateien: { ...dateien, 'public/data/releases.json': [releases[0], releases[2]] }, kopien: ['data/kino-ankuendigungen.yaml', 'data/ankuendigungen.yaml'] })
  pruefe('cartoon-news: sauber ohne Marke', gruen.code === 0 && gruen.marken.length === 0, gruen.aus.slice(-1500))
}

// cr-ja-deckung (26.10.2026, PERSONA5 Stars and Ours): drei Titel auf Adressen, die zweite mit Null-Block; Ja ohne Deckung nur an Titel 6
// (Titel 5 hat Termin, Titel 7 steht auf der Serie ohne Null-Block). Die Marke trägt die Kennung, nicht den Namen.
{
  const adresse = (n: number) => `https://www.crunchyroll.com/de/series/GTEST000${n}/x`
  const weg = (n: number) => ({ platform: 'crunchyroll', url: adresse(n), dub: true })
  const serie = (n: number, staffeln: object[]) => ({ url: adresse(n), seriesId: `GTEST000${n}`, katalog: 'de', deutschImAngebot: true, staffeln })
  const mitNull = [{ deutsch: 0, folgen: 12 }]
  const crDub = { scrapedAt: '', serien: [serie(1, [{ deutsch: 12, folgen: 12 }]), serie(2, mitNull), serie(3, mitNull)] }
  const titles = [titel(5, { streams: [weg(2)] }), titel(6, { streams: [weg(3)] }), titel(7, { streams: [weg(1)] })]
  const termin = { slug: 'a', titleId: 5, name: 'A', platform: 'crunchyroll', releaseType: 'weekly', sources: [], schedule: { firstEpisodeDate: '2099-01-05', episodeCount: 12 } }
  const dateien = { 'public/data/titles.json': titles, 'public/data/releases.json': [termin], 'data/crunchyroll-dub.json': crDub }
  const rot = lauf('pipeline/check-cr-ja-deckung-bestand.ts', { dateien, kopien: ['data/dub-confirmed.yaml', 'data/curated', 'data/kino-ankuendigungen.yaml', 'data/ankuendigungen.yaml'] })
  pruefe('cr-ja-deckung: Marke nur am Titel ohne Deckung', rot.code === 1 && gleich(rot.marken, [6]), { code: rot.code, marken: rot.marken, aus: rot.aus.slice(-800) })
  const gruen = lauf('pipeline/check-cr-ja-deckung-bestand.ts', { dateien: { ...dateien, 'public/data/titles.json': [titles[0], titles[2]] }, kopien: ['data/dub-confirmed.yaml', 'data/curated', 'data/kino-ankuendigungen.yaml', 'data/ankuendigungen.yaml'] })
  pruefe('cr-ja-deckung: gedeckt ohne Marke', gruen.code === 0 && gruen.marken.length === 0, gruen.aus.slice(-800))
}

// tmdb-hauptserie (26.10.2026): Folgenliste einer anderen Kennung (2, 4) und Hintergrundbild ohne Kennung (3; 8 trägt Staffel 0, 4 ist zurückgestellt).
// Zurückgestellte Titel gelten nicht mehr als Verstoß — sonst bliebe die Prüfung nach der Quarantäne rot, weil sie die rohe Sammler-Datei liest.
{
  const quarantaeneMeta = (ids: number[]) => ({ quarantaene: ids.map((titleId) => ({ titleId, pruefung: 'p', grund: 'g', releases: [] })) })
  const dateien = {
    'data/tmdb-titles.json': { '1': { tmdbId: 11 }, '2': { tmdbId: 12 }, '4': { tmdbId: 14 }, '8': {} },
    'data/tmdb-folgen.json': { '1': { tmdbId: 11 }, '2': { tmdbId: 99 }, '4': { tmdbId: 98 } },
    'data/tmdb-banner.json': { '1': {}, '3': {}, '8': {} },
    'data/tmdb-staffel0.json': { '8': {} },
  }
  const rot = lauf('pipeline/check-tmdb-hauptserie-bestand.ts', { dateien })
  pruefe('tmdb-hauptserie: Marken an Folgenliste (2, 4) und Hintergrundbild (3)', rot.code === 1 && gleich([...rot.marken].sort(), [2, 3, 4]), { code: rot.code, marken: rot.marken })
  const zurueck = lauf('pipeline/check-tmdb-hauptserie-bestand.ts', { dateien: { ...dateien, 'public/data/meta.json': quarantaeneMeta([2, 4]) } })
  pruefe('tmdb-hauptserie: zurückgestellte Titel zählen nicht, der übrige bleibt rot', zurueck.code === 1 && gleich(zurueck.marken, [3]), { code: zurueck.code, marken: zurueck.marken })
  const alle = lauf('pipeline/check-tmdb-hauptserie-bestand.ts', { dateien: { ...dateien, 'public/data/meta.json': quarantaeneMeta([2, 3, 4]) } })
  pruefe('tmdb-hauptserie: alle Verstöße zurückgestellt: grün ohne Marke', alle.code === 0 && alle.marken.length === 0, { code: alle.code, marken: alle.marken })
}

const lies = <T>(datei: string): T => yaml.load(readFileSync(join(WURZEL, datei), 'utf8')) as T
const mitte = <T>(liste: T[]): T => liste[Math.floor(liste.length / 2)]!
const quarantaene = (titleId: number, releases: string[] = []) => ({ quarantaene: [{ titleId, pruefung: 'p', grund: 'g', releases }] })

/**
 * Ein Leser mit echter Handdatei: dem Bestand fehlt der Titel `fehlt` (aus der Mitte). Ohne `meta.quarantaene` rot, mit einer fremden
 * Kennung weiter rot, mit dem fehlenden Titel grün.
 */
function leser(name: string, skript: string, aufbau: (meta: unknown) => Aufbau, fehlt: number, release?: string): void {
  const ohne = lauf(skript, aufbau(undefined))
  pruefe(`${name}: fehlender Titel ohne Quarantäne rot`, ohne.code === 1, ohne.aus.slice(-600))
  const fremd = lauf(skript, aufbau(quarantaene(fehlt + 1, release ? [`${release}-x`] : [])))
  pruefe(`${name}: Quarantäne eines anderen Titels hilft nicht`, fremd.code === 1, fremd.aus.slice(-600))
  const mit = lauf(skript, aufbau(quarantaene(fehlt, release ? [release] : [])))
  pruefe(`${name}: zurückgestellter Titel fehlt zu Recht`, mit.code === 0, mit.aus.slice(-600))
}
const metaDatei = (meta: unknown): Record<string, unknown> => (meta ? { 'public/data/meta.json': meta } : {})

{
  const ids = lies<{ anilistId: number; deFolgen?: unknown }[]>('data/erstausgabe-von-hand.yaml').filter((e) => e.deFolgen).map((e) => e.anilistId)
  const fehlt = mitte(ids)
  const titles = ids.filter((id) => id !== fehlt).map((id) => titel(id, { episodes: 100000 }))
  leser('deutsche-folgenzahl', 'pipeline/check-deutsche-folgenzahl-bestand.ts', (meta) => ({ kopien: ['data/erstausgabe-von-hand.yaml'], dateien: { 'public/data/titles.json': titles, ...metaDatei(meta) } }), fehlt)
  // Handdatei mit drei Einträgen: der mittlere (900001) fehlt und ist zurückgestellt, der letzte steht ohne Folgenzahl des Werks im Bestand
  // und auch in der Liste. Sie entschuldigt nur fehlende Titel, und nach dem zurückgestellten wird weiter geprüft.
  const [erster, letzter] = lies<{ anilistId: number; deFolgen?: unknown }[]>('data/erstausgabe-von-hand.yaml').filter((e) => e.deFolgen)
  const hand = [erster!, { ...erster!, anilistId: 900001 }, letzter!]
  const knapp = [titel(erster!.anilistId, { episodes: 100000 }), titel(letzter!.anilistId)]
  const beide = { quarantaene: [900001, letzter!.anilistId].map((titleId) => quarantaene(titleId).quarantaene[0]) }
  const dateien = { 'data/erstausgabe-von-hand.yaml': yaml.dump(hand), 'public/data/titles.json': knapp, 'public/data/meta.json': beide }
  const r = lauf('pipeline/check-deutsche-folgenzahl-bestand.ts', { dateien })
  const nurLetzter = r.aus.includes(`Deutsche Folgenzahl ${letzter!.anilistId} `) && !r.aus.includes('Deutsche Folgenzahl 900001')
  pruefe('deutsche-folgenzahl: Liste entschuldigt keinen vorhandenen Titel', r.code === 1 && nurLetzter, r.aus.slice(-600))
}
{
  const ids = lies<{ id: number }[]>('data/handlung-eigen.yaml').map((e) => e.id)
  const fehlt = mitte(ids)
  const titles = ids.filter((id) => id !== fehlt).map((id) => titel(id))
  // Seit 26.10.2026 sperrt ein verwaister Eintrag nicht mehr: Warnung samt Kennung, Exit 0 (kein Leser der Quarantäne nötig).
  const r = lauf('pipeline/check-handlung-eigen-bestand.ts', { kopien: ['data/handlung-eigen.yaml'], dateien: { 'public/data/titles.json': titles } })
  pruefe('handlung-eigen: fehlender Titel ist Warnung mit Kennung, Exit 0', r.code === 0 && r.aus.includes('[vorher rot] Eigene Handlung: 1 ohne Titel im Bestand') && r.aus.includes(`: ${fehlt}`), r.aus.slice(-600))
}
{
  const ids = [...new Set(lies<{ eintraege: { titleId: number }[] }>('data/offizielle-meldungen.yaml').eintraege.map((e) => e.titleId))]
  const fehlt = mitte(ids)
  const titles = ids.filter((id) => id !== fehlt).map((id) => titel(id))
  leser('news-offiziell', 'pipeline/check-news-offiziell-bestand.ts', (meta) => ({ kopien: ['data/offizielle-meldungen.yaml'], dateien: { 'public/data/titles.json': titles, ...metaDatei(meta) } }), fehlt)
}
{
  const liste = lies<{ anilistId: number; liste: string }[]>('data/synchron-forum-treffer.yaml')
  const fehlt = mitte(liste).anilistId
  const titles = liste.filter((e) => e.anilistId !== fehlt).map((e) => titel(e.anilistId, { jpYear: Number(e.liste.slice(-4)) }))
  const aufbau = (meta: unknown): Aufbau => ({
    kopien: ['data/synchron-forum-treffer.yaml'],
    dateien: { 'public/data/titles.json': titles, 'public/data/ohne-synchro.json': [], ...metaDatei(meta) },
  })
  leser('belegstaerke', 'pipeline/check-belegstaerke-bestand.ts', aufbau, fehlt)
}
{
  const eintraege = lies<{ slug: string; url: string }[]>('data/katalog-release-von-hand.yaml')
  const weg = mitte(eintraege).slug
  const releases = eintraege.filter((e) => e.slug !== weg).map((e) => ({ slug: e.slug, titleId: 1, sources: [e.url] }))
  const aufbau = (meta: unknown): Aufbau => ({ kopien: ['data/katalog-release-von-hand.yaml'], dateien: { 'public/data/releases.json': releases, ...metaDatei(meta) } })
  leser('katalog-release', 'pipeline/check-katalog-release-bestand.ts', aufbau, 900001, weg)
}

/**
 * Verlust-Riegel des Baus: Vorher 1–7, jetzt 1, 6, 7 — vier verloren, einer ist erlaubt. Die Quarantäne-Liste 2, 3, 4 (der Titel
 * dazwischen zählt) lässt den Bau durch, eine fremde Kennung nicht.
 */
function riegel(liste: number[] | undefined): Lauf {
  const skript = `import { pruefeVerlust } from '${pathToFileURL(join(WURZEL, 'pipeline/bau/verlust-riegel.ts')).href}'\npruefeVerlust([1, 6, 7].map((id) => ({ id })), [])\nconsole.log('durch')\n`
  return lauf((wo) => join(wo, 'riegel.mts'), {
    kopien: ['data/kino-ankuendigungen.yaml', 'data/ankuendigungen.yaml', 'data/ohne-synchro-von-hand.yaml', 'data/curated'],
    dateien: { 'public/data/titles.json': [1, 2, 3, 4, 5, 6, 7].map((id) => titel(id)), 'riegel.mts': skript, ...(liste ? { 'q.json': liste.map((titleId) => ({ titleId })) } : {}) },
    umgebung: (wo): Record<string, string> => (liste ? { BAU_QUARANTAENE: join(wo, 'q.json') } : {}),
  })
}
{
  const ohne = riegel(undefined)
  pruefe('verlust-riegel: ohne Quarantäne bricht der Bau ab', ohne.code === 1 && ohne.aus.includes('ABBRUCH: 4 Titel') && !ohne.aus.includes('durch'), ohne.aus.slice(-600))
  const mit = riegel([2, 3, 4])
  pruefe('verlust-riegel: zurückgestellte Titel sind kein Verlust', mit.code === 0 && mit.aus.includes('durch'), mit.aus.slice(-600))
  const fremd = riegel([2, 9, 4])
  pruefe('verlust-riegel: fremde Kennung lässt den Verlust stehen', fremd.code === 1 && fremd.aus.includes('ABBRUCH: 2 Titel'), fremd.aus.slice(-600))
}

// cr-batch-bestand: Aoashi-Abwurf (Herkunft wörtlich: 1 belegte Folge, 24 behauptet) wird gemeldet; Film (1 von 1), voller Abwurf und
// Wochentakt mit Werkszahl bleiben ohne Marke.
{
  const termin = (titleId: number, belegt: number, anzahl: number, releaseType = 'batch') => ({
    slug: `cr${titleId}`,
    titleId,
    platform: 'crunchyroll',
    releaseType,
    herkunft: `Deutsche Fassung bei Crunchyroll — ${belegt} Folgen mit belegtem Termin (Block „Staffel 2“)`,
    schedule: { firstEpisodeDate: '2026-10-25', episodeCount: anzahl },
  })
  const rot = lauf('pipeline/check-cr-batch-bestand.ts', { dateien: { 'public/data/releases.json': [termin(-1, 1, 24), termin(-2, 1, 1), termin(-3, 24, 24), termin(-4, 1, 24, 'weekly')] } })
  pruefe('cr-batch-bestand: nur der Abwurf mit 1 von 24 trägt die Marke', gleich(rot.marken, [-1]) && rot.code === 1, rot)
  const gruen = lauf('pipeline/check-cr-batch-bestand.ts', { dateien: { 'public/data/releases.json': [termin(-2, 1, 1), termin(-3, 24, 24)] } })
  pruefe('cr-batch-bestand: Film und voller Abwurf sind sauber ohne Marke', gruen.code === 0 && gruen.marken.length === 0 && gruen.aus.includes('2 geprüft'), gruen)
  const ohneDatei = lauf('pipeline/check-cr-batch-bestand.ts', {})
  pruefe('cr-batch-bestand: ohne Bestand rot, aber ohne Marke', ohneDatei.code === 1 && ohneDatei.marken.length === 0, ohneDatei)
}

if (fehler) {
  console.error(`quarantaene-pruefungen: ${fehler} Fehler`)
  process.exit(1)
}
console.log('quarantaene-pruefungen: ok')
