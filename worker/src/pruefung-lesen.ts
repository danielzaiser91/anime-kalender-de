import { type Env } from './env.ts'
import { zaehleOffenePruefungen } from './pruefung-zaehlen.ts'
import { liefereRohfolgen } from './pruefung-rohfolgen.ts'
import { berechnePruefstand } from './pruefung-stand.ts'

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
      return await berechnePruefstand({ env, antwort })
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
      return await liefereRohfolgen({ request, env, antwort })
    }

    if (new URL(request.url).searchParams.get('zaehlen') === '1') return ausCache(async () => {
      return await zaehleOffenePruefungen({ request, env, antwort })
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
