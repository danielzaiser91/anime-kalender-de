/**
 * Bestandsteil von `check-reihen-teilname.ts`: Kein Teil einer Reihe in `public/data` trägt im Kopf des Detail-Panels einen nichtssagenden Namen
 * („0" statt „Jujutsu Kaisen 0"). Rechnet wie die Oberfläche: `reihenNameVon` und `teilNameVon` über `franchises.json` samt `titles.json`.
 * Liest `public/data` und gehört deshalb in `check:bestand`, nicht in `check:logic`.
 */
import { readFileSync } from 'node:fs'
import type { FranchiseMember, Title } from '../shared/types.ts'
import { reihenNameVon, teilNameVon } from '../web/src/components/detail/reihen-namen.ts'
import { istNichtssagend } from '../web/src/components/detail/reihen-regeln.ts'
import type { Dataset } from '../web/src/lib/data.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const lies = <T>(p: string): T => JSON.parse(readFileSync(p, 'utf8')) as T

console.log('\nAusgelieferter Datensatz:')
{
  const reihen = lies<Record<string, FranchiseMember[]>>('public/data/franchises.json')
  const titel = [...lies<Title[]>('public/data/titles.json'), ...lies<Title[]>('public/data/ohne-synchro.json')]
  const data = { titleById: new Map(titel.map((t) => [t.id, t])) } as unknown as Dataset
  const offen: string[] = []
  let teile = 0
  for (const reihe of Object.values(reihen)) {
    const erster = data.titleById.get(reihe[0]!.id)
    if (reihe.length < 2 || !erster) continue
    const reihenName = reihenNameVon(erster, reihe, data)
    for (const m of reihe) {
      const t = data.titleById.get(m.id)
      if (!t) continue
      teile++
      const kopf = teilNameVon(t, reihenName, reihe)
      if (istNichtssagend(kopf)) offen.push(`${reihenName} | ${m.name} → „${kopf}"`)
    }
  }
  pruefe(`Kein Reihenteil heißt im Kopf nur „0", „2" oder „!" (${teile} Teile geprüft)`, offen.length === 0, offen.slice(0, 5))
}

if (verletzt) {
  console.error(`\n${verletzt} Zusicherung(en) verletzt.`)
  console.log(`VERSTÖSSE: ${verletzt}`)
  process.exit(1)
}
console.log('VERSTÖSSE: 0')
