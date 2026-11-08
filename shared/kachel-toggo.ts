import type { StreamLink, Title, WatchLink } from './types.ts'
import { bloeckeOffen, fensterOffen, offeneFenster, pruefZeiten } from './toggo-fenster.ts'

type Weg = StreamLink | WatchLink

/** Ein kostenloser Weg für die Kachel: `toggo` (bis 100 Blöcke je Titel) wird zu den offenen Fenstern `toggoOffen`; alles andere bleibt. */
export function toggoKompakt<T extends Weg>(weg: T, jetzt: string): T {
  const bloecke = (weg as WatchLink).toggo
  if (!bloecke) return weg
  const { toggo: _weg, ...rest } = weg as WatchLink
  return { ...rest, toggoOffen: offeneFenster(bloecke, jetzt) } as unknown as T
}

function ohneFeld<T extends object>(eintrag: T, feld: string): T {
  return Object.fromEntries(Object.entries(eintrag).filter(([name]) => name !== feld)) as T
}

/** Fehler eines Wegs: Kachel-Fenster und Blöcke der Wochen-Datei müssen zu jedem Zeitpunkt ab `jetzt` gleich „offen“ sagen. */
function wegFehler(titel: number, kachel: Weg, voll: Weg, jetzt: string): string[] {
  const bloecke = (voll as WatchLink).toggo
  const fenster = (kachel as WatchLink).toggoOffen
  if (!bloecke && !fenster) return []
  if (!bloecke) return [`Kachel-Datei: Titel ${titel} hat Toggo-Fenster ohne Blöcke in der Wochen-Datei`]
  if (!fenster) return kachel.zugang !== 'kostenlos' ? [] : [`Kachel-Datei: Titel ${titel} verliert die Toggo-Fenster`]
  const falsch = pruefZeiten(bloecke, fenster, jetzt).find((z) => fensterOffen(fenster, z) !== bloeckeOffen(bloecke, z))
  return falsch ? [`Kachel-Datei: Titel ${titel} sagt Toggo zu ${falsch} anders als die Wochen-Datei`] : []
}

function listeNormal<T extends Weg>(titel: number, kachel: T[] | undefined, voll: T[] | undefined, jetzt: string, fehler: string[]): [T[] | undefined, T[] | undefined] {
  if (!kachel || !voll || kachel.length !== voll.length) return [kachel, voll]
  const paare = kachel.map((k, i) => {
    fehler.push(...wegFehler(titel, k, voll[i]!, jetzt))
    const gemeinsam = (k as WatchLink).toggoOffen && (voll[i] as WatchLink).toggo
    return gemeinsam ? [ohneFeld(k, 'toggoOffen'), ohneFeld(voll[i]!, 'toggo')] : [k, voll[i]!]
  })
  return [paare.map((p) => p[0]!), paare.map((p) => p[1]!)]
}

/**
 * Bereitet einen Titel für den Feldvergleich vor: meldet falsche Toggo-Fenster in `fehler` und nimmt `toggoOffen`
 * der Kachel und `toggo` der Wochen-Datei aus beiden Seiten, damit `teilVon` den Rest vergleicht.
 */
export function toggoAbgleich(kachel: Title, voll: Title, jetzt: string, fehler: string[]): [Title, Title] {
  if (kachel.id !== voll.id) return [kachel, voll]
  const [ks, vs] = listeNormal(kachel.id, kachel.streams, voll.streams, jetzt, fehler)
  const [kw, vw] = listeNormal(kachel.id, kachel.watchLinks, voll.watchLinks, jetzt, fehler)
  const k = { ...kachel, ...(ks ? { streams: ks } : {}), ...(kw ? { watchLinks: kw } : {}) }
  const v = { ...voll, ...(vs ? { streams: vs } : {}), ...(vw ? { watchLinks: vw } : {}) }
  return [k, v]
}
