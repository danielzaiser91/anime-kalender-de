import { type Env } from './env.ts'
import { tokenGleich, tokenMitUebergang } from './lauf-token.ts'
import { ausSpeicher } from './export-speicher.ts'
import { zaehleOffenePruefungen, ZAEHLEN_SEKUNDEN } from './pruefung-zaehlen.ts'
import { liefereRohfolgen } from './pruefung-rohfolgen.ts'
import { berechnePruefstand } from './pruefung-stand.ts'
import { leseGemeldet } from './pruefung-gemeldet.ts'
import { GEMELDET_SEKUNDEN, gemeldetSchluessel } from './pruefung-gemeldet-cache.ts'
import { wartendSchluessel } from './pruefung-stand-briefkasten.ts'
import { type AusCache } from './cache-kurz.ts'
import { allePruefungen, offenePruefungen } from './titelzeile-lesen.ts'

/** Höchstalter der offenen Liste für den Bau (`?token=`), wenn seitdem gemeldet oder abgehakt wurde. */
export const OFFEN_FRIST_MS = 5 * 60_000

export async function beantwortePruefungLesen({ request, env, antwort, ausCache }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
  ausCache: AusCache
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
      return ausCache(
        async () => antwort(await leseGemeldet(env, fuer)),
        GEMELDET_SEKUNDEN,
        gemeldetSchluessel(request.url, fuer),
      )
    }

    /**
     * **Eine Zahl, eine Stelle, die sie rechnet** (Netflix-Regel „gedeckt“: `pruefung-gedeckt.ts`, Wächter hält die Erweiterung gleich).
     *
     * Bis zum 26.08.2026 rechneten drei Stellen dasselbe aus verschiedenen
     * Quellen: die Statusanzeige aus `pruefstand.json` minus Briefkasten, die
     * Erweiterung ebenso, und ihre Liste aus dem lokalen Speicher. Das Ergebnis
     * war ein offener Widerspruch — der Knopf sagte „10 offen", die Liste
     * daneben „Alles geprüft", und beide hatten recht.
     *
     * Hier laufen beide Quellen zusammen: `pruefstand.json` sagt, was der
     * Datensatz noch nicht hat, die Datenbank, was davon schon unterwegs ist.
     * Wer die Zahl braucht, liest sie — niemand rechnet sie nach.
     *
     * Gezählt wird in **Staffeln**, wie im Prüfstand; `titel` nennt daneben die
     * Zahl der Adressen, damit eine Liste ihre eigene Länge belegen kann.
     */
    if (new URL(request.url).searchParams.get('stand') === '1') return ausCache(async () => {
      return await berechnePruefstand({ env, antwort, zwischen: { ausCache, schluessel: wartendSchluessel(request.url) } })
    }, 300)

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
      return await liefereRohfolgen({ request, env, antwort, ausCache })
    }

    if (new URL(request.url).searchParams.get('zaehlen') === '1') return ausCache(async () => {
      return await zaehleOffenePruefungen({ request, env, antwort })
    }, ZAEHLEN_SEKUNDEN)

    // Die Pipeline holt sich, was noch nicht übernommen wurde.
    const sucheP = new URL(request.url).searchParams
    const token = tokenMitUebergang(request)
    if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)

    /*
      **Die Reihenfolge bleibt aufsteigend — daran hängt der Datenlauf.**

      `OFFEN_FENSTER` (bis 18.10.2026 `LIMIT 500`) schneidet ab, und die Pipeline arbeitet die ältesten zuerst ab.
      Umgestellt auf absteigend hätte sie bei 562 Meldungen die ältesten 62 nie
      gesehen. Der Deckel ist für sie richtig; er ist nur keine Zählung.

      Zum Nachsehen einzelner Meldungen gibt es deshalb `?plattform=`. Am
      26.08.2026 verdeckten 558 Disney-Meldungen eine frische Prime-Meldung
      vollständig, und die Suche danach ging zweimal ins Leere.
    */
    /*
      **`?alle=1&nach=<id>`: jede Meldung, auch übernommene — für Stufe 3** (22.09.2026). Das Urteil
      je Folge wird aus allen Beobachtungen neu gerechnet, nicht aus dem Fenster der offenen. Seitenweise wie
      bei den Rohfolgen; gemessen am 22.09.2026: 4.467 Zeilen, eine Seite.
    */
    /* In R2 zwischengespeichert (`export-speicher.ts`, 05.10.2026): Der Edge-Cache half nicht, jeder Bau holte alle Seiten neu (4,5 Mio. Zeilen an einem Tag). */
    if (sucheP.get('alle') === '1') return ausSpeicher(env, `pruefung-alle-${Number(sucheP.get('nach') ?? 0) || 0}`, async () => {
      const { zeilen, weiter } = await allePruefungen(env, Number(sucheP.get('nach') ?? 0))
      return { pruefungen: zeilen, weiter }
    })

    return await offeneFuerBau(env, sucheP.get('plattform'))
}

/**
 * Die offenen Meldungen für den Bau (`?token=`), in R2 wie `?alle=1` (15.10.2026): Ein Aufruf liest rund 36.000
 * Zeilen, und die Erweiterung fragte auf jeder Prime-Seite. Neu gerechnet wird erst nach einer Meldung oder einem
 * Abhaken (Marke), dann spätestens nach `OFFEN_FRIST_MS`: Der Bau sieht eine frische Meldung nach höchstens fünf Minuten.
 */
async function offeneFuerBau(env: Env, plattform: string | null): Promise<Response> {
  return await ausSpeicher(env, `offen-pruefung-${plattform ?? 'alle'}`, async () => ({ pruefungen: await offenePruefungen(env, plattform) }), OFFEN_FRIST_MS)
}
