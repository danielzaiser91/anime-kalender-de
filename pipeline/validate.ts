/** Prüft die kuratierten Daten, bevor sie in einen Build wandern. */
import { loadCurated } from './lib/curated.ts'
import { log } from './lib/util.ts'
import { PLATFORMS, RELEASE_TYPES } from '../shared/types.ts'

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/
const TIME = /^\d{2}:\d{2}$/
const FSK = [0, 6, 12, 16, 18]

function main(): void {
  const entries = loadCurated()
  const errors: string[] = []
  const seen = new Set<string>()

  for (const e of entries) {
    const at = `"${e.slug ?? '(ohne slug)'}"`
    if (!e.slug) errors.push(`${at}: slug fehlt`)
    else if (seen.has(e.slug)) errors.push(`${at}: Slug doppelt vergeben`)
    else seen.add(e.slug)

    if (!(e.platform in PLATFORMS)) errors.push(`${at}: unbekannte Plattform "${e.platform}"`)
    if (!(e.releaseType in RELEASE_TYPES)) errors.push(`${at}: unbekannte releaseType "${e.releaseType}"`)
    if (!e.anilistId && !e.search) errors.push(`${at}: weder anilistId noch search gesetzt`)
    if (!e.sources?.length) errors.push(`${at}: keine Quelle angegeben`)
    if (e.fsk !== undefined && !FSK.includes(e.fsk)) errors.push(`${at}: ungültige FSK "${e.fsk}"`)

    const s = e.schedule
    if (!s?.firstEpisodeDate) {
      errors.push(`${at}: schedule.firstEpisodeDate fehlt`)
    } else {
      if (!ISO_DATE.test(String(s.firstEpisodeDate)))
        errors.push(`${at}: firstEpisodeDate "${s.firstEpisodeDate}" ist kein ISO-Datum in Anführungszeichen`)
      if (s.time && !TIME.test(s.time)) errors.push(`${at}: time "${s.time}" ist nicht HH:MM`)
      if (s.lastEpisodeDate && !ISO_DATE.test(String(s.lastEpisodeDate)))
        errors.push(`${at}: lastEpisodeDate ist kein ISO-Datum`)
      for (const d of s.skipDates ?? []) {
        if (!ISO_DATE.test(String(d))) errors.push(`${at}: skipDate "${d}" ist kein ISO-Datum`)
      }
      if (s.lastEpisodeDate && s.lastEpisodeDate < s.firstEpisodeDate)
        errors.push(`${at}: lastEpisodeDate liegt vor firstEpisodeDate`)
    }

    if (e.releaseType === 'disc' && e.platform !== 'disc')
      errors.push(`${at}: releaseType "disc" gehört zu platform "disc"`)
  }

  if (errors.length) {
    for (const err of errors) console.error('  ✖', err)
    console.error(`\n${errors.length} Fehler in den kuratierten Daten.`)
    process.exit(1)
  }
  log(`${entries.length} kuratierte Einträge, keine Fehler.`)
}

main()
