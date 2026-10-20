/**
 * Kulisse für `check-erstausgabe.ts`: setzt `AK_ROOT` auf einen Temp-Ordner mit einem Nein-Handbeleg in der Form der echten Datei
 * (Prime, `available: false`), damit der Standard des Baus nicht an einer Zeile des echten Bestands hängt.
 * Muss der erste Import der Prüfung sein (`ROOT` in `util.ts` wird beim ersten Laden gelesen).
 */
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const NEIN_ID = 98320

const wurzel = mkdtempSync(join(tmpdir(), 'erstausgabe-'))
mkdirSync(join(wurzel, 'data', 'curated'), { recursive: true })
writeFileSync(
  join(wurzel, 'data', 'dub-confirmed.yaml'),
  `- anilistId: ${NEIN_ID}\n  title: Erfunden\n  platform: primevideo\n  available: false\n  checkedAt: '2026-08-20'\n  note: Treffer endet auf eine Fehlerseite.\n`,
)
/* Beim Laden liest `bau/grundlagen.ts` diese Handdatei; leer genügt. */
writeFileSync(join(wurzel, 'data', 'kino-ankuendigungen.yaml'), '[]\n')
process.env.AK_ROOT = wurzel
process.on('exit', () => rmSync(wurzel, { recursive: true, force: true }))
