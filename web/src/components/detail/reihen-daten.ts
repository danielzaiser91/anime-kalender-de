import { useEffect, useMemo, useState } from 'react'
import type { FranchiseMember, Franchises, Title } from '@shared/types.ts'
import { anzeigeName, nachJahrUndId } from '@shared/titles.ts'
import { loadFranchises, type Dataset } from '../../lib/data.ts'
import { istAusgeblendet } from '../../lib/ecchi.ts'

/**
 * Die ganze Reihe — Staffeln, Filme und Specials.
 *
 * Kommt aus `franchises.json`, nicht aus `data.titles`. Dort stehen im
 * Kalender nur die 133 Titel **mit Termin**; „That Time I Got Reincarnated as
 * a Slime" zeigte deshalb allein Staffel 4 als verwandten Eintrag, „I've Been
 * Killing Slimes" gar nichts, obwohl es eine zweite Staffel gibt (gemeldet
 * von Daniel, 12.08.2026).
 */
export function useReihe(title: Title | undefined): FranchiseMember[] {
  const [franchises, setFranchises] = useState<Franchises>({})
  useEffect(() => {
    let alive = true
    loadFranchises().then((f) => {
      if (alive) setFranchises(f)
    })
    return () => {
      alive = false
    }
  }, [])

  return useMemo((): FranchiseMember[] => {
    if (!title) return []
    return franchises[title.franchiseId ?? title.id] ?? []
  }, [franchises, title])
}

/**
 * Alle Kennungen der Reihe — aus zwei Quellen zusammengeführt.
 *
 * `franchises.json` deckt nur den gepflegten Bestand ab. Titel **ohne**
 * deutsche Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link
 * Click" hat sieben Teile und keinen einzigen mit Synchro. Der zweite Weg
 * geht deshalb über das, was die Anwendung ohnehin geladen hat — wer im
 * Detail-Panel steht, hat die passende Liste vorher geöffnet.
 */
/**
 * Alle Teile der Reihe als Karten — aus **beiden** Beständen.
 *
 * `franchises.json` deckt nur den gepflegten Bestand ab. Titel ohne deutsche
 * Synchro stehen dort nicht, gehören aber zur selben Reihe: „Link Click" hat
 * sieben Teile und keinen einzigen mit Synchro — der Umschalter fehlte dort
 * deshalb ganz, obwohl die Kachel korrekt gebündelt war.
 *
 * Die zweite Quelle ist das, was die Anwendung ohnehin geladen hat. Wer im
 * Detail-Panel steht, hat die passende Liste vorher geöffnet; im Kalender
 * fehlen die Cover mancher Teile, dafür trägt `franchises.json` sie bei.
 */
export function reihenTeileVon(title: Title | undefined, reihe: FranchiseMember[], data: Dataset): FranchiseMember[] {
  if (!title) return []
  const wurzel = title.franchiseId ?? title.id
  const teile = new Map<number, FranchiseMember>()
  for (const m of reihe) if (m.id === title.id || !istAusgeblendet(data.titleById.get(m.id))) teile.set(m.id, m)
  for (const t of data.titleById.values()) {
    if ((t.franchiseId ?? t.id) !== wurzel) continue
    /* Der geöffnete Titel selbst kommt unten über den Rückfall dazu, auch wenn er ausgeblendet ist. */
    if (istAusgeblendet(t)) continue
    const bisher = teile.get(t.id)
    /*
      **Was `franchises.json` sagt, gewinnt — und zwar vollständig.**

      Feld für Feld aufzuzählen hieß: Jedes Feld, das später dazukommt,
      fehlt hier. Bei „Lord of Mysteries" fielen so `beiwerk`, `jpStart`
      und `jpStatus` heraus, sobald `titles.json` nachgeladen war — die
      Specials standen zwei Sekunden lang richtig unter „Specials" und
      danach unter „Hauptserie".

      Der Titel liefert deshalb nur noch die Vorgabe; der Eintrag der
      Reihe liegt darüber. Fehlende Felder stehen in der Datei gar nicht
      erst, überschreiben also nichts.
    */
    teile.set(t.id, {
      id: t.id,
      name: t.titleDe ?? t.titleEn ?? t.titleRomaji ?? `#${t.id}`,
      format: t.format,
      jpYear: t.jpYear,
      episodes: t.episodes,
      cover: t.coverImage,
      ...bisher,
    })
  }
  if (!teile.has(title.id)) {
    teile.set(title.id, {
      id: title.id,
      name: anzeigeName(title),
      format: title.format,
      jpYear: title.jpYear,
      episodes: title.episodes,
      cover: title.coverImage,
    })
  }
  // Nach Ausstrahlung: erst das Jahr, dann die Kennung als stabiler Zweitschlüssel.
  return [...teile.values()].sort(nachJahrUndId)
}
