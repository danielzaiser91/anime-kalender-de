/**
 * Wartet der Reihe nach auf eine Sperre aus `einzel-sperre.mjs` (`bau-vergleich`). Vorher fragte jeder Wartende alle paar
 * Sekunden die Sperre ab; wer gerade zufällig nach der Freigabe dran war, überholte die Älteren (13.10.2026: Katalog-Release
 * dreimal, OG-Titel viermal Exit 3, ohne dass ein Vergleich lief).
 *
 * Jeder Wartende legt ein Ticket `<name>.warte-<Zeit>-<PID>` neben die Sperre in `tmpdir()`. Nur der Älteste darf die Sperre
 * nehmen. Tickets, deren Prozess nicht mehr lebt (hart beendeter Wartender), räumt jeder Wartende beim nächsten Takt weg;
 * ein Ticket wird auch beim regulären Ende, bei SIGINT und SIGTERM gelöscht. Eine Frist (Vorgabe 45 min) beendet den Aufruf
 * mit Exit 3 und nennt Platz und Halter.
 */
import { readdirSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { basename, join } from 'node:path'
import { beschreibeHalter, lebt, liesSperre, nimmSperre } from './einzel-sperre.mjs'

const MINUTE = 60_000
export const FRIST_MS = 45 * MINUTE

const ticketName = (name, zeit, pid) => `${name}.warte-${String(zeit).padStart(15, '0')}-${String(pid).padStart(10, '0')}`

function liesTicket(datei) {
  try {
    return JSON.parse(readFileSync(datei, 'utf8'))
  } catch {
    return null
  }
}

/** Legt das eigene Ticket atomar (Schreiben, dann Umbenennen) ab und sorgt dafür, dass es mit dem Prozess verschwindet. */
function legeTicket(name, wer, zeit = Date.now()) {
  const datei = join(tmpdir(), ticketName(name, zeit, process.pid))
  const entwurf = join(tmpdir(), `${name}.entwurf-${process.pid}`)
  writeFileSync(entwurf, JSON.stringify({ pid: process.pid, exe: basename(process.execPath).toLowerCase(), seit: new Date().toISOString(), wer }))
  renameSync(entwurf, datei)
  const entfernen = () => rmSync(datei, { force: true })
  process.on('exit', entfernen)
  process.on('SIGINT', () => process.exit(130))
  process.on('SIGTERM', () => process.exit(143))
  return { datei, entfernen }
}

/** Lebende Tickets von `name`, älteste zuerst. Tickets toter oder unlesbarer Wartender werden gelöscht (mit Meldung). */
export function lebendeTickets(name, ordner = tmpdir()) {
  const lebende = []
  for (const datei of readdirSync(ordner).filter((f) => f.startsWith(`${name}.warte-`)).sort()) {
    const pfad = join(ordner, datei)
    const ticket = liesTicket(pfad)
    if (ticket && lebt(ticket.pid, ticket.exe)) {
      lebende.push({ ...ticket, pfad })
      continue
    }
    console.warn(`${name}: abgebrochener Wartender${ticket ? ` (PID ${ticket.pid}, seit ${ticket.seit})` : ''} aus der Schlange entfernt.`)
    rmSync(pfad, { force: true })
  }
  return lebende
}

function sperrText(name) {
  const sperre = liesSperre(name)
  return sperre ? `Sperre hält ${beschreibeHalter(sperre)}` : 'Sperre gerade frei'
}

/**
 * Wartet höchstens `maxMs`, bis der Aufruf an der Reihe ist und die Sperre bekommt. Meldet jede Platzänderung sofort, sonst
 * jede Minute (Platz, Länge der Schlange, Halter). Läuft die Frist ab: Meldung und Exit 3.
 */
export async function wartAufSperre(name, maxMs = FRIST_MS, takt = 5_000, wer) {
  const ende = Date.now() + maxMs
  const start = Date.now()
  let ticket = legeTicket(name, wer, start)
  let letzterPlatz = ''
  let naechsteMeldung = 0
  for (;;) {
    const schlange = lebendeTickets(name)
    const platz = schlange.findIndex((t) => t.pfad === ticket.datei) + 1
    if (platz === 0) {
      ticket = legeTicket(name, wer, start) // Ticket wurde fälschlich weggeräumt (Lesefehler): an alter Stelle wieder anlegen
      continue
    }
    if (platz === 1 && !nimmSperre(name, wer)) {
      ticket.entfernen()
      return
    }
    const stand = `Platz ${platz} von ${schlange.length}`
    if (Date.now() + takt > ende) {
      console.error(`${name}: nach ${Math.round(maxMs / MINUTE)} min Warten aufgegeben (${stand}; ${sperrText(name)}). Ein neuer Aufruf reiht sich hinten ein.`)
      process.exit(3)
    }
    if (stand !== letzterPlatz || Date.now() >= naechsteMeldung) {
      console.log(`${name}: ${stand} in der Schlange — ${sperrText(name)} — warte bis zu ${Math.round(maxMs / MINUTE)} min.`)
      letzterPlatz = stand
      naechsteMeldung = Date.now() + MINUTE
    }
    await new Promise((fertig) => setTimeout(fertig, takt))
  }
}
