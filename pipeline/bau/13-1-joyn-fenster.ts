import { log } from '../lib/util.ts'
import { type FolgenFenster, type Title, type Release } from '../../shared/types.ts'

/*
  **Joyn: Abruffenster je Folge aus den ProSieben-MAXX-Terminen** (22.09.2026).

  Joyn selbst lesen wir nicht (Impressum: TDM-Vorbehalt nach § 44b). Gemessen an der
  Dragon-Ball-Super-Seite (Folgen 108–127, docs/wissen/quellen.md): Eine Folge ist mit dem Sendeende
  auf ProSieben MAXX online und fällt heraus, wenn die Folge 20 Nummern später zu Ende gesendet
  ist, spätestens am 29. Tag nach der Ausstrahlung um 23:59. Daraus und aus den tv.de-Sichtungen
  (`releasesAusTvProgramm`, Nummern über die Wikipedia-Liste) entstehen die Fenster.

  **Eine Erstsichtung zwischen 0 und 5 Uhr ist kein Start.** Unser tv.de-Verlauf beginnt am
  19.09.2026; Folge 116–125 sahen wir zuerst im Nachtblock am 20.09., Joyn nennt für 116 aber den
  14.09. — die Nacht wiederholt. Solche Folgen bleiben ohne Fenster (die Pille zählt dann zu
  wenig, nie zu viel). Gemessen nur an ProSieben MAXX; andere Sender der Gruppe erst nach Messung.
*/
export function setzeJoynFenster(allTitles: Title[], releases: Release[]): void {
  const SENDER = new Set(['prosieben maxx'])
  const titelNachId = new Map(allTitles.map((t) => [t.id, t]))
  const plusTage = (tag: string, n: number) => new Date(Date.parse(tag + 'T12:00:00Z') + n * 86_400_000).toISOString().slice(0, 10)
  const plusMinuten = (ab: string, n: number) =>
    new Date(Date.parse(ab + ':00Z') + n * 60_000).toISOString().slice(0, 16)
  let joynFenster = 0
  const gemessen = new Map<number, Map<number, string>>()
  for (const r of releases) {
    if (r.platform !== 'tv' || !r.folgenBelegt || !SENDER.has((r.sender ?? '').toLowerCase())) continue
    const t = titelNachId.get(r.titleId)
    const joyn = (t?.streams ?? []).find((s) => s.platform === 'joyn')
    const beobachtet = r.schedule.observed ?? {}
    if (!joyn || !Object.keys(beobachtet).length) continue
    const zeit = (nr: number) => r.schedule.zeiten?.[nr] ?? r.schedule.time
    const start = new Map<number, string>()
    for (const [nr, tag] of Object.entries(beobachtet)) {
      const z = zeit(Number(nr))
      if (!z || Number(z.slice(0, 2)) < 5) continue
      start.set(Number(nr), `${tag}T${z}`)
    }
    const fenster: FolgenFenster[] = []
    for (const [nr, ab] of [...start].sort((a, b) => a[0] - b[0])) {
      const frist = `${plusTage(ab.slice(0, 10), 29)}T23:59`
      /* Nachfolger +20 gesendet: Ende mit dessen Sendeende (gemessen: je 25 Minuten nach Beginn). */
      const nachfolger = start.get(nr + 20)
      const ende = nachfolger && plusMinuten(nachfolger, 25) < frist ? plusMinuten(nachfolger, 25) : frist
      /*
        Abrufbar ab dem **Sendeende**, nicht dem Sendebeginn: Joyns `airdate` ist der TV-Termin.
        Gemessen 22.09.2026 (Daniel): 128 lief 17:05–17:30, fehlte um 17:25 und 17:28, war um 17:31 da.
      */
      const abrufbar = plusMinuten(ab, 25)
      fenster.push({ nr, ab: abrufbar, ende })
      merkeTag(gemessen, r.titleId, nr, abrufbar)
    }
    /*
      **Die 19 Folgen vor der ersten sicheren Sichtung** (Daniel, 22.09.2026: „die Folgen in der pill
      sind falsch" — „≈ Fg. 126–129", bei Joyn standen 110–129). Joyn hält die letzten 20 Folgen
      (bestätigt 22.09. 17:30: 108 fiel mit dem Sendeende von 128). Premieren laufen in
      Nummernfolge, also sind die 19 davor schon ausgestrahlt — wann genau, wissen wir nicht, wenn
      es vor unserem tv.de-Verlauf lag. Beginn ist dann „vor der ersten sicheren Sichtung", Ende
      das Sendeende von Folge +20, sonst höchstens 29 Tage nach der ersten sicheren Sichtung
      (obere Grenze; die Pille schreibt ohnehin „≈").
    */
    const erste = Math.min(...start.keys())
    const ersteAb = start.get(erste)
    if (ersteAb) {
      const obergrenze = `${plusTage(ersteAb.slice(0, 10), 29)}T23:59`
      const davor = `${plusTage(ersteAb.slice(0, 10), -1)}T00:00`
      for (let nr = Math.max(1, erste - 19); nr < erste; nr++) {
        const nachfolger = start.get(nr + 20)
        const ende = nachfolger && plusMinuten(nachfolger, 25) < obergrenze ? plusMinuten(nachfolger, 25) : obergrenze
        fenster.push({ nr, ab: davor, ende })
      }
      fenster.sort((a, b) => a.nr - b.nr)
    }
    if (!fenster.length) continue
    joyn.fenster = fenster
    joynFenster++
  }
  const belegt = belegeJoynTage(releases, gemessen)
  if (joynFenster) log(`${joynFenster} Joyn-Weg(e) mit Abruffenstern aus dem ProSieben-MAXX-Programm`)
  if (belegt) log(`${belegt} Joyn-Folgentag(e) aus den Abruffenstern belegt`)
}

function merkeTag(gemessen: Map<number, Map<number, string>>, titleId: number, nr: number, ab: string): void {
  const tage = gemessen.get(titleId) ?? new Map<number, string>()
  tage.set(nr, ab.slice(0, 10))
  gemessen.set(titleId, tage)
}

/*
  **Gemessene Joyn-Tage belegen die Folgen des Joyn-Termins** (09.11.2026, Daniel: „≈ 18:50“ bei Yaiba). Ein Joyn-Termin mit Sendetagen
  ohne Beobachtung gilt ab der zweiten Folge als fortgeschrieben (`terminGeschaetzt`), obwohl die Fenster Tag und Uhrzeit der auf
  ProSieben MAXX gesehenen Folgen belegen. Diese Folgen kommen in `observed`; spätere bleiben geschätzt. Nur Fenster aus Sichtungen
  (nicht die 19 Folgen vor der ersten), eine eigene Beobachtung bleibt. Gibt die Zahl der neu belegten Folgen zurück.
*/
export function belegeJoynTage(releases: Release[], gemessen: Map<number, Map<number, string>>): number {
  let neu = 0
  for (const r of releases) {
    const tage = gemessen.get(r.titleId)
    if (r.platform !== 'joyn' || r.widerlegt || !r.schedule || !tage) continue
    const observed = (r.schedule.observed ??= {})
    for (const [nr, tag] of tage) {
      if (observed[nr]) continue
      observed[nr] = tag
      neu++
    }
  }
  return neu
}
