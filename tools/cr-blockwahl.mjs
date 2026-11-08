/**
 * Welcher deutsche Crunchyroll-Katalogblock gehört zu einem Titel an einer Serie? Gemeinsam für OmU-Begleiter
 * (`pipeline/bau/omu-synchro-begleiter.ts`) und Wache (`tools/synchro-wartezeit.mjs`). Nur Node-Bordmittel (Wache ohne `npm ci`).
 *
 * Reihenfolge der Wege, jeder muss genau einen Block ergeben, sonst zählt der nächste:
 *  1. `zahl`:   „Staffel n“/„Season n“ am Namensende passt zu einer Staffelnummer des Titels (`katalogBlock`).
 *  2. `einzig`: die Serie führt genau einen datierten deutschen Block ohne Staffelzusatz („Season 1 Part 4“) und kein anderer Titel teilt sie.
 *  3. `name`:   der Blockname gleicht (ohne Satzzeichen, Groß-/Kleinschreibung, „(German Dub)“) einem Namen des Titels.
 *  4. `folgen`: genau ein Block hat so viele Folgen wie der Titel und sein Name steht am Ende eines Titelnamens (Folgenzahl allein
 *     reicht nie: Filme und Einzelfolgen haben alle 1, Attack on Titan Part I ≠ „Last Attack“).
 * Ein Block mit ausdrücklicher Nummer, die nicht zum Titel passt, kommt für 2 bis 4 nie in Frage. Jeder Fehlschlag trägt einen Grund.
 */
import { STAFFEL_IM_NAMEN, katalogBlock } from './cr-katalogblock.mjs'

/** Name ohne Satzzeichen und Sprachzusatz, damit „Don’t Toy With Me … (German Dub)“ und „Don't Toy with Me …“ gleich sind. */
export function blockName(name) {
  return String(name)
    .toLowerCase()
    .replace(/\((?:german|deutsch)[^)]*\)/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
}

/**
 * Der Blockname ist der Schluss eines Titelnamens („~High School Days~“ am Ende von „TONIKAWA … ~High School Days~“). Nur der Schluss:
 * ein Blockname, der am Anfang steht, ist der Name der Vorstaffel („Meisterdetektiv Ron Kamonohashi“ in „… Season 2“).
 */
function verwandt(blockname, namen) {
  const b = blockName(blockname)
  return b.length >= 8 && [...namen].some((n) => n.endsWith(b))
}

const STAFFEL_GENANNT = /(?:(?:staffel|season)\s*0*(\d+)|(\d+)(?:st|nd|rd|th)\s+season)/i

/** Die Staffelnummer, die der Blockname irgendwo nennt („Season 1 Part 4“, „2nd Season“, „Season2“), sonst NaN. */
function genannteStaffel(name) {
  const treffer = STAFFEL_GENANNT.exec(name)
  return Number(treffer?.[1] ?? treffer?.[2])
}

const datiert = (block) => (block.deutscheFolgen ?? []).some((f) => f.verfuegbarAb)

/** Die Blöcke mit datierten deutschen Folgen, je Name einer (derselbe Block steht unter mehreren Serienadressen). */
function datierteBloecke(serien, kennung) {
  const alle = serien
    .filter((s) => s.katalog === 'de' && s.seriesId === kennung)
    .flatMap((s) => (s.staffeln ?? []).map((block) => ({ block, url: s.url })))
    .filter(({ block }) => datiert(block))
  return [...new Map(alle.map((b) => [b.block.name, b])).values()]
}

/**
 * @param {import('../pipeline/lib/crunchyroll-dub.ts').CrSerie[]} serien
 * @param {string} kennung
 * @param {{ nummern: number[], namen?: string[], folgen?: number, geteilt?: boolean }} titel
 * @returns {{ treffer: { block: object, url: string } | null, weg?: string, grund?: string }}
 */
export function blockWahl(serien, kennung, titel) {
  const bloecke = datierteBloecke(serien, kennung)
  if (!bloecke.length) return { treffer: null, grund: 'kein datierter deutscher Block' }
  const nummer = (b) => Number(STAFFEL_IM_NAMEN.exec(b.block.name)?.[1])
  const nachZahl = katalogBlock(serien, kennung, titel.nummern)
  if (nachZahl) return { treffer: nachZahl, weg: 'zahl' }
  if (bloecke.some((b) => titel.nummern.includes(nummer(b)))) return { treffer: null, grund: 'mehrere Blöcke zur selben Staffelnummer' }
  const frei = bloecke.filter((b) => {
    const genannt = genannteStaffel(b.block.name)
    return Number.isNaN(genannt) || titel.nummern.includes(genannt)
  })
  if (!frei.length) return { treffer: null, grund: 'alle Blöcke tragen eine andere Staffelnummer' }
  const ohneZusatz = bloecke.length === 1 && Number.isNaN(genannteStaffel(frei[0].block.name))
  if (ohneZusatz && !titel.geteilt) return { treffer: frei[0], weg: 'einzig' }
  const namen = new Set((titel.namen ?? []).map(blockName))
  const gleich = frei.filter((b) => namen.has(blockName(b.block.name)))
  if (gleich.length === 1) return { treffer: gleich[0], weg: 'name' }
  const gleichViele = frei.filter((b) => b.block.folgen === titel.folgen && verwandt(b.block.name, namen))
  if (gleichViele.length === 1) return { treffer: gleichViele[0], weg: 'folgen' }
  return { treffer: null, grund: offenerGrund(bloecke.length, ohneZusatz) }
}

/** Warum kein Block gewählt wurde, wenn alle Wege versagten. */
function offenerGrund(anzahl, ohneZusatz) {
  if (anzahl > 1) return 'mehrere Blöcke, keiner eindeutig'
  /* Ein einziger Block ohne Zusatz, der nicht gewählt wurde, scheiterte nur an der geteilten Serie. */
  return ohneZusatz ? 'Serie geteilt, ein Block' : 'einziger Block nennt eine Staffel'
}
