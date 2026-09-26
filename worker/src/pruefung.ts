import { type Env } from './env.ts'
import { ereignisSenden } from './ereignisse.ts'
import { zahlOderNull, jetztIso } from './werte.ts'

/**
 * Prüfergebnisse aus dem Browser entgegennehmen.
 *
 * Der Weg (Daniels Vorschlag, 21.08.2026): Er öffnet einen Titel beim Anbieter,
 * eine Chrome-Erweiterung blendet einen Knopf ein, der Klick schickt hierher,
 * was auf der Seite steht. Danach der nächste Titel.
 *
 * Warum das etwas anderes ist als ein Scraper: Die Seite hat **er** geöffnet.
 * `robots.txt` richtet sich an automatische Clients — ein Mensch mit einer
 * Erweiterung ist keiner. Ein Programm, das dieselben Adressen von sich aus
 * abklappert, wäre einer, und deshalb bleibt Netflix für uns gesperrt.
 *
 * CORS ist hier offen wie bei `/lauf`: Die Erweiterung läuft auf
 * `netflix.com`, nicht auf unserer Seite. Geschrieben wird nur mit Token.
 */
const PRUEFUNG_STAPEL_HOECHSTENS = 10

export async function handlePruefung(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const offen = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  /**
   * **Gelesene Zeilen sind das Kontingent — also wird nicht zweimal dasselbe gelesen.**
   *
   * Die beiden Übersichts-Endpunkte (`?zaehlen=1`, `?stand=1`) lesen je Aufruf
   * die **ganze** Tabelle `pruefung`: einmal die offenen Meldungen, einmal alle
   * je gemeldeten Adressen. Am 01.09.2026 waren das rund 6.900 Zeilen — und die
   * Erweiterung fragt im Minutentakt, aus jedem offenen Tab. Ein einziger Tab
   * kommt so auf **9,9 Millionen gelesene Zeilen am Tag**, bei einem
   * Tageskontingent von fünf.
   *
   * Genau das ist an dem Tag passiert (8,82 Mio., der Worker antwortete
   * stundenlang mit HTTP 500). Die Unterabfrage ohne Index war der Auslöser,
   * aber nicht die Ursache: Der Takt allein hätte es auch geschafft.
   *
   * Die Antwort ist für **alle** Fragenden dieselbe und ändert sich nur, wenn
   * jemand schreibt. Sie wird deshalb im Cache der Edge gehalten und bei **jedem**
   * Schreibzugriff verworfen (`briefkastenCacheLeeren`, angehängt an die
   * Weiterleitung) — ein frisch gemeldeter Titel steht also nicht weiter als
   * offen. Das ist der Fall, den Daniel am 01.09.2026 viermal melden musste; er
   * darf durch eine Sparmaßnahme nicht zurückkommen.
   *
   * **Deshalb ist die halbe Stunde keine Wartezeit.** Die Frische kommt aus dem
   * Verwerfen, nicht aus dem Ablaufen; die Dauer deckt nur den Fall ab, dass ein
   * Verwerfen ein anderes Rechenzentrum nicht erreicht. Bei fünf Minuten
   * blieben 2,0 Millionen gelesene Zeilen am Tag je offenem Tab — bei drei Tabs
   * wieder über dem Kontingent. Mit dreißig sind es 331.000.
   *
   * `caches.default` gilt je Rechenzentrum. Meldung und Abfrage kommen aus
   * demselben Browser, also aus demselben — für einen fremden Leser ist die
   * Antwort im schlimmsten Fall fünf Minuten alt, und das ist bei einer
   * Prüfliste folgenlos.
   */
  /**
   * **Und die Haltedauer gehoert zur Frage, nicht zum Endpunkt.**
   *
   * Bis zum 05.09.2026 hielten alle drei Uebersichts-Antworten eine halbe
   * Stunde. Fuer `?zaehlen=1` ist das richtig — dort liegt die teure Abfrage
   * (`SELECT DISTINCT url`, die ganze Tabelle), und die Frist ist der Grund,
   * warum das Tageskontingent haelt.
   *
   * Fuer `?stand=1` war es falsch, und zwar sichtbar: Die Zahl darin stammt aus
   * `pruefstand.json`, und die schreibt ein **Datenlauf**, kein Schreibzugriff
   * auf den Worker. Das Verwerfen haengt aber genau an den Schreibzugriffen
   * (`briefkastenCacheLeeren`). Nach einem Datenlauf zeigte die Statusanzeige
   * deshalb bis zu dreissig Minuten den Stand von davor: Am 05.09.2026 standen
   * vier neue Prime-Auftraege im Bestand, und in der App war die Leiste leer
   * (Daniel: „die prime auftraege muessen auch als pill in status app").
   *
   * Eine Minute deckt genau den Takt ab, in dem die Anzeige ohnehin fragt. Sie
   * ist billig: `?stand=1` liest nur die **offenen** Meldungen
   * (`WHERE uebernommen = 0`), nicht die ganze Tabelle — das ist der
   * Unterschied zu `?zaehlen=1`.
   */
  const ausCache = async (
    bauen: () => Promise<Response>,
    sekunden = 1800,
  ): Promise<Response> => {
    const schluessel = new Request(new URL(request.url).toString(), { method: 'GET' })
    const cache = caches.default
    const getroffen = await cache.match(schluessel)
    if (getroffen) return getroffen
    const frisch = await bauen()
    /* Nur erfolgreiche Antworten werden gehalten — ein Fehler soll sich nicht festsetzen. */
    if (frisch.status === 200) {
      const zumHalten = new Response(frisch.clone().body, frisch)
      zumHalten.headers.set('Cache-Control', `public, max-age=${sekunden}`)
      ctx?.waitUntil(cache.put(schluessel, zumHalten))
    }
    return frisch
  }

  if (request.method === 'GET') {
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

  if (request.method === 'DELETE') {
    /*
      Falsche Meldungen wirklich entfernen — nicht nur abhaken.

      Abhaken heißt „ein Lauf hat es eingearbeitet"; die Route `?gemeldet=`
      zählt solche Meldungen weiter, und das ist richtig. Was falsch war, muss
      dagegen verschwinden, sonst gilt eine Reihe als geprüft, die niemand
      geprüft hat.
    */
    const token = request.headers.get('X-Lauf-Token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
    let daten: { ids?: number[]; url?: string; nummern?: number[] }
    try {
      daten = (await request.json()) as { ids?: number[]; url?: string; nummern?: number[] }
    } catch {
      return antwort({ error: 'Kein gültiges JSON' }, 400)
    }
    if (Array.isArray(daten.ids) && daten.ids.length) {
      const platzhalter = daten.ids.map(() => '?').join(',')
      const ergebnis = await env.DB.prepare(`DELETE FROM pruefung WHERE id IN (${platzhalter})`)
        .bind(...daten.ids)
        .run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    /*
      Einzelne Folgen einer Adresse — für den Fall, dass nur ein Teil einer
      Reihe neu geprüft werden soll. Bei One Piece waren drei von achtzehn
      Meldungen aus Staffel 1; die übrigen fünfzehn gehören zu anderen
      Staffeln und sollten bleiben.
    */
    if (daten.url && Array.isArray(daten.nummern) && daten.nummern.length) {
      const platzhalter = daten.nummern.map(() => '?').join(',')
      const ergebnis = await env.DB.prepare(
        `DELETE FROM pruefung WHERE url = ? AND folge_nr IN (${platzhalter})`,
      )
        .bind(daten.url, ...daten.nummern)
        .run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    if (daten.url) {
      const ergebnis = await env.DB.prepare('DELETE FROM pruefung WHERE url = ?').bind(daten.url).run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    return antwort({ error: 'ids oder url erwartet' }, 400)
  }

  if (request.method !== 'POST') return antwort({ error: 'GET, POST oder DELETE erwartet' }, 405)

  const token = request.headers.get('X-Lauf-Token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

  let daten: Record<string, unknown>
  try {
    daten = (await request.json()) as Record<string, unknown>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

  /*
    **Ein Stapel: mehrere Meldungen in einer Anfrage** (Daniel, 25.09.2026: „alles gebündelt
    senden, statt jede erste letzte einer staffel zu senden, weil das senden so lange dauert").
    Die Randprobe einer Netflix-Staffel schickte je Folge eine Anfrage — 25 Folgen, 25 Rundreisen.

    Jedes Element läuft durch genau denselben Weg wie eine Einzelmeldung (derselbe Handler,
    gleichzeitig), damit es keine zweite Fassung der Annahme gibt. Ein Ereignis für alle.

    **Höchstens 10 je Stapel — eine Größengrenze, kein gemessenes Limit.** Die Doku nennt 50
    D1-Abfragen je Aufruf im kostenlosen Plan, jede `batch`-Anweisung einzeln gezählt
    (developers.cloudflare.com/d1/platform/limits, gelesen 25.09.2026). Das greift hier nicht:
    Eine Prime-Meldung vom 19.09.2026 schrieb 90 Rohfolgen in einem Aufruf, also rund 93
    Anweisungen (gezählt in `prime_folge`, 25.09.2026). Eine Netflix-Meldung braucht 4. Die
    Erweiterung schickt mehrere Stapel gleichzeitig, deshalb bringt eine höhere Grenze wenig.
  */
  if (Array.isArray(daten.stapel)) {
    const stapel = daten.stapel as unknown[]
    if (!stapel.length || stapel.length > PRUEFUNG_STAPEL_HOECHSTENS) {
      return antwort({ error: `stapel braucht 1 bis ${PRUEFUNG_STAPEL_HOECHSTENS} Meldungen` }, 400)
    }
    const ergebnisse = await Promise.all(
      stapel.map(async (einzeln) => {
        if (!einzeln || typeof einzeln !== 'object' || 'stapel' in einzeln) return { ok: false, status: 400 }
        const r = await handlePruefung(
          new Request(request.url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
            body: JSON.stringify(einzeln),
          }),
          env,
        )
        const inhalt = (await r.json().catch(() => ({}))) as { befund?: string }
        return r.ok ? { ok: true, befund: inhalt.befund ?? null } : { ok: false, status: r.status }
      }),
    )
    const erste = stapel[0] as Record<string, unknown>
    ctx?.waitUntil(ereignisSenden(env, 'pruefung', { plattform: String(erste?.plattform ?? 'unbekannt') }))
    return antwort({ ok: true, ergebnisse })
  }

  /**
   * Abhaken, was die Pipeline wirklich eingetragen hat.
   *
   * Vorher markierte der Abruf selbst alles Gelieferte als übernommen — auch
   * eine Meldung, die sich nicht zuordnen ließ. Die war damit still verloren
   * (22.08.2026). Jetzt sagt die Pipeline, was angekommen ist.
   */
  /*
      **Abgehakt ist nicht dasselbe wie eingearbeitet.**

      Am 26.08.2026 hakte der Uebernahme-Lauf 508 Disney-Meldungen ab und
      schrieb daraus einen einzigen Eintrag. Die uebrigen liessen sich nicht
      zuordnen — falsche Adresse im Bestand, abweichende Staffelzahlen — und
      verschwanden trotzdem aus dem Briefkasten. Daniels Arbeit eines ganzen
      Abends war damit unerreichbar.

      Die Zeilen stehen noch in der Datenbank; nur `uebernommen` trennt sie vom
      Briefkasten. Diese Route dreht das zurueck, damit ein berichtigter Lauf
      sie erneut sieht.

      Sie ist ein Werkzeug fuer den Notfall, kein Teil des Ablaufs: Ohne Angabe
      von Plattform und Datum tut sie nichts.
    */
    if (daten.reoeffnen && typeof daten.reoeffnen === 'object') {
      const { plattform, seit } = daten.reoeffnen as { plattform?: string; seit?: string }
      if (!plattform || !seit) return antwort({ error: 'plattform und seit noetig' }, 400)
      const { meta } = await env.DB.prepare(
        `UPDATE pruefung SET uebernommen = 0
           WHERE uebernommen = 1 AND plattform = ? AND gemeldet_am >= ?`,
      )
        .bind(plattform, seit)
        .run()
      return antwort({ ok: true, reoeffnet: meta?.changes ?? 0 })
    }

  /**
   * **Rohfolgen abhaken — sonst wächst die Tabelle für immer.**
   *
   * `pruefung` kennt das seit jeher, `prime_folge` nicht: Der Bau ordnet die
   * Folgen zu, schreibt das Ergebnis ins Repo — und die Zeilen bleiben auf
   * `uebernommen = 0` stehen. Am 29.08.2026 holte jeder Lauf dieselben 5.633
   * Zeilen erneut, davon 3.569 Dubletten aus einem behobenen Fehler.
   *
   * Abgehakt wird, was **zugeordnet** ist. Der Beleg dafür steht committet in
   * `data/prime-zugeordnet.json`; ein Baufehler danach verliert also nichts.
   * Was sich nicht zuordnen ließ, bleibt offen — das ist die Warteschlange, und
   * sie soll bestehen bleiben, bis ein Anker dazukommt.
   */
  if (Array.isArray(daten.rohfolgenUebernommen)) {
    const ids = (daten.rohfolgenUebernommen as unknown[])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
    if (!ids.length) return antwort({ ok: true, markiert: 0 })
    /* Dieselbe Stapelgrenze wie unten: D1 bindet höchstens 100 Werte je Anfrage. */
    const STAPEL = 50
    for (let i = 0; i < ids.length; i += STAPEL) {
      const teil = ids.slice(i, i + STAPEL)
      await env.DB.prepare(
        `UPDATE prime_folge SET uebernommen = 1 WHERE id IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(...teil)
        .run()
    }
    return antwort({ ok: true, markiert: ids.length })
  }

  if (Array.isArray(daten.uebernommen)) {
    const ids = (daten.uebernommen as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (!ids.length) return antwort({ ok: true, markiert: 0 })

    /**
     * In Stapeln, nicht in einem Rutsch.
     *
     * D1 begrenzt die gebundenen Werte je Anfrage auf 100. Am 23.08.2026
     * schickte ein Lauf 107 Kennungen und bekam HTTP 500 zurück — die Meldung
     * lautete „sie kommen beim nächsten Lauf erneut", und genau das war das
     * Problem: Was nicht abgehakt wird, wird erneut geholt, erneut
     * geschrieben und scheitert erneut. Der Briefkasten wächst, bis jeder
     * Lauf über dieselbe Grenze stolpert.
     *
     * 50 je Stapel lässt Luft, falls die Grenze je enger wird.
     */
    const STAPEL = 50
    for (let i = 0; i < ids.length; i += STAPEL) {
      const teil = ids.slice(i, i + STAPEL)
      await env.DB.prepare(
        `UPDATE pruefung SET uebernommen = 1 WHERE id IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(...teil)
        .run()
    }
    return antwort({ ok: true, markiert: ids.length })
  }

  /*
    **Welche Ausgaben zu einem Suchauftrag gehören — vom Menschen bestätigt.**

    Prime führt denselben Anime regelmäßig zweimal (Kanal-Abo und Kauftitel).
    Welche Karten dasselbe Werk meinen, sieht nur ein Mensch; er kreuzt sie auf
    der Trefferliste an, und der Auftrag gilt erst als erledigt, wenn jede
    gemeldet ist.

    Das gehört hierher, nicht in den Browser: Der erste Anlauf legte es in
    `sessionStorage` ab und war nach einem Neuladen weg (02.09.2026). Daniels
    Regel vom 28.08.2026: „kein localstorage dafür … single source of truth."
  */
  /*
    **Vor der Pflichtfeld-Prüfung — eine Erwartung hat keine `url`.**

    Der erste Einbau stand hinter `if (!url) return`, und der Worker antwortete
    mit „url fehlt": Die Bestätigung meldet keinen Befund zu einer Adresse,
    sondern welche Ausgaben zusammengehören. Am Knopf stand deshalb „Auswahl
    bestätigen — nicht angekommen" (Daniel, 02.09.2026), und die Anzeige war
    ehrlich: Es kam wirklich nichts an.
  */
  if (daten.erwartung && typeof daten.erwartung === 'object') {
    const e = daten.erwartung as { suchUrl?: unknown; kennungen?: unknown }
    const suchUrl = e.suchUrl ? String(e.suchUrl).slice(0, 500) : null
    if (suchUrl) {
      const liste = Array.isArray(e.kennungen)
        ? e.kennungen.map((k) => String(k).slice(0, 40)).filter(Boolean).slice(0, 20)
        : []
      if (liste.length) {
        await env.DB.prepare(
          `INSERT INTO such_erwartung (such_url, kennungen, gesetzt_am) VALUES (?1, ?2, ?3)
           ON CONFLICT(such_url) DO UPDATE SET kennungen = ?2, gesetzt_am = ?3`,
        )
          .bind(suchUrl, JSON.stringify(liste), new Date().toISOString())
          .run()
      } else {
        /* Leere Liste heißt zurücknehmen — das ↺ neben dem Bestätigen-Knopf. */
        await env.DB.prepare('DELETE FROM such_erwartung WHERE such_url = ?1').bind(suchUrl).run()
      }
      return antwort({ ok: true, erwartung: liste.length })
    }
  }

  const url = String(daten.url ?? '').trim()
  if (!url) return antwort({ error: 'url fehlt' }, 400)
  /*
    **Stufe 1 des neuen Modells: Verfügbarkeit und Sprache getrennt** (22.09.2026,
    docs/konzept-meldungen-architektur.md). Die Erweiterung schickt `vorhanden`, `ton_de`, `art`;
    ältere Fassungen schicken nur `befund`. Beides wird angenommen, und das jeweils andere abgeleitet:
    `befund` braucht der heutige Einleser.
    **Befristet:** Die Ableitung von `befund` entfällt, sobald Stufe 2 den Einleser ersetzt; die
    Annahme des alten `befund` entfällt, sobald alle Erweiterungen ≥ 4.21.0 melden.
  */
  let vorhanden = daten.vorhanden != null ? String(daten.vorhanden).trim() : ''
  let tonDe = daten.ton_de != null ? String(daten.ton_de).trim() : ''
  let art = daten.art != null ? String(daten.art).trim() : ''
  let befund = String(daten.befund ?? '').trim()
  if (vorhanden) {
    if (!['ja', 'nein'].includes(vorhanden)) return antwort({ error: 'vorhanden muss ja oder nein sein' }, 400)
    if (vorhanden === 'nein') tonDe = 'unbekannt'
    if (!['ja', 'nein', 'unbekannt'].includes(tonDe)) return antwort({ error: 'ton_de muss ja, nein oder unbekannt sein' }, 400)
    /* Eine vorhandene Folge ohne Sprachauskunft ist eine Störung, keine Beobachtung (Szenario 10). */
    if (vorhanden === 'ja' && tonDe === 'unbekannt') return antwort({ error: 'vorhanden ja braucht ton_de ja oder nein' }, 400)
    if (!art) art = 'gemessen'
    if (!['gemessen', 'angenommen'].includes(art)) return antwort({ error: 'art muss gemessen oder angenommen sein' }, 400)
    befund = vorhanden === 'nein' ? 'weg' : tonDe === 'ja' ? 'dub' : 'kein_dub'
  } else {
    if (!['dub', 'kein_dub', 'weg'].includes(befund)) {
      return antwort({ error: 'befund muss dub, kein_dub oder weg sein' }, 400)
    }
    vorhanden = befund === 'weg' ? 'nein' : 'ja'
    tonDe = befund === 'weg' ? 'unbekannt' : befund === 'dub' ? 'ja' : 'nein'
    art = /ANGENOMMEN/.test(String(daten.notiz ?? '')) ? 'angenommen' : 'gemessen'
  }

  /**
   * Wird derselbe Titel zweimal geschickt, gilt der jüngere Blick.
   *
   * **Die Staffel gehört in die Bedingung.** Amazon führt Sammelseiten: Unter
   * `B0GFPBT6FG` liegen alle drei Staffeln von „Oshi no Ko", unterschieden
   * allein durch den Verweis-Parameter (gemessen 23.08.2026). Ohne die
   * Staffel löschte eine Meldung für Staffel 3 die für Staffel 1 — ein Befund
   * verschwände, ohne dass es jemandem auffällt.
   *
   * `IS` statt `=`, weil SQLite bei `NULL = NULL` nichts liefert und die
   * allermeisten Meldungen gar keine Staffelangabe tragen.
   */
  const folgeNr = zahlOderNull(daten.folge_nr)
  const staffelNr = zahlOderNull(daten.staffel)
  /**
   * **Die Seitenkennung gehört in die Ersetzungs-Bedingung.**
   *
   * `url` ist die Adresse aus der Prüfliste — dieselbe für beide Ausgaben eines
   * Titels. Prime führt aber regelmäßig zwei, und sie sind verschiedene
   * Angebote: „My First Girlfriend is a Gal" liegt als Kauftitel mit 11 Folgen
   * und FSK 16 (die KAZÉ-Fassung samt OVA) und über den Crunchyroll-Kanal mit
   * 10 Folgen und FSK 18, mit völlig anderen Folgentiteln (Daniel, 30.08.2026).
   *
   * Ohne diese Bedingung löscht die zweite Meldung die erste, und im Briefkasten
   * bleibt nur eine der beiden Ausgaben übrig.
   *
   * `IS` statt `=`, aus demselben Grund wie bei der Staffel: Ältere Meldungen
   * tragen keine Kennung, und `NULL = NULL` liefert in SQLite nichts.
   */
  const seitenKennung = typeof daten.seiten_kennung === 'string' ? daten.seiten_kennung : null
  await env.DB.prepare(
    folgeNr === null
      ? 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr IS NULL AND staffel IS ?2 AND seiten_kennung IS ?3'
      : 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr = ?2 AND staffel IS ?3 AND seiten_kennung IS ?4',
  )
    .bind(
      ...(folgeNr === null ? [url, staffelNr, seitenKennung] : [url, folgeNr, staffelNr, seitenKennung]),
    )
    .run()

  await env.DB.prepare(
    /*
      **`titel_id` sagt, für welchen Auftrag gemeldet wurde — die Adresse sagt es nicht.**

      Anbieter führen denselben Anime unter mehreren Kennungen; wer aus der
      Prüfliste heraus öffnet, weiß trotzdem, welcher Titel gemeint war. Ohne
      dieses Feld musste der Bau die Adresse im Datensatz suchen und fiel sonst
      auf einen Namensvergleich zurück, der ausdrücklich kein Beleg ist — am
      02.09.2026 warteten so 36 Meldungen auf Daniels Bestätigung.
    */
    `INSERT INTO pruefung (plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln, serientitel, notiz, gemeldet_am, zugang, abos, teil_von, teil_bis, seiten_kennung, titel_id, such_url, folge, vorhanden, ton_de, art)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)`,
  )
    .bind(
      String(daten.plattform ?? 'unbekannt'),
      url,
      daten.sprachen ? JSON.stringify(daten.sprachen) : null,
      befund,
      daten.titel ? String(daten.titel).slice(0, 200) : null,
      zahlOderNull(daten.folgen),
      // Die Nummer der Folge, auf die sich die Meldung bezieht — daraus bildet
      // die Auswertung Bereiche, statt eine ganze Reihe über einen Kamm zu
      // scheren.
      zahlOderNull(daten.folge_nr),
      staffelNr,
      // Die Aufteilung des Anbieters, als JSON — sie ist der Schlüssel, um die
      // Meldung später einer unserer Staffeln zuzuordnen.
      daten.staffeln ? JSON.stringify(daten.staffeln).slice(0, 4000) : null,
      daten.serientitel ? String(daten.serientitel).slice(0, 200) : null,
      daten.notiz ? String(daten.notiz).slice(0, 500) : null,
      jetztIso(),
      /**
       * Zugangsart und Abos, wie die Seite sie beim Melden auswies.
       *
       * Beides liest die Erweiterung längst aus und zeigt es auf dem Knopf an;
       * abgeschickt wurde es bisher nicht. Bei Prime nennt keine öffentliche
       * Quelle die Zugangsart — deshalb standen dort am 24.08.2026 alle 203
       * Suchadressen auf „Mit Abo", ohne dass es jemand geprüft hatte.
       *
       * Kein Wertebereich erzwungen: Eine Meldung, die an einer Schema-Prüfung
       * scheitert, ist schlechter als eine mit unbekanntem Wert. Die Pipeline
       * entscheidet, was sie damit anfängt.
       */
      daten.zugang ? String(daten.zugang).slice(0, 40) : null,
      daten.abos ? JSON.stringify(daten.abos).slice(0, 1000) : null,
      /*
        Welchen Teil der Anbieter-Liste diese Meldung meint — bei einer Reihe,
        die dort gebündelt liegt. Fehlt im Normalfall.
      */
      zahlOderNull(daten.teil_von),
      zahlOderNull(daten.teil_bis),
      /* Die Seite, auf der wirklich gelesen wurde — trennt zwei Ausgaben desselben Titels. */
      seitenKennung,
      zahlOderNull(daten.titelId ?? daten.titel_id),
      /* Die Suchadresse, unter der der Auftrag stand — siehe Migration 025. */
      daten.suchUrl ? String(daten.suchUrl).slice(0, 500) : null,
      /**
       * **Der Folgentitel — seit Migration 028, und er war die ganze Zeit da.**
       *
       * `melder.js` setzt `folge: stand.folge` in jede Meldung; bei Haikyu!!
       * Staffel 1 Folge 26 steht dort „Haikyu! OVA". Gespeichert wurde er nie —
       * erhoben, übertragen, beim Empfang verworfen.
       *
       * Er ist der Anker, den Nummern nicht ersetzen können: Ein Anbieter mischt
       * Nebenausgaben in seine Staffeln, und über Folgenzahlen allein sind zwei
       * Zerlegungen mit derselben Summe nicht zu unterscheiden (am 10.09.2026
       * real passiert, vier falsche Belege). Ein Wort im Titel entscheidet es.
       */
      daten.folge ? String(daten.folge).slice(0, 200) : null,
      /* Stufe 1 (22.09.2026): Verfügbarkeit, Sprache, gemessen oder angenommen — getrennt. */
      vorhanden,
      tonDe,
      art,
    )
    .run()

  /*
    **Die Folgen selbst, roh und ohne Deutung.**

    Bis 3.76 meldete die Erweiterung ein Urteil und warf die Grundlage weg — die
    Folgentitel, Erstausstrahlungsdaten und Laufzeiten, die sie längst gelesen
    hatte. Jede spätere Frage war damit unbeantwortbar, und genau deshalb musste
    sie im Browser entscheiden, was sich dort nicht entscheiden lässt.

    `daten.rohfolgen` ist der neue Weg. Er kommt **neben** dem alten Format an,
    nicht statt seiner: Eine Erweiterung, die ihn noch nicht schickt, meldet
    weiter wie bisher.

    Gespeichert wird ohne Prüfung auf Sinn. Ob eine Nummer stimmt, entscheidet
    der Bau gegen TMDB — hier zählt nur, dass nichts verlorengeht.
  */
  const rohfolgen = Array.isArray(daten.rohfolgen) ? daten.rohfolgen : []
  if (rohfolgen.length) {
    /*
      **Eine neue Meldung ersetzt die alte — sie kommt nicht dazu.**

      Gemessen am 28.08.2026: 5.219 Zeilen in der Tabelle, davon **3.569 allein
      unter „Captain Tsubasa (2018)" — einer Seite mit 91 Folgen. Jede erneute
      Meldung derselben Adresse hing ihre Folgen an, und Daniel hat an dem Titel
      an einem Abend oft gemeldet.

      Die Tabelle daneben macht es seit jeher richtig: `pruefung` loescht die
      noch nicht uebernommenen Zeilen derselben Adresse, bevor sie schreibt. Hier
      fehlte das — ein reines INSERT, und niemandem faellt es auf, weil die
      Zuordnung im Bau die Dubletten stillschweigend mitverarbeitet.

      Uebernommene Zeilen bleiben unberuehrt: Sie sind Geschichte, kein Bestand.
    */
    try {
      /*
        **Je Adresse UND Plattform**, seit dem 01.09.2026. Vorher trug die
        Tabelle nur Prime-Zeilen; jetzt melden auch Netflix und Disney+ hierher,
        und ein Aufräumen ohne Plattform löschte die Zeilen des Nachbarn.
      */
      /*
        **Netflix und Disney+ melden je Folge — dort ersetzt eine Meldung nur
        ihre eigene Folge.** Prime schickt alle Folgen einer Seite auf einmal,
        und dafür ist das Aufräumen je Adresse gebaut. Ein Netflix-Durchlauf
        schickt je Folge eine Meldung, und so blieb von 26 Rohfolgen nur die
        letzte stehen (gefunden am 11.09.2026 beim Einbau der Spalte `roh`).
      */
      const plattform = String(daten.plattform ?? 'primevideo')
      const kennungen = rohfolgen.map((f: Record<string, unknown>) => (f.gti ? String(f.gti) : null)).filter(Boolean)
      if (plattform === 'primevideo' || !kennungen.length) {
        /* Je Seite, nicht nur je Adresse: Staffel 2 unter derselben Prüflisten-Adresse
           löschte sonst die offenen Folgen von Staffel 1 (Migration 030, 17.09.2026). */
        await env.DB.prepare(
          'DELETE FROM prime_folge WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND seiten_kennung IS ?3',
        )
          .bind(url, plattform, seitenKennung)
          .run()
      } else {
        await env.DB.batch(
          kennungen.map((k) =>
            env.DB.prepare(
              'DELETE FROM prime_folge WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND gti = ?3',
            ).bind(url, plattform, k),
          ),
        )
      }
    } catch (e) {
      console.error(`prime_folge aufraeumen: ${(e as Error).message}`)
    }
    const jetzt = jetztIso()
    /* Höchstens 500 je Meldung: Eine Staffel hat keine tausend Folgen, und eine
       kaputte Erweiterung soll die Tabelle nicht fluten. */
    const stapel = rohfolgen.slice(0, 500).map((f: Record<string, unknown>) =>
      env.DB.prepare(
        `INSERT INTO prime_folge (url, asin, gti, nummer, titel, erschienen, dauer_sek,
                                  sprachen, untertitel, staffel_text, staffel_nr, gemeldet_am,
                                  titel_id, plattform, roh, seiten_kennung, vorhanden, ton_de)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18)`,
      ).bind(
        url,
        f.asin ? String(f.asin).slice(0, 40) : null,
        f.gti ? String(f.gti).slice(0, 60) : null,
        zahlOderNull(f.nummer),
        f.titel ? String(f.titel).slice(0, 300) : null,
        f.erschienen ? String(f.erschienen).slice(0, 30) : null,
        /*
          **Netflix schickt die Laufzeit nur in `roh`.** Gemessen am 14.09.2026
          an fünf Netflix-Rohfolgen: `roh.liste.runtimeSec` und
          `displayRuntimeSec` (je 1428 bei „Law & Order: Axel"), `dauerSek` fehlt.
          Ein Erscheinungsdatum liefert die Folgenliste nicht — das einzige
          Datum ist `bookmark.watchedDate`, und das ist Daniels Wiedergabe.
        */
        zahlOderNull(
          f.dauerSek ??
            (f.roh as { liste?: Record<string, unknown> } | undefined)?.liste?.runtimeSec ??
            (f.roh as { liste?: Record<string, unknown> } | undefined)?.liste?.displayRuntimeSec,
        ),
        f.sprachen ? JSON.stringify(f.sprachen).slice(0, 1000) : null,
        f.untertitel ? JSON.stringify(f.untertitel).slice(0, 1000) : null,
        f.staffelText ? String(f.staffelText).slice(0, 120) : null,
        zahlOderNull(f.staffelNr),
        jetzt,
        /*
          **Die Titel-Kennung macht aus einer Suche eine Angabe.**

          Gemessen am 28.08.2026: 1 von 67 Adressen liess sich zuordnen,
          66-mal „kein Titel zu dieser Adresse". Die Suche lief ueber
          `titles.streams.url` — und ein Titel ohne Verweis hat dort nichts
          stehen. Die Erweiterung kennt die Kennung aus ihrem Auftrag; sie
          mitzuschicken kostet ein Feld.
        */
        zahlOderNull(daten.titelId),
        /*
          **Wer die Folge gemeldet hat.** Ohne dieses Feld gehörte die Tabelle
          Prime allein; seit dem 01.09.2026 melden Netflix und Disney+ ebenfalls
          hierher — sammeln und zuordnen sind getrennt, und der Zuordner
          entscheidet über die Anker, nicht über die Anbieter-Staffelnummer.
        */
        String(daten.plattform ?? 'primevideo').slice(0, 20),
        /* Alles Kleine, was die Seite über die Folge sagt — Migration 029. */
        f.roh ? JSON.stringify(f.roh).slice(0, 8000) : null,
        seitenKennung ? seitenKennung.slice(0, 40) : null,
        /* Stufe 1 je Folge — Migration 035. Nur die bekannten Werte, sonst leer. */
        ['ja', 'nein'].includes(String(f.vorhanden)) ? String(f.vorhanden) : null,
        ['ja', 'nein', 'unbekannt'].includes(String(f.ton_de)) ? String(f.ton_de) : null,
      ),
    )
    try {
      await env.DB.batch(stapel)
    } catch (e) {
      /* Die Meldung selbst ist schon gespeichert — ein Fehler hier darf sie
         nicht mitreißen. Ohne Rohfolgen ist der Befund weniger wert, aber gültig. */
      console.error(`prime_folge: ${(e as Error).message}`)
    }
  }

  /*
    Bis zum 24.09.2026 zählte hier jede Meldung alle offenen Meldungen nach (`COUNT(*) … WHERE
    uebernommen = 0`) und schickte die Zahl zurück. Kein Melder las sie; an jenem Tag waren es
    1.904 Zählungen und 560.000 gelesene Zeilen — ein Zehntel des Tageskontingents.
  */
  /*
    **Die Anzeige erfährt es sofort, nicht beim nächsten Nachfragen.**

    Über `ctx.waitUntil`, damit die Erweiterung nicht auf den Versand wartet:
    Sie hat ihre Arbeit getan, sobald die Meldung in der Datenbank steht.
  */
  ctx?.waitUntil(ereignisSenden(env, 'pruefung', { plattform: String(daten.plattform ?? 'unbekannt') }))
  return antwort({ ok: true, befund })
}
