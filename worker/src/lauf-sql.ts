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

/** Hausputz im Vorbeigehen: Was älter als 14 Tage ist, interessiert niemanden mehr. */
export const SQL_AUFRAEUMEN = `DELETE FROM lauf_status WHERE gemeldet_am < ${ISO_JETZT}, '-14 days')`

/** Die letzten zwölf Läufe **einer** Lauf-Art — der Index `(workflow, gemeldet_am)` sucht sie. */
export const SQL_EINE_ART = `SELECT workflow, zustand, gemeldet_am
       FROM lauf_status
      WHERE workflow = ?1
      ORDER BY gemeldet_am DESC
      LIMIT 12`

/**
 * **Die Lauf-Arten des Projekts** — dieselbe Liste wie in der Statusanzeige (`ARTEN`).
 *
 * Nötig, weil die Übersicht „je Lauf-Art die letzten zwölf" auf **eine** Abfrage je Art umgestellt
 * wurde (29.09.2026): Eine Fensterfunktion über der ganzen Tabelle las im Mittel **3.666 Zeilen je
 * Aufruf** (`SCAN lauf_status USING INDEX lauf_status_verlauf`) — bei 5-Minuten-Takt rund 1 Mio. am
 * Tag. Zwölf je Art über den Index sind ~200 Zeilen. `check:logic` hält diese Liste gegen
 * `.github/workflows/*.yml`, damit sie nicht veraltet (dieselbe Zusicherung wie für die Anzeige).
 */
export const LAUF_ARTEN = [
  'Deploy auf GitHub Pages',
  'Bestand — zusammenführen und bauen',
  'Stündlich — Sendezeiten',
  'Täglich — alle Quellen',
  'Wöchentlich — tiefer Durchlauf',
  'Wache — Delta und Briefkasten',
  'Wache — Datenbankverbrauch',
  'ADN — laufende Serien',
  'Datenlauf auf Abruf',
  'aniSearch-Katalog',
  'Crunchyroll — Rückstand nachholen',
  'Monatlich — Tonspuren von der Streaming Availability API',
  'Claude — Daten-PR zusammenführen',
  'Claude — Auftrag abarbeiten',
  'Claude — roten Datenlauf untersuchen',
  'Claude — ausgebliebene Folgen recherchieren',
  'Aussehen prüfen',
  'Crunchyroll — Regionstest mit fremdem Token',
  'Crunchyroll — Weiche aus der Cloud messen',
]

/** Alle Abfragen dieses Moduls — für den Prüflauf. */
export const LAUF_ABFRAGEN = [SQL_LAEUFE_LAUFEND, SQL_VERLAUF, SQL_AUFRAEUMEN, SQL_EINE_ART]
