/**
 * Prüfung der `grund`-Texte von `reinIds:` in `data/reihen-von-hand.yaml`: Wer „AniList-Beziehung" behauptet, muss sie im Katalog (`rel`) belegen können.
 * Teile ohne Katalogeintrag oder ohne jede Beziehung (`rel: []`, auf den auch kein anderer Eintrag zeigt) dürfen nur unter „(außer …)" oder „… bei AniList keine Beziehung" im Grund stehen;
 * dieselbe Rechnung gilt für Gründe, die „bei AniList" ausformulieren (Mononoke / ayakashi).
 */
export type KatalogRel = { id: number; rel?: number[] }
export type ReinIdsEintrag = { reinIds?: number[]; grund?: string }

/** Komponenten des Beziehungsgraphen (beide Richtungen): Kennung → Wurzel, Wurzel → Zahl der Katalogtitel. */
export function katalogKomponenten(katalog: KatalogRel[]): { komp: Map<number, number>; groesse: Map<number, number> } {
  const eltern = new Map<number, number>()
  const wurzel = (x: number): number => {
    let r = x
    while ((eltern.get(r) ?? r) !== r) r = eltern.get(r)!
    eltern.set(x, r)
    return r
  }
  for (const e of katalog) {
    for (const b of e.rel ?? []) eltern.set(wurzel(e.id), wurzel(b))
  }
  const komp = new Map(katalog.map((e) => [e.id, wurzel(e.id)]))
  const groesse = new Map<number, number>()
  for (const w of komp.values()) groesse.set(w, (groesse.get(w) ?? 0) + 1)
  return { komp, groesse }
}

/** Befunde (leer = in Ordnung) für alle Einträge, deren `grund` „AniList-Beziehung" enthält. */
export function pruefeReinIdsGrund(eintraege: ReinIdsEintrag[], katalog: KatalogRel[]): string[] {
  const { komp, groesse } = katalogKomponenten(katalog)
  const befunde: string[] = []
  for (const e of eintraege) {
    const grund = e.grund ?? ''
    if (!e.reinIds || !(grund.includes('AniList-Beziehung') || grund.includes('bei AniList'))) continue
    const teile = new Map<number, number>()
    for (const id of e.reinIds) if (komp.has(id)) teile.set(komp.get(id)!, (teile.get(komp.get(id)!) ?? 0) + 1)
    const haupt = [...teile.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
    const abweichler = e.reinIds.filter((id) => komp.get(id) !== haupt)
    const ohneBeziehung = abweichler.filter((id) => !komp.has(id) || groesse.get(komp.get(id)!) === 1)
    const marke = `[${e.reinIds.join(', ')}]`
    const mitAusnahme = grund.includes('(außer ') || grund.includes('bei AniList keine Beziehung')
    if (!abweichler.length && mitAusnahme) befunde.push(`${marke}: „(außer …)" im Grund, aber alle Teile liegen in einer Komponente`)
    else if (abweichler.length && !mitAusnahme) befunde.push(`${marke}: Teile ${abweichler.join(', ')} liegen nicht in der rel-Komponente der übrigen, der Grund nennt keine Ausnahme`)
    else if (abweichler.length && ohneBeziehung.length !== abweichler.length) befunde.push(`${marke}: Ausnahme genannt, aber Teile ${abweichler.filter((id) => !ohneBeziehung.includes(id)).join(', ')} haben Beziehungen in einer anderen Komponente`)
  }
  return befunde
}
