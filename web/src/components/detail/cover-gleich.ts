/**
 * **Zeigt das TMDB-Plakat dasselbe Bild wie das AniList-Cover?** (Daniel, 08.10.2026, Ishura: die Vergrößerung zeigte ein anderes
 * Plakat als das Panel.) TMDB wählt das größte Hochformat je Titel (`fetch-tmdb-poster.ts`) — oft ein anderes Key Visual als AniList.
 * Vor dem Überblenden werden beide als 9 × 8 Graustufen verglichen (dHash, 64 Bit); erst ab Gleichheit kommt das große Plakat, sonst
 * bleibt das AniList-Cover. Kosten: zwei Kleinstbilder (AniList `small` 100 px, TMDB `w92`, zusammen unter 10 KB), nur beim Öffnen.
 *
 * Schwelle 18 aus einer Stichprobe von 15 Titeln (08.10.2026): gleiche Motive lagen bei 4–16 (auch mit Schriftzug), andere bei 23–38.
 * Beide CDNs erlauben `crossOrigin` (Access-Control-Allow-Origin); ohne lesbare Pixel gilt „nicht gleich" — lieber dasselbe Bild unscharf.
 */
const TMDB_BILD = 'https://image.tmdb.org/t/p'
const SCHWELLE = 18

async function dhash(url: string): Promise<Uint8Array> {
  const img = new Image()
  img.crossOrigin = 'anonymous'
  await new Promise<void>((ok, nein) => {
    img.onload = () => ok()
    img.onerror = () => nein(new Error(`Bild nicht ladbar: ${url}`))
    img.src = url
  })
  /* Zweistufig verkleinern (36 × 32, dann 9 × 8): ein direkter Sprung von 100 auf 9 px tastet nur einzelne Pixel ab und streut um bis zu
     12 Bit gegen die Flächenmittelung (gemessen 08.10.2026 an 15 Titeln); zweistufig liegt der Browser auf ±3 Bit bei `sharp`. */
  const zwischen = document.createElement('canvas')
  zwischen.width = 36
  zwischen.height = 32
  const zc = zwischen.getContext('2d')
  const leinwand = document.createElement('canvas')
  leinwand.width = 9
  leinwand.height = 8
  const ctx = leinwand.getContext('2d', { willReadFrequently: true })
  if (!ctx || !zc) throw new Error('kein Canvas')
  zc.imageSmoothingQuality = 'high'
  zc.drawImage(img, 0, 0, 36, 32)
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(zwischen, 0, 0, 9, 8)
  const d = ctx.getImageData(0, 0, 9, 8).data
  const grau = (i: number) => d[i * 4]! * 0.299 + d[i * 4 + 1]! * 0.587 + d[i * 4 + 2]! * 0.114
  const bits = new Uint8Array(64)
  for (let y = 0; y < 8; y++) for (let x = 0; x < 8; x++) bits[y * 8 + x] = grau(y * 9 + x) > grau(y * 9 + x + 1) ? 1 : 0
  return bits
}

export function abstand(a: Uint8Array, b: Uint8Array): number {
  let n = 0
  for (let i = 0; i < 64; i++) if (a[i] !== b[i]) n++
  return n
}

/** `true`, wenn AniList-Cover und TMDB-Plakat dasselbe Motiv zeigen; bei jedem Fehler `false`. */
export async function gleichesBild(anilist: string, tmdbPfad: string): Promise<boolean> {
  try {
    const klein = anilist.replace(/\/cover\/(small|medium|large|extraLarge)\//, '/cover/small/')
    const [a, b] = await Promise.all([dhash(klein), dhash(`${TMDB_BILD}/w92${tmdbPfad}`)])
    return abstand(a, b) <= SCHWELLE
  } catch {
    return false
  }
}
