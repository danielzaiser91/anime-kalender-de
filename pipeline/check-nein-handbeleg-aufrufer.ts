/**
 * Zusicherung für die Verdrahtung der Nein-Handbelege (13.10.2026, Reste aus PR 1151): `ergaenzeWegeAusJustwatch` und
 * `uebernehmeAnbieter` laden die Handbelege selbst und reichen sie weiter. Die getesteten Funktionen darunter (`ergaenzeWegeOhneWeg`,
 * `ergaenzeAboWege`, `fehlendeAnbieter`) bekamen bisher nur eine mitgegebene Menge; ein leeres `new Set()` am Aufruf blieb grün.
 * Hier laufen die Aufrufer mit den echten Handbelegen und `data/justwatch-audio.json`.
 *
 * Aufruf: npm run check:logic (steckt darin) oder `tsx pipeline/check-nein-handbeleg-aufrufer.ts`
 */
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import type { StreamLink, Title } from '../shared/types.ts'
import { ergaenzeAboWege } from './bau/11-2-3-abo-wege.ts'
import { ergaenzeWegeOhneWeg, type JwEintrag } from './bau/11-2-2-wege-ohne-weg.ts'
import { ergaenzeWegeAusJustwatch } from './bau/11-2-justwatch.ts'
import { uebernehmeAnbieter } from './bau/cartoon-zu-anime.ts'
import { dubKey, loadDubChecks, neinHandbelege } from './lib/dub-confirmed.ts'
import { readJson } from './lib/util.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const titel = (id: number): Title => ({ id, streams: [], keywords: [], genres: [] }) as unknown as Title
const nein = neinHandbelege(loadDubChecks())
const jw = readJson<Record<string, JwEintrag & { angebote?: { audio?: string[] }[] }>>('data/justwatch-audio.json', {})
const neinIds = [...new Set([...nein].map((k) => Number(k.split('|')[0])))]
/** Nein an `url`, Ja an einer zweiten Adresse derselben Plattform: Das Nein gilt dann nur `url` (`neinHandbelege`). */
const neinNurDort = (id: number, platform: string, url: string) =>
  neinHandbelege([{ anilistId: id, platform, url, dub: false }, { anilistId: id, platform, url: 'https://example.org/ja', dub: true }])
const ohneParameter = { tmdbMehrdeutig: new Set<string>(), toteAdressen: new Set<string>() }

console.log('\nAbo-Weg-Runde mit Nein-Handbeleg (Fixture):')
{
  const angebot = { anbieter: 'Crunchyroll', art: 'FLATRATE', audio: ['de', 'ja'], url: 'https://www.crunchyroll.com/de/watch/GTEST' }
  const lauf = (handNein: Set<string>, id: number) => {
    const t = titel(id)
    ergaenzeAboWege({ titles: new Map([[id, t]]), jw: { '9000010': { angebote: [angebot] } }, handNein, ...ohneParameter })
    return (t.streams as StreamLink[]).map((s) => s.platform).join()
  }
  pruefe('ohne Nein-Handbeleg kommt der Crunchyroll-Weg', lauf(new Set(), 9000010) === 'crunchyroll')
  pruefe('mit Nein-Handbeleg für Crunchyroll kommt er nicht', lauf(new Set([dubKey(9000010, 'crunchyroll')]), 9000010) === '')
  pruefe('das Nein gilt nur dem Titel, dem es gehört', lauf(new Set([dubKey(9000011, 'crunchyroll')]), 9000010) === 'crunchyroll')
  pruefe('Nein nur an seiner Adresse: der Weg dorthin kommt nicht', lauf(neinNurDort(9000010, 'crunchyroll', angebot.url), 9000010) === '')
  pruefe('… ein Nein an einer anderen Adresse hält ihn nicht auf', lauf(neinNurDort(9000010, 'crunchyroll', 'https://www.crunchyroll.com/de/watch/ANDERS'), 9000010) === 'crunchyroll')
}

console.log('\nJustWatch-Runden über den Aufrufer (echte Handbelege, echte JustWatch-Datei):')
{
  const fresh = () => new Map(neinIds.map((id) => [id, titel(id)] as [number, Title]))
  /* Was ein Titel an Wegen trägt: Bezugsweg-Namen und Plattformen der Verweise. */
  const zeichen = (titles: Map<number, Title>) =>
    new Map([...titles].map(([id, t]) => [id, new Set([...(t.watchLinks ?? []).map((w) => `weg:${w.name}`), ...(t.streams ?? []).map((s) => `verweis:${s.platform}`)])]))
  const runden = (handNein: Set<string>) => {
    const titles = fresh()
    ergaenzeWegeOhneWeg({ titles, jw, handNein, ...ohneParameter })
    ergaenzeAboWege({ titles, jw, handNein, ...ohneParameter })
    return zeichen(titles)
  }
  const ohne = runden(new Set())
  const mit = runden(nein)
  const unterdrueckt = new Map([...ohne].map(([id, z]) => [id, [...z].filter((x) => !mit.get(id)?.has(x))] as [number, string[]]))
  const alle = [...unterdrueckt.values()].flat()
  pruefe('Vorbedingung: ein Nein hält mindestens einen Bezugsweg (Runde „ohne jeden Weg“) zurück', alle.some((x) => x.startsWith('weg:')))
  pruefe('Vorbedingung: ein Nein hält mindestens einen Verweis (Runde „Abo-Weg“) zurück', alle.some((x) => x.startsWith('verweis:')))

  const titles = fresh()
  ergaenzeWegeAusJustwatch({ titles, ...ohneParameter })
  const echt = zeichen(titles)
  const durchgerutscht = [...unterdrueckt].flatMap(([id, z]) => z.filter((x) => echt.get(id)?.has(x)).map((x) => `${id} ${x}`))
  pruefe('ergaenzeWegeAusJustwatch legt keinen Weg an, den ein Nein-Handbeleg verneint', durchgerutscht.length === 0, durchgerutscht.slice(0, 5))
}

console.log('\nCartoon-Zwilling über den Aufrufer (echte Handbelege):')
{
  const [neinKey] = [...nein].map((k) => k.split('|') as [string, string]).filter((k) => k.length === 2)
  const animeId = Number(neinKey?.[0])
  const kontrollId = 9000012
  const weg = (platform: string): StreamLink => ({ platform, url: `https://example.org/${platform}` }) as StreamLink
  const cartoon = { id: -1, streams: [weg(neinKey![1]), weg('joyn')] } as unknown as Title
  const ordner = mkdtempSync(join(tmpdir(), 'nein-aufrufer-'))
  try {
    writeFileSync(join(ordner, 'titles.json'), JSON.stringify([titel(animeId), titel(kontrollId)]))
    uebernehmeAnbieter([[-1, animeId], [-1, kontrollId]], new Map([[-1, cartoon]]), ordner)
    const gelesen = JSON.parse(readFileSync(join(ordner, 'titles.json'), 'utf8')) as Title[]
    const plattformen = (id: number) => (gelesen.find((t) => t.id === id)?.streams ?? []).map((s) => s.platform).join()
    pruefe('Kontrolle: ein Titel ohne Nein bekommt beide Anbieter des Cartoons', plattformen(kontrollId) === `${neinKey![1]},joyn`, plattformen(kontrollId))
    pruefe('uebernehmeAnbieter lässt den verneinten Anbieter weg, der andere kommt', plattformen(animeId) === 'joyn', plattformen(animeId))
  } finally {
    rmSync(ordner, { recursive: true, force: true })
  }
}

console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
