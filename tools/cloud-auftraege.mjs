/**
 * Cloud-Aufträge (14.11.2026): der lokale Dirigent startet Bau-Aufträge als Cloud-Routinen, eine Routine je Auftrag.
 * Dieses Werkzeug führt das Register (JSON-Liste `{ id, routine, start }`) und beantwortet, ob ein Auftrag starten darf.
 * Reine Logik hier, gh-Aufrufe in `cloud-auftraege-welt.mjs` (Tests setzen eine Attrappe-Welt ein). Nur Node-Bordmittel.
 *
 * Exit 0 = ja, 1 = nein (Grund in einer Zeile), 2 = Aufruf- oder Abruffehler (nie stilles „nein“ oder „ja“).
 *   vorab <id> --register <pfad>
 *   eintragen <id> --routine <trig_id> --register <pfad> [--vorrat <datei.md>]
 *   uebersicht --register <pfad> [--runs <runs.json>] [--json]
 *   kontingent
 */
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { pathToFileURL } from 'node:url'

const MIN = 60_000
const STUNDE = 60 * MIN
export const FENSTER_MS = 72 * STUNDE
export const KONTINGENT_MIN = 5
export const KONTINGENT_MAX = 15
export const AKTIV_HOECHSTENS = 5
export const LAEUFT_STILL_MS = 45 * MIN
export const IDLE_OHNE_PR_MS = 30 * MIN

const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** PR, dessen Beschreibung die Zeile `Auftrag: <id>` trägt (die Zeile darf weitere Teile hinter ` · ` haben). */
export const traegtAuftrag = (pr, id) => new RegExp(`^\\s*Auftrag:\\s*${esc(id)}(?=\\s|·|$)`, 'm').test(pr.beschreibung ?? '')
const erledigt = (pr) => pr !== undefined && !pr.offen

/** Neuester PR mit der Auftragszeile (offene zuerst, dann nach Nummer). */
export function prZuAuftrag(prs, id) {
  const treffer = prs.filter((p) => traegtAuftrag(p, id)).sort((a, b) => Number(b.offen) - Number(a.offen) || b.nummer - a.nummer)
  return treffer[0]
}

export function leseRegister(pfad) {
  if (!existsSync(pfad)) return []
  const daten = JSON.parse(readFileSync(pfad, 'utf8'))
  if (!Array.isArray(daten)) throw new Error(`Register ${pfad} ist keine Liste`)
  return daten
}

const istCodePr = (p) => !p.entwurf && !/^chore\(data\)/.test(p.titel) && !/^github-actions/.test(p.autor ?? '')
const stundeVon = (iso) => Math.floor(Date.parse(iso) / STUNDE)

/** Median einer nicht leeren Zahlenliste. */
export function median(zahlen) {
  const s = [...zahlen].sort((a, b) => a - b)
  const m = s.length >> 1
  return s.length % 2 === 1 ? s[m] : (s[m - 1] + s[m]) / 2
}

/** Durchsatz und Grenze aus den gemergten PRs der letzten 72 h (Daten-Bot ausgeschlossen); `offen` zählt offene, bereite Code-PRs. */
export function kontingentVon(prs, jetztMs) {
  const seit = jetztMs - FENSTER_MS
  const je = new Map()
  for (const p of prs) {
    if (!p.gemergtAm || Date.parse(p.gemergtAm) < seit || !istCodePr(p)) continue
    je.set(stundeVon(p.gemergtAm), (je.get(stundeVon(p.gemergtAm)) ?? 0) + 1)
  }
  const durchsatz = je.size === 0 ? 0 : median([...je.values()])
  const grenze = Math.min(KONTINGENT_MAX, Math.max(KONTINGENT_MIN, Math.round(durchsatz * 2)))
  const offen = prs.filter((p) => p.offen && istCodePr(p)).length
  return { offen, grenze, durchsatz, von: new Date(seit).toISOString(), bis: new Date(jetztMs).toISOString(), voll: offen >= grenze }
}

const hm = (iso) => iso.slice(11, 16)
export const kontingentZeile = (k) => `Kontingent: ${k.offen}/${k.grenze} (Durchsatz ${k.durchsatz}/h, gemessen ${k.von.slice(0, 10)} ${hm(k.von)}–${k.bis.slice(0, 10)} ${hm(k.bis)} UTC)`

/** Darf der Auftrag starten? { ok, grund } nach den vier Regeln a–d; die erste Abweisung zählt. */
export function vorabUrteil(id, register, prs, kontingent) {
  const eintrag = register.find((e) => e.id === id)
  if (eintrag && !erledigt(prZuAuftrag(prs, id))) return { ok: false, grund: `${id} steht im Register und sein PR ist weder gemergt noch geschlossen` }
  const offener = prs.find((p) => p.offen && traegtAuftrag(p, id))
  if (offener) return { ok: false, grund: `offener PR #${offener.nummer} trägt „Auftrag: ${id}“` }
  if (kontingent.voll) return { ok: false, grund: kontingentZeile(kontingent) }
  const aktiv = register.filter((e) => !erledigt(prZuAuftrag(prs, e.id))).length
  if (aktiv >= AKTIV_HOECHSTENS) return { ok: false, grund: `${aktiv} aktive Cloud-Sitzungen im Register (höchstens ${AKTIV_HOECHSTENS - 1} plus der neue)` }
  return { ok: true, grund: 'darf starten' }
}

/** Register mit neuem Eintrag; derselbe id wird ersetzt (Neustart nach geschlossenem PR). */
export const mitEintrag = (register, eintrag) => [...register.filter((e) => e.id !== eintrag.id), eintrag]

const BERLIN = new Intl.DateTimeFormat('de-DE', { timeZone: 'Europe/Berlin', day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export function vergebenZeile(routine, jetztMs) {
  const t = Object.fromEntries(BERLIN.formatToParts(jetztMs).map((p) => [p.type, p.value]))
  return `**Vergeben:** Cloud-Routine https://claude.ai/code/routines/${routine} (${t.day}.${t.month}. ${t.hour}:${t.minute})`
}

/** Vorratsdatei mit Vergeben-Zeile unter der ersten Zeile; null, wenn dort schon eine steht. */
export function vorratMitVergeben(text, zeile) {
  if (/^\*\*Vergeben:\*\*/m.test(text)) return null
  const zeilen = text.split('\n')
  zeilen.splice(1, 0, zeile)
  return zeilen.join('\n')
}

const letzterEvent = (runs) => (runs?.data ?? []).map((r) => ({ ...r, ms: Date.parse(r.last_event_at ?? '') || 0 })).sort((a, b) => b.ms - a.ms)[0]

/** Sitzungszustand und Alarm eines Eintrags; `lauf` ist der jüngste Run aus runs.json oder undefined. */
export function sitzungVon(lauf, hatPr, startMs, jetztMs) {
  if (lauf === undefined) return { zustand: 'unbekannt', alarm: null }
  const still = jetztMs - lauf.ms
  if (lauf.worker_status === 'running' && still > LAEUFT_STILL_MS) return { zustand: 'running', alarm: `läuft, aber seit ${Math.round(still / MIN)} min kein Ereignis` }
  if (lauf.worker_status === 'idle' && !hatPr && jetztMs - startMs > IDLE_OHNE_PR_MS) return { zustand: 'idle', alarm: `idle ohne PR, Start vor ${Math.round((jetztMs - startMs) / MIN)} min` }
  return { zustand: lauf.worker_status ?? 'unbekannt', alarm: null }
}

/** Eine Zeile je Eintrag als Objekt; `pruefstand(nummer)` liefert { kette, kandidat, grund } oder wirft. */
export function eintragStand(eintrag, prs, runs, pruefstand, jetztMs, letzterCommit) {
  const pr = prZuAuftrag(prs, eintrag.id)
  if (erledigt(pr)) return { id: eintrag.id, fertig: true, pr: pr.nummer }
  const sitzung = sitzungVon(letzterEvent(runs?.[eintrag.routine]), pr !== undefined, Date.parse(eintrag.start), jetztMs)
  const stand = { id: eintrag.id, fertig: false, start: eintrag.start, pr: pr?.nummer ?? null, commit: null, kette: null, kandidat: null, grund: null, sitzung: sitzung.zustand, alarm: sitzung.alarm }
  if (pr === undefined) return stand
  stand.commit = letzterCommit(pr.nummer)
  try {
    Object.assign(stand, pruefstand(pr.nummer))
  } catch (e) {
    stand.grund = `Prüfstand unlesbar: ${e.message}`
  }
  return stand
}

export function standZeile(s) {
  const pr = s.pr === null ? 'kein PR' : `PR #${s.pr}`
  const commit = s.commit ? `letzter Commit ${s.commit}` : 'kein Commit'
  const merge = s.kandidat === null ? '' : ` · Merge-reif: ${s.kandidat ? 'ja' : 'nein'}`
  return `${s.id} · Start ${s.start} · ${pr} · ${commit} · Kette: ${s.kette ?? '–'}${merge} · Prüfstand: ${s.grund ?? '–'} · Sitzung: ${s.sitzung}`
}

function uebersicht(register, prs, runs, welt, jetztMs) {
  const staende = register.map((e) => eintragStand(e, prs, runs, welt.pruefstand, jetztMs, welt.letzterCommit))
  const offene = staende.filter((s) => !s.fertig)
  return { eintraege: offene, fertig: staende.length - offene.length, alarme: offene.filter((s) => s.alarm).map((s) => `ALARM haengt: ${s.id} ${s.alarm}`) }
}

function optionen(args) {
  const o = { _: [] }
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--json') o.json = true
    else if (args[i].startsWith('--')) o[args[i].slice(2)] = args[++i]
    else o._.push(args[i])
  }
  return o
}

/** Frühester Start im Register, damit die PR-Abfrage alle PRs der Einträge umfasst (ein PR entsteht nach dem Start). */
const fensterSeit = (register, jetztMs) => Math.min(jetztMs - FENSTER_MS, ...register.map((e) => Date.parse(e.start) || jetztMs))

/** Ablauf aller Unterbefehle; gibt den Exit-Code zurück. `welt`: { jetzt, prs(seitMs), letzterCommit, pruefstand, zeile }. */
export function lauf(argv, welt) {
  const [befehl, ...rest] = argv
  const o = optionen(rest)
  const jetzt = welt.jetzt()
  const registerPfad = o.register
  const braucheRegister = befehl !== 'kontingent'
  if (!['vorab', 'eintragen', 'uebersicht', 'kontingent'].includes(befehl)) return fehler(welt, 'Aufruf: vorab|eintragen|uebersicht|kontingent (siehe Kopf von tools/cloud-auftraege.mjs)')
  if (braucheRegister && !registerPfad) return fehler(welt, '--register <pfad.json> fehlt')
  if (braucheRegister && befehl !== 'eintragen' && !existsSync(registerPfad)) return fehler(welt, `Register ${registerPfad} fehlt (falscher Pfad? nur eintragen legt es an)`)
  const register = braucheRegister ? leseRegister(registerPfad) : []
  if (befehl === 'kontingent') {
    const k = kontingentVon(welt.prs(jetzt - FENSTER_MS), jetzt)
    welt.zeile(kontingentZeile(k))
    return k.voll ? 1 : 0
  }
  if (befehl === 'uebersicht') return befehlUebersicht(o, register, welt, jetzt)
  const id = o._[0]
  if (!id) return fehler(welt, 'Auftrags-id fehlt')
  if (befehl === 'vorab') {
    const prs = welt.prs(fensterSeit(register, jetzt))
    const u = vorabUrteil(id, register, prs, kontingentVon(prs, jetzt))
    welt.zeile(u.ok ? u.grund : `nein: ${u.grund}`)
    return u.ok ? 0 : 1
  }
  return befehlEintragen(id, o, register, welt, jetzt)
}

function fehler(welt, text) {
  welt.zeile(`Fehler: ${text}`)
  return 2
}

function befehlEintragen(id, o, register, welt, jetzt) {
  if (!o.routine) return fehler(welt, '--routine <trig_id> fehlt')
  let vorrat = null
  if (o.vorrat) {
    if (!existsSync(o.vorrat)) return fehler(welt, `Vorratsdatei ${o.vorrat} fehlt`)
    vorrat = vorratMitVergeben(readFileSync(o.vorrat, 'utf8'), vergebenZeile(o.routine, jetzt))
    if (vorrat === null) {
      welt.zeile(`nein: ${o.vorrat} trägt schon eine Vergeben-Zeile`)
      return 1
    }
  }
  writeFileSync(o.register, `${JSON.stringify(mitEintrag(register, { id, routine: o.routine, start: new Date(jetzt).toISOString() }), null, 2)}\n`)
  if (vorrat !== null) writeFileSync(o.vorrat, vorrat)
  welt.zeile(`eingetragen: ${id} → ${o.routine}`)
  return 0
}

function befehlUebersicht(o, register, welt, jetzt) {
  let runs = {}
  if (o.runs) {
    if (!existsSync(o.runs)) return fehler(welt, `${o.runs} fehlt`)
    runs = JSON.parse(readFileSync(o.runs, 'utf8'))
  }
  const u = uebersicht(register, welt.prs(fensterSeit(register, jetzt)), runs, welt, jetzt)
  if (o.json) welt.zeile(JSON.stringify(u, null, 2))
  else {
    for (const s of u.eintraege) welt.zeile(standZeile(s))
    for (const a of u.alarme) welt.zeile(a)
    welt.zeile(`Fertig (PR gemergt/geschlossen): ${u.fertig}`)
  }
  return 0
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  const { echteWelt } = await import('./cloud-auftraege-welt.mjs')
  try {
    process.exitCode = lauf(process.argv.slice(2), echteWelt())
  } catch (e) {
    console.error(`Fehler: ${e.message}`)
    process.exitCode = 2
  }
}
