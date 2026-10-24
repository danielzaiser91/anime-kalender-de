import { type Env } from './env.ts'
import { tokenGleich, tokenMitUebergang } from './lauf-token.ts'
import { ausSpeicher, FRIST_NAMEN_MS } from './export-speicher.ts'
import { serientitelJeAdresse } from './pruefung-serientitel.ts'
import { probeRohfolgen } from './rohfolgen-probe.ts'
import { alleRohfolgen, offeneRohfolgen, type Seite } from './rohfolgen-seiten.ts'
import { namenAusTitelzeilen, NICHT_VERDRAENGT } from './titelzeile-lesen.ts'

export async function liefereRohfolgen({ request, env, antwort, ausCache }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
  /** Hält eine erfolgreiche Antwort für 30 Minuten (`caches.default`, gleiche Adresse = gleiche Antwort). */
  ausCache: (bauen: () => Promise<Response>, sekunden?: number) => Promise<Response>
}) {
      const token = tokenMitUebergang(request)
      if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) {
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
        letzte Seite endete; `weiter` ist bei voller Seite deren letzte Kennung (nächstes `?nach=`), sonst `null`; eine Gesamtzahl gibt es nicht mehr.
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
        return antwort({ probe: await probeRohfolgen(env, probe, id) })
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
      /* Die Vollexporte liegen in R2 (`export-speicher.ts`) und werden bei jedem Schreibzugriff verworfen. */
      if (new URL(request.url).searchParams.get('namen') === '1') return ausSpeicher(env, 'namen', async () => {
        const { results } = await env.DB.prepare(
          `SELECT url, MAX(titel) AS titel FROM pruefung WHERE titel IS NOT NULL AND url IS NOT NULL AND ${NICHT_VERDRAENGT} GROUP BY url`,
        ).all()
        return { namen: [...(results ?? []), ...(await namenAusTitelzeilen(env))] }
      }, FRIST_NAMEN_MS)
      const seite = (s: Seite) => ({ folgen: s.zeilen, weiter: s.weiter })
      if (new URL(request.url).searchParams.get('alle') === '1') return ausSpeicher(env, `alle-${Number.isFinite(nach) ? nach : 0}`, async () => seite(await alleRohfolgen(env, nach)))
      return ausSpeicher(env, `offen-${Number.isFinite(nach) ? nach : 0}`, async () => {
      const { zeilen, weiter } = await offeneRohfolgen(env, nach)
      /*
        **Der Serienname kommt aus der Meldung derselben Adresse.**

        `meldung_id` steht in `prime_folge`, wurde aber nie gefüllt (bei allen 795 offenen Zeilen leer,
        gemessen 01.09.2026). Der Weg über die Adresse trägt trotzdem: Zu jeder Rohfolge gibt es eine
        Meldung unter derselben URL, und die kennt den Namen. Gebraucht wird er, wo unser Bestand die
        Adresse nicht führt — Prime legt je Staffel eine eigene an, wir kennen eine.
      */
      const titel = await serientitelJeAdresse(env, zeilen.map((z) => z.url))
      return {
        folgen: zeilen.map((z) => ({ ...z, serientitel: titel.get(z.url) ?? null })),
        /* Ist die Seite voll, steht die Fortsetzung dabei — sonst ausdrücklich null. Eine Gesamtzahl
           gibt es nicht mehr: das `COUNT(*)` las je Seite alle offenen Zeilen (1,39 Mio. am Tag, 12.10.2026). */
        weiter,
      }
      })
}
