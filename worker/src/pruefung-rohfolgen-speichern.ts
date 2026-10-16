/**
 * **Die Rohfolgen einer Meldung in `prime_folge` ablegen** (11.10.2026 aus `pruefung-speichern.ts`
 * herausgelöst): Abgleich mit den vorhandenen Zeilen (`rohfolgen-abgleich.ts`, 12.10.2026), dann ein
 * `batch` mit den geänderten und neuen.
 */
import { zahlOderNull, jetztIso, fehlerLog } from './werte.ts'
import { type Env } from './env.ts'
import { istD1Abweisung } from './d1-limit.ts'
import { meldungsHash, normalisiert } from './pruefung-unveraendert.ts'
import { ladeRohfolgen, loescheRohfolgen, rohfolgenAbgleich } from './rohfolgen-abgleich.ts'

type Meldung = Record<string, unknown>
export type RohZeile = { werte: unknown[]; hash: string }

/** Die Namen der Werte in `RohZeile.werte`, in dieser Reihenfolge: die Spalten von `prime_folge` (ohne `gemeldet_am`, `hash`). */
export const ROH_FELDER = ['url', 'asin', 'gti', 'nummer', 'titel', 'erschienen', 'dauer_sek', 'sprachen', 'untertitel', 'staffel_text', 'staffel_nr', 'titel_id', 'plattform', 'roh', 'seiten_kennung', 'vorhanden', 'ton_de'] as const

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
  /*
    **Eine neue Meldung ersetzt die alte — sie kommt nicht dazu.** Gemessen am 28.08.2026: 3.569
    Zeilen allein unter „Captain Tsubasa (2018)", einer Seite mit 91 Folgen, weil jede erneute
    Meldung ihre Folgen anhängte. Übernommene Zeilen bleiben unberührt: Sie sind Geschichte.
    Seit 12.10.2026 ersetzt sie nur, was sich geändert hat; was die jüngste übernommene Zeile schon trägt, kommt nicht noch einmal.
  */
  /* Höchstens 500 je Meldung: Eine Staffel hat keine tausend Folgen, und eine
     kaputte Erweiterung soll die Tabelle nicht fluten. */
  const begrenzt: Record<string, unknown>[] = rohfolgen.slice(0, 500)
  const zeilen = await Promise.all(begrenzt.map((f) => rohZeile(daten, url, seitenKennung, f)))
  const kennungen = [...new Set(begrenzt.map((f) => (f.gti ? String(f.gti) : '')))].filter(Boolean)
  const plattform = String(daten.plattform ?? 'primevideo')
  const vorhandene = await ladeRohfolgen(env, plattform, url, seitenKennung, kennungen)
  const { loeschen, einfuegen } = rohfolgenAbgleich(vorhandene, zeilen.map((z) => z.hash))
  await loescheRohfolgen(env, loeschen)
  if (!einfuegen.length) return
  const jetzt = jetztIso()
  try {
    await env.DB.batch(einfuegen.map((i) => einfuegeAnweisung(env, zeilen[i]!, jetzt)))
  } catch (e) {
    /* Ein dauerhafter Fehler hier darf die Meldung nicht mitreißen. Ohne Rohfolgen ist der Befund
       weniger wert, aber gültig. Weist D1 nur gerade ab (Export, Tageslimit), scheitert die Meldung
       und der nächste Klick schreibt beides (`speichereDaten`). */
    if (istD1Abweisung(e)) throw e
    fehlerLog('prime_folge', e)
  }
}

function einfuegeAnweisung(env: Env, zeile: RohZeile, jetzt: string): D1PreparedStatement {
  return env.DB.prepare(
    `INSERT INTO prime_folge (url, asin, gti, nummer, titel, erschienen, dauer_sek,
                              sprachen, untertitel, staffel_text, staffel_nr,
                              titel_id, plattform, roh, seiten_kennung, vorhanden, ton_de, gemeldet_am, hash)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19)`,
  ).bind(...zeile.werte, jetzt, zeile.hash)
}

/** Die 17 Spaltenwerte einer Rohfolge und der Hash über sie (Schlüssel sortiert, ohne `gemeldet_am`). */
export async function rohZeile(daten: Meldung, url: string, seitenKennung: string | null, f: Record<string, unknown>): Promise<RohZeile> {
  const werte = [
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
    f.roh ? JSON.stringify(normalisiert(f.roh)).slice(0, 8000) : null,
    seitenKennung ? seitenKennung.slice(0, 40) : null,
    /* Stufe 1 je Folge — Migration 035. Nur die bekannten Werte, sonst leer. */
    ['ja', 'nein'].includes(String(f.vorhanden)) ? String(f.vorhanden) : null,
    ['ja', 'nein', 'unbekannt'].includes(String(f.ton_de)) ? String(f.ton_de) : null,
  ]
  /* `roh` mit sortierten Schlüsseln: Die Reihenfolge, in der die Erweiterung sie schreibt, ändert den Hash nicht. */
  return { werte, hash: await meldungsHash(werte) }
}
