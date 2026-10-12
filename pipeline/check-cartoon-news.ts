/**
 * Zusicherung zu `cartoonsAusReleases` (`bau/cartoon-kern.ts`): Cartoons mit Termin speisen `baueNews()`, und daraus
 * entstehen nur Termin-Meldungen mit Quelle — keine Anime-Meldung („neu mit Synchro", Messung, Folgen) greift auf sie.
 * Läuft auf den Erzeugnissen in `public/data/` (wie der Bau sie liest), deshalb in `check:bestand` (`tools/check-bestand-liste.txt`), nicht in `check:logic`.
 */
import { baueNews } from './lib/news.ts'
import { cartoonsAusReleases } from './bau/cartoon-kern.ts'
import { readJson } from './lib/util.ts'
import { istLink } from '../shared/quelle.ts'
import type { NewsEintrag, Release } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, bedingung: boolean, gefunden?: unknown) {
  if (bedingung) return console.log(`  ✓ ${name}`)
  fehler++
  console.error(`  ✗ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const TERMIN_ARTEN = new Set(['angekuendigt', 'nachgetragen', 'disc', 'kino'])
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

pruefe('Cartoons erzeugen Meldungen (sonst bliebe der Pfad unbelegt)', cartoons.length === 0 || vonCartoons.length > 0)
pruefe('jede Cartoon-Meldung hat eine Quelle (Link)', vonCartoons.every((x) => istLink(x.m.quelle)), vonCartoons.filter((x) => !istLink(x.m.quelle)).map((x) => x.m.art))
pruefe('jede Cartoon-Meldung hat Belege mit Adresse', vonCartoons.every((x) => (x.m.belege ?? []).length > 0 && (x.m.belege ?? []).every((b) => istLink(b.url))))
pruefe(
  'nur Termin-Arten: kein „neu mit Synchro", keine Folgen- oder Messmeldung',
  vonCartoons.every((x) => TERMIN_ARTEN.has(x.m.art)),
  [...new Set(vonCartoons.map((x) => x.m.art))],
)
pruefe('jede Cartoon-Meldung nennt das Release, aus dem sie stammt', vonCartoons.every((x) => releases.some((r) => r.slug === x.m.release)))

if (fehler) {
  console.error(`check-cartoon-news: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-cartoon-news: alles grün')
