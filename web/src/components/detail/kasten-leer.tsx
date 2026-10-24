import type { ComponentProps } from 'react'
import { AntwortBereich } from './antwort-bereich.tsx'
import { useHatFolgenListe } from './folgen-bereich.tsx'

type Props = ComponentProps<typeof AntwortBereich>

/** Eingaben von `AntwortBereich`, die `kastenOhneInhalt` prüft (der Test gleicht beide Listen mit den Props ab). */
export const BEWERTET = ['antwort', 'title', 'releases', 'terminReleases', 'streamReleases', 'discAusgaben', 'discReleases', 'tvVorbei', 'wegeHinweis', 'kastenNotiz', 'folgenLuecke'] as const
/** Eingaben, die nur Darstellung oder Zustand sind und keine Zeile unter der Überschrift erzeugen. */
export const OHNE_WIRKUNG = ['sortiertNachZugang', 't', 'today', 'verbindung', 'favorites', 'folgenAngabeFuer', 'dubZeilen', 'releaseJePlattform', 'discOffen', 'setDiscOffen', 'discZuerst'] as const

type Eingabe = Pick<Props, (typeof BEWERTET)[number]> & {
  /** Die Folgenliste kommt nicht über die Props, sondern nachgeladen (`folgen/index.json`). */
  folgenListe: boolean
}

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
  const keineZeile = !(p.wegeHinweis || p.kastenNotiz || p.folgenLuecke || p.folgenListe || title.ohneSynchro || title.deErstausgabe || title.angebotSeit)
  return nurSynchroOffen && keineWege && keineZeile
}

/** Der Rahmen mit bekannter Folgenliste; `data-kasten` finden die Prüfwerkzeuge, `contents` gibt ihm keine eigene Fläche. */
export function KastenRahmen(p: Props & { folgenListe: boolean }) {
  if (kastenOhneInhalt(p)) return null
  return (
    <div data-kasten className="contents">
      <AntwortBereich {...p} />
    </div>
  )
}

/**
 * Der Antwort-Kasten, oder nichts, wenn er leer wäre. Die Folgenliste kennt erst das geladene Verzeichnis — bis dahin
 * (ein Frame) fehlt der Kasten eines sonst leeren Titels mit Folgenliste noch.
 */
export function AntwortBereichOderNichts(p: Props) {
  const folgenListe = useHatFolgenListe(p.title.id)
  return <KastenRahmen {...p} folgenListe={folgenListe} />
}
