/**
 * Schnappschuss von .github/workflows/pr-pruefer.yml (Schreib-Token, Freigabe): Das ganze geparste Dokument wird mit
 * tools/pr-pruefer.schnappschuss.json verglichen, jeder Schlüssel und jeder Wert zählt. Nur der Prompt-Text der
 * Prüfer wird ersetzt (ändert sich oft, hat keine Rechte; seine Wirkung auf den Zustand prüft pr-pruefer-ablauf.test).
 */
import fs from 'node:fs'

export const WORKFLOW = new URL('../.github/workflows/pr-pruefer.yml', import.meta.url)
export const SCHNAPPSCHUSS = new URL('./pr-pruefer.schnappschuss.json', import.meta.url)
const PROMPT = '<Prompt-Text: nicht Teil des Schnappschusses>'

/** Tiefe Kopie des Workflows, bei der `with.prompt` jedes Schritts durch einen festen Platzhalter ersetzt ist. */
export function fuerSchnappschuss(wf) {
  const kopie = JSON.parse(JSON.stringify(wf))
  for (const job of Object.values(kopie.jobs ?? {})) {
    for (const s of job.steps ?? []) {
      if (s.with && 'prompt' in s.with) s.with.prompt = PROMPT
    }
  }
  return kopie
}

const istObjekt = (w) => w !== null && typeof w === 'object'

/** Alle Stellen, an denen Ist vom Soll abweicht: [{ pfad, soll, ist }]; fehlend ist `undefined`. */
export function unterschiede(soll, ist, pfad = '') {
  if (!istObjekt(soll) || !istObjekt(ist) || Array.isArray(soll) !== Array.isArray(ist)) {
    return JSON.stringify(soll) === JSON.stringify(ist) ? [] : [{ pfad: pfad || '(Wurzel)', soll, ist }]
  }
  const schluessel = [...new Set([...Object.keys(soll), ...Object.keys(ist)])]
  return schluessel.flatMap((s) => unterschiede(soll[s], ist[s], Array.isArray(soll) ? `${pfad}[${s}]` : `${pfad}.${s}`.replace(/^\./, '')))
}

/** Die Meldung bei Abweichung: Pfad, Soll, Ist und der Weg zur absichtlichen Änderung. */
export function meldung(diffs) {
  const zeilen = diffs.map((d) => `  ${d.pfad}\n    Soll: ${JSON.stringify(d.soll)}\n    Ist:  ${JSON.stringify(d.ist)}`)
  return [
    `pr-pruefer.yml weicht vom Schnappschuss ab (${diffs.length} Stelle(n)):`,
    ...zeilen,
    'Absichtliche Änderung? Schnappschuss mit `node tools/pr-pruefer-freigabe.test.mjs --schnappschuss` neu schreiben;',
    'der Prüfer sieht die Änderung dann im Diff von tools/pr-pruefer.schnappschuss.json.',
  ].join('\n')
}

export function leseSchnappschuss() {
  return JSON.parse(fs.readFileSync(SCHNAPPSCHUSS, 'utf8'))
}

export function schreibeSchnappschuss(wf) {
  fs.writeFileSync(SCHNAPPSCHUSS, JSON.stringify(fuerSchnappschuss(wf), null, 2) + '\n')
}
