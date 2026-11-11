import { type Title } from '../../shared/types.ts'
import { type JwEintrag } from './11-2-2-wege-ohne-weg.ts'
import { staffelDesTitels } from './widerlegung-staffel.ts'

/**
 * **JustWatch führt eine Folgestaffel unter dem Eintrag der Serie, nicht unter einem eigenen** (Goblin Slayer II 129188: `data/justwatch-audio.json`
 * kennt nur 101165, die Angebote stehen in `staffeln[nr=2]`). Dieser Titel bekommt hier einen Eintrag aus der Staffel des Verwandten seiner Reihe,
 * dessen `nr` die Staffelnummer des Titels (`staffelDesTitels`) **und** dessen `folgen` seine Folgenzahl trägt. Nur die Folgenzahl allein
 * (31 statt 23 Titel, 11.11.2026) legte falsche Wege an (Shingeki 3 → JW 2:12, Dr. Stone NEW WORLD → JW 2:11). Titel mit eigenem Eintrag bleiben unberührt;
 * passen zwei verschiedene Serien-Einträge, wird keiner genommen.
 */
export function mitFolgestaffelEintraegen(jw: Record<string, JwEintrag>, titles: ReadonlyMap<number, Title>): Record<string, JwEintrag> {
  const neu: Record<string, JwEintrag> = {}
  for (const t of titles.values()) {
    if (jw[String(t.id)] || t.franchiseId === undefined || !t.episodes) continue
    const nummer = staffelDesTitels(t, titles.values())
    if (!nummer) continue
    const treffer = [...titles.values()]
      .filter((x) => x.id !== t.id && x.franchiseId === t.franchiseId && jw[String(x.id)]?.staffeln)
      .flatMap((x) => (jw[String(x.id)]!.staffeln ?? []).filter((s) => s.nr === nummer && s.folgen === t.episodes && s.angebote?.length).map((s) => ({ e: jw[String(x.id)]!, s })))
    const serien = new Set(treffer.map(({ e }) => e.jwId ?? e))
    if (serien.size !== 1) continue
    neu[String(t.id)] = { jwId: treffer[0].e.jwId, angebote: treffer[0].s.angebote }
  }
  return { ...jw, ...neu }
}
