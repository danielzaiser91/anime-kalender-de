import { type Env } from './env.ts'

export async function berechnePruefstand({ env, antwort }: {
  env: Env
  antwort: (body: unknown, status?: number) => Response
}) {
      const { results } = await env.DB.prepare(
        `SELECT plattform, url, staffel FROM pruefung WHERE uebernommen = 0`,
      ).all<{ plattform: string; url: string; staffel: number | null }>()
      const gemeldeteAdressen = new Map<string, Set<string>>()
      for (const r of results ?? []) {
        if (!r.url) continue
        const dazu = gemeldeteAdressen.get(r.plattform) ?? new Set<string>()
        dazu.add(r.url)
        gemeldeteAdressen.set(r.plattform, dazu)
      }
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
       * Hier stand `SELECT DISTINCT plattform, url` ohne Zeitfilter: **jede**
       * jemals gemeldete Adresse galt als erledigt. Das war richtig, solange
       * eine Meldung je Adresse den ganzen Titel erledigte.
       *
       * Seit dem 10.09.2026 nennt die Prüfliste **einzelne Folgen** derselben
       * Adresse („S1 Folge 26", „S1 F13–15"). Eine Adresse, unter der schon
       * gemeldet wurde, kann also weiter offen sein — und genau das ist der
       * Normalfall bei Haikyu!!, Dorohedoro und Hi Score Girl.
       *
       * Die Folge sah Daniel am 10.09.2026: In der Statusanzeige stand nur
       * „Amazon 2 Suchen", während die Prüfliste fünf Aufgaben führte
       * („im todo stehen viel mehr meldungen etc die ich machen muss als im
       * status app als pill stehen"). Der Worker rechnete Netflix auf null und
       * Prime auf die zwei Suchen herunter — beide Male, weil unter jeder
       * Adresse irgendwann einmal etwas gemeldet worden war.
       *
       * **Der Zeitstempel des Prüfstands trennt es sauber.** Er entsteht beim
       * Datenbau, und alles davor hat der Bau bereits eingearbeitet: Führt er
       * die Adresse trotzdem als Ziel, ist dort noch etwas offen. Nur was
       * **danach** gemeldet wurde, ist die Überbrückung, für die dieser Abzug
       * gedacht war — die Lücke zwischen Meldung und nächstem Datenlauf.
       *
       * Ohne Zeitstempel (alter Prüfstand, kaputte Datei) bleibt es beim alten
       * Verhalten: lieber ein Ziel zu wenig als eins, das längst erledigt ist.
       */
      const seit = stand.erzeugtAm ?? null
      const { results: jemals } = seit
        ? await env.DB.prepare(
            `SELECT DISTINCT plattform, url, staffel FROM pruefung
             WHERE url IS NOT NULL AND url != '' AND gemeldet_am > ?1`,
          )
            .bind(seit)
            .all<{ plattform: string; url: string; staffel: number | null }>()
        : await env.DB.prepare(
            `SELECT DISTINCT plattform, url, staffel FROM pruefung WHERE url IS NOT NULL AND url != ''`,
          ).all<{ plattform: string; url: string; staffel: number | null }>()
      const jeGemeldet = new Map<string, Set<string>>()
      /** Je Adresse die Staffeln, zu denen seit dem Prüfstand gemeldet wurde (22.09.2026). */
      const staffelnGemeldet = new Map<string, Set<number>>()
      /*
        **Was noch im Briefkasten liegt, ist nie übernommen — es zählt immer** (22.09.2026). Der
        Zeitstempel allein trägt nicht: Ein lokal neu erzeugter Prüfstand setzte `erzeugtAm` auf
        jetzt, und Haikyu!! stand wieder als offen, obwohl alle 25 Meldungen unübernommen im
        Briefkasten lagen (Daniel: „dann änder das in prüfliste").
      */
      for (const r of [...(jemals ?? []), ...(results ?? []).filter((x) => x.url)]) {
        const dazu = jeGemeldet.get(r.plattform) ?? new Set<string>()
        dazu.add(r.url)
        jeGemeldet.set(r.plattform, dazu)
        if (typeof r.staffel === 'number') {
          const st = staffelnGemeldet.get(r.url) ?? new Set<number>()
          st.add(r.staffel)
          staffelnGemeldet.set(r.url, st)
        }
      }

      const anbieter = (stand.anbieter ?? []).map((roh) => {
        const a = roh as {
          name: string
          plattform: string
          offen: number
          gesamt: number
          gemeldet: number
          ohneSeite?: number
          suchAdressen?: string[]
          ziele?: { url: string; titel: string; staffeln?: number[] }[]
        }
        const unterwegs = gemeldeteAdressen.get(a.plattform) ?? new Set<string>()
        /*
          Ein Ziel, unter dem **seit dem Prüfstand** gemeldet wurde, ist
          erledigt — auch wenn der Datensatz es noch nicht weiß und der
          Briefkasten es schon abgegeben hat. Ältere Meldungen zählen nicht:
          Der Bau kennt sie, und wenn er die Adresse trotzdem führt, steht dort
          noch etwas aus (siehe oben).
        */
        const schonGemeldet = jeGemeldet.get(a.plattform) ?? new Set<string>()
        /*
          **Nennt das Ziel seine offenen Staffeln, ist es erst erledigt, wenn jede gemeldet ist**
          (22.09.2026). Sonst verschwand Dr. STONE nach der Meldung von Staffel 1 bis zur nächsten
          Übernahme aus der Prüfliste, obwohl Staffel 2 offen war. Ziele ohne Staffelangabe bleiben
          bei der Adresse.
        */
        const offeneZiele = (a.ziele ?? []).filter((z) => {
          if (!schonGemeldet.has(z.url)) return true
          if (!z.staffeln?.length) return false
          const gemeldet = staffelnGemeldet.get(z.url)
          return !z.staffeln.every((nr) => gemeldet?.has(nr))
        })
        /**
         * **Eine Suchadresse ist auch ein Ziel.**
         *
         * Daniel am 31.08.2026: „pill click in status app doesn't open next
         * item in prüfliste, it just opens storefront." Zu Recht — bei Prime
         * waren alle 100 offenen Aufträge Suchadressen, und die standen nur als
         * **Zahl** in `ohneSeite`. `ziele` blieb leer, `ziel` null, und die
         * Anzeige fiel auf die Startseite zurück.
         *
         * Die Adressen liegen längst vor — der Prüfstand schickt sie seit dem
         * 30.08.2026 als `suchAdressen` mit, damit hier die gemeldeten
         * abgezogen werden können. Sie hinten anzuhängen kostet nichts und gibt
         * der Pille ein Ziel: die nächste Suche, die noch niemand erledigt hat.
         *
         * Titelseiten stehen davor: Dort liest die Erweiterung selbst, bei
         * einer Suche muss der Treffer erst herausgesucht werden.
         */
        const offeneSuchen = (a.suchAdressen ?? [])
          .filter((u) => !schonGemeldet.has(u))
          .map((u) => ({ url: u, titel: '' }))
        const alleZiele = [...offeneZiele, ...offeneSuchen]
        return {
          name: a.name,
          plattform: a.plattform,
          gesamt: a.gesamt,
          /**
           * Staffeln, zu denen weder der Datensatz noch eine Meldung etwas hat.
           *
           * Abgezogen wird, was **jemals** gemeldet wurde, nicht nur das
           * Offene: Sonst wächst die Zahl nach jedem Datenlauf wieder an, weil
           * die übernommenen Meldungen aus dem Briefkasten verschwinden, bevor
           * der nächste Datenbau sie einarbeitet (30.08.2026).
           */
          offen: Math.max(0, a.offen - schonGemeldet.size),
          /** Adressen, die noch niemand gemeldet hat. */
          titel: offeneZiele.length,
          /** Was davon schon unterwegs ist. */
          unterwegs: unterwegs.size,
          /**
           * Verweise, für die niemand eine Titelseite kennt.
           *
           * Bei Prime sind das 117 Suchadressen — weder AniList noch aniSearch
           * führen für diese Titel eine Produktseite, und weder MOTN noch TMDB
           * kennen eine. Die Erweiterung zeigt auf der Suchseite, welcher Titel
           * gemeint ist; gesucht werden muss er trotzdem von Hand.
           *
           * Der Prüfstand zählt sie seit jeher, der Worker reichte sie nicht
           * weiter — die Anzeige schrieb deshalb „alles geprüft" für einen
           * Anbieter mit dreistelliger offener Arbeit (Daniel, 27.08.2026:
           * „wieso steht in status app oben keine klickbare pill?").
           */
          /*
            Abgezogen wird, was schon gemeldet ist — sonst zählt die Anzeige
            Arbeit mit, die längst getan ist.

            Am 30.08.2026 stand in der Statusanzeige „58 Suchen", in der
            Erweiterung im selben Moment „122 von 176 offen" (Daniel: „wieso die
            diskrepanz? es sollte synchron sein"). Zwei Ursachen hintereinander:
            Der Prüfstand rechnete die Suchaufträge selbst nach, statt die Liste
            zu zählen, die Daniel abarbeitet — und hier wurde nichts abgezogen.

            Beide sind behoben. `suchAdressen` trägt die Liste, `suchOffen()` in
            der Erweiterung macht dieselbe Rechnung.
          */
          ohneSeite: a.suchAdressen
            ? a.suchAdressen.filter((u) => !schonGemeldet.has(u)).length
            : (a.ohneSeite ?? 0),
          ziel: alleZiele[0]?.url ?? null,
          /*
            **Alle Ziele, nicht die ersten 25** (19.09.2026). Die Erweiterung hält
            für erledigt, was hier nicht steht (`fertig()` → `standZiele`). Mit
            `slice(0, 25)` zeigte sie bei 37 offenen Titeln „25 offen", die
            Statusanzeige 36 — und Peace Maker Kurogane, eben gemeldet, rückte
            nach dem Abzug aus der Liste und ein anderer Titel nach (Daniel: „25
            ist kurz auf 24 gesprungen, jetzt steht wieder 25"). Selbst 384 Ziele
            wären nur einige Dutzend KB.
          */
          ziele: alleZiele,
        }
      })
      return antwort({ anbieter, erzeugtAm: new Date().toISOString() })
}
