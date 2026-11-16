/**
 * `quellenPflegen` stellt eine Quelle auf `ueberholt`, deren altes `sagt` vom Termin abweicht, wenn der Termin gestützt ist (16.11.2026).
 * Fälle aus dem Bestand: A New Dawn (Disc, Shop-Beleg 11.12. gegen Meldung 04.12.), Apothekerin S3 (Folge 1 am 23.10. gegen News 02.10.),
 * Pokémon (Sendeplan `tv`, `sagt` = Sichtungstag: bleibt). Gegenproben: eine echte Abweichung ohne Stütze bleibt `aktuell`.
 * Der Lauf geht durch `quellenPflegen` mit einer Historie, die das alte `sagt` trägt, in einer Wegwerf-Wurzel (`AK_ROOT`).
 */
import { copyFileSync, mkdirSync, mkdtempSync, readdirSync, rmSync, statSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const fehler: string[] = []
const pruefe = (name: string, ok: boolean, info?: unknown) => {
  if (!ok) fehler.push(`${name}${info === undefined ? '' : ` (${JSON.stringify(info)})`}`)
}
const tmp = mkdtempSync(join(process.argv[2] ?? tmpdir(), 'check-quelle-ueberholt-'))
process.env.AK_ROOT = tmp
for (const o of ['data/cache', 'public/data', 'data/curated']) mkdirSync(join(tmp, o), { recursive: true })
for (const d of readdirSync('data', { withFileTypes: true })) {
  if (d.isFile() && /\.(json|yaml)$/.test(d.name) && statSync(join('data', d.name)).size < 200_000) copyFileSync(join('data', d.name), join(tmp, 'data', d.name))
}
writeFileSync(join(tmp, 'data', 'ohne-synchro-von-hand.yaml'), '[]\n')

const A2Y = 'https://example.org/meldung-04-12'
const SHOP = 'https://example.org/shop-11-12'
const NEWS = 'https://example.org/news-02-10'
const NEWS2 = 'https://example.org/news2-02-10'
const SERIE = 'https://example.org/serie'
const PLAN = 'https://example.org/tv-programm'
const q = (url: string, sagt?: string) => ({ url, name: 'x', gesehenAm: '2026-10-01', stand: 'aktuell', ...(sagt ? { sagt } : {}) })

try {
  const { quellenPflegen } = await import('./bau/nebendateien.ts')
  const { aktuelleMitAbweichung } = await import('./lib/quelle-ueberholt.ts')
  const release = (slug: string, platform: string, schedule: object, sources: string[]) => ({ slug, titleId: 900010, platform, schedule, sources })
  const historie = {
    disc: [q(SHOP), q(A2Y, '2026-12-04')],
    cr: [q(SERIE), q(NEWS, '2026-10-02'), q(NEWS2, '2026-10-02')],
    allein: [q(NEWS, '2026-10-02')],
    zwei: [q(NEWS, '2026-10-02'), q(NEWS2, '2026-10-03')],
    tv: [q(PLAN, '2026-09-29')],
    gleich: [q(NEWS, '2026-10-23'), q(SERIE)],
  }
  writeFileSync(join(tmp, 'data', 'quellen-historie.json'), JSON.stringify(historie))
  const lauf = () => [
    release('disc', 'disc', { firstEpisodeDate: '2026-12-11' }, [SHOP, A2Y]),
    release('cr', 'crunchyroll', { firstEpisodeDate: '2026-10-23', observed: { 1: '2026-10-23', 2: '2026-10-30' } }, [SERIE, NEWS, NEWS2]),
    release('allein', 'crunchyroll', { firstEpisodeDate: '2026-10-23' }, [NEWS]),
    release('zwei', 'crunchyroll', { firstEpisodeDate: '2026-10-23' }, [NEWS, NEWS2]),
    release('tv', 'tv', { firstEpisodeDate: '2026-09-24', observed: { 1: '2026-09-24', 2: '2026-09-25' } }, [PLAN]),
    release('gleich', 'crunchyroll', { firstEpisodeDate: '2026-10-23', observed: { 1: '2026-10-23' } }, [NEWS, SERIE]),
  ]
  const stand = (rs: ReturnType<typeof lauf>, slug: string, url: string) => (rs.find((r) => r.slug === slug) as { quellen?: { url: string; stand?: string; grund?: string }[] }).quellen?.find((x) => x.url === url)

  const rs = lauf()
  quellenPflegen(rs as never)
  pruefe('Disc: Meldung 04.12. gegen Shop 11.12. wird überholt', stand(rs, 'disc', A2Y)?.stand === 'ueberholt' && stand(rs, 'disc', A2Y)?.grund === 'Termin: 2026-12-11', stand(rs, 'disc', A2Y))
  pruefe('Disc: der Shop bleibt aktuell', stand(rs, 'disc', SHOP)?.stand === 'aktuell', stand(rs, 'disc', SHOP))
  pruefe('CR: News 02.10. gegen Folge 1 am 23.10. wird überholt', stand(rs, 'cr', NEWS)?.stand === 'ueberholt' && stand(rs, 'cr', NEWS)?.grund === 'Folge 1 erschien am 2026-10-23', stand(rs, 'cr', NEWS))
  pruefe('CR: auch die zweite News wird überholt', stand(rs, 'cr', NEWS2)?.stand === 'ueberholt', stand(rs, 'cr', NEWS2))
  pruefe('CR: die Serienseite ohne Aussage bleibt aktuell', stand(rs, 'cr', SERIE)?.stand === 'aktuell', stand(rs, 'cr', SERIE))
  pruefe('Gegenprobe: einzige Quelle mit anderem Tag bleibt aktuell', stand(rs, 'allein', NEWS)?.stand === 'aktuell', stand(rs, 'allein', NEWS))
  pruefe('Gegenprobe: zwei abweichende Quellen ohne Stütze bleiben aktuell', stand(rs, 'zwei', NEWS)?.stand === 'aktuell' && stand(rs, 'zwei', NEWS2)?.stand === 'aktuell', stand(rs, 'zwei', NEWS2))
  pruefe('Sendeplan `tv`: Sichtungstag in `sagt` bleibt aktuell, auch mit Folge 1', stand(rs, 'tv', PLAN)?.stand === 'aktuell', stand(rs, 'tv', PLAN))
  pruefe('Quelle mit Tag gleich Termin bleibt aktuell', stand(rs, 'gleich', NEWS)?.stand === 'aktuell', stand(rs, 'gleich', NEWS))
  const offen = rs.flatMap((r) => aktuelleMitAbweichung(r as never, (r as { quellen?: never[] }).quellen ?? []).map((x) => `${r.slug}:${x.url}`))
  pruefe('übrig bleiben nur die echten Abweichungen', offen.join() === `allein:${NEWS},zwei:${NEWS},zwei:${NEWS2}`, offen)

  const zweiter = lauf()
  quellenPflegen(zweiter as never)
  pruefe('zweiter Lauf: Disc-Meldung bleibt überholt, mit Grund', stand(zweiter, 'disc', A2Y)?.stand === 'ueberholt' && stand(zweiter, 'disc', A2Y)?.grund === 'Termin: 2026-12-11', stand(zweiter, 'disc', A2Y))
  pruefe('zweiter Lauf: CR-News bleibt überholt', stand(zweiter, 'cr', NEWS)?.stand === 'ueberholt', stand(zweiter, 'cr', NEWS))
  pruefe('zweiter Lauf: Gegenprobe bleibt aktuell', stand(zweiter, 'allein', NEWS)?.stand === 'aktuell', stand(zweiter, 'allein', NEWS))
} finally {
  rmSync(tmp, { recursive: true, force: true })
}

if (fehler.length) {
  console.error(`check-quelle-ueberholt: ${fehler.join('; ')}`)
  process.exit(1)
}
console.log('check-quelle-ueberholt: Disc-Shop, Folge 1, Gegenproben (allein, zwei, tv, gleich), zweiter Lauf: alle 13 Fälle ok')
