/**
 * Zusicherungen zur Vertrauensregel „Deutsch laut JustWatch" (Prime): jede Bedingung der Regel einzeln, dazu der Bestand
 * nach einem Bau — nur Prime, nie bei vorhandenem Urteil, nie bei Cartoons. Läuft in `check:logic`.
 */
import { existsSync } from 'node:fs'
import { readJson } from './lib/util.ts'
import { BEFUND_MAX_TAGE, justwatchDeutsch, titelJeJustwatchKennung, type JwBefund, type JwVertrauenEingabe } from './lib/jw-vertrauen.ts'
import { primeHakenOhneBeleg, primeTitelMitBeleg } from './lib/haken-beleg.ts'
import type { Title } from '../shared/types.ts'

let fehler = 0
function pruefe(name: string, ok: boolean, info = ''): void {
  if (!ok) {
    fehler++
    console.error(`FEHLER: ${name} ${info}`)
  }
}

const GTI = 'amzn1.dv.gti.8cbba00e-0d43-4c48-bdfa-437e5762c51d'
const ANDERE_GTI = 'amzn1.dv.gti.00000000-0000-0000-0000-000000000000'
const URL = `https://watch.amazon.de/detail?gti=${GTI}`
const angebot = (anbieter: string, audio: string[], gti = GTI) => ({
  anbieter,
  art: 'FLATRATE',
  audio,
  url: `https://watch.amazon.de/detail?gti=${gti}`,
})
const befund = (angebote: JwBefund['angebote'], zusatz: Partial<JwBefund> = {}): JwBefund => ({
  geprueftAm: '2026-10-01',
  jwId: 'ts1',
  jwPfad: '/de/Serie/x',
  angebote,
  ...zusatz,
})
const prime = (audio: string[]) => befund([angebot('Amazon Prime Video', audio)])
const eingabe = (zusatz: Partial<JwVertrauenEingabe> = {}): JwVertrauenEingabe => ({
  url: URL,
  dub: undefined,
  befund: prime(['de']),
  titelJeJwId: 1,
  widerspruch: false,
  heute: '2026-10-11',
  ...zusatz,
})
const gilt = (zusatz: Partial<JwVertrauenEingabe> = {}) => justwatchDeutsch(eingabe(zusatz)) !== undefined

pruefe('einzeln geführte Serie mit Deutsch an der Wegadresse gilt', justwatchDeutsch(eingabe()) === '2026-10-01')
pruefe('Film gilt auch bei geteilter Kennung', gilt({ titelJeJwId: 3, befund: befund([angebot('Amazon Prime Video', ['de'])], { jwPfad: '/de/Film/x' }) }))
pruefe('Mehrteiler (Serie, mehrere Titel) bekommt nichts', !gilt({ titelJeJwId: 2 }))
pruefe('Prime mit Werbung gilt', gilt({ befund: befund([angebot('Amazon Prime Video with Ads', ['de'])]) }))
pruefe('Amazon-Kanal gilt', gilt({ befund: befund([angebot('Aniverse Amazon Channel', ['de'])]) }))
pruefe('Amazon-Store (Kauf) gilt nicht', !gilt({ befund: befund([angebot('Amazon Video', ['de'])]) }))
pruefe('nur Originalton (audio ohne de, auch mit deutschen Untertiteln) gilt nicht', !gilt({ befund: prime(['ja']) }))
pruefe('keine Tonangabe gilt nicht', !gilt({ befund: prime([]) }))
pruefe('Deutsch bei einer anderen Adresse gilt nicht', !gilt({ befund: befund([angebot('Amazon Prime Video', ['de'], ANDERE_GTI)]) }))
pruefe('Weg ohne gti-Adresse gilt nicht', !gilt({ url: 'https://www.amazon.de/gp/video/detail/B09JLN6S1R' }))
pruefe('vorhandenes Urteil bleibt unberührt (ja)', !gilt({ dub: true }))
pruefe('vorhandenes Urteil bleibt unberührt (nein)', !gilt({ dub: false }))
pruefe('Widerspruch von Handbeleg oder Urteil sperrt', !gilt({ widerspruch: true }))
pruefe('Befund von vor 27 Tagen gilt', justwatchDeutsch(eingabe({ befund: { ...prime(['de']), geprueftAm: '2026-09-14' } })) === '2026-09-14')
pruefe(`Befund ab ${BEFUND_MAX_TAGE} Tagen gilt nicht`, !gilt({ befund: { ...prime(['de']), geprueftAm: '2026-09-13' } }))
pruefe('verfehlte Suche (alter Befund) gilt nicht', !gilt({ befund: { ...prime(['de']), verfehltAm: '2026-10-05' } }))
pruefe('ohne Treffer gilt nicht', !gilt({ befund: befund([], { ohneTreffer: true }) }))
pruefe('ohne Befund gilt nicht', !gilt({ befund: undefined }))
const jeKennung = titelJeJustwatchKennung({ a: befund([]), b: befund([]), c: befund([], { jwId: 'ts2' }), d: befund([], { jwId: undefined }) })
pruefe('Titel je JustWatch-Kennung zählt gleiche Kennungen', jeKennung.get('ts1') === 2 && jeKennung.get('ts2') === 1 && jeKennung.size === 2)

// Volles Häkchen bei Prime nur mit Handbeleg, Messurteil oder Meldung (der Bau bricht sonst ab, `11-6-jw-vertrauen.ts`).
const primeWeg = (id: number, dub?: boolean) => ({ id, titleRomaji: 'X', streams: [{ platform: 'primevideo', url: URL, dub }] }) as unknown as Title
const belege = (id: number) =>
  primeTitelMitBeleg(
    [{ anilistId: id, platform: 'primevideo', dub: true, checkedAt: '2026-10-01' }],
    { '2|primevideo|1': { urteil: 'deutsch' }, '9|primevideo|1': { urteil: 'kein deutsch' } },
    { a: { titleId: 3, plattform: 'primevideo', folgen: [{ sprachen: ['Deutsch'] }] } },
  )
const ohneBeleg = (id: number, dub?: boolean) => primeHakenOhneBeleg([primeWeg(id, dub)], belege(1)).length
pruefe('Haken mit Handbeleg gilt', ohneBeleg(1, true) === 0)
pruefe('Haken mit Messurteil gilt', ohneBeleg(2, true) === 0)
pruefe('Haken mit Meldung aus der angemeldeten Sitzung gilt', ohneBeleg(3, true) === 0)
pruefe('Haken ohne jeden Beleg wird gemeldet', ohneBeleg(4, true) === 1)
pruefe('Messurteil „kein deutsch" belegt kein Häkchen', ohneBeleg(9, true) === 1)
pruefe('Weg ohne Urteil (auch mit Umriss) ist kein Fehler', ohneBeleg(4, undefined) === 0)
const handNein = primeTitelMitBeleg([{ anilistId: 5, platform: 'primevideo', dub: false, checkedAt: '2026-10-01' }], {}, {})
pruefe('Hand-Nein ist kein Beleg für ein Häkchen', primeHakenOhneBeleg([primeWeg(5, true)], handNein).length === 1)

// Echter Bestand (nach einem Bau): nur Prime, nur offene Urteile, nur Adressen mit gti, nur der Hauptbestand.
const OUT = 'public/data/titles.json'
if (existsSync(OUT)) {
  const gekennzeichnet = readJson<Title[]>(OUT, []).flatMap((t) => (t.streams ?? []).filter((s) => s.dubQuelle).map((s) => ({ t, s })))
  pruefe('Bestand: nur Prime-Wege tragen die Kennzeichnung', gekennzeichnet.every(({ s }) => s.platform === 'primevideo'))
  pruefe('Bestand: kein Weg trägt Kennzeichnung und Urteil zugleich', gekennzeichnet.every(({ s }) => s.dub === undefined))
  pruefe('Bestand: Kennzeichnung nur auf JustWatch-Adressen mit Datum', gekennzeichnet.every(({ s }) => /[?&]gti=/.test(s.url) && /^\d{4}-\d\d-\d\d$/.test(s.dubStand ?? '')))
  pruefe('Bestand: nur Titel der Anime-Liste, nie Cartoons', gekennzeichnet.every(({ t }) => t.id > 0))
}

if (fehler) {
  console.error(`${fehler} Fehler`)
  process.exit(1)
}
console.log('check-jw-vertrauen: ok')
