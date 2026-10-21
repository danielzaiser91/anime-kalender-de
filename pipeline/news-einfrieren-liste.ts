/**
 * Listet jede Meldung, deren Satz sich zwischen zwei `news.json`-Ständen ändert (Beleg für die PR-Bilanz).
 * Aufruf: npx tsx pipeline/news-einfrieren-liste.ts <alte.json> <neue.json>
 */
import { readFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'
import { artLabel, newsSatz } from '../web/src/lib/news-text.ts'
import type { NewsEintrag, NewsMeldung } from '../shared/news-typen.ts'

const schluessel = (e: NewsEintrag, m: NewsMeldung): string => [e.am, e.titelId, m.art, m.platform ?? '', m.release ?? '', m.datum ?? '', m.teilId ?? ''].join('|')

export function satzAenderungen(alt: NewsEintrag[], neu: NewsEintrag[]): string[] {
  const vorher = new Map<string, { e: NewsEintrag; m: NewsMeldung }>()
  for (const e of alt) for (const m of e.meldungen ?? []) vorher.set(schluessel(e, m), { e, m })
  const zeilen: string[] = []
  for (const e of neu) {
    for (const m of e.meldungen) {
      const a = vorher.get(schluessel(e, m))
      if (!a) continue
      const t0 = `${artLabel(a.m)} · ${newsSatz(a.m, a.e.am)}`
      const t1 = `${artLabel(m)} · ${newsSatz(m, e.am)}`
      if (t0 !== t1) zeilen.push(`${e.am} ${e.titel} [${m.release ?? m.art}]: „${t0}“ -> „${t1}“`)
    }
  }
  return zeilen
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const lies = (p: string) => JSON.parse(readFileSync(p, 'utf8')) as NewsEintrag[]
  const z = satzAenderungen(lies(process.argv[2]!), lies(process.argv[3]!))
  console.log(z.join('\n'))
  console.log(`Meldungen mit geändertem Satz: ${z.length}`)
}
