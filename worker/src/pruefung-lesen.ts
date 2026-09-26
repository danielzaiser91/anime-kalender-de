import { type Env } from './env.ts'

export async function beantwortePruefungLesen({ request, env, antwort, ausCache }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
  ausCache: (bauen: () => Promise<Response>, sekunden?: number) => Promise<Response>
}) {
    /**
     * **Nur zählen — das geht ohne Token.**
     *
     * Daniel am 26.08.2026, nachdem er einen Titel gemeldet hatte: „status app
     * still says 11 offen, even after reporting 1, should be 10 offen."
     *
     * Zwischen der Meldung und dem nächsten Datenlauf liegt bis zu eine Stunde.
     * Solange zeigt `pruefstand.json` den Stand von vorher — richtig für den
     * Datensatz, aber falsch für die Frage „habe ich das schon gemacht?".
     *
     * Diese Route liefert je Plattform, wie viele Meldungen im Briefkasten
     * liegen und noch nicht übernommen sind. Das ist eine Zahl, kein Inhalt:
     * kein Titel, keine Adresse, keine Tonspur. Deshalb braucht sie kein Token
     * — eines in einer Datei auf dem Schreibtisch wäre der schlechtere Handel.
     */
    /**
     * **Welche Folgen dieser Adresse schon gemeldet sind.**
     *
     * Daniel am 26.08.2026 über den lokalen Zähler der Erweiterung: „warum ist
     * das überhaupt notwendig, es sollte synchron zur remote liste sein, fix das
     * sodass die stände nie auseinander laufen können."
     *
     * Er hat recht: Ein Zähler im Browser ist eine zweite Fassung derselben
     * Wahrheit, und zwei Fassungen laufen auseinander. Nach einem Neuladen der
     * Erweiterung stand der lokale Stand auf null, obwohl zwölf Meldungen längst
     * hier lagen.
     *
     * Gefragt wird ohne Rücksicht auf `uebernommen`: Was einmal gemeldet wurde,
     * bleibt gemeldet — sonst wäre nach jedem Datenlauf alles wieder offen.
     *
     * Nur Folgennummern, keine Inhalte; deshalb ohne Token.
     */
    const fuer = new URL(request.url).searchParams.get('gemeldet')
    if (fuer) {
      /*
        **Nummer und Staffel gehören zusammen.**

        Der erste Anlauf gab nur die Folgennummern zurück. Bei Beyblade X waren
        S1E1-15 gemeldet — und weil jede Staffel bei Disney+ ab 1 zählt, hielt
        die Erweiterung damit auch S2E1-15 für erledigt und übersprang sie.
        Im Briefkasten landete Staffel 1 vollständig und Staffel 2 erst ab Folge
        16 (Daniel, 26.08.2026: „2e16? wo sind die ersten 15 von s2?").

        `nummern` bleibt für die Netflix-Seite, die eine durchlaufende Zählung
        hat; `paare` ist die genauere Auskunft.
      */
      /*
        **Mit Datum der letzten Meldung** (Daniel, 11.09.2026: „gemeldet (+datum
        wann zuletzt)"). Die Erweiterung zeigt je Folge genau einen Zustand, und
        „gemeldet" trägt sein Datum — auch für Folgen, die eine Stichprobe
        abgeleitet hat: Sie gehen als eigene Meldung ein und gelten wie gemessene.
      */
      /*
        `folge` ist bei Netflix die Kennung aus `/watch/<id>` — Player und
        Durchlauf schicken beide sie. Damit trifft die Erweiterung eine Folge
        exakt, ohne die Staffel zu kennen, und lernt nebenbei, welche Staffel
        auf der Titelseite geladen ist. `staffelBekannt` trennt eine gemeldete
        Staffel vom Ersatzwert 1, den `staffel` seit jeher trägt.
      */
      const { results } = await env.DB.prepare(
        `SELECT folge_nr, staffel, folge, MAX(gemeldet_am) AS am FROM pruefung
         WHERE url = ? AND folge_nr IS NOT NULL GROUP BY folge_nr, staffel, folge`,
      )
        .bind(fuer)
        .all<{ folge_nr: number; staffel: number | null; folge: string | null; am: string | null }>()
      const nummern = [...new Set((results ?? []).map((r) => r.folge_nr))]
      const paare = (results ?? []).map((r) => ({
        nummer: r.folge_nr,
        staffel: r.staffel ?? 1,
        staffelBekannt: r.staffel != null,
        folge: r.folge,
        am: r.am,
      }))
      return antwort({ nummern, paare })
    }

    /**
     * **Eine Zahl, eine Stelle, die sie rechnet.**
     *
     * Bis zum 26.08.2026 rechneten drei Stellen dasselbe aus verschiedenen
     * Quellen: die Statusanzeige aus `pruefstand.json` minus Briefkasten, die
     * Erweiterung ebenso, und ihre Liste aus dem lokalen Speicher. Das Ergebnis
     * war ein offener Widerspruch — der Knopf sagte „10 offen", die Liste
     * daneben „Alles geprüft", und beide hatten recht (Daniel: „wo sind die 10
     * einträge die es zu prüfen gilt?", danach: „single source of truth").
     *
     * Hier laufen beide Quellen zusammen: `pruefstand.json` sagt, was der
     * Datensatz noch nicht hat, die Datenbank, was davon schon unterwegs ist.
     * Wer die Zahl braucht, liest sie — niemand rechnet sie nach.
     *
     * Gezählt wird in **Staffeln**, wie im Prüfstand; `titel` nennt daneben die
     * Zahl der Adressen, damit eine Liste ihre eigene Länge belegen kann.
     */
    if (new URL(request.url).searchParams.get('stand') === '1') return ausCache(async () => {
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
    }, 60)

    /*
      **Die Rohfolgen für den Bau.**

      Die Zuordnung passiert nicht mehr im Browser, sondern hier gegen TMDB —
      dafür braucht der Bau, was die Erweiterung gesehen hat: Folgentitel,
      Erstausstrahlung, Laufzeit, Sprachen, je Folge.

      Wie bei `/pruefung` mit Token, und mit derselben Grenze: Was hier
      herauskommt, ist der Rohstoff eines Laufs, nicht eine Ansicht für
      Menschen.
    */
    if (new URL(request.url).searchParams.get('rohfolgen') === '1') {
      const token = new URL(request.url).searchParams.get('token') ?? ''
      if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) {
        return antwort({ error: 'Token fehlt oder stimmt nicht' }, 403)
      }
      /*
        **`titel_id` gehört mit heraus — sonst war die Spalte umsonst.**

        Migration 018 hat sie am 28.08.2026 angelegt, damit eine Meldung sagt,
        **zu welchem Eintrag unseres Bestands** sie gehört, statt dass der Bau es
        aus der Adresse erraten muss. Die Spalte wurde befüllt, im SELECT stand
        sie nie — der Bau hat sie also nie gesehen, und die Zuordnung lief
        weiter über die Adresse. Gemessen am 29.08.2026: 0 von 67 Adressen
        zugeordnet.

        **Und die Abfrage lässt sich fortsetzen.** 5.620 Folgen lagen offen,
        5.000 kamen heraus — 620 hätten den Bau nie erreicht. Eine Abfrage mit
        `LIMIT` beantwortet eine andere Frage als die gestellte (26.08.2026,
        damals kostete es zwei Einträge). `?nach=<id>` setzt dort fort, wo die
        letzte Seite endete; `gesamt` bleibt die ungekürzte Zahl.
      */
      /*
        **Probe: die jüngsten Rohfolgen eines Anbieters samt `roh`, auch übernommene.**

        Die Abfrage darunter gibt nur offene Zeilen heraus und ohne `roh` — beides
        mit Grund (Menge, Kontingent). Welche Felder Netflix je Folge liefert
        (Laufzeit? Datum?), war am 14.09.2026 damit nicht zu beantworten: Alle
        Netflix-Zeilen waren längst übernommen, und die Spalte kam nie heraus.
        Höchstens 5 Zeilen, nach Kennung absteigend — ein Index-Zugriff.
      */
      const probe = new URL(request.url).searchParams.get('probe')
      if (probe) {
        /*
          `&id=<n>` holt genau eine Zeile — Daniel am 15.09.2026: „sag mir aus
          gemeldetem stand was für ep 2 angekommen ist". Die jüngsten fünf
          reichen dafür nicht, sobald danach weitere Folgen kamen.
        */
        const id = Number(new URL(request.url).searchParams.get('id') ?? 0)
        const { results } = await (
          Number.isInteger(id) && id > 0
            ? env.DB.prepare(
                `SELECT id, url, nummer, titel, erschienen, dauer_sek, plattform, uebernommen, gemeldet_am, roh
                   FROM prime_folge WHERE id = ?1 AND plattform = ?2`,
              ).bind(id, probe.slice(0, 20))
            : env.DB.prepare(
                `SELECT id, url, nummer, titel, erschienen, dauer_sek, plattform, uebernommen, gemeldet_am, roh
                   FROM prime_folge WHERE plattform = ?1 AND roh IS NOT NULL ORDER BY id DESC LIMIT 5`,
              ).bind(probe.slice(0, 20))
        ).all()
        return antwort({ probe: results ?? [] })
      }
      const nach = Number(new URL(request.url).searchParams.get('nach') ?? 0)
      /*
        **`&alle=1`: jede Beobachtung, auch übernommene und gesperrte — für Stufe 2** (22.09.2026,
        `docs/konzept-meldungen-architektur.md`). Die Zuordnung je Plattform-Folge wird aus allen
        Beobachtungen neu berechnet, nicht aus den noch offenen. Ohne `roh` (Menge); fortsetzbar
        über `nach` wie unten. Gemessen am 22.09.2026: 10.976 Zeilen, drei Seiten.
      */
      /*
        **`&namen=1`: der Serienname je gemeldeter Adresse** (22.09.2026). 980 Folgen hatten keinen
        Kandidaten — die Adresse steht nicht im Bestand, `titel_id` fehlt. Die Meldung zur selben
        Adresse nennt die Reihe aber („Food Wars!" für B0CK66ZZ8G, 552 Folgen). Eine Abfrage mit
        GROUP BY, keine Unterabfrage je Zeile (Kontingent, siehe betrieb.md).
      */
      if (new URL(request.url).searchParams.get('namen') === '1') {
        const { results } = await env.DB.prepare(
          `SELECT url, MAX(titel) AS titel FROM pruefung WHERE titel IS NOT NULL AND url IS NOT NULL GROUP BY url`,
        ).all()
        return antwort({ namen: results ?? [] })
      }
      if (new URL(request.url).searchParams.get('alle') === '1') {
        const { results } = await env.DB.prepare(
          `SELECT id, plattform, url, asin, gti, nummer, titel, erschienen, staffel_nr, titel_id,
                  seiten_kennung, gemeldet_am, vorhanden, ton_de, sprachen
             FROM prime_folge WHERE id > ?1 ORDER BY id LIMIT 5000`,
        )
          .bind(Number.isFinite(nach) ? nach : 0)
          .all()
        const zeilen = (results ?? []) as { id: number }[]
        return antwort({ folgen: zeilen, weiter: zeilen.length === 5000 ? zeilen[zeilen.length - 1]!.id : null })
      }
      const { results } = await env.DB.prepare(
        /*
          **Der Serienname kommt aus der Meldung derselben Adresse.**

          `meldung_id` steht in der Tabelle, wurde aber nie gefüllt — bei allen
          795 offenen Zeilen ist sie leer (gemessen 01.09.2026). Der Weg über
          die Adresse trägt trotzdem: Zu jeder Rohfolge gibt es eine Meldung
          unter derselben URL, und die kennt den Namen.

          Gebraucht wird er, wo unser Bestand die Adresse nicht führt — Prime
          legt je Staffel eine eigene an, wir kennen eine. „Card Captor Sakura"
          lag deshalb mit 105 Folgen auf zwei Adressen unzugeordnet, obwohl der
          Titel im Bestand steht.
        */
        `SELECT f.id, f.url, f.asin, f.gti, f.nummer, f.titel, f.erschienen, f.dauer_sek,
                f.sprachen, f.untertitel, f.staffel_text, f.staffel_nr, f.gemeldet_am,
                f.titel_id, f.plattform, f.seiten_kennung,
                (SELECT p.titel FROM pruefung p
                  WHERE p.url = f.url AND p.titel IS NOT NULL
                  ORDER BY p.gemeldet_am DESC LIMIT 1) AS serientitel
           FROM prime_folge f
          WHERE f.uebernommen = 0 AND f.id > ?1
            AND (f.vorhanden IS NULL OR f.vorhanden <> 'nein')
          ORDER BY f.id
          LIMIT 5000`,
      )
        .bind(Number.isFinite(nach) ? nach : 0)
        .all()
      /* Die Gesamtzahl getrennt: Eine Abfrage mit LIMIT beantwortet eine andere
         Frage als die gestellte — das hat am 26.08.2026 zwei Einträge gekostet. */
      /* Gesperrte Folgen (`vorhanden = 'nein'`, Migration 035) liest erst Stufe 2 — bis dahin
         sähe der Zuordner ihre leeren Tonspuren als „kein Deutsch". Entfällt mit Stufe 2. */
      const gesamt = await env.DB.prepare(
        "SELECT COUNT(*) AS n FROM prime_folge WHERE uebernommen = 0 AND (vorhanden IS NULL OR vorhanden <> 'nein')",
      ).first<{ n: number }>()
      const zeilen = (results ?? []) as { id: number }[]
      return antwort({
        folgen: zeilen,
        gesamt: gesamt?.n ?? 0,
        /* Ist die Seite voll, steht die Fortsetzung dabei — sonst ausdrücklich null. */
        weiter: zeilen.length === 5000 ? zeilen[zeilen.length - 1]!.id : null,
      })
    }

    if (new URL(request.url).searchParams.get('zaehlen') === '1') return ausCache(async () => {
      /*
        **Die Adressen gehören dazu, nicht nur ihre Anzahl.**

        Daniel am 26.08.2026: „klick auf netflix pill führt zu dem titel den ich
        gerade vor dem letzten change reported habe … ich reporte, reloade,
        steht weiterhin 10."

        Die Prüfliste stammt vom letzten Datenlauf und kennt seine frischen
        Meldungen nicht — sie schickte ihn deshalb immer wieder zum selben
        Titel, und die zweite Meldung überschrieb nur die erste. Eine Zahl
        allein kann das nicht verhindern: Sie sagt, **dass** etwas gemeldet
        wurde, nicht **was**.

        Es sind öffentliche Titelseiten, keine persönlichen Angaben.
      */
      /*
        **Mit `nummern=1` kommen die Folgennummern mit.**

        Die Erweiterung zeigt in ihrer Liste je Titel, welche Folgen schon
        gemeldet sind — als Bereich („1e1-15"), nicht als Anzahl. Dafür genügt
        die Adresse nicht (Daniel, 26.08.2026: „bereits gemeldete folgen und
        fehlende meldungen werden ebenfalls nicht korrekt in der liste
        angezeigt").

        Ein Abruf für alle Titel statt einer je Titel: 31 Disney-Seiten wären
        sonst 31 Anfragen bei jedem Öffnen der Liste.
      */
      const mitNummern = new URL(request.url).searchParams.get('nummern') === '1'
      const { results } = await env.DB.prepare(
        `SELECT plattform, url, folge_nr, staffel FROM pruefung WHERE uebernommen = 0`,
      ).all<{ plattform: string; url: string; folge_nr: number | null; staffel: number | null }>()
      const je: Record<string, number> = {}
      const adressen: string[] = []
      const eintraege: { url: string; folge_nr: number | null; staffel: number | null }[] = []
      for (const r of results ?? []) {
        je[r.plattform] = (je[r.plattform] ?? 0) + 1
        if (!r.url) continue
        adressen.push(r.url)
        if (mitNummern) eintraege.push({ url: r.url, folge_nr: r.folge_nr, staffel: r.staffel })
      }
      /**
       * **„Liegt hier noch was?" ist nicht „wurde das gemeldet?"**
       *
       * `adressen` oben führt nur, was der Datenlauf noch nicht abgeholt hat
       * (`uebernommen = 0`). Die Erweiterung benutzte genau diese Liste, um zu
       * entscheiden, ob ein Titel abgehakt ist — mit der Folge, dass jede
       * übernommene Meldung ihren Titel wieder in die Prüfliste zurückholte.
       *
       * Daniel am 30.08.2026: „3.91 → alles gemeldet, warum eintrag immer noch
       * in liste?" Gemessen an „From Bureaucrat to Villainess": im Briefkasten
       * nicht mehr da, im Datensatz noch ohne Urteil — also gemeldet, geholt,
       * und trotzdem wieder offen. Nach jedem Datenlauf begann die Arbeit von
       * vorn.
       *
       * `gemeldet` beantwortet die Frage, die die Erweiterung wirklich stellt:
       * Ist unter dieser Adresse jemals etwas eingegangen? `DISTINCT`, weil je
       * Staffel und Folge mehrere Zeilen auf dieselbe Adresse zeigen.
       */
      const { results: alle } = await env.DB.prepare(
        `SELECT DISTINCT url FROM pruefung WHERE url IS NOT NULL AND url != ''`,
      ).all<{ url: string }>()
      const gemeldet = (alle ?? []).map((r) => r.url)
      /*
        **Und die Suchadressen, unter denen gemeldet wurde.**

        Ein Suchauftrag wird auf der Titelseite gemeldet; ohne dieses Feld erfährt
        die Erweiterung nie, dass die Suche erledigt ist, und muss sich auf einen
        lokalen Vermerk verlassen. Der ist nicht abgeglichen — wird die Meldung
        hier verworfen, sperrt er den Auftrag, und nur ein Konsolenbefehl half
        (02.09.2026, „Is This a Zombie?").
      */
      const { results: suchen } = await env.DB.prepare(
        `SELECT DISTINCT such_url FROM pruefung WHERE such_url IS NOT NULL AND such_url != ''`,
      ).all<{ such_url: string }>()
      const gemeldeteSuchen = (suchen ?? []).map((r) => r.such_url)
      /*
        **Und die Seiten, auf denen wirklich nachgesehen wurde.**

        Prime führt denselben Anime regelmäßig zweimal: über einen Kanal (aniverse,
        Crunchyroll) und als Kauftitel. Beide sind Antworten auf „wo kann ich das
        sehen", und nur die Meldung sagt uns, dass es sie gibt — vorher kennt der
        Bau höchstens eine Adresse.

        Ein Auftrag steuert, **was** zu prüfen ist. Er darf nicht verbieten, eine
        zweite Seite desselben Titels zu melden: Am 02.09.2026 war nach der
        Kauftitel-Meldung die aniverse-Meldung gesperrt, weil die Suchadresse als
        erledigt galt (Daniel: „nach kaufoption meldung ist aniverse meldung nicht
        mehr möglich"). Mit dieser Liste entscheidet die **Seite**, nicht der
        Auftrag.
      */
      /*
        **Gezählt wird seit dem Prüfstand — wie bei `?stand=1`.**

        Bis zum 15.09.2026 kamen hier die Seiten **aller** Meldungen. Eine Meldung,
        die der Bau eingearbeitet hat und die trotzdem kein Urteil ergab (eine
        Kanal-Meldung ohne Folgenbefund), sperrte ihre Seite damit für immer: Bei
        Touken Ranbu (`B0FQXKKXQW`) verschwand der Melde-Knopf, bei Nukitashi stand
        „gemeldet ✓" auf einem Titel, den die Prüfliste als offen führte. Die
        Ziele zählen seit dem 14.09. nur Meldungen nach `erzeugtAm`; die Seiten
        zählten weiter alles, und die Erweiterung zeigte zwei Stände zugleich.
        Ohne Prüfstand bleibt es beim alten Verhalten.
      */
      let seitStand: string | null = null
      try {
        const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
          cf: { cacheTtl: 60 },
        } as RequestInit)
        if (res.ok) seitStand = ((await res.json()) as { erzeugtAm?: string }).erzeugtAm ?? null
      } catch {
        /* Ohne Prüfstand zählen alle Meldungen. */
      }
      const { results: seiten } = await (seitStand
        ? env.DB.prepare(
            `SELECT DISTINCT seiten_kennung FROM pruefung
             WHERE seiten_kennung IS NOT NULL AND seiten_kennung != '' AND gemeldet_am > ?1`,
          ).bind(seitStand)
        : env.DB.prepare(
            `SELECT DISTINCT seiten_kennung FROM pruefung WHERE seiten_kennung IS NOT NULL AND seiten_kennung != ''`,
          )
      ).all<{ seiten_kennung: string }>()
      const gemeldeteSeiten = (seiten ?? []).map((r) => r.seiten_kennung)
      /* Die bestätigten Erwartungen — siehe Migration 026. */
      const { results: erw } = await env.DB.prepare(
        'SELECT such_url, kennungen FROM such_erwartung',
      ).all<{ such_url: string; kennungen: string }>()
      const erwartungen: Record<string, string[]> = {}
      for (const r of erw ?? []) {
        try {
          const l = JSON.parse(r.kennungen)
          if (Array.isArray(l) && l.length) erwartungen[r.such_url] = l
        } catch {
          /* Eine kaputte Zeile darf die Antwort nicht mitreißen. */
        }
      }
      return antwort(
        mitNummern
          ? { imBriefkasten: je, adressen, gemeldet, gemeldeteSuchen, gemeldeteSeiten, erwartungen, eintraege }
          : { imBriefkasten: je, adressen, gemeldet, gemeldeteSuchen, gemeldeteSeiten, erwartungen },
      )
    })

    // Die Pipeline holt sich, was noch nicht übernommen wurde.
    const sucheP = new URL(request.url).searchParams
    const token = sucheP.get('token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

    /*
      **Die Reihenfolge bleibt aufsteigend — daran hängt der Datenlauf.**

      `LIMIT 500` schneidet ab, und die Pipeline arbeitet die ältesten zuerst ab.
      Umgestellt auf absteigend hätte sie bei 562 Meldungen die ältesten 62 nie
      gesehen. Der Deckel ist für sie richtig; er ist nur keine Zählung.

      Zum Nachsehen einzelner Meldungen gibt es deshalb `?plattform=`. Am
      26.08.2026 verdeckten 558 Disney-Meldungen eine frische Prime-Meldung
      vollständig, und die Suche danach ging zweimal ins Leere.
    */
    /*
      **`?alle=1&nach=<id>`: jede Meldung, auch übernommene — für Stufe 3** (22.09.2026). Das Urteil
      je Folge wird aus allen Beobachtungen neu gerechnet, nicht aus den 500 offenen. Seitenweise wie
      bei den Rohfolgen; gemessen am 22.09.2026: 4.467 Zeilen, eine Seite.
    */
    if (sucheP.get('alle') === '1') {
      const nach = Number(sucheP.get('nach') ?? 0)
      const { results } = await env.DB.prepare(
        `SELECT id, plattform, url, befund, folge_nr, staffel, teil_von, teil_bis, titel_id, notiz,
                abos, gemeldet_am, vorhanden, ton_de, art
           FROM pruefung WHERE id > ?1 ORDER BY id LIMIT 5000`,
      )
        .bind(Number.isFinite(nach) ? nach : 0)
        .all()
      const zeilen = (results ?? []) as { id: number }[]
      return antwort({ pruefungen: zeilen, weiter: zeilen.length === 5000 ? zeilen[zeilen.length - 1]!.id : null })
    }

    const nurPlattform = sucheP.get('plattform')
    const abfrage = nurPlattform
      ? `SELECT id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln,
                serientitel, notiz, teil_von, teil_bis, gemeldet_am, seiten_kennung, titel_id, folge
           FROM pruefung WHERE uebernommen = 0 AND plattform = ?
           ORDER BY gemeldet_am LIMIT 500`
      : `SELECT id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln,
                serientitel, notiz, teil_von, teil_bis, gemeldet_am, seiten_kennung, titel_id, folge
           FROM pruefung WHERE uebernommen = 0
           ORDER BY gemeldet_am LIMIT 500`
    const stmt = env.DB.prepare(abfrage)
    const { results } = await (nurPlattform ? stmt.bind(nurPlattform) : stmt).all()

    return antwort({ pruefungen: results ?? [] })
}
