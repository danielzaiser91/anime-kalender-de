/**
 * **Der Prüfstand als Auskunft: was noch zu melden ist.**
 *
 * Zwei Zeitpunkte stehen in der Antwort, und sie sind nicht dasselbe (01.10.2026):
 *
 * - `pruefstandAm` — wann `data/pruefstand.json` gebaut wurde. Das ist der **Maßstab** für „schon
 *   gemeldet": Nur eine Meldung **nach** dem Listenbau ist die Überbrückung bis zum nächsten
 *   Lauf; alles davor kennt der Bau längst. Die Erweiterung auf Disney+ nahm stattdessen das
 *   Eintragsdatum und blendete damit einen Titel aus, den die Liste weiterhin verlangt (Bleach:
 *   Meldung vom 27.09. mit Folgentiteln statt Nummern — der Prüfstand vom 30.09. will sie erneut).
 * - `erzeugtAm` — wann diese Antwort **gerechnet** wurde. Steht nur zur Anzeige da.
 */
import { type Env } from './env.ts'
import { rechneAnbieter, type Gemeldet } from './pruefung-stand-anbieter.ts'
import { holeWartende } from './pruefung-stand-briefkasten.ts'
import { gedeckteZiele, netflixZiele } from './pruefung-gedeckt.ts'
import { staffelnSeit } from './titelzeile-lesen.ts'

/** `bekannt` (höchste Folge laut Datensatz je Kennung, 4.24.21) kommt unverändert aus `pruefstand.json`. */
function bekanntDazu<T extends { plattform: string }>(anbieter: T[], roh: unknown[] = []) {
  const bekannt = new Map(
    (roh as { plattform: string; bekannt?: Record<string, number> }[]).map((r) => [r.plattform, r.bekannt]),
  )
  return anbieter.map((a) => (bekannt.get(a.plattform) ? { ...a, bekannt: bekannt.get(a.plattform) } : a))
}

type StandKontext = {
  env: Env
  antwort: (body: unknown, status?: number) => Response
  /** Cache der Edge und Schlüssel für die wartenden Meldungen; ohne beides (Tests) wird direkt gelesen. */
  zwischen?: Parameters<typeof holeWartende>[1]
}

export async function berechnePruefstand({ env, antwort, zwischen }: StandKontext) {
      const wartend = await holeWartende(env, zwischen)
      /**
       * **Übernommen ist nicht erledigt — jedenfalls nicht für den Prüfstand.**
       *
       * `pruefstand.json` entsteht beim Datenbau und nennt, was der Datensatz
       * noch nicht weiß. Abgezogen wurde bisher nur, was **offen** im
       * Briefkasten liegt. Zwischen der Übernahme einer Meldung und dem
       * nächsten Datenbau fällt eine Adresse damit durch beide Raster: im
       * Prüfstand noch offen, im Briefkasten nicht mehr da.
       *
       * Genau dort landete Daniel zweimal an einem Tag — die Amazon-Pille
       * schickte ihn auf einen Titel, den er längst gemeldet hatte (30.08.2026:
       * „klick auf amazon pill in status leitet mich erneut zu einem bereits
       * vollständig gemeldeten titel").
       *
       * Für die **Ziele** zählt deshalb jede jemals gemeldete Adresse. Die
       * Zahl `unterwegs` daneben bleibt bei den offenen: Sie beantwortet eine
       * andere Frage — was der nächste Datenlauf noch abholt.
       */
      let stand: { anbieter?: unknown[]; erzeugtAm?: string } = {}
      try {
        const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
          cf: { cacheTtl: 60 },
        } as RequestInit)
        if (res.ok) stand = (await res.json()) as { anbieter?: unknown[]; erzeugtAm?: string }
      } catch {
        /* Ohne Prüfstand bleibt die Briefkasten-Zahl — besser als keine. */
      }

      /**
       * **Abgezogen wird nur, was der Prüfstand noch nicht kennt.**
       *
       * Der Zeitstempel `erzeugtAm` entsteht beim Datenbau; alles davor hat der Bau eingearbeitet.
       * Führt er eine Adresse trotzdem als Ziel, ist dort noch etwas offen; nur was **danach**
       * gemeldet wurde, ist die Überbrückung bis zum nächsten Datenlauf. Ohne Zeitstempel (alter
       * Prüfstand) gilt das alte, strengere Verhalten — lieber ein Ziel zu wenig als eins zu viel.
       */
      const seit = stand.erzeugtAm ?? null
      const jemals = await staffelnSeit(env, seit)
      const jeGemeldet = new Map<string, Set<string>>()
      /** Je Adresse die Staffeln, zu denen seit dem Prüfstand gemeldet wurde (22.09.2026). */
      const staffelnGemeldet = new Map<string, Set<number>>()
      /*
        **Nur was nach dem Listenbau gemeldet wurde, erledigt ein Ziel** (29.09.2026). Der Prüfstand
        entsteht nach `data:build`; alles davor hat der Bau verarbeitet. Was danach kommt, ist die
        Brücke bis zum nächsten Lauf. Offene Briefkasten-Meldungen zählen für gewöhnliche Ziele mit,
        nicht für Wiedervorlagen (11.10.2026, `pruefung-stand-anbieter.ts`) — sie zogen Wiedervorlagen
        über ihren alten Beleg ab („7 statt 9", Daniel).
      */
      for (const r of jemals) {
        const dazu = jeGemeldet.get(r.plattform) ?? new Set<string>()
        dazu.add(r.url)
        jeGemeldet.set(r.plattform, dazu)
        if (typeof r.staffel === 'number') {
          const st = staffelnGemeldet.get(r.url) ?? new Set<number>()
          st.add(r.staffel)
          staffelnGemeldet.set(r.url, st)
        }
      }

      const gemeldet: Gemeldet = {
        unterwegs: wartend.adressen,
        wartendeStaffeln: wartend.staffeln,
        seitPruefstand: jeGemeldet,
        staffeln: staffelnGemeldet,
        gedeckt: await gedeckteZiele(env, netflixZiele(stand.anbieter)),
      }
      const anbieter = (stand.anbieter ?? []).map((roh) => rechneAnbieter(roh, gemeldet))
      return antwort({ anbieter: bekanntDazu(anbieter, stand.anbieter), erzeugtAm: new Date().toISOString(), pruefstandAm: seit })
}
