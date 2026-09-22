/* Stichprobe: wie verteilen sich die Folgen einer Adresse auf unsere Titel? */
import { readFileSync } from 'node:fs'
const z = JSON.parse(readFileSync('data/folgen-zuordnung.json', 'utf8')) as Record<string, { titel?: number; folge?: number; grund: string }>
const zeilen = JSON.parse(readFileSync(process.argv[2]!, 'utf8'))[0].results as { plattform: string; asin: string | null; gti: string | null; url: string; titel: string; nummer: number }[]
const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = new Map((Array.isArray(roh) ? roh : roh.titles).map((t: { id: number }) => [t.id, t]))
for (const teil of process.argv.slice(3)) {
  const gesehen = new Set<string>()
  const je = new Map<string, number[]>()
  const bsp: string[] = []
  for (const r of zeilen) {
    if (!r.url.includes(teil)) continue
    const k = `${r.plattform}:${r.asin ?? r.gti}`
    if (gesehen.has(k)) continue
    gesehen.add(k)
    const e = z[k]
    const g = e?.titel ? `${e.titel} ${(titel.get(e.titel) as { titleDe?: string })?.titleDe ?? ''}` : `(${e?.grund})`
    je.set(g, [...(je.get(g) ?? []), e?.folge ?? 0])
    if (bsp.length < 4 && e?.folge) bsp.push(`  Prime Nr. ${r.nummer} „${r.titel}" → ${g} F${e.folge}`)
  }
  console.log(`\n${teil}: ${gesehen.size} Folgen`)
  for (const [g, f] of je) console.log(`  ${f.length}  ${g}  (Folgen ${Math.min(...f)}–${Math.max(...f)})`)
  console.log(bsp.join('\n'))
}
