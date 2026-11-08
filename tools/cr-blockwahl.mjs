/**
 * Welcher deutsche Crunchyroll-Katalogblock gehört zu einem Titel an einer Serie? Gemeinsam für OmU-Begleiter
 * (`pipeline/bau/omu-synchro-begleiter.ts`) und Wache (`tools/synchro-wartezeit.mjs`). Nur Node-Bordmittel (Wache ohne `npm ci`).
 *
 * Reihenfolge der Wege, jeder muss genau einen Block ergeben, sonst zählt der nächste:
 *  1. `zahl`:   „Staffel n“/„Season n“ am Namensende passt zu einer Staffelnummer des Titels (`katalogBlock`).
 *  2. `einzig`: die Serie führt genau einen datierten deutschen Block ohne Staffelzusatz („Season 1 Part 4“), kein anderer Titel teilt
 *     sie und der Titel zählt als Staffel 1 (`nummern` enthält 1): ein Block ohne Nummer kann sonst die Vorstaffel sein.
 *  3. `name`:   der Blockname gleicht (ohne Satzzeichen, Groß-/Kleinschreibung, „(German Dub)“) einem Namen des Titels.
 *  4. `folgen`: genau ein Block hat so viele Folgen wie der Titel und sein Name steht am Ende eines Titelnamens (Folgenzahl allein
 *     reicht nie: Filme und Einzelfolgen haben alle 1, Attack on Titan Part I ≠ „Last Attack“).
 * Ein Block mit ausdrücklicher Nummer, die nicht zum Titel passt, kommt für 2 bis 4 nie in Frage; ebenso keiner mit deutschen Folgen vor
 * dem OmU-Start (`ab`, wenn bekannt) und keiner mit mehr als einer Folge über der Zahl des Titels. Jeder Fehlschlag trägt einen Grund.
 */
import { STAFFEL_IM_NAMEN, datierteFolgen, katalogBlock } from './cr-katalogblock.mjs'

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
 * @param {{ nummern: number[], namen?: string[], folgen?: number, geteilt?: boolean, ab?: string, nummernAusName?: boolean }} titel
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
  const wahl = kandidaten(frei, titel)
  if (!wahl.liste.length) return { treffer: null, grund: wahl.grund }
  const ohneZusatz = bloecke.length === 1 && Number.isNaN(genannteStaffel(wahl.liste[0].block.name))
  const alsStaffel1 = titel.nummern.includes(1)
  if (ohneZusatz && !titel.geteilt && alsStaffel1) return { treffer: wahl.liste[0], weg: 'einzig' }
  const namen = new Set((titel.namen ?? []).map(blockName))
  const nachName = titel.nummernAusName ? ohneGrundnamen(wahl.liste, bloecke) : wahl.liste
  const gleich = nachName.filter((b) => namen.has(blockName(b.block.name)))
  if (gleich.length === 1) return { treffer: gleich[0], weg: 'name' }
  const gleichViele = nachName.filter((b) => b.block.folgen === titel.folgen && verwandt(b.block.name, namen))
  if (gleichViele.length === 1) return { treffer: gleichViele[0], weg: 'folgen' }
  return { treffer: null, grund: offenerGrund(bloecke.length, ohneZusatz, titel.geteilt) }
}

/**
 * Ohne Blöcke, deren Name der Anfang eines anderen Blocknamens ist („Tsukimichi“ neben „Tsukimichi Staffel 2“): der Grundname gehört zur
 * 1. Staffel. Nur nötig, wenn die Staffelnummern des Titels allein aus seinem Namen kommen (Wache): ein Folgestaffel-Termin trägt oft den
 * Namen der 1. Staffel, und die Reihe, die das auflöst, kennt nur der Bau.
 */
function ohneGrundnamen(liste, bloecke) {
  const namen = bloecke.map((b) => blockName(b.block.name))
  return liste.filter((b) => {
    const n = blockName(b.block.name)
    return !namen.some((andere) => andere !== n && andere.startsWith(n))
  })
}

/**
 * Die Blöcke, die für die Wege ohne Zahl in Frage kommen: die erst mit oder nach dem OmU-Start (`ab`, Berliner Tag) deutsch werden — ein
 * Block mit früheren Folgen ist eine Vorstaffel, die noch läuft (Tsukimichi 2: Block der 1. Staffel) — und mit höchstens einer Folge
 * mehr als der Titel: ein größerer Block gehört auch anderen Titeln (K-ON!! mit 27 Folgen gehört nicht zu K-ON! mit 13).
 */
function kandidaten(frei, titel) {
  const ab = titel.ab ? frei.filter((b) => datierteFolgen(b.block).every((f) => f.tag >= titel.ab)) : frei
  if (!ab.length) return { liste: [], grund: 'Blöcke haben deutsche Folgen vor dem OmU-Start' }
  const passend = ab.filter((b) => titel.folgen === undefined || b.block.folgen <= titel.folgen + 1)
  return passend.length ? { liste: passend } : { liste: [], grund: 'Block hat mehr Folgen als der Titel' }
}

/** Warum kein Block gewählt wurde, wenn alle Wege versagten. */
function offenerGrund(anzahl, ohneZusatz, geteilt) {
  if (anzahl > 1) return 'mehrere Blöcke, keiner eindeutig'
  if (!ohneZusatz) return 'einziger Block nennt eine Staffel'
  return geteilt ? 'Serie geteilt, ein Block' : 'einziger Block, Titel ist nicht Staffel 1'
}
