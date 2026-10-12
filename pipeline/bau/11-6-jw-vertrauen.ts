import { readJson, log } from '../lib/util.ts'
import { type Title } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { dubKey, type DubCheck } from '../lib/dub-confirmed.ts'
import { primeHakenOhneBeleg, primeTitelMitBeleg, type MeldungEintrag, type UrteilEintrag } from '../lib/haken-beleg.ts'
import { justwatchDeutsch, titelJeJustwatchKennung, type JwBefund } from '../lib/jw-vertrauen.ts'
import { brichAbBeiWiderspruch } from '../lib/bau-widerspruch.ts'

/**
 * **Prime-Wege ohne Urteil bekommen „Deutsch laut JustWatch", wo die Vertrauensregel greift.**
 *
 * Die Regel steht in `lib/jw-vertrauen.ts`. Hier wird nur zugeordnet: Herkunft (`dubQuelle`) und
 * Stand des Befunds (`dubStand`) kommen an den Weg, `dub` bleibt offen — es ist kein Beleg, und
 * Handbeleg, Messurteil und Anbieter-API behalten den Vorrang, weil sie `dub` schon gesetzt haben.
 * Ein Nein dieser Quellen (auch „nicht verfügbar") sperrt den Weg ausdrücklich.
 */
export function kennzeichneDeutschLautJustwatch({ titles, tmdbMehrdeutig, alleChecks }: {
  titles: Map<number, Title>
  tmdbMehrdeutig: Set<string>
  alleChecks: DubCheck[]
}) {
  const bestand = readJson<Record<string, JwBefund>>('data/justwatch-audio.json', {})
  const jeKennung = titelJeJustwatchKennung(bestand)
  const urteile = readJson<Record<string, { urteil?: string }>>('data/urteile.json', {})
  const nein = new Set<string>()
  for (const c of alleChecks) if (c.platform === 'primevideo' && (c.dub === false || c.available === false)) nein.add(dubKey(c.anilistId, c.platform))
  const heute = todayIso()
  let gekennzeichnet = 0
  for (const title of titles.values()) {
    const befund = bestand[String(title.id)]
    if (!befund || tmdbMehrdeutig.has(String(title.id))) continue
    const widerspruch =
      nein.has(dubKey(title.id, 'primevideo')) || urteile[`${title.id}|primevideo`]?.urteil === 'kein deutsch'
    for (const s of title.streams ?? []) {
      if (s.platform !== 'primevideo') continue
      const stand = justwatchDeutsch({
        url: s.url,
        dub: s.dub,
        befund,
        titelJeJwId: jeKennung.get(befund.jwId ?? '') ?? 0,
        widerspruch,
        heute,
      })
      if (!stand) continue
      s.dubQuelle = 'justwatch'
      s.dubStand = stand
      gekennzeichnet++
    }
  }
  if (gekennzeichnet) log(`${gekennzeichnet} Prime-Wege als „Deutsch laut JustWatch" gekennzeichnet`)
  bestehePrimeHakenNurMitBeleg({ titles, alleChecks })
}

/** Zusicherung: kein Prime-Weg trägt ein volles Häkchen ohne Handbeleg, Messurteil oder Meldung — sonst bricht der Bau ab. */
function bestehePrimeHakenNurMitBeleg({ titles, alleChecks }: { titles: Map<number, Title>; alleChecks: DubCheck[] }) {
  const urteile = readJson<Record<string, UrteilEintrag>>('data/urteile.json', {})
  const meldungen = readJson<Record<string, MeldungEintrag>>('data/prime-zugeordnet.json', {})
  const fehler = primeHakenOhneBeleg(titles.values(), primeTitelMitBeleg(alleChecks, urteile, meldungen))
  brichAbBeiWiderspruch(fehler, 'Prime-Wege mit vollem Häkchen ohne Beleg — nichts geschrieben.')
}
