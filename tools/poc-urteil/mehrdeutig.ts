/**
 * PoC Stufe 2, zweiter Schnitt — lösen Anbieter-Staffel und Folgennummer die mehrdeutigen Fälle?
 *
 * Nimmt die Beobachtungen mit mehreren Titeln an derselben Adresse und ordnet sie mit derselben
 * Funktion zu wie der Einleser (`ordneMeldungZu`, `lib/folgenbereiche.ts`), gegen Netflix'
 * Staffelaufteilung aus `data/anbieter-staffeln.json`. Schreibt nichts.
 *
 * Aufruf: npx tsx tools/poc-urteil/mehrdeutig.ts <beobachtungen.json>
 */
import { readFileSync } from 'node:fs'
import { ordneMeldungZu, type AnbieterStaffel, type Staffeleintrag } from '../../pipeline/lib/folgenbereiche.ts'
import { folgeUeberTitel, folgentitelAusNotiz } from '../../pipeline/lib/folgentitel-anker.ts'

const beobachtungen = JSON.parse(readFileSync(process.argv[2]!, 'utf8')) as Array<Record<string, any>>
const roh = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const titel = (Array.isArray(roh) ? roh : roh.titles) as Array<Record<string, any>>
const struktur = JSON.parse(readFileSync('data/anbieter-staffeln.json', 'utf8')) as Record<string, { staffeln?: AnbieterStaffel[] }>

const kern = (u: string) =>
  String(u ?? '').replace(/^https?:\/\/(www\.)?/, '').replace(/\/(gp\/video\/detail|dp)\//, '/').replace(/[?#].*$/, '').replace(/\/$/, '')
const JZ: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }
const jeAdresse = new Map<string, Array<Record<string, any>>>()
for (const t of titel) {
  for (const w of [...(t.streams ?? []), ...(t.watchLinks ?? [])]) {
    const k = kern(w.url)
    const liste = jeAdresse.get(k) ?? []
    if (!liste.includes(t)) liste.push(t)
    jeAdresse.set(k, liste)
  }
}

const frueher = new Map<string, Set<number>>()
{
  let id: number | null = null
  for (const zeile of readFileSync('data/dub-confirmed.yaml', 'utf8').split('\n')) {
    const neu = /^- anilistId: (\d+)/.exec(zeile)
    if (neu) id = Number(neu[1])
    const url = /^  url: (\S+)/.exec(zeile)?.[1]
    if (url && id) {
      const k = kern(url)
      if (!frueher.has(k)) frueher.set(k, new Set())
      frueher.get(k)!.add(id)
    }
  }
}
const abweichungen: string[] = []
const zaehl = new Map<string, number>()
const plus = (k: string) => zaehl.set(k, (zaehl.get(k) ?? 0) + 1)
for (const b of beobachtungen) {
  if (b.quelle !== 'erweiterung' || b.titelId != null) continue
  const kandidaten = jeAdresse.get(kern(b.url)) ?? []
  if (kandidaten.length < 2) continue
  const unsere: Staffeleintrag[] = [...kandidaten]
    .sort((a, c) => (a.jpYear ?? 0) - (c.jpYear ?? 0) || (JZ[a.jpSeason] ?? 0) - (JZ[c.jpSeason] ?? 0))
    .map((t) => ({ id: t.id, titel: t.titleRomaji ?? '', folgen: t.episodes ?? 0 }))
  const netflixId = /netflix\.com\/title\/(\d+)/.exec(b.url)?.[1]
  const anbieter = netflixId ? struktur[netflixId]?.staffeln : undefined
  if (b.anbieterFolge == null) {
    plus(`${b.anbieter} · staffelweit, ohne Folge — nicht auflösbar`)
    continue
  }
  if (!anbieter?.length) {
    plus(`${b.anbieter} · keine Anbieter-Staffelaufteilung bekannt`)
    continue
  }
  /* Wie der Einleser: zuerst der Folgentitel aus der Notiz, dann die Zählung (18.09.2026). */
  const anker = b.anbieter === 'netflix' ? folgeUeberTitel(folgentitelAusNotiz(b.notiz), unsere.map((u) => u.id)) : null
  if (anker) plus(`${b.anbieter} · über den Folgentitel`)
  const treffer = anker
    ? { staffel: unsere.find((u) => u.id === anker.id)!, folgeInStaffel: anker.nr }
    : ordneMeldungZu({ folge: b.anbieterFolge, staffel: b.anbieterStaffel }, unsere, anbieter)
  if (!treffer) {
    plus(`${b.anbieter} · nicht aufgelöst`)
    continue
  }
  /*
    Gegenprobe: Hat der Einleser für diese Adresse einen Beleg für denselben Titel geschrieben?
    Eine Kennung „Meldung → Titel" speichert er nicht — das ist schwächer als ein Einzelvergleich,
    fängt aber jede Zuordnung auf einen Titel, den er nie aus dieser Adresse bekommen hat.
  */
  const damals = frueher.get(kern(b.url))
  plus(
    `${b.anbieter} · aufgelöst · ` +
      (!damals?.size ? 'kein früherer Beleg zu dieser Adresse' : damals.has(treffer.staffel.id) ? 'Titel hat dort einen früheren Beleg' : 'WEICHT ab: Titel hat dort keinen früheren Beleg'),
  )
  if (damals?.size && !damals.has(treffer.staffel.id) && abweichungen.length < 8)
    abweichungen.push(`${b.ref} ${b.url} S${b.anbieterStaffel} F${b.anbieterFolge}: jetzt ${treffer.staffel.id}, früher ${[...damals].join(',')}`)
}
for (const [k, v] of [...zaehl].sort((a, b) => b[1] - a[1])) console.log(String(v).padStart(6), k)
for (const a of abweichungen) console.log('  ' + a)
