/**
 * Gemeinsame Katalog-Regeln von OmU-Begleiter (`pipeline/bau/omu-synchro-begleiter.ts`) und Wache `tools/synchro-wartezeit.mjs`:
 * welcher Katalogblock zur Staffel gehört, welche Folgen datiert sind und welcher Berliner Tag zu einem UTC-Zeitstempel gehört.
 * Nur Node-Bordmittel — die Wache läuft im Deploy-Job `abschluss` ohne `npm ci`. Die Zuordnung Titel -> Staffelnummer
 * (`katalogStaffeln`) bleibt im Bau: sie liest Reihe und Beziehungsdateien von der Platte.
 */

/** „Staffel 3“ / „Season 3“ am Ende des Staffelnamens im Katalog. */
export const STAFFEL_IM_NAMEN = /(?:staffel|season)\s+(\d+)\s*$/i

/**
 * **Ein UTC-Zeitstempel wird zu Datum und Uhrzeit in Europe/Berlin.**
 *
 * Crunchyroll liefert `2023-11-18T21:30:00Z`. In Berlin ist das der 18.11. um
 * 22:30 (MEZ) — und im Sommer eine Stunde später. Wer nur `slice(0, 10)`
 * nimmt, verschiebt jeden Termin nach 22:00 UTC auf den Vortag; bei einer
 * Freitagsfolge um 23:30 UTC stünde im Kalender Freitag statt Samstag.
 *
 * Gerechnet wird über `Intl` (`shared/time.ts` hat keine Umrechnung von UTC-Zeitstempel in Datum und Uhrzeit,
 * `utcZeitInBerlin` kennt nur die Uhrzeit) — eine feste Stundenverschiebung wäre im Winter richtig und im Sommer falsch.
 */
export function nachBerlin(iso) {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return null
  const teile = new Intl.DateTimeFormat('de-DE', {
    timeZone: 'Europe/Berlin',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).formatToParts(d)
  const w = (art) => teile.find((t) => t.type === art)?.value ?? ''
  const datum = `${w('year')}-${w('month')}-${w('day')}`
  /* Mitternacht meldet `Intl` als „24" — für uns ist das 00:00 desselben Tages. */
  const stunde = w('hour') === '24' ? '00' : w('hour')
  return { datum, zeit: `${stunde}:${w('minute')}` }
}

/**
 * Der eine Katalogblock der Staffel, die zu einer der `nummern` passt, samt Serienadresse — `null`, wenn keiner oder mehrere passen.
 * @param {import('../pipeline/lib/crunchyroll-dub.ts').CrSerie[]} serien
 * @param {string} kennung
 * @param {number[]} nummern
 */
export function katalogBlock(serien, kennung, nummern) {
  const treffer = serien
    .filter((s) => s.katalog === 'de' && s.seriesId === kennung)
    .flatMap((s) => (s.staffeln ?? []).map((block) => ({ block, url: s.url })))
    .filter(({ block }) => nummern.includes(Number(STAFFEL_IM_NAMEN.exec(block.name)?.[1])))
    .filter(({ block }) => (block.deutscheFolgen ?? []).some((f) => f.verfuegbarAb))
  const namen = new Set(treffer.map((t) => t.block.name))
  return namen.size === 1 ? treffer[0] : null
}

/**
 * Die datierten deutschen Folgen eines Blocks mit Berliner Tag und Uhrzeit (`ms` = Zeitpunkt der Verfügbarkeit).
 * @param {import('../pipeline/lib/crunchyroll-dub.ts').CrStaffel} block
 */
export function datierteFolgen(block) {
  const raus = []
  for (const f of block.deutscheFolgen ?? []) {
    const b = f.verfuegbarAb ? nachBerlin(f.verfuegbarAb) : null
    if (b) raus.push({ tag: b.datum, zeit: b.zeit, laufend: f.laufend, ms: Date.parse(f.verfuegbarAb) })
  }
  return raus
}

/** Die Folgen ab dem Berliner Starttag des OmU-Termins (`firstEpisodeDate`); davor zählen sie nicht (`vorOmuStart`). */
export function folgenAbOmuStart(folgen, startTag) {
  return folgen.filter((f) => f.tag >= startTag)
}
