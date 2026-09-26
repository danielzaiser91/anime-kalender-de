import { type Env } from './env.ts'

export async function liefereRohfolgen({ request, env, antwort }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
}) {
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
