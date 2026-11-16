/**
 * Bilanz einer Änderung an Meldungen und Auto-Terminen: `meldungenAus` und `releasesAus` laufen mit denselben, eingecheckten Eingaben
 * (Titel, Anime2You-Vorschläge, Handtermine) einmal gegen den Basis-Stand (`origin/main`, als Worktree) und einmal gegen diesen Stand; die
 * Abweichungen kommen als Markdown für die PR-Beschreibung. Nur lesen, Exit 0.
 *
 * Aufruf: `npx tsx pipeline/meldungen-bilanz.ts [Basis-Ref]` (Standard `origin/main`).
 */
import { execFileSync } from 'node:child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, resolve } from 'node:path'
import { bilanzZeilen, unterschied } from './lib/meldungen-bilanz.ts'

const HIER = resolve(import.meta.dirname, '..')
const lies = <T>(pfad: string): T => JSON.parse(readFileSync(join(HIER, pfad), 'utf8')) as T

interface TitelEintrag { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string }
const listeVon = <T>(roh: T[] | { titles?: T[] }): T[] => (Array.isArray(roh) ? roh : (roh.titles ?? []))

async function zeilenVon(wurzel: string, eingaben: { titel: TitelEintrag[]; vorschlaege: unknown[]; hand: unknown[] }) {
  const m = (await import(join(wurzel, 'pipeline/lib/meldungen.ts'))) as typeof import('./lib/meldungen.ts')
  const s = (await import(join(wurzel, 'pipeline/lib/sammelartikel.ts'))) as typeof import('./lib/sammelartikel.ts')
  type V = Parameters<typeof m.releasesAus>[0]
  const titel = eingaben.titel as unknown as Parameters<typeof m.releasesAus>[1]
  const namen = new Map(eingaben.titel.map((t) => [t.id, t.titleDe ?? t.titleEn ?? t.titleRomaji]))
  const vorschlaege = eingaben.vorschlaege as V
  const alle = [...vorschlaege, ...s.vorschlaegeAusAllenSammelartikeln(vorschlaege)]
  const meldungen = m.meldungenAus(vorschlaege, titel, '2026-11-16').map((x) => ({ titleId: x.titleId, name: namen.get(x.titleId), anlass: x.titel }))
  const releases = m.releasesAus(alle, titel, eingaben.hand as Parameters<typeof m.releasesAus>[2], '2026-11-16').map((r) => ({ titleId: r.titleId, name: namen.get(r.titleId), anlass: r.herkunft ?? r.slug }))
  return { meldungen: bilanzZeilen(meldungen), releases: bilanzZeilen(releases) }
}

function tabelle(titel: string, vorher: string[], nachher: string[]): string {
  const u = unterschied(vorher, nachher)
  const zeilen = [`### ${titel}: ${vorher.length} vorher, ${nachher.length} nachher`]
  if (!u.weg.length && !u.neu.length) return [...zeilen, 'Keine Abweichung.'].join('\n')
  return [...zeilen, '| Änderung | Titel-ID \\| Name \\| Anlass |', '|---|---|', ...u.weg.map((z) => `| nur vorher | ${z.replaceAll('|', '\\|')} |`), ...u.neu.map((z) => `| nur nachher | ${z.replaceAll('|', '\\|')} |`)].join('\n')
}

async function main(): Promise<void> {
  const basis = process.argv[2] ?? 'origin/main'
  const wurzel = mkdtempSync(join(tmpdir(), 'bilanz-'))
  const worktree = join(wurzel, 'basis')
  execFileSync('git', ['worktree', 'add', '--detach', worktree, basis], { cwd: HIER, stdio: 'ignore' })
  try {
    if (existsSync(join(HIER, 'node_modules'))) symlinkSync(join(HIER, 'node_modules'), join(worktree, 'node_modules'))
    const releases = lies<{ automatisch?: boolean }[]>('public/data/releases.json')
    const eingaben = {
      titel: [...listeVon(lies<TitelEintrag[]>('public/data/titles.json')), ...listeVon(lies<TitelEintrag[]>('public/data/ohne-synchro.json'))],
      vorschlaege: lies<{ proposals: unknown[] }>('data/proposals/anime2you.json').proposals,
      hand: releases.filter((r) => !r.automatisch),
    }
    const vorher = await zeilenVon(worktree, eingaben)
    const nachher = await zeilenVon(HIER, eingaben)
    console.log([tabelle('Meldungen (`meldungenAus`)', vorher.meldungen, nachher.meldungen), tabelle('Auto-Termine (`releasesAus`)', vorher.releases, nachher.releases)].join('\n\n'))
  } finally {
    execFileSync('git', ['worktree', 'remove', '--force', worktree], { cwd: HIER, stdio: 'ignore' })
    rmSync(wurzel, { recursive: true, force: true })
  }
}

await main()
