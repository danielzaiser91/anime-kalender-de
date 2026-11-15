/**
 * Gattung einer RTL+-Programmseite. Die Sitemap kennt nur den Slug; gleichnamige
 * Hörbücher und Hörspiele (Tom Sawyer, Peter Pan …) stehen dort neben den Serien.
 * Gemessen am 15.11.2026 an allen 110 Katalog-Einträgen: 52 Seiten tragen als
 * Beschreibung „Jetzt <Titel> von <Autor> hören ► Weitere Hörbücher und Hörspiele
 * auf RTL+ entdecken!“ (Ronja: „Weitere Kinder-Hörbücher …“), die übrigen 58 sind
 * Serien (24 mit schema.org `TVSeries`) und Filme (nur `WebPage`, ohne Hörmarke).
 */
export type RtlGattung = 'video' | 'nicht-video'

export type KatalogEintrag = { url: string; gattung?: RtlGattung; [feld: string]: unknown }

const HOER_MARKE = /hören ►|Hörbüch|Hörspiel|Kinder-Hör/i

export function rtlGattung(html: string): RtlGattung {
  const beschreibung = /<meta[^>]+name="description"[^>]+content="([^"]*)"/.exec(html)?.[1] ?? ''
  return HOER_MARKE.test(beschreibung) ? 'nicht-video' : 'video'
}

export type GattungsLauf = {
  bestand: Record<string, KatalogEintrag>
  verworfen: string[]
  unklar: string[]
  geprueft: number
}

/**
 * Prüft jeden Eintrag ohne Gattung gegen seine Seite. Hörbücher fallen heraus; ein Abruffehler ist keine
 * Auskunft: der Eintrag bleibt ungeprüft stehen (und wird beim nächsten Lauf neu gefragt), `unklar` nennt ihn.
 */
export async function pruefeGattungen(
  bestand: Record<string, KatalogEintrag>,
  hole: (url: string) => Promise<string>,
  pause: () => Promise<void>,
  melde: (zeile: string) => void,
): Promise<GattungsLauf> {
  const neu: Record<string, KatalogEintrag> = {}
  const verworfen: string[] = []
  const unklar: string[] = []
  let geprueft = 0
  for (const [id, eintrag] of Object.entries(bestand)) {
    if (eintrag.gattung === 'video') {
      neu[id] = eintrag
      continue
    }
    geprueft++
    try {
      const gattung = rtlGattung(await hole(eintrag.url))
      if (gattung === 'nicht-video') {
        verworfen.push(id)
        melde(`[rtlplus] verworfen (Hörbuch/Hörspiel): ${id} ${eintrag.url}`)
      } else neu[id] = { ...eintrag, gattung }
    } catch (err) {
      unklar.push(id)
      neu[id] = eintrag
      melde(`[rtlplus] Gattung offen (${id}): ${err instanceof Error ? err.message : String(err)}`)
    }
    await pause()
  }
  return { bestand: neu, verworfen, unklar, geprueft }
}
