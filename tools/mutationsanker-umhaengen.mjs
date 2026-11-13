/**
 * Zu einem toten Mutationsanker die Datei vorschlagen, in die der Code gewandert ist: genau eine Quelldatei enthält
 * die `suche` (Testdateien und Mutationslisten zählen nicht). Mehrere Treffer oder keiner: nur melden.
 * `umhaengenText` trägt den Vorschlag in den Listentext ein und lässt alles andere (Layout, Reihenfolge) byte-gleich.
 */
import { normalisiereListe, normalisierePfad, parseListeText, planeMutant } from './mutationslaeufer.mjs'

const QUELLEN = /\.(?:[cm]?[jt]sx?)$/
const TESTDATEI = /\.test\.[cm]?[jt]sx?$/

/** Kandidaten für die Suche: Quelldateien ohne Tests und ohne Mutationslisten. */
export const istKandidat = (pfad) => QUELLEN.test(pfad) && !TESTDATEI.test(pfad) && !pfad.startsWith('tools/mutationen/') && !pfad.startsWith('public/data/')

/**
 * Vorschläge für alle toten Anker einer Liste: { name, alt, suche, kandidaten } (kandidaten = Dateien mit der `suche`).
 * `lies(pfad)` liefert Text oder null, `dateiListe()` alle getrackten Pfade.
 */
export function ankerVorschlaege(listeText, lies, dateiListe, cwd = process.cwd()) {
  let liste
  try {
    liste = normalisiereListe(parseListeText(listeText))
  } catch {
    return []
  }
  const tot = []
  for (const m of liste) {
    for (const a of m.aenderungen) {
      const text = lies(a.datei)
      const einzeln = text === null ? null : planeMutant({ ...m, aenderungen: [a] }, new Map([[normalisierePfad(a.datei, cwd), Buffer.from(text, 'utf8')]]), cwd)
      if (text === null || einzeln.urteil === 'nicht gefunden') tot.push({ name: m.name, alt: a.datei, suche: a.suche, gleicheDatei: m.aenderungen.filter((x) => x.datei === a.datei).length })
    }
  }
  if (!tot.length) return []
  const quellen = dateiListe().filter(istKandidat).map((p) => [p, lies(p)]).filter(([, t]) => t !== null)
  return tot.map(({ gleicheDatei, ...t }) => ({ ...t, gleicheDatei, kandidaten: quellen.filter(([p, t2]) => p !== t.alt && t2.includes(t.suche)).map(([p]) => p) }))
}

/** Vorschläge mit genau einem Kandidaten, die sich sicher eintragen lassen (eine Änderung je Datei im Mutanten). */
export const eindeutige = (vorschlaege) => vorschlaege.filter((v) => v.kandidaten.length === 1 && v.gleicheDatei === 1)

/** Trägt die eindeutigen Vorschläge in den Listentext ein; Rückgabe { text, geaendert }. Name nicht eindeutig im Text: unverändert. */
export function umhaengenText(listeText, vorschlaege) {
  let text = listeText
  let geaendert = 0
  for (const v of eindeutige(vorschlaege)) {
    const nameLit = new RegExp(`"name"\\s*:\\s*${JSON.stringify(v.name).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'g')
    const treffer = [...text.matchAll(nameLit)]
    if (treffer.length !== 1) continue
    const start = treffer[0].index
    const naechster = text.indexOf('"name"', start + 1)
    const ende = naechster === -1 ? text.length : naechster
    const dateiLit = new RegExp(`("datei"\\s*:\\s*)${JSON.stringify(v.alt).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`)
    const abschnitt = text.slice(start, ende)
    if (!dateiLit.test(abschnitt)) continue
    text = text.slice(0, start) + abschnitt.replace(dateiLit, (_, kopf) => kopf + JSON.stringify(v.kandidaten[0])) + text.slice(ende)
    geaendert++
  }
  return { text, geaendert }
}

/** Zeilen für die Ausgabe: Vorschlag bei einem Treffer, sonst nur die Meldung. */
export function vorschlagZeilen(listeName, vorschlaege) {
  return vorschlaege.map((v) => {
    if (v.kandidaten.length === 0) return `${listeName}: „${v.name}“: kein Treffer für die Suche in ${v.alt}, kein Vorschlag`
    if (v.kandidaten.length > 1) return `${listeName}: „${v.name}“: ${v.kandidaten.length} Dateien enthalten die Suche (${v.kandidaten.join(', ')}), nur gemeldet`
    return `${listeName}: „${v.name}“: Vorschlag ${v.alt} -> ${v.kandidaten[0]}`
  })
}
