/**
 * Zusicherungen zu `pipeline/lib/meldungen-liste.ts` an einer Kulisse (`AK_ROOT`): `liegenGeblieben` trägt Warnung und Listenzeile
 * ein (Name aus Serientitel, sonst Titel, sonst nur der Grund); `schreibeMeldungenListe` schreibt die Tabelle mit Stand und „Zu tun“
 * (eigenes `zuTun` vor „weg“ vor „ohne Vorschlag“ vor „Vorschlag bestätigen“), Vorschläge als AniList-Verweis mit deutschem, sonst
 * englischem Namen, sonst der Kennung; ohne offene Meldung verschwindet die Datei. Läuft in `check:logic`.
 */
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const kulisse = mkdtempSync(join(tmpdir(), 'meldungen-liste-'))
process.env.AK_ROOT = kulisse
const DATEI = join(kulisse, 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md')
mkdirSync(join(kulisse, 'daniel-zum-abarbeiten/listen'), { recursive: true })

let fehler = 0
function pruefe(text: string, ist: unknown, soll: unknown) {
  const a = JSON.stringify(ist)
  const b = JSON.stringify(soll)
  if (a !== b) {
    fehler++
    console.error(`FEHLER ${text}:\n  ist  ${a}\n  soll ${b}`)
  }
}

try {
  const { liegenGeblieben, schreibeMeldungenListe } = await import('./lib/meldungen-liste.ts')
  type OhneZuordnung = Parameters<typeof schreibeMeldungenListe>[0][number]

  // liegenGeblieben
  const warnungen: string[] = []
  const liste: OhneZuordnung[] = []
  const meldung = { url: 'https://x.test/a', plattform: 'netflix', befund: 'dub' }
  liegenGeblieben(warnungen, liste, { ...meldung, serientitel: 'Serie', titel: 'Folge' }, 'Staffel 2 offen', [7], 'Staffel prüfen')
  liegenGeblieben(warnungen, liste, { ...meldung, serientitel: null, titel: 'Folge' }, 'g', [], 'z')
  liegenGeblieben(warnungen, liste, { ...meldung, serientitel: null, titel: null }, 'nur Grund', [], 'z')
  pruefe('Warnungen', warnungen, ['https://x.test/a — Staffel 2 offen, Meldung bleibt liegen', 'https://x.test/a — g, Meldung bleibt liegen', 'https://x.test/a — nur Grund, Meldung bleibt liegen'])
  pruefe('Namen: Serientitel, sonst Titel, sonst Grund', liste.map((o) => o.name), ['Serie — Staffel 2 offen', 'Folge — g', 'nur Grund'])
  pruefe('Zeile trägt Vorschlag und zuTun', liste[0], { url: 'https://x.test/a', name: 'Serie — Staffel 2 offen', plattform: 'netflix', befund: 'dub', vorschlag: [7], zuTun: 'Staffel prüfen' })

  // schreibeMeldungenListe: ohne offene Meldung
  schreibeMeldungenListe([], [], '2026-11-13')
  pruefe('leer ohne Datei: keine Datei', existsSync(DATEI), false)
  writeFileSync(DATEI, 'alt')
  schreibeMeldungenListe([], [], '2026-11-13')
  pruefe('leer mit Datei: Datei entfernt', existsSync(DATEI), false)

  // schreibeMeldungenListe: Tabelle
  const titel = [{ id: 1, titleDe: 'Eins', titleEn: 'One' }, { id: 2, titleEn: 'Two', streams: [{ platform: 'netflix' }] }]
  const o = (befund: string, vorschlag: number[], mehr: Partial<OhneZuordnung> = {}): OhneZuordnung => ({ url: 'https://x.test/u', name: 'N', plattform: 'netflix', befund, vorschlag, ...mehr })
  schreibeMeldungenListe(
    [o('weg', []), o('weg', [1]), o('dub', []), o('dub', [1, 2, 3]), o('dub', [1], { zuTun: 'eigen' }), o('kein_dub', [], { name: '' })],
    titel,
    '2026-11-13',
  )
  const md = readFileSync(DATEI, 'utf8')
  pruefe('Stand im Kopf', md.includes('\nStand: 2026-11-13\n'), true)
  pruefe('endet mit Zeilenumbruch', md.endsWith('|\n'), true)
  pruefe('Tabellenzeilen', md.split('\n').filter((z) => z.startsWith('| netflix')), [
    '| netflix | https://x.test/u | N | weg | — | nichts — diese Adresse steht bei uns nirgends |',
    '| netflix | https://x.test/u | N | weg | [Eins](https://anilist.co/anime/1) | nichts — diese Adresse steht bei uns nirgends |',
    '| netflix | https://x.test/u | N | dub | — | Titel von Hand suchen |',
    '| netflix | https://x.test/u | N | dub | [Eins](https://anilist.co/anime/1)<br>[Two](https://anilist.co/anime/2)<br>[3](https://anilist.co/anime/3) | Vorschlag bestätigen, dann Adresse eintragen |',
    '| netflix | https://x.test/u | N | dub | [Eins](https://anilist.co/anime/1) | eigen |',
    '| netflix | https://x.test/u | — | kein_dub | — | Titel von Hand suchen |',
  ])
  pruefe('kein # vor der Kennung', /#\d/.test(md), false)

  schreibeMeldungenListe([o('dub', [])], titel, '2026-11-14')
  const neu = readFileSync(DATEI, 'utf8')
  pruefe('neuer Lauf überschreibt', [neu.includes('Stand: 2026-11-14'), neu.split('\n').filter((z) => z.startsWith('| netflix')).length], [true, 1])
} finally {
  rmSync(kulisse, { recursive: true, force: true })
}

if (fehler) {
  console.error(`check-meldungen-liste: ${fehler} Fehler`)
  process.exit(1)
}
console.log('check-meldungen-liste: alle Zusicherungen grün')
