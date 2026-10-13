/**
 * **Die Meldung als Zeile in `pruefung` ablegen** (13.10.2026 aus `speichereDaten` herausgelöst, ohne
 * Verhaltensänderung): der `INSERT` samt der Begründungen je Spalte.
 */
import { zahlOderNull, jetztIso } from './werte.ts'
import { type Env } from './env.ts'

/** Was `speichereDaten` aus der Meldung abgeleitet hat und der Einfüge-Weg braucht. */
export type Abgeleitet = {
  befund: string
  vorhanden: string
  tonDe: string
  art: string
  staffelNr: number | null
  seitenKennung: string | null
  hash: string
  /** Die Rohfolge als JSON (`pruefung-rohfolge-spalte.ts`), sonst `null`: dann gehört sie in `prime_folge`. */
  rohfolge: string | null
  /** 0 = offen für den Zuordner, 1 = schon abgehakt, `null` = keine Rohfolge in dieser Zeile. */
  rohUebernommen: number | null
}

export async function fuegePruefungEin(env: Env, daten: Record<string, unknown>, url: string, a: Abgeleitet): Promise<void> {
  const { befund, vorhanden, tonDe, art, staffelNr, seitenKennung, hash, rohfolge, rohUebernommen } = a
  await env.DB.prepare(
    /*
      **`titel_id` sagt, für welchen Auftrag gemeldet wurde — die Adresse sagt es nicht.**

      Anbieter führen denselben Anime unter mehreren Kennungen; wer aus der
      Prüfliste heraus öffnet, weiß trotzdem, welcher Titel gemeint war. Ohne
      dieses Feld musste der Bau die Adresse im Datensatz suchen und fiel sonst
      auf einen Namensvergleich zurück, der ausdrücklich kein Beleg ist — am
      02.09.2026 warteten so 36 Meldungen auf Daniels Bestätigung.
    */
    `INSERT INTO pruefung (plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln, serientitel, notiz, gemeldet_am, zugang, abos, teil_von, teil_bis, seiten_kennung, titel_id, such_url, folge, vorhanden, ton_de, art, hash, rohfolge, roh_uebernommen)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23, ?24, ?25, ?26)`,
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
      hash,
      rohfolge,
      rohUebernommen,
    )
    .run()
}
