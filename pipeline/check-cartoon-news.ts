/**
 * Zusicherung zu `cartoonsAusReleases` (`bau/cartoon-kern.ts`): Cartoons mit Termin speisen `baueNews()`, und daraus
 * entstehen nur Termin-Meldungen mit Quelle (auch der belegte Folgenrhythmus) — keine Anime-Meldung („neu mit Synchro", Messung, Folgen) greift auf sie.
 * Läuft auf den Erzeugnissen in `public/data/` (wie der Bau sie liest), deshalb in `check:bestand` (`tools/check-bestand-liste.txt`), nicht in `check:logic`.
 */
import { baueNews } from './lib/news.ts'
import { CARTOON_NEWS_ARTEN, cartoonsAusReleases } from './bau/cartoon-kern.ts'
import { readJson } from './lib/util.ts'
import { belegLink, istLink } from '../shared/quelle.ts'
import { melde } from './lib/quarantaene.ts'
import type { NewsEintrag, Release } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const releases = readJson<Release[]>('public/data/releases.json', [])
const cartoons = cartoonsAusReleases(releases)
const ids = new Set(cartoons.map((c) => c.id))
console.log(`  ${cartoons.length} Cartoons mit Termin`)

pruefe('jeder dieser Cartoons hat einen Termin', cartoons.every((c) => releases.some((r) => r.titleId === c.id)))
pruefe('Cartoons tragen negative Kennungen (kein Anime darunter)', cartoons.every((c) => c.id < 0))

/* Wie 13-5-kerndateien: Anime-Titel plus Cartoons; hier nur die Cartoons, dazu die echte Liste „neu mit Synchro". */
const neuMitSynchro = readJson<{ id: number; seit: string }[]>('public/data/neu-mit-synchro.json', [])
const eintraege: NewsEintrag[] = baueNews(cartoons, releases, neuMitSynchro, [], { zuerst: {} })
const meldungen = eintraege.flatMap((e) => e.meldungen.map((m) => ({ m, titelId: m.teilId ?? e.titelId })))
const vonCartoons = meldungen.filter((x) => ids.has(x.titelId))

/** Die Cartoon-Meldungen, an denen `verletzt` zutrifft; ihre Cartoons werden gemeldet (das Quarantäne-Gate sperrt bei Cartoons und nennt sie). */
function verletzte(grund: string, verletzt: (x: (typeof vonCartoons)[number]) => boolean): typeof vonCartoons {
  const rot = vonCartoons.filter(verletzt)
  for (const id of new Set(rot.map((x) => x.titelId))) melde(id, 'cartoon-news', grund)
  return rot
}

pruefe('Cartoons erzeugen Meldungen (sonst bliebe der Pfad unbelegt)', cartoons.length === 0 || vonCartoons.length > 0)
const ohneQuelle = verletzte('Meldung ohne Quelle', (x) => !istLink(x.m.quelle))
pruefe('jede Cartoon-Meldung hat eine Quelle (Link)', !ohneQuelle.length, ohneQuelle.map((x) => x.m.art))
const ohneBelege = verletzte('Meldung ohne Belege mit Adresse', (x) => !((x.m.belege ?? []).length > 0 && (x.m.belege ?? []).every((b) => belegLink(b))))
pruefe('jede Cartoon-Meldung hat Belege mit Adresse', !ohneBelege.length, ohneBelege.map((x) => x.titelId))
pruefe(
  'nur Termin-Arten: kein „neu mit Synchro", keine Folgen- oder Messmeldung',
  vonCartoons.every((x) => CARTOON_NEWS_ARTEN.has(x.m.art)),
  [...new Set(vonCartoons.map((x) => x.m.art))],
)
pruefe('jede Cartoon-Meldung nennt das Release, aus dem sie stammt', vonCartoons.every((x) => releases.some((r) => r.slug === x.m.release)))

if (fehler) {
  console.error(`check-cartoon-news: ${fehler} Fehler`)
  console.log(`VERSTÖSSE: ${fehler}`)
  process.exit(1)
}
console.log('check-cartoon-news: alles grün')
console.log('VERSTÖSSE: 0')
