/**
 * Alarm „Bestandsbau rot“: der letzte grüne Lauf von `bestand-bauen.yml` ist älter als die Grenze, und danach liegen rote oder
 * abgebrochene Läufe. Liest nur GitHub (kein Worker, kein Token), damit ein Ausfall des Status-Workers ihn nicht verdeckt.
 * Anlass: Der Bau war vom 21.10.2026 18:10 bis 23.10.2026 13:07 UTC rot (46 Läufe); die Wache erlaubt dem Workflow 36 h
 * (`wache-woechentlich.mjs`), das Urteil nannte es erst nach 39,9 h.
 */
export const BESTAND_ROT_GRENZE_STUNDEN = 6
export const BESTAND_WORKFLOW = 'bestand-bauen.yml'
const ROT = new Set(['failure', 'timed_out', 'cancelled'])

/** `laeufe`: `[{ status, conclusion, createdAt }]` (gh run list). Übersprungene Läufe (Push ohne Bau) zählen weder grün noch rot. */
export function bestandRotAlarm(laeufe, jetztMs, grenzeStunden = BESTAND_ROT_GRENZE_STUNDEN) {
  const fertig = laeufe.filter((l) => l.conclusion)
  const gruen = fertig
    .filter((l) => l.conclusion === 'success')
    .map((l) => l.createdAt)
    .sort()
    .at(-1)
  const aelteste = fertig.map((l) => l.createdAt).sort()[0]
  const bezug = gruen ?? aelteste
  const rote = fertig.filter((l) => ROT.has(l.conclusion) && (gruen === undefined || l.createdAt > gruen)).length
  const stunden = (jetztMs - Date.parse(bezug)) / 3_600_000
  return { alarm: rote > 0 && stunden > grenzeStunden, stunden, gruenAm: gruen, rote }
}

/** Die Alarmzeile, oder `undefined` ohne Alarm. */
export function alarmZeile(ergebnis) {
  if (!ergebnis.alarm) return undefined
  const gruen = ergebnis.gruenAm ? `letzter grüner Lauf ${ergebnis.gruenAm}` : 'kein grüner Lauf in den abgefragten Läufen'
  return `ALARM Bestandsbau seit ${ergebnis.stunden.toFixed(1)} h rot (${gruen}, ${ergebnis.rote} rote/abgebrochene danach, Grenze ${BESTAND_ROT_GRENZE_STUNDEN} h)`
}

/** Liest die Läufe mit der übergebenen `gh`-Funktion; nicht lesbar ist selbst eine Zeile, nie Schweigen. */
export function bestandRotText(gh, repo, jetztMs) {
  try {
    return bestandRotZeile(holeLaeufeJson(gh, repo, BESTAND_WORKFLOW), jetztMs)
  } catch (fehler) {
    return `ALARM? Läufe des Bestandsbaus nicht lesbar: ${String(fehler.message).split('\n')[0]}`
  }
}

/** Zeile aus bereits geholten Läufen; ein Rechenfehler ist selbst eine Zeile. */
export function bestandRotZeile(laeufe, jetztMs) {
  try {
    const ergebnis = bestandRotAlarm(laeufe, jetztMs)
    return alarmZeile(ergebnis) ?? `Bestandsbau: kein Alarm (letzter grüner Lauf ${ergebnis.gruenAm ?? 'unbekannt'}, ${ergebnis.rote} rote/abgebrochene danach)`
  } catch (fehler) {
    return `ALARM? Läufe des Bestandsbaus nicht lesbar: ${String(fehler.message).split('\n')[0]}`
  }
}

export const DEPLOY_WORKFLOW = 'deploy.yml'
export const DEPLOY_ROT_GRENZE_STUNDEN = 6
export const SCHRITTE_GRENZE_STUNDEN = 1
export const SCHRITTE_MINDESTZAHL = 2
const SCHRITTE_LAEUFE = 5

/** Deploy ohne Erfolg: gleiche Regel wie beim Bestandsbau (letzter Erfolg älter als die Grenze, danach rote Läufe), eigene Zeile. */
export function deployAlarmZeile(laeufe, jetztMs, grenzeStunden = DEPLOY_ROT_GRENZE_STUNDEN) {
  const e = bestandRotAlarm(laeufe, jetztMs, grenzeStunden)
  if (!e.alarm) return undefined
  const gruen = e.gruenAm ? `letzter Erfolg ${e.gruenAm}` : 'kein Erfolg in den abgefragten Läufen'
  return `ALARM Deploy seit ${e.stunden.toFixed(1)} h ohne Erfolg (${gruen}, ${e.rote} rote/abgebrochene danach, Grenze ${grenzeStunden} h)`
}

/** Rote Läufe nach dem letzten grünen, neueste zuerst: `[{ databaseId, createdAt }]`. */
export function roteSeitGruen(laeufe) {
  const fertig = laeufe.filter((l) => l.conclusion)
  const gruen = fertig.filter((l) => l.conclusion === 'success').map((l) => l.createdAt).sort().at(-1)
  return fertig.filter((l) => ROT.has(l.conclusion) && (gruen === undefined || l.createdAt > gruen)).sort((a, b) => b.createdAt.localeCompare(a.createdAt))
}

/** `jobsJe`: Antworten von `gh run view --json jobs`. Ergebnis: verschiedene „Job: Schritt“ mit Fehlschlag. */
export function fehlerschritte(jobsJe) {
  const namen = new Set()
  for (const antwort of jobsJe) {
    for (const job of antwort.jobs ?? []) {
      for (const schritt of job.steps ?? []) if (schritt.conclusion === 'failure') namen.add(`${job.name}: ${schritt.name}`)
    }
  }
  return [...namen].sort()
}

/** Bestandsbau rot länger als die Grenze, und die roten Läufe scheitern an mindestens zwei verschiedenen Schritten (Kette, nicht ein Wackler). */
export function schritteAlarmZeile(rote, schritte, jetztMs) {
  if (rote.length === 0 || schritte.length < SCHRITTE_MINDESTZAHL) return undefined
  const stunden = (jetztMs - Date.parse(rote.at(-1).createdAt)) / 3_600_000
  if (stunden <= SCHRITTE_GRENZE_STUNDEN) return undefined
  return `ALARM Bestandsbau seit ${stunden.toFixed(1)} h rot mit ${schritte.length} verschiedenen Fehlerschritten (${schritte.join('; ')}; Grenze ${SCHRITTE_GRENZE_STUNDEN} h)`
}

const holeLaeufeJson = (gh, repo, workflow) =>
  JSON.parse(gh('run', 'list', '--repo', repo, '--workflow', workflow, '--limit', '200', '--json', 'status,conclusion,createdAt,databaseId'))

/** Alle Alarmzeilen (Bestandsbau 6 h, Fehlerschritte, Deploy) in einem Text; jede Teilprüfung meldet ihren Lesefehler selbst. */
export function rotAlarmText(gh, repo, jetztMs) {
  let bestand
  let abrufFehler
  try {
    bestand = holeLaeufeJson(gh, repo, BESTAND_WORKFLOW)
  } catch (fehler) {
    abrufFehler = fehler
  }
  const zeilen = [abrufFehler ? `ALARM? Läufe des Bestandsbaus nicht lesbar: ${String(abrufFehler.message).split('\n')[0]}` : bestandRotZeile(bestand, jetztMs)]
  try {
    if (abrufFehler) throw abrufFehler
    const rote = roteSeitGruen(bestand)
    const jobs = rote.slice(0, SCHRITTE_LAEUFE).map((r) => JSON.parse(gh('run', 'view', String(r.databaseId), '--repo', repo, '--json', 'jobs')))
    const z = schritteAlarmZeile(rote, fehlerschritte(jobs), jetztMs)
    if (z) zeilen.push(z)
  } catch (fehler) {
    zeilen.push(`ALARM? Fehlerschritte des Bestandsbaus nicht lesbar: ${String(fehler.message).split('\n')[0]}`)
  }
  try {
    const z = deployAlarmZeile(holeLaeufeJson(gh, repo, DEPLOY_WORKFLOW), jetztMs)
    zeilen.push(z ?? 'Deploy: kein Alarm')
  } catch (fehler) {
    zeilen.push(`ALARM? Läufe des Deploys nicht lesbar: ${String(fehler.message).split('\n')[0]}`)
  }
  return zeilen.join('\n')
}
