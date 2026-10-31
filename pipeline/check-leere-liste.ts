/**
 * Mindestzahlen auf schrumpfenden Listen: Eine leere offene Liste ist grün („nichts zu tun“), eine leere oder fehlende Quelle bleibt rot.
 * Einheitenfälle für `lib/leere-liste.ts`, dazu je Wächter ein Prozesslauf gegen eine Wegwerf-Wurzel (Verdrahtung):
 * check-folgenzahl-kennzeichnung-bestand, check-news-rhythmus, check-ankuendigung-news. Aufruf: npx tsx pipeline/check-leere-liste.ts
 */
import { spawnSync } from 'node:child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { leereListe } from './lib/leere-liste.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info: unknown = ''): void {
  console.log(ok ? '✓' : '✗', name, ok ? '' : JSON.stringify(info))
  if (!ok) fehler++
}

pruefe('offen 3 von 10: grün', leereListe('X', 3, 10).ok)
pruefe('offen 1 von 10: grün', leereListe('X', 1, 10).ok)
pruefe('offen 0, Quelle 7: grün mit Zeile „0 offen — nichts zu tun“', leereListe('X', 0, 7).ok && leereListe('X', 0, 7).zeile.includes('0 offen — nichts zu tun'))
pruefe('Quelle 0: rot, auch bei offen 0', !leereListe('X', 0, 0).ok)
pruefe('Quelle 0 mit offen 2 (widersprüchlich): rot', !leereListe('X', 2, 0).ok)

const PROJEKT = resolve(import.meta.dirname, '..')
const wurzeln: string[] = []
function lauf(skript: string, wurzel: string, cwd: string): { status: number | null; aus: string } {
  const r = spawnSync(process.execPath, ['--import', import.meta.resolve('tsx'), join(PROJEKT, 'pipeline', skript)], {
    cwd,
    env: { ...process.env, AK_ROOT: wurzel, TSX_TSCONFIG_PATH: join(PROJEKT, 'tsconfig.json') },
    encoding: 'utf8',
    timeout: 120_000,
    windowsHide: true,
  })
  return { status: r.status, aus: `${r.stdout}${r.stderr}` }
}
function wegwerf(dateien: Record<string, string>): string {
  const w = mkdtempSync(join(tmpdir(), 'leere-liste-'))
  wurzeln.push(w)
  for (const [kurz, inhalt] of Object.entries(dateien)) {
    const pfad = kurz.replace(/^@/, 'data').replace(/^#/, join('public', 'data'))
    mkdirSync(join(w, pfad, '..'), { recursive: true })
    writeFileSync(join(w, pfad), inhalt)
  }
  return w
}

try {
  // Bestandswächter: Wege ohne „≈“ (Quelle gesehen, nichts offen) gegen leeren Bestand.
  const weg = [{ id: 900001, slug: 'a', titleEn: 'A', streams: [{ platform: 'netflix', url: 'https://example.org/a' }] }]
  const bestand = (titel: string) => wegwerf({ '#/titles.json': titel, '#/ohne-synchro.json': '[]', '#/cartoons.json': '[]', '#/releases.json': '[]' })
  const fz = 'check-folgenzahl-kennzeichnung-bestand.ts'
  const fzGefuellt = bestand(JSON.stringify(weg))
  const a = lauf(fz, fzGefuellt, fzGefuellt)
  pruefe('Folgenzahl: Weg gesehen, keiner mit „≈“ → Exit 0 und „0 offen“', a.status === 0 && a.aus.includes('0 offen — nichts zu tun'), a)
  const fzLeer = bestand('[]')
  const b = lauf(fz, fzLeer, fzLeer)
  pruefe('Folgenzahl: leerer Bestand (kein Weg gesehen) → Exit 1', b.status === 1 && b.aus.includes('Quelle leer oder fehlt'), b)

  // Rhythmus: Handbeleg-Ordner mit Eintrag ohne Rhythmus gegen leeren Ordner.
  const rhythmus = 'check-news-rhythmus.ts'
  const rStumm = { '@/kino-ankuendigungen.yaml': '[]\n', '@/anisearch-ids-hand.yaml': '{}\n' }
  const rGefuellt = wegwerf({ ...rStumm, '@/curated/a.yaml': '- slug: x-netflix\n  titleId: 1\n  platform: netflix\n' })
  const c = lauf(rhythmus, rGefuellt, PROJEKT)
  pruefe('Rhythmus: Handbelege ohne Rhythmus → Exit 0 und „0 offen“', c.status === 0 && c.aus.includes('0 offen — nichts zu tun'), c)
  const rLeer = wegwerf({ ...rStumm, '@/curated/a.yaml': '[]\n' })
  const d = lauf(rhythmus, rLeer, PROJEKT)
  pruefe('Rhythmus: keine Handbelege → Exit 1', d.status === 1 && d.aus.includes('Quelle leer oder fehlt'), d)

  // Ankündigungen: leere Liste gegen Datei ohne `eintraege`.
  const ank = 'check-ankuendigung-news.ts'
  const eLeer = wegwerf({ '@/ankuendigungen.yaml': 'quellen: {}\neintraege: []\n', '@/offizielle-meldungen.yaml': 'eintraege: []\n' })
  const e = lauf(ank, eLeer, eLeer)
  pruefe('Ankündigungen: `eintraege: []` → Exit 0 und „0 offen“', e.status === 0 && e.aus.includes('0 offen — nichts zu tun'), e)
  const eKaputt = wegwerf({ '@/ankuendigungen.yaml': 'quellen: {}\n', '@/offizielle-meldungen.yaml': 'eintraege: []\n' })
  const f = lauf(ank, eKaputt, eKaputt)
  pruefe('Ankündigungen: Datei ohne `eintraege` → Exit 1 durch die Quellen-Zeile', f.status === 1 && f.aus.includes('Quelle leer oder fehlt'), f)
} finally {
  for (const w of wurzeln) rmSync(w, { recursive: true, force: true })
}

console.log(fehler ? `\n${fehler} Zusicherung(en) verletzt.` : '\ncheck-leere-liste: alle Zusicherungen halten (8 Prozess- und Einheitenfälle)')
process.exit(fehler ? 1 : 0)
