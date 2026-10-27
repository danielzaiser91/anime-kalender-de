/**
 * Fristen der Wochenwache (`tools/wache-woechentlich.mjs`): Wie alt darf der letzte erfolgreiche Lauf je Workflow sein?
 * Reine Funktionen und Tabelle, damit ein Test sie ohne `gh` fährt.
 */

/** Frist = drei Takte, mindestens 3 h, nie länger als die bisherige Frist (nur verkürzen). */
export function fristAusTakt(taktStunden, bisherStunden) {
  return Math.min(bisherStunden, Math.max(3, 3 * taktStunden))
}

/**
 * Workflow: erlaubtes Alter des letzten erfolgreichen Laufs in Stunden.
 * Takt aus `shared/weckplan.ts` (Stand 27.10.2026): refresh-hourly stündlich, adn-laufende 4 Starts am Tag (alle 6 h).
 * Gemessen an 14 Tagen echter Läufe (`gh run list`): deploy.yml (Lücken bis 5,1 h)
 * hängt an Pushes und Vorläufen ohne festen Takt und bleibt bei der alten Frist; Tageswecker liegen mit 3 × 24 h über der alten Frist.
 */
export const FRISTEN_STUNDEN = {
  'refresh-hourly.yml': fristAusTakt(1, 12),
  'refresh-data.yml': 36,
  // Ausnahme von 3 x Takt: gemessene Lücken bis 6,2 h (27.10.2026), 3 h gäbe Fehlalarme.
  'bestand-bauen.yml': 8,
  'deploy.yml': 48,
  'adn-laufende.yml': fristAusTakt(6, 24),
  'claude-verpasst-recherche.yml': 36,
  'claude-anime2you-extraktion.yml': 36,
  'claude-wache-urteil.yml': 36,
  'anisearch-katalog.yml': 48,
  'ladezeiten.yml': 36,
  'offizielle-news.yml': 36,
  'meldungskopie.yml': 36,
  'refresh-weekly.yml': 216,
  // Wie `motn` in check-sources.ts: ein Kontingentzyklus plus zwei Tage.
  'tonspuren-monatlich.yml': 792,
}

/** Befunde aller Workflows; `letzterErfolg(workflow)` liefert Millisekunden oder null und darf werfen. */
export function pruefeFristen(letzterErfolg, jetzt, fristen = FRISTEN_STUNDEN, ausgabe = () => {}) {
  const befunde = []
  for (const [workflow, max] of Object.entries(fristen)) {
    let t = null
    try {
      t = letzterErfolg(workflow)
    } catch (e) {
      befunde.push(`${workflow}: Abfrage fehlgeschlagen (${String(e.message).split('\n')[0]})`)
      continue
    }
    const alter = t === null ? null : (jetzt - t) / 3600e3
    ausgabe(`${workflow.padEnd(32)} letzter Erfolg vor ${alter === null ? 'nie' : alter.toFixed(1) + ' h'} (erlaubt ${max} h)`)
    const befund = befundZuAlt(workflow, alter, fristen)
    if (befund) befunde.push(befund)
  }
  return befunde
}

/** Befundtext, wenn der letzte Erfolg zu alt ist (alter in Stunden, null = nie), sonst null. */
export function befundZuAlt(workflow, alter, fristen = FRISTEN_STUNDEN) {
  const max = fristen[workflow]
  if (alter !== null && !(alter > max)) return null
  return `${workflow}: letzter erfolgreicher Lauf ${alter === null ? 'nie' : 'vor ' + Math.round(alter) + ' h'}, erlaubt ${max} h`
}
