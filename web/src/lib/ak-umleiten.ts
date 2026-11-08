/** Reine Umschreibung gemerkter Titel nach `ak-umleitung.json` (`[alt, neu]`); getrennt von `ak-umleitung.ts`, damit `check:logic` sie ohne Browser prüft. */
type Abbild = Map<number, number>

export function umleiteListe(alt: unknown[], abbild: Abbild): number[] {
  const neu = alt.filter((id): id is number => typeof id === 'number').map((id) => abbild.get(id) ?? id)
  return [...new Set(neu)]
}

const TITEL_IM_HASH = /([?&]t=)(-?\d+)(?!\d)/
const TITEL_IM_PFAD = /^(.*\/t\/)(\d+)(\/?)$/

export function adresseHatTitel(pfad: string, hash: string): boolean {
  return TITEL_IM_PFAD.test(pfad) || TITEL_IM_HASH.test(hash)
}

/** Eine geöffnete Adresse (`/t/<ak>/` oder `#/…?t=<ak>`, auch Cartoons mit negativer Kennung) auf den Nachfolger umgeschrieben; `undefined`, wenn nichts zu ändern ist. */
export function adresseNachfolger(pfad: string, hash: string, abbild: Abbild): { pfad: string; hash: string } | undefined {
  const imPfad = TITEL_IM_PFAD.exec(pfad)
  const pfadZiel = imPfad && abbild.get(Number(imPfad[2]))
  const hashZiel = abbild.get(Number(TITEL_IM_HASH.exec(hash)?.[2]))
  if (!pfadZiel && !hashZiel) return undefined
  return {
    pfad: pfadZiel && imPfad ? `${imPfad[1]}${pfadZiel}${imPfad[3]}` : pfad,
    hash: hashZiel ? hash.replace(TITEL_IM_HASH, `$1${hashZiel}`) : hash,
  }
}

/** Treffen zwei Einträge zusammen, gilt bei Zahlen (gesehen bis Folge) der größere, bei Tagen (gemerkt seit) der frühere Wert. */
export function umleiteKarte(alt: Record<string, unknown>, abbild: Abbild): Record<string, unknown> {
  const neu: Record<string, unknown> = {}
  for (const [id, wert] of Object.entries(alt)) {
    const ziel = String(abbild.get(Number(id)) ?? id)
    const bisher = neu[ziel]
    const besser = typeof wert === 'number' && typeof bisher === 'number' ? wert > bisher : String(wert) < String(bisher)
    if (!(ziel in neu) || besser) neu[ziel] = wert
  }
  return neu
}
