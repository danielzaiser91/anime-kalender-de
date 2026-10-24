/**
 * Kulisse für `check-mal-dubletten.ts`: setzt `AK_ROOT` auf einen Temp-Ordner mit den vier Dubletten (Eintragszeilen in der Form von
 * `data/anisearch-eintraege.json`, Handbindungen wie in `data/anisearch-ids-hand.yaml`), damit die Prüfung nicht an einer Zeile des echten
 * Bestands hängt. Muss der erste Import der Prüfung sein (`ROOT` in `util.ts` und die Handdatei in `bau/grundlagen.ts` werden beim Laden gelesen).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/** AniList-Titel → aniSearch-Kennung der vier Dubletten. */
export const DUBLETTEN = [[204011, 21084], [206814, 21566], [212503, 21575], [213457, 21751]] as const

const eintrag = (t: string, dub: 'p' | '-', mal: number, dvon: string) => ({ t, en: t, ty: 'TV-Serie', y: 2026, f: 12, von: dvon, mal, dub, pub: ['Crunchyroll'], dvon })
const eintraege = {
  21084: eintrag('Psyren', 'p', 63098, '2026-10-05'),
  21566: eintrag('Dragon Ball Super: Beerus', '-', 63367, '2026-10-11'),
  21575: eintrag('Hyouken II', 'p', 64254, '2026-10-08'),
  21751: eintrag('Fool Night', '-', 64459, '2026-11-26'),
  /* Eine Zeile ohne Handbindung: bleibt in jedem Fall stehen. */
  21900: eintrag('Ohne Bindung', 'p', 64900, '2026-11-01'),
}

const wurzel = mkdtempSync(join(tmpdir(), 'mal-dubletten-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(join(wurzel, 'data', 'anisearch-eintraege.json'), JSON.stringify(eintraege))
writeFileSync(join(wurzel, 'data', 'anisearch-ids-hand.yaml'), `# Kulisse\n${DUBLETTEN.map(([al, as]) => `${al}: ${as}`).join('\n')}\n`)
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
process.env.AK_ROOT = wurzel
process.on('exit', () => rmSync(wurzel, { recursive: true, force: true }))
