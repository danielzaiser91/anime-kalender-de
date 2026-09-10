/**
 * Die Vorfälle der Erweiterung abholen und ablegen, wo sie gelesen werden.
 *
 * **Der Anlass** (Daniel, 10.09.2026): „info bringt nix, du liest nix aus der
 * console aus, ich lese auch nix aus. denk darüber nach auch bezüglich allen
 * anderen derartigen logs, du musst informiert werden über issues."
 *
 * Er hat recht, und der Punkt geht weiter als das eine Log. Die Erweiterung
 * schrieb seit Monaten Diagnosen in die Browserkonsole — „keine Tonspur
 * gelesen", „Folge gehört zu fremder Reihe", „Durchlauf abgebrochen bei M7111".
 * Gelesen hat sie nie jemand: Er schaut dort nicht hin, ich komme gar nicht
 * daran. Die Information existierte nur, wenn er zufällig hinsah und ein
 * Bildschirmfoto schickte — und genau so ist der Fall am 10.09.2026 auch
 * aufgefallen.
 *
 * Seit 4.17.10 meldet die Erweiterung sie an den Worker. Dieser Lauf holt sie
 * ab, fasst sie zusammen und schreibt `daniel-zum-abarbeiten/17-vorfaelle.md`.
 *
 * **Abgeholte Vorfälle werden gelöscht.** Einer, der liegen bleibt, taucht beim
 * nächsten Lauf wieder auf und sieht aus wie ein neuer — dieselbe Falle, die
 * `fetch-pruefungen.ts` mit seinem DELETE vermeidet. Was hier steht, ist also
 * immer der **neue** Stand seit dem letzten Lauf; die Datei sammelt nicht an.
 *
 * Aufruf: `npx tsx pipeline/fetch-vorfaelle.ts [--trocken]`
 */
import { writeFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, warn, ROOT } from './lib/util.ts'
import { recordSource } from './lib/health.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''
const TROCKEN = process.argv.includes('--trocken')

interface Vorfall {
  id: number
  plattform: string
  art: string
  url: string | null
  reihe: string | null
  folge_nr: number | null
  staffel: number | null
  text: string | null
  version: string | null
  gemeldet_am: string
}

/** Was die Arten bedeuten — der Bericht soll ohne Rückfrage lesbar sein. */
const ERKLAERUNG: Record<string, string> = {
  ohne_tonspur:
    'Der Player lieferte binnen zwanzig Sekunden keine Tonspur. Die Folge bleibt offen und kommt beim nächsten Durchlauf wieder dran — **das ist vorgesehen**. Häufen sich diese Fälle, ist die Frist zu knapp.',
  fremde_reihe:
    'Der Player zeigte eine andere Reihe als erwartet. Meist steht dann ein Verweis auf der falschen Adresse.',
  stoerung:
    'Netflix hat den Durchlauf abgebrochen. `M7…` meint die Wiedergabe (zu viele Streams, Netz), `E1…`/`UI…`/`NSES-…` den Titel selbst.',
  melden_fehlgeschlagen: 'Die Meldung kam nicht beim Worker an — der Befund ist verloren.',
  ausnahme: 'Ein unerwarteter Fehler in der Erweiterung.',
}

async function main(): Promise<void> {
  if (!TOKEN) {
    warn('LAUF_TOKEN fehlt — ohne das Token gibt der Worker die Vorfälle nicht heraus.')
    return
  }

  const antwort = await fetch(`${WORKER}/vorfall?token=${encodeURIComponent(TOKEN)}`)
  if (!antwort.ok) {
    warn(`Vorfälle nicht abrufbar: HTTP ${antwort.status}`)
    recordSource('vorfaelle', 0, `HTTP ${antwort.status}`)
    return
  }
  const daten = (await antwort.json()) as { vorfaelle?: Vorfall[] }
  const alle = daten.vorfaelle ?? []
  log(`${alle.length} Vorfall/Vorfälle abgeholt.`)

  const ziel = resolve(ROOT, 'daniel-zum-abarbeiten/17-vorfaelle.md')
  if (!alle.length) {
    recordSource('vorfaelle', 0)
    log('Nichts zu berichten.')
    return
  }

  /* Gruppiert nach Art — die Häufigkeit ist die eigentliche Auskunft. */
  const jeArt = new Map<string, Vorfall[]>()
  for (const v of alle) jeArt.set(v.art, [...(jeArt.get(v.art) ?? []), v])

  const zeilen = [
    '# Vorfälle aus der Erweiterung',
    '',
    'Was der Browser-Erweiterung aufgefallen ist, seit dieser Lauf zuletzt gelesen hat.',
    'Bis zum 10.09.2026 stand das in der Browserkonsole — also an einer Stelle, die',
    'niemand liest: Daniel schaut dort nicht hin, und der Agent kommt gar nicht daran.',
    '',
    `Stand: ${new Date().toISOString().slice(0, 16).replace('T', ' ')} · ${alle.length} Vorfall/Vorfälle`,
    '',
    '**Ein Vorfall ist nicht zwingend ein Fehler.** „Keine Tonspur gelesen" ist ein',
    'vorgesehener Fall — interessant wird er erst durch seine Häufigkeit.',
    '',
  ]

  for (const [art, liste] of [...jeArt].sort((a, b) => b[1].length - a[1].length)) {
    zeilen.push(`## ${art} — ${liste.length}×`, '')
    if (ERKLAERUNG[art]) zeilen.push(ERKLAERUNG[art], '')
    zeilen.push('| Wann | Plattform | Reihe | Folge | Was | Version |', '|---|---|---|---|---|---|')
    for (const v of liste.slice(0, 40)) {
      zeilen.push(
        `| ${v.gemeldet_am.slice(0, 16).replace('T', ' ')} | ${v.plattform} | ${v.reihe ?? '—'} | ` +
          `${v.folge_nr ?? '—'} | ${(v.text ?? '').replace(/\|/g, '\\|')} | ${v.version ?? '—'} |`,
      )
    }
    if (liste.length > 40) zeilen.push(`| … | | | | ${liste.length - 40} weitere | |`)
    zeilen.push('')
  }

  if (TROCKEN) {
    console.log(zeilen.join('\n'))
    log('Trockenlauf — nichts geschrieben, nichts gelöscht.')
    return
  }

  mkdirSync(resolve(ROOT, 'daniel-zum-abarbeiten'), { recursive: true })
  writeFileSync(ziel, zeilen.join('\n') + '\n', 'utf8')
  log(`daniel-zum-abarbeiten/17-vorfaelle.md geschrieben (${jeArt.size} Art(en)).`)

  /*
    **Erst schreiben, dann löschen.** Bricht der Lauf zwischen beidem ab, ist
    der Bericht da und die Zeilen bleiben — beim nächsten Mal stehen sie doppelt,
    und das ist der harmlosere Fehler.
  */
  const weg = await fetch(`${WORKER}/vorfall`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
    body: JSON.stringify({ ids: alle.map((v) => v.id) }),
  })
  if (!weg.ok) warn(`Vorfälle nicht gelöscht: HTTP ${weg.status} — sie tauchen beim nächsten Lauf erneut auf.`)
  recordSource('vorfaelle', alle.length)
}

await main()
