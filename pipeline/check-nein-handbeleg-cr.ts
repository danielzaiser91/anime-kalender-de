/**
 * Zusicherung: Die zwei Crunchyroll-Runden, die einen Weg mit `dub: true` neu anlegen (Geschwister-Block in `09-4-2`,
 * deutscher Katalog in `09-4-4`), legen ihn nicht an, wo ein Nein-Handbeleg ihn verneint (13.10.2026, Reste aus PR 1151).
 * Geprüft wird auch der Aufrufer: Die echten Handbelege müssen ankommen, nicht nur eine mitgegebene Menge.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg-cr.ts`
 */
import type { PlatformId, StreamLink, Title } from '../shared/types.ts'
import type { CrDubData } from './lib/crunchyroll-dub.ts'
import type { AnisearchEintrag } from './bau/01-quellen.ts'
import { ordneCrBloeckeZu } from './bau/09-4-2-bloecke.ts'
import { ordneGeschwisterBloeckeZu } from './bau/09-4-2-1-geschwister.ts'
import { legeCrVerweiseUndTermineAn } from './bau/09-4-4-termine.ts'
import { legeCrWegeAusKatalogAn } from './bau/09-4-4-1-katalog-wege.ts'
import { dubKey, loadDubChecks, neinHandbelege } from './lib/dub-confirmed.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number, rest: Partial<Title> = {}): Title => ({ id, streams: [], keywords: [], genres: [], ...rest }) as unknown as Title
const hatCr = (t: Title | undefined) => (t?.streams ?? []).some((s: StreamLink) => s.platform === 'crunchyroll')
const SERIE_URL = 'https://www.crunchyroll.com/series/GTESTSERIE'

/** Ein echtes Nein für Crunchyroll aus den Handbelegen: Der Aufrufer muss genau diese Menge laden. */
const echtesNein = [...neinHandbelege(loadDubChecks())].map((k) => k.split('|')).find((k) => k.length === 2 && k[1] === 'crunchyroll')
const neinId = Number(echtesNein?.[0])
pruefe('Vorbedingung: die Handbelege führen mindestens ein Crunchyroll-Nein', Number.isFinite(neinId), echtesNein)

/** Nein an `url`, Ja an einer zweiten Adresse derselben Plattform: Das Nein gilt dann nur `url` (`neinHandbelege`). */
const neinNurDort = (id: number, platform: PlatformId, url: string) =>
  neinHandbelege([{ anilistId: id, platform, url, dub: false }, { anilistId: id, platform, url: 'https://example.org/ja', dub: true }])

/* Eltern (Staffel mit 12 Folgen) und ein Special mit 3 Folgen, das die Serie als deutschen Block führt. */
function geschwisterLage(specialId: number) {
  const eltern = titel(9000001, { episodes: 12, franchiseId: 9000001 })
  const special = titel(specialId, { episodes: 3, franchiseId: 9000001 })
  const serie = {
    seriesId: 'GTESTSERIE',
    url: SERIE_URL,
    katalog: 'de',
    deutschImAngebot: true,
    geprueftAm: '2026-10-01',
    staffeln: [{ name: 'Special', folgen: 3, deutsch: 3 }],
  } as unknown as CrDubData['serien'][number]
  const titles = new Map([eltern, special].map((t) => [t.id, t] as [number, Title]))
  return { eltern, special, serie, titles }
}

console.log('\nGeschwister-Block (09-4-2):')
{
  const lauf = (nein: Set<string>) => {
    const { eltern, special, serie, titles } = geschwisterLage(9000002)
    ordneGeschwisterBloeckeZu({ nachSerienId: new Map([['GTESTSERIE', { serie, titel: new Map([[eltern.id, eltern]]) }]]), titles, katalogEintraege: [], handNein: nein })
    return hatCr(special)
  }
  pruefe('ohne Nein-Handbeleg bekommt das Special den Crunchyroll-Weg', lauf(new Set()))
  pruefe('mit Nein-Handbeleg für Crunchyroll bleibt es ohne', !lauf(new Set([dubKey(9000002, 'crunchyroll')])))
  pruefe('das Nein gilt nur dem Titel, dem es gehört', lauf(new Set([dubKey(9000003, 'crunchyroll')])))
  pruefe('Nein nur an der Serienadresse: kein Weg', !lauf(neinNurDort(9000002, 'crunchyroll', SERIE_URL)))
  pruefe('… ein Nein an einer anderen Adresse hält ihn nicht auf', lauf(neinNurDort(9000002, 'crunchyroll', 'https://www.crunchyroll.com/series/ANDERS')))
}

console.log('\nGeschwister-Block über den Aufrufer (echte Handbelege):')
{
  const { eltern, special, serie, titles } = geschwisterLage(neinId)
  const kontrolle = geschwisterLage(9000002)
  const bloecke = (s: typeof serie, t: Title, alle: Map<number, Title>) =>
    ordneCrBloeckeZu({ crDub: { scrapedAt: '2026-10-01', serien: [s] }, nachUrl: new Map([[SERIE_URL, [t]]]), titles: alle, katalogEintraege: [] })
  bloecke(kontrolle.serie, kontrolle.eltern, kontrolle.titles)
  bloecke(serie, eltern, titles)
  pruefe('Kontrolle: derselbe Aufbau mit einem Titel ohne Nein bekommt den Weg', hatCr(kontrolle.special))
  pruefe('ordneCrBloeckeZu legt für einen Titel mit echtem Crunchyroll-Nein keinen Weg an', !hatCr(special))
}

console.log('\nDeutscher Katalog (09-4-4):')
{
  const katalog = readJson<{ eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[] }>('data/cr-katalog-de.json', {})
  const eintrag = (katalog.eintraege ?? []).find((e) => e.folgen && e.staffeln === 1 && (e.audio ?? []).includes('de-DE'))
  pruefe('Vorbedingung: der Katalog führt einen Eintrag mit einer Staffel und de-DE', Boolean(eintrag))
  const anisearch = (id: number) => ({ [id]: { streams: [{ provider: 'crunchyroll', url: `https://www.crunchyroll.com/series/${eintrag?.id}` }] } }) as unknown as Record<string, AnisearchEintrag>
  const lauf = (id: number, nein: Set<string>) => {
    const t = titel(id)
    legeCrWegeAusKatalogAn({ titles: new Map([[id, t]]), anisearch: anisearch(id), handNein: nein })
    return hatCr(t)
  }
  pruefe('ohne Nein-Handbeleg legt der Katalog den Weg an', lauf(9000004, new Set()))
  pruefe('mit Nein-Handbeleg für Crunchyroll legt er ihn nicht an', !lauf(9000004, new Set([dubKey(9000004, 'crunchyroll')])))
  pruefe('das Nein gilt nur dem Titel, dem es gehört', lauf(9000004, new Set([dubKey(9000005, 'crunchyroll')])))
  pruefe('Nein nur an der Katalogadresse: kein Weg', !lauf(9000004, neinNurDort(9000004, 'crunchyroll', `https://www.crunchyroll.com/series/${eintrag?.id}`)))
  pruefe('… ein Nein an einer anderen Adresse hält ihn nicht auf', lauf(9000004, neinNurDort(9000004, 'crunchyroll', 'https://www.crunchyroll.com/series/ANDERS')))

  /* Ohne Serien läuft nur die Katalog-Runde; nichts wird geschrieben. */
  const katalogRunde = (t: Title) => {
    legeCrVerweiseUndTermineAn({
      titles: new Map([[t.id, t]]),
      anisearch: anisearch(t.id),
      belegt: 0,
      crDub: { scrapedAt: '2026-10-01', serien: [] },
      verschwunden: 0,
      usNeinOffen: 0,
      nachUrl: new Map(),
      releases: [],
    })
  }
  const t = titel(neinId)
  katalogRunde(t)
  const k = titel(9000004)
  katalogRunde(k)
  pruefe('Kontrolle über den Aufrufer: ein Titel ohne Nein bekommt den Weg', hatCr(k))
  pruefe('legeCrVerweiseUndTermineAn legt für einen Titel mit echtem Crunchyroll-Nein keinen Weg an', !hatCr(t))
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
