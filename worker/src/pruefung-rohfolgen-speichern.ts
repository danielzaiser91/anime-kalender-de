/**
 * **Die Rohfolgen einer Meldung in `prime_folge` ablegen** (11.10.2026 aus `pruefung-speichern.ts`
 * herausgelöst, Text unverändert): Aufräumen der alten Zeilen, dann ein `batch` mit den neuen.
 */
import { zahlOderNull, jetztIso, fehlerLog } from './werte.ts'
import { type Env } from './env.ts'

type Meldung = Record<string, unknown>

export async function speichereRohfolgen(env: Env, daten: Meldung, url: string, seitenKennung: string | null): Promise<void> {
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
  if (!rohfolgen.length) return
  await raeumeRohfolgenAuf(env, daten, url, seitenKennung, rohfolgen)
  const stapel = rohfolgenAnweisungen(env, daten, url, seitenKennung, rohfolgen)
  try {
    await env.DB.batch(stapel)
  } catch (e) {
    /* Die Meldung selbst ist schon gespeichert — ein Fehler hier darf sie
       nicht mitreißen. Ohne Rohfolgen ist der Befund weniger wert, aber gültig. */
    fehlerLog('prime_folge', e)
  }
}

async function raeumeRohfolgenAuf(
  env: Env,
  daten: Meldung,
  url: string,
  seitenKennung: string | null,
  rohfolgen: Meldung[],
): Promise<void> {
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
      /* Je Seite, nicht nur je Adresse (Migration 030, 17.09.2026); mit erzwungenem Index —
         Begründung und Messung im Kopf dieser Datei. */
      await env.DB.prepare(
        'DELETE FROM prime_folge INDEXED BY prime_folge_seite WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND seiten_kennung IS ?3',
      )
        .bind(url, plattform, seitenKennung)
        .run()
    } else {
      /* Mit erzwungenem Index: ohne ihn las diese Abfrage im Mittel 3430 Zeilen (26 % des
         Kontingents, 28.09.2026) — der Planer nahm `prime_folge_plattform` statt `_gti`.
         Messung und Begründung stehen im Kopf dieser Datei. */
      await env.DB.batch(
        kennungen.map((k) =>
          env.DB.prepare(
            'DELETE FROM prime_folge INDEXED BY prime_folge_gti WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND gti = ?3',
          ).bind(url, plattform, k),
        ),
      )
    }
  } catch (e) {
    fehlerLog('prime_folge aufraeumen', e)
  }
}

function rohfolgenAnweisungen(
  env: Env,
  daten: Meldung,
  url: string,
  seitenKennung: string | null,
  rohfolgen: Meldung[],
): D1PreparedStatement[] {
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
  return stapel
}
