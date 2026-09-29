/**
 * **Die Abfragen des Laufstatus — als Text an einer Stelle** (29.09.2026).
 *
 * Anlass: In `letzteZustaende` fehlte eine schließende Klammer (die Unterabfrage war nie zu), und
 * `/lauf` antwortete stundenlang mit **HTTP 500** — ohne dass ein Typecheck das sehen konnte. Der
 * Fehler entsteht erst in SQLite.
 *
 * Eigenes Modul, weil `check:logic` diese Texte prüfen soll: `lauf.ts` zieht beim Laden den
 * Ereignis-Kanal (`cloudflare:workers`) herein, den es außerhalb des Workers nicht gibt. Hier steht
 * nur SQL und `ISO_JETZT` — importierbar von überall.
 */
import { ISO_JETZT } from './werte.ts'

/** Was gerade läuft — die Übersicht über alle Lauf-Arten. */
export const SQL_LAEUFE_LAUFEND = `SELECT lauf_id, repo, workflow, auftrag, zweck, ziel, zustand, begonnen_am, gemeldet_am, url, notiz,
            fortschritt, fortschritt_gesamt, fortschritt_text
       FROM lauf_status
      WHERE zustand = 'laeuft'
        AND gemeldet_am > ${ISO_JETZT}, '-3 days')
      ORDER BY gemeldet_am DESC
      LIMIT 40`

/** Der Verlauf einer Lauf-Art — Abgehaktes inbegriffen. */
export const SQL_VERLAUF = `SELECT lauf_id, zustand, auftrag, notiz, url, begonnen_am, gemeldet_am
       FROM lauf_status
      WHERE workflow = ?1
        AND gemeldet_am > ${ISO_JETZT}, '-14 days')
      ORDER BY gemeldet_am DESC
      LIMIT ?2`

/** Je Lauf-Art die letzten zwölf Ergebnisse — die Kästchenreihe des Gitters. */
export const SQL_LETZTE_ZUSTAENDE = `SELECT workflow, zustand, gemeldet_am, rang FROM (
       SELECT workflow, zustand, gemeldet_am,
              ROW_NUMBER() OVER (PARTITION BY workflow ORDER BY gemeldet_am DESC) AS rang
         FROM lauf_status
        WHERE gemeldet_am > ${ISO_JETZT}, '-14 days'))
      WHERE rang <= 12
      ORDER BY workflow, rang DESC`

/** Hausputz im Vorbeigehen: Was älter als 14 Tage ist, interessiert niemanden mehr. */
export const SQL_AUFRAEUMEN = `DELETE FROM lauf_status WHERE gemeldet_am < ${ISO_JETZT}, '-14 days')`

/** Alle Abfragen dieses Moduls — für den Prüflauf. */
export const LAUF_ABFRAGEN = [SQL_LAEUFE_LAUFEND, SQL_VERLAUF, SQL_LETZTE_ZUSTAENDE, SQL_AUFRAEUMEN]
