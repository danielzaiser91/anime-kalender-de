/**
 * Fristen der Wochenwache (`tools/wache-woechentlich.mjs`): Wie alt darf der letzte erfolgreiche Lauf je Workflow sein?
 * Reine Funktionen und Tabelle, damit ein Test sie ohne `gh` fährt.
 */

/** Frist = drei Takte, mindestens 3 h, nie länger als die bisherige Frist (nur verkürzen). */
export function fristAusTakt(taktStunden, bisherStunden) {
  return Math.min(bisherStunden, Math.max(3, 3 * taktStunden))
}

/**
 * Workflow: erlaubtes Alter des letzten erfolgreichen Laufs in Stunden — die einzige Frist-Tabelle, die Wochen-Wache
 * (`tools/wache-woechentlich.mjs`) und Zugangs-Wache (`tools/zugangs-waechter.mjs`) lesen.
 * Takt aus `shared/weckplan.ts` (Stand 27.10.2026): refresh-hourly stündlich, adn-laufende 4 Starts am Tag (alle 6 h).
 * Werte aus den größten Lücken zwischen zwei Erfolgen (`gh run list`, 7 Tage, bei Wochen- und Monatsläufen 14 Tage / alle Läufe,
 * Messung 03.11.2026) plus Reserve: bestand-bauen 13,5 h, refresh-weekly 243,6 h, tonspuren-monatlich 867,7 h, meldungskopie 33,2 h;
 * Tageslauf-Workflows 24 h → 36 h (1,5-fach). deploy.yml, adn-laufende.yml und claude-daten-merge.yml hängen an Pushes, Vorläufen
 * oder Takten ohne feste Lücke und bleiben bei ihren Fristen.
 */
export const FRISTEN_STUNDEN = {
  'refresh-hourly.yml': fristAusTakt(1, 12),
  'refresh-data.yml': 36,
  'daten-auf-abruf.yml': 36,
  'bestand-bauen.yml': 18,
  'd1-verbrauch.yml': 48,
  'deploy.yml': 48,
  'adn-laufende.yml': fristAusTakt(6, 24),
  'claude-verpasst-recherche.yml': 36,
  'claude-anime2you-extraktion.yml': 36,
  'claude-wache-urteil.yml': 36,
  'claude-daten-merge.yml': 48,
  'anisearch-katalog.yml': 36,
  'ladezeiten.yml': 36,
  'offizielle-news.yml': 36,
  'meldungskopie.yml': 48,
  'refresh-weekly.yml': 336,
  'tonspuren-monatlich.yml': 1008,
}

/** Befunde aller Workflows; `letzterErfolg(workflow)` liefert Millisekunden oder null und darf werfen. */
export function pruefeFristen(letzterErfolg, jetzt, fristen, ausgabe = () => {}) {
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
