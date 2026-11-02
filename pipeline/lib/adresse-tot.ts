/** Ob eine Adresse als tot gilt; jede Runde, die Wege anlegt, nimmt dieses Prädikat statt einer der Quellen allein. */
export type IstTot = (url: string) => boolean

/** Beide Quellen von „tot“: Handbeleg „nicht verfügbar“ und Linkprüfung (404/Regionssperre). */
export function baueIstTot(toteAdressen: Set<string>, lautPruefungTot: IstTot): IstTot {
  return (url) => toteAdressen.has(url) || lautPruefungTot(url)
}
