/**
 * Trägt die Folgen-Zuordnung über fremde Nummerierungen hinweg?
 *
 * **Die Frage, die dieses Projekt seit Wochen beschäftigt.** Jeder Anbieter
 * sortiert anders: Prime führt „Danganronpa 3" als durchlaufende Liste, in der
 * unsere Folge 1 des Despair Arc die Nummer 13 trägt; Crunchyroll stellt
 * Rückblick-Specials voran; Netflix zählt wieder anders. Daniel am 28.08.2026:
 *
 * > „jeder anbieter sortiert anders, aber die folgen heißen identisch überall
 * > (episodentitel). episodennummer etc können unterschiedlich sein, aber
 * > episodentitel und original release date zB nicht"
 *
 * **Der Prüfaufbau stellt genau das nach.** Aus den aniSearch-Folgenlisten wird
 * eine Anbieter-Meldung gebaut, deren Nummern **um zwölf verschoben** sind —
 * Titel und Datum bleiben, wie sie überall stehen. Trifft die Zuordnung
 * trotzdem, trägt sie.
 *
 * **Gemessen am 29.08.2026:** 4.112 Folgen, 4.095 richtig, **0 falsch**, 17
 * offen. Offen ist erlaubt und erwünscht — falsch nicht.
 *
 * Die Untergrenzen unten sind bewusst weit unter dem gemessenen Stand: Sie
 * sollen einen **Bruch** melden, nicht jede Schwankung im Datenbestand.
 *
 * Aufruf: `npm run check:folgen`
 */
import { existsSync, readFileSync } from 'node:fs'
import { ausAnisearch, englischeSchreibweisen, ordneZu, type AsFolgeRoh } from '../shared/folgen-zuordnung.ts'

/** Ab wann ein Ergebnis als Bruch gilt. */
const MIN_TREFFERQUOTE = 0.9
/** Eine einzige falsche Zuordnung ist eine zu viel — sie erzeugt falsche Daten. */
const MAX_FALSCH = 0
/** Unter dieser Zahl geprüfter Folgen sagt der Lauf nichts aus. */
const MIN_GEPRUEFT = 500

/** Wie weit die Nummerierung des Anbieters verschoben wird. */
const VERSATZ = 12

function main(): void {
  const pfad = 'data/anisearch-folgen.json'
  if (!existsSync(pfad)) {
    /*
      Kein Bestand ist kein Fehler — der Abruf läuft wöchentlich und beginnt bei
      null. Eine Prüfung, die rot wird, weil noch nichts da ist, misst das
      Falsche (siehe CLAUDE.md, „Eine Prüfung, die rot wird, weil die Arbeit
      erledigt ist").
    */
    console.log('[check:folgen] Noch keine aniSearch-Folgen — nichts zu prüfen.')
    return
  }

  const bestand = JSON.parse(readFileSync(pfad, 'utf8')) as Record<string, { folgen: AsFolgeRoh[] }>

  let geprueft = 0
  let getroffen = 0
  let daneben = 0
  const fehler: string[] = []

  for (const [asId, eintrag] of Object.entries(bestand)) {
    /*
      Nur Folgen mit Titel **und** Datum: Sie sind der Fall, für den die
      Zuordnung gebaut ist. Ohne beides bliebe sie zu Recht offen, und das
      würde die Messung verwässern.
    */
    const folgen = (eintrag.folgen ?? []).filter((f) => f.de && f.datum)
    if (folgen.length < 5) continue

    const anker = [...ausAnisearch(eintrag.folgen), ...englischeSchreibweisen(eintrag.folgen)]
    const gemeldet = folgen.map((f, i) => ({
      nummer: i + 1 + VERSATZ,
      titel: f.de ?? null,
      datum: f.datum ?? null,
      minuten: f.minuten ?? null,
    }))

    const paare = ordneZu(gemeldet, anker)
    for (let i = 0; i < paare.length; i++) {
      geprueft++
      if (paare[i].unsere === folgen[i].nr) getroffen++
      else if (paare[i].unsere !== null) {
        daneben++
        if (fehler.length < 5) {
          fehler.push(`aniSearch ${asId}, Folge ${folgen[i].nr} ("${folgen[i].de}") → ${paare[i].unsere}`)
        }
      }
    }
  }

  const quote = geprueft ? getroffen / geprueft : 0
  console.log(`[check:folgen] ${geprueft} Folgen geprüft, Nummerierung um ${VERSATZ} verschoben`)
  console.log(`[check:folgen]   ${getroffen} richtig (${Math.round(quote * 100)} %)`)
  console.log(`[check:folgen]   ${daneben} falsch`)
  console.log(`[check:folgen]   ${geprueft - getroffen - daneben} offen`)

  if (geprueft < MIN_GEPRUEFT) {
    console.log(`[check:folgen] Zu wenig Bestand (${geprueft} < ${MIN_GEPRUEFT}) — kein Urteil.`)
    return
  }

  let rot = false
  if (daneben > MAX_FALSCH) {
    console.error(`[check:folgen] ⚠  ${daneben} falsche Zuordnungen — erlaubt sind ${MAX_FALSCH}.`)
    for (const f of fehler) console.error(`[check:folgen]     ${f}`)
    rot = true
  }
  if (quote < MIN_TREFFERQUOTE) {
    console.error(
      `[check:folgen] ⚠  Trefferquote ${Math.round(quote * 100)} % unter der Grenze von ${Math.round(MIN_TREFFERQUOTE * 100)} %.`,
    )
    rot = true
  }
  if (rot) process.exit(1)
  console.log('[check:folgen] Die Zuordnung trägt über fremde Nummerierungen hinweg.')
}

main()
