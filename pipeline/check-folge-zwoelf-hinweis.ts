/**
 * Zusicherung: **der Hinweis zu Villainess Folge 12 steht im kuratierten Eintrag und erreicht den Kasten im Panel**
 * (18.10.2026: Crunchyroll kündigt eine Folge 12 an, die Japan nie hatte). Der Bau reicht `note` unverändert an
 * `Release.note` weiter (`05-releases.ts`); `kastenNotizVon()` wählt sie für den Kasten. Läuft in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import yaml from 'js-yaml'
import type { Release } from '../shared/types.ts'
import { kastenNotizVon } from '../web/src/components/detail/kasten-hinweise.ts'
import { ROOT } from './lib/util.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (ok) return
  fehler++
  console.error(`FEHLER: ${name} ${info}`)
}

const SLUG = 'though-i-am-an-inept-villainess'
const kuratiert = yaml.load(readFileSync(resolve(ROOT, 'data/curated/streaming-sommer-2026.yaml'), 'utf8')) as { slug: string; note?: string }[]
const note = kuratiert.find((e) => e.slug === SLUG)?.note
pruefe('Kuratierter Eintrag trägt den Hinweis zu Folge 12', Boolean(note?.includes('Folge 12')) && Boolean(note?.includes('11 Folgen')), String(note))

/* Der Release, wie der Bau ihn aus dem Eintrag macht: Slug, Termin (vor heute) und die durchgereichte Notiz. */
const releases = [{ slug: SLUG, platform: 'crunchyroll', releaseType: 'weekly', schedule: { firstEpisodeDate: '2026-08-02' }, note }] as unknown as Release[]
pruefe('Der Kasten zeigt den Hinweis (Termin liegt vor „heute")', kastenNotizVon(releases, '2026-10-18')?.note === note)
pruefe('Ohne Hinweis zeigt der Kasten nichts', kastenNotizVon(releases.map((r) => ({ ...r, note: undefined })), '2026-10-18') === undefined)

if (fehler) {
  console.error(`${fehler} Prüfung(en) fehlgeschlagen`)
  process.exit(1)
}
console.log('Folge-12-Hinweis: Eintrag vorhanden, Kasten zeigt ihn')
