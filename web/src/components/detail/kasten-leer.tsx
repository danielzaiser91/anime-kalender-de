import type { ComponentProps } from 'react'
import { AntwortBereich } from './antwort-bereich.tsx'

type Eingabe = Pick<
  ComponentProps<typeof AntwortBereich>,
  'antwort' | 'title' | 'releases' | 'terminReleases' | 'streamReleases' | 'discAusgaben' | 'discReleases' | 'tvVorbei' | 'wegeHinweis' | 'kastenNotiz' | 'kaufausgabeZeile' | 'folgenLuecke'
>

/**
 * Hat der Kasten nur die Überschrift „Synchro offen“ und darunter nichts, sagt er nichts — er entfällt ganz.
 * Das trifft Cartoons ohne jeden Beleg (172 am 14.10.2026, z. B. Matrix Dreads). Ein „Noch keine deutsche
 * Fassung“ bleibt stehen: Das ist eine Auskunft, kein Schweigen. Jede Quelle einer Zeile unter der Überschrift
 * steht hier einzeln; kommt eine hinzu, gehört sie in diese Liste (der Test bricht dann bei einem Weg ohne Kasten).
 */
export function kastenOhneInhalt(p: Eingabe): boolean {
  const { antwort, title } = p
  const nurSynchroOffen = antwort?.art === 'ohne' && Boolean(title.westlich) && !title.dubHinweis && !title.streams.length
  const keineWege = !(title.watchLinks ?? []).length && ![p.releases, p.terminReleases, p.streamReleases, p.discAusgaben, p.discReleases, p.tvVorbei].some((l) => l.length)
  const keineZeile = !(p.wegeHinweis || p.kastenNotiz || p.kaufausgabeZeile || p.folgenLuecke || title.ohneSynchro || title.deErstausgabe || title.angebotSeit)
  return nurSynchroOffen && keineWege && keineZeile
}

/** Der Antwort-Kasten, oder nichts, wenn er leer wäre. `data-kasten` finden die Prüfwerkzeuge; `contents` gibt dem Rahmen keine eigene Fläche. */
export function AntwortBereichOderNichts(p: ComponentProps<typeof AntwortBereich>) {
  if (kastenOhneInhalt(p)) return null
  return (
    <div data-kasten className="contents">
      <AntwortBereich {...p} />
    </div>
  )
}
