import { resolve } from 'node:path'
import { log, ROOT, writeJson } from '../lib/util.ts'
import type { Title } from '../../shared/types.ts'
import { adressKern } from '../lib/dub-confirmed.ts'
import { ladeKanalWissen } from '../lib/kanal-wissen.ts'
import { kanalAusNotiz } from '../lib/amazon-adresse.ts'
import { geteilteAdressen, type TeilseitenPruefung } from '../lib/teilseiten.ts'
import { ordnePrimeSeiteZu, type PrimeMeldung } from '../lib/prime-teilseiten.ts'
import { leseZugeordnet } from '../lib/prime-meldung-riegel.ts'

/**
 * **Geteilte Prime-Seiten: der Folgenbereich je Titel** (Regel und Begründung: `lib/prime-teilseiten.ts`).
 * Ein Prime-Weg mit Haken, der seine Seite mit anderen Titeln teilt und keinen Bereich trägt, bekommt ihn aus Daniels Meldung,
 * wenn sie eindeutig ist. Der Rest steht mit Grund in `data/prime-teilseiten-pruefliste.json`. Ein Handbeleg bleibt unberührt.
 */
export const PRIME_PRUEFLISTE = 'data/prime-teilseiten-pruefliste.json'

/** Prime-Seiten, die Handbeleg oder Merkliste als Kanal-Titel führen (Kanal in „Abos:" oder die Warnung „Kanal-Titel"). */
function kanalSeiten(): Set<string> {
  const seiten = new Set<string>()
  for (const c of ladeKanalWissen()) {
    if (c.platform !== 'primevideo' || !c.url) continue
    if (kanalAusNotiz(c.note) || /Kanal-Titel/.test(c.note ?? '')) seiten.add(adressKern(c.url))
  }
  return seiten
}

export function setzePrimeTeilseiten(titles: Map<number, Title>, schreibWurzel = ROOT): void {
  const meldungen = Object.entries(leseZugeordnet<PrimeMeldung>())
  const kanaele = kanalSeiten()
  const pruefen: TeilseitenPruefung[] = []
  let gesetzt = 0
  for (const [url, eintraege] of geteilteAdressen(titles, 'primevideo')) {
    const offen = eintraege.filter((e) => e.stream.dub === true && !e.stream.dubRanges?.length)
    if (!offen.length) continue
    const seite = adressKern(url)
    const urteile = ordnePrimeSeiteZu(
      offen.map((e) => ({ id: e.title.id, episodes: e.title.episodes ?? 0 })),
      meldungen,
      seite,
      kanaele.has(seite),
    )
    for (const { title, stream } of offen) {
      const urteil = urteile.get(title.id)!
      if ('bereiche' in urteil) {
        stream.dubRanges = urteil.bereiche
        gesetzt++
        continue
      }
      pruefen.push({ titleId: title.id, titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? '', url, grund: urteil.grund })
    }
  }
  writeJson(resolve(schreibWurzel, PRIME_PRUEFLISTE), pruefen.sort((a, b) => a.titleId - b.titleId))
  log(`Geteilte Prime-Seiten: ${gesetzt} Bereiche aus Meldungen, ${pruefen.length} auf der Prüfliste`)
}
