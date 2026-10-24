/**
 * Entscheidung des Untersuchers ohne Netz: Schlüssel eines roten Bestandsbaus, offenes Issue und
 * offener PR zu diesem Schlüssel. Eigene Datei, damit `untersucher-schluessel.test.mjs` sie mit
 * echten Protokollen prüfen kann; die gh-Aufrufe stehen in `untersucher-vorab.mjs`.
 *
 * Anlass (11./12.10.2026): eine Ursache erzeugte vier Issues und fünf PRs, weil jeder rote Lauf
 * einen frischen Untersucher startete, der das Vorhandene nicht kannte.
 */
import { createHash } from 'node:crypto'

const ANSI = /\x1b\[[0-9;]*m/g
const KOPF = /^[^\t]*\t[^\t]*\t﻿?\d{4}-\d\d-\d\dT[\d:.]+Z ?/
// Meldungen, die jeder rote Bau trägt und die die Ursache nicht nennen.
const ALLGEMEIN = [/^Process completed with exit code/, /^Der gebaute Bestand verletzt eine Zusicherung/]

/** Protokollzeilen ohne Job-/Schrittkopf, Zeitstempel und Farbcodes. */
export function protokollZeilen(text) {
  return text
    .replace(ANSI, '')
    .split(/\r?\n/)
    .map((z) => z.replace(KOPF, ''))
}

/** Die Zeile, die die Ursache nennt: erste Zusicherung ✖/✗, sonst FEHLER:, sonst ⚠-Block vor der Zusicherungsmeldung, sonst erster besonderer ##[error]. */
export function ursachenZeile(zeilen) {
  const zusicherung = zeilen.find((z) => /^\s+[✖✗]\s/.test(z))
  if (zusicherung) return zusicherung
  const fehler = zeilen.find((z) => /^FEHLER:/.test(z))
  if (fehler) return fehler
  const meldungen = zeilen.map((z, i) => ({ i, m: /^##\[error\](.*)$/.exec(z)?.[1] })).filter((e) => e.m !== undefined)
  const anker = meldungen.find((e) => !ALLGEMEIN[0].test(e.m))
  if (!anker) return ''
  if (!ALLGEMEIN[1].test(anker.m)) return anker.m
  let kopf = ''
  for (let i = anker.i - 1; i >= 0 && /^\[pipeline\] ⚠/.test(zeilen[i]); i--) kopf = zeilen[i]
  return kopf
}

/** Zeile ohne Marker und ohne Fundliste: so lesen es Menschen (Issue-Titel). */
export function lesbar(zeile) {
  return zeile
    .replace(/^\[pipeline\]\s*/, '')
    .replace(/^\s*[✖✗⚠]\s*/, '')
    .replace(/\s+—\s+gefunden:.*$/, '')
    .replace(/\s+/g, ' ')
    .trim()
}

/** Zusätzlich ohne Zahlen: gleiche Prüfung, gleiche Ursache — auch wenn andere Titel betroffen sind. */
export const normalisiere = (zeile) => lesbar(zeile).replace(/\d+/g, 'N')

/** `{ text, schluessel, lesbar }` oder `null`, wenn das Protokoll keine Ursache nennt (dann bleibt alles wie bisher). */
export function schluesselAusProtokoll(protokoll) {
  const zeile = ursachenZeile(protokollZeilen(protokoll))
  const text = normalisiere(zeile)
  if (!text) return null
  return { text, lesbar: lesbar(zeile), schluessel: createHash('sha1').update(text).digest('hex').slice(0, 10) }
}

export const markerFuer = (schluessel) => `<!-- untersucher-schluessel: ${schluessel} -->`

/** Offenes Issue mit dem Marker im Text; bei mehreren das älteste (kleinste Nummer). */
export function offenesIssue(issues, schluessel) {
  const marker = markerFuer(schluessel)
  const treffer = issues.filter((i) => (i.body ?? '').includes(marker)).map((i) => i.number)
  return treffer.length ? Math.min(...treffer) : null
}

/** Lauf-Nummern, die ein Issue samt Kommentaren nennt: so erkennt man PRs, die nur den Lauf zitieren. */
export function laufNummern(texte) {
  return [...new Set(texte.join('\n').match(/\b\d{10,12}\b/g) ?? [])]
}

/**
 * So lange hält ein offener PR den Untersucher zurück. Danach gilt er als liegengeblieben: PR 1464 stand
 * vom 17.10. 22:10 bis zum Morgen offen, der Bau blieb rot, und jeder Untersucher meldete `ok` ohne zu arbeiten.
 */
export const PR_FRIST_MS = 6 * 3600 * 1000

function betrifft(p, issueNr, laeufe) {
  const nr = new RegExp(`#${issueNr}(?!\\d)`)
  const t = `${p.title}\n${p.body ?? ''}`
  return nr.test(t) || laeufe.some((l) => t.includes(l))
}

const liegtLange = (p, jetzt) => jetzt - Date.parse(p.createdAt) > PR_FRIST_MS

/** Offene, frische PRs, die das Issue (`#N`) oder einen seiner Läufe nennen. */
export function offenePrs(prs, issueNr, laeufe, jetzt) {
  return prs.filter((p) => betrifft(p, issueNr, laeufe) && !liegtLange(p, jetzt)).map((p) => p.number)
}

/** Passende PRs, die länger als `PR_FRIST_MS` offen stehen: sie halten den Untersucher nicht auf. */
export function liegengebliebenePrs(prs, issueNr, laeufe, jetzt) {
  return prs.filter((p) => betrifft(p, issueNr, laeufe) && liegtLange(p, jetzt)).map((p) => p.number)
}
