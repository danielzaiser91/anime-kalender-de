/**
 * Zusicherung: Das Kalender-Abo führt Folgen desselben Tages als einen Eintrag (Daniel, 13.10.2026; Mushoku Tensei Staffel 3:
 * Folge 13 und 14 am 18.10.). Gegenfälle: anderer Tag, andere Uhrzeit, Lücke, anderer Release, ausgebliebener Termin.
 * Aufruf: `npm run check:logic`.
 */
import type { ReleaseEvent } from '../shared/types.ts'
import { buildIcs } from '../shared/ics.ts'

let verletzt = 0
function pruefe(name: string, ok: boolean, gefunden?: unknown): void {
  if (ok) return void console.log(`  ✓ ${name}`)
  verletzt++
  console.error(`  ✖ ${name}${gefunden === undefined ? '' : ` — gefunden: ${JSON.stringify(gefunden)}`}`)
}

const ev = (episode: number, o: Partial<ReleaseEvent> = {}): ReleaseEvent =>
  ({ id: `m@2026-10-18#${episode}`, releaseSlug: 'm', titleId: 1, name: 'Mushoku', date: '2026-10-18', time: '17:00', releaseType: 'weekly', platform: 'crunchyroll', episode, episodeCount: 14, ...o }) as ReleaseEvent

/** Die Einträge der Datei: Kennung und Titelzeile (Faltungen aufgelöst). */
function eintraege(events: ReleaseEvent[]): { uid: string; summary: string }[] {
  const text = buildIcs(events).replace(/\r\n /g, '')
  return text.split('BEGIN:VEVENT').slice(1).map((v) => ({ uid: /UID:(.*)\r/.exec(v)![1]!, summary: /SUMMARY:(.*)\r/.exec(v)![1]! }))
}

function fall(): void {
  console.log('\nKalender-Abo: Folgen desselben Tages sind ein Eintrag:')
  const zwei = eintraege([ev(13), ev(14)])
  pruefe('Folge 13 und 14: ein Eintrag', zwei.length === 1, zwei)
  pruefe('… „Folge 13–14/14“ in der Titelzeile', zwei[0]?.summary === 'Mushoku – Folge 13–14/14', zwei[0])
  pruefe('… mit der Kennung der ersten Folge (der Termin im fremden Kalender bleibt stehen)', zwei[0]?.uid === 'm@2026-10-18#13@anime-kalender-de', zwei[0])
  const drei = eintraege([ev(10), ev(11), ev(12)])
  pruefe('drei Folgen: „Folge 10–12/14“', drei.length === 1 && drei[0]!.summary === 'Mushoku – Folge 10–12/14', drei)
  const umgekehrt = eintraege([ev(14), ev(13)])
  pruefe('Reihenfolge der Eingabe egal: „Folge 13–14/14“', umgekehrt.length === 1 && umgekehrt[0]!.summary === 'Mushoku – Folge 13–14/14', umgekehrt)
}

function gegenfaelle(): void {
  console.log('\nGegenfälle (bleiben einzelne Einträge):')
  const einzeln = eintraege([ev(13)])
  pruefe('eine Folge: unverändert „Folge 13/14“', einzeln.length === 1 && einzeln[0]!.summary === 'Mushoku – Folge 13/14', einzeln)
  pruefe('anderer Tag', eintraege([ev(13), ev(14, { date: '2026-10-25' })]).length === 2)
  pruefe('andere Uhrzeit', eintraege([ev(13), ev(14, { time: '18:00' })]).length === 2)
  pruefe('Lücke (11 und 13)', eintraege([ev(11), ev(13)]).length === 2)
  pruefe('anderer Release', eintraege([ev(13), ev(14, { releaseSlug: 'n', id: 'n@2026-10-18#14' })]).length === 2)
  pruefe('ausgebliebener Termin bleibt eigen', eintraege([ev(13), ev(14, { verpasst: { erwartetAm: '2026-10-18' } })]).length === 2)
  pruefe('Batch ohne Folgennummer unverändert', eintraege([ev(0, { episode: undefined, releaseType: 'batch', id: 'b' })]).length === 1)
  const gemischt = eintraege([ev(1, { releaseSlug: 'a', id: 'a1' }), ev(13), ev(14), ev(2, { releaseSlug: 'a', id: 'a2', date: '2026-10-25' })])
  pruefe('Reihenfolge: ein Eintrag steht, wo sein erster Termin stand', gemischt.map((g) => g.uid.split('@')[0]).join() === 'a1,m,a2', gemischt)
}

/** Die Beschreibung des ersten Eintrags (Faltungen aufgelöst). */
function beschreibung(e: ReleaseEvent): string {
  return /DESCRIPTION:(.*)\r\n[A-Z]/.exec(buildIcs([e]).replace(/\r\n /g, ''))?.[1] ?? ''
}

function releaseArt(): void {
  console.log('\nRelease-Art: „Simuldub“ nur ohne gesetzte Sprache (Beerus, omu):')
  pruefe('ohne Sprache: „Wöchentlich (Simuldub)“', beschreibung(ev(1)).includes('Release-Art: Wöchentlich (Simuldub)'), beschreibung(ev(1)))
  for (const sprache of ['omu', 'offen'] as const) {
    const b = beschreibung(ev(1, { sprache }))
    pruefe(`Sprache ${sprache}: Kurzform „Wöchentlich“, kein „Simuldub“`, b.includes('Release-Art: Wöchentlich\\n') && !b.includes('Simuldub'), b)
  }
}

fall()
gegenfaelle()
releaseArt()
console.log(verletzt ? `\n${verletzt} Zusicherung(en) verletzt.` : '\nAlle Zusicherungen halten.')
process.exit(verletzt ? 1 : 0)
