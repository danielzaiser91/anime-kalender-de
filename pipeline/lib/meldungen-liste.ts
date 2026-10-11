/**
 * Die Arbeitsliste `11-meldungen-ohne-zuordnung.md`: Meldungen, die der Datenlauf nicht
 * zuordnen konnte (aus `fetch-pruefungen.ts` herausgelöst, Ausgabe unverändert).
 */
import { existsSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { log, ROOT } from './util.ts'

const DATEI = resolve(ROOT, 'daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md')

export interface OhneZuordnung {
  url: string
  name: string
  plattform: string
  befund: string
  vorschlag: number[]
}

interface ListenTitel {
  id: number
  titleDe?: string
  titleEn?: string
  streams?: Array<{ platform: string }>
}

const KOPF = (heute: string): string[] => [
  '# Meldungen ohne Zuordnung',
  '',
  'Der Browser hat diese Seiten gemeldet, unser Datensatz kennt die Adresse aber',
  'nicht. Anbieter führen denselben Titel oft unter mehreren Kennungen — Jujutsu',
  'Kaisen meldete sich als `title/80237957`, bei uns steht `title/81278456`.',
  '',
  'Der Vorschlag stammt aus einem Namensvergleich und ist **kein Beleg**:',
  '„Beyblade Burst Surge" und „Beyblade Burst Rise" trennt ein Wort. Stimmt er,',
  'gehört die gemeldete Adresse als zusätzlicher Verweis an den Titel; stimmt er',
  'nicht, gehört die Zeile gestrichen.',
  '',
  `Stand: ${heute}`,
  '',
  '## Was hier zu tun ist',
  '',
  'Die Erweiterung hat einen Befund gemeldet, aber unser Datensatz kennt die Adresse',
  'nicht. Drei Fälle, drei Handgriffe:',
  '',
  '- **„nichts"** — erledigt sich von selbst, nur der Vollständigkeit halber aufgeführt.',
  '- **„Vorschlag bestätigen"** — stimmt der vorgeschlagene Titel? Dann sag Bescheid,',
  '  ich trage die Adresse als Verweis ein und übernehme den Befund.',
  '- **„Titel von Hand suchen"** — die Seite hat keinen Serientitel gemeldet. Öffne die',
  '  Adresse und sag mir, welcher Anime das ist; den Rest mache ich.',
  '',
  '| Anbieter | Gemeldete Adresse | Name laut Seite | Befund | Vorschlag | Zu tun |',
  '|---|---|---|---|---|---|',
]

/** Eine Tabellenzeile. */
function zeile(o: OhneZuordnung, liste: ListenTitel[]): string {
  /**
   * Kein `#` vor der Kennung.
   *
   * Markdown-Ansichten deuten `#154965` als Verweis auf ein GitHub-Ticket und
   * führen ins Leere. Verlinkt wird stattdessen die Titelseite bei AniList — dort
   * steht, worum es geht.
   */
  const namen = o.vorschlag.map((id) => {
    const t = liste.find((x) => x.id === id)
    const name = t?.titleDe ?? t?.titleEn ?? String(id)
    return `[${name}](https://anilist.co/anime/${id})`
  })
  // Ein „weg" an einem Titel, der diesen Anbieter ohnehin nicht führt, ist
  // schon abgebildet — dann bleibt nichts zu tun, und das gehört dazu.
  // Sonst liest jemand die Zeile, öffnet den Verweis und stellt fest, dass
  // die Arbeit längst getan ist.
  const erledigt =
    o.befund === 'weg' &&
    o.vorschlag.length > 0 &&
    o.vorschlag.every((id) => {
      const t = liste.find((x) => x.id === id)
      return !t?.streams?.some((st) => st.platform === o.plattform)
    })
  /**
   * Ein „weg" zu einer Adresse, die wir nicht führen, ist gegenstandslos.
   *
   * Das gilt **ohne** Titelvergleich: Wenn kein Verweis auf diese Adresse
   * zeigt, kann auch keiner entfernt werden. Wer den Titel dahinter kennt,
   * gewinnt nichts dazu — „Titel von Hand suchen" wäre Arbeit, die keine ist.
   */
  const zuTun =
    o.befund === 'weg'
      ? 'nichts — diese Adresse steht bei uns nirgends'
      : !o.vorschlag.length
        ? 'Titel von Hand suchen'
        : erledigt
          ? 'nichts — wir führen dort keinen Verweis'
          : 'Vorschlag bestätigen, dann Adresse eintragen'
  return `| ${o.plattform} | ${o.url} | ${o.name || '—'} | ${o.befund} | ${namen.join('<br>') || '—'} | ${zuTun} |`
}

/**
 * Was keine Zuordnung fand, wird sichtbar abgelegt statt vergessen.
 *
 * Bis zum 22.08.2026 fielen solche Meldungen lautlos aus dem Lauf und blieben
 * für immer im Briefkasten liegen — die Arbeit war getan und ging verloren.
 * Die Datei ist Arbeitsvorrat, kein Datensatz: Jede Zeile braucht ein
 * menschliches Ja, bevor die Adresse in `data/` landet.
 *
 * Ist nichts mehr offen, verschwindet die Datei: Sie blieb sonst mit dem letzten
 * Stand liegen und behauptete Arbeit, die es nicht mehr gibt (23.08.2026).
 */
export function schreibeMeldungenListe(offen: OhneZuordnung[], liste: ListenTitel[], heute: string): void {
  if (!offen.length) {
    if (!existsSync(DATEI)) return
    rmSync(DATEI)
    log('daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md entfernt — nichts mehr offen')
    return
  }
  writeFileSync(DATEI, [...KOPF(heute), ...offen.map((o) => zeile(o, liste)), ''].join('\n'))
  log(`${offen.length} Meldung(en) ohne Zuordnung in daniel-zum-abarbeiten/listen/11-meldungen-ohne-zuordnung.md`)
}
