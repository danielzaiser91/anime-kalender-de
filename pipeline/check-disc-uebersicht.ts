/**
 * Abgleich der Anime2You-Monatsübersichten „Disc-Neuheiten" mit den Disc-Terminen im Kalender: Was die Übersicht nennt und der Kalender nicht kennt,
 * wird aufgelistet (Anlass 06.10.2026: vier KSM-Ultimate-Editions am 22.10. fehlten). Nur Auskunft, Exit 0 — übernommen wird von Hand, nach Prüfung von
 * Titel und Staffel.
 *
 * Aufruf: npx tsx pipeline/check-disc-uebersicht.ts [--holen]   (--holen liest die Übersichten live, sonst aus data/proposals/anime2you.json)
 */
import { readJson } from './lib/util.ts'
import { DISC_UEBERSICHT, discAbgleich, leseDiscUebersicht, type DiscZeile } from './lib/disc-uebersicht.ts'
import { todayIso } from '../shared/time.ts'

interface Vorschlag {
  articleUrl: string
  articleTitle: string
  discZeilen?: DiscZeile[]
}

async function zeilenHolen(v: Vorschlag, live: boolean): Promise<DiscZeile[]> {
  if (!live && v.discZeilen?.length) return v.discZeilen
  const res = await fetch(v.articleUrl, { headers: { 'User-Agent': 'Mozilla/5.0 (compatible; anime-kalender.de/1.0; +https://anime-kalender.de)' } })
  return res.ok ? leseDiscUebersicht(await res.text()) : []
}

async function main(): Promise<void> {
  const live = process.argv.includes('--holen')
  const alle = readJson<{ proposals?: Vorschlag[] }>('data/proposals/anime2you.json', {}).proposals ?? []
  const uebersichten = alle.filter((p) => DISC_UEBERSICHT.test(p.articleUrl))
  const releases = readJson<{ platform: string; name: string; schedule?: { firstEpisodeDate?: string }; widerlegt?: boolean }[]>('public/data/releases.json', [])
  const termine = releases.filter((r) => r.platform === 'disc' && !r.widerlegt && r.schedule?.firstEpisodeDate).map((r) => ({ name: r.name, datum: r.schedule!.firstEpisodeDate! }))
  const heute = todayIso()
  let gelesen = 0
  let fehlt = 0
  let abweichend = 0
  for (const u of uebersichten) {
    const zeilen = (await zeilenHolen(u, live)).filter((z) => z.datum >= heute)
    gelesen += zeilen.length
    for (const z of zeilen) {
      const r = discAbgleich(z, termine)
      if (r.art === 'gedeckt') continue
      if (r.art === 'fehlt') fehlt++
      else abweichend++
      console.log(`${r.art === 'fehlt' ? 'FEHLT   ' : 'ANDERER TAG (' + r.tag + ')'} ${z.datum} | ${z.titel} | ${z.label} | ${z.medium}`)
    }
  }
  console.log(`${uebersichten.length} Übersichten, ${gelesen} künftige Zeilen: ${fehlt} fehlen im Kalender, ${abweichend} stehen dort an einem anderen Tag (${termine.length} Disc-Termine).`)
}

await main()
