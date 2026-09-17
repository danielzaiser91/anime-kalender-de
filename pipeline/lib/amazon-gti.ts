/**
 * **Welche Amazon-Adresse JustWatch für einen Prime-Verweis nennt** (17.09.2026).
 *
 * Der Proof of Concept in `docs/poc-justwatch-amazon.md` hat belegt: Die gti in
 * JustWatchs Adresse (`watch.amazon.de/detail?gti=…`) ist genau die `catalogId`
 * der Amazon-Seite (8 von 8), und bei einer toten Seite leitet sie auf die neu
 * angelegte weiter (Afro Samurai). Daniel hat entschieden, alle Amazon-Verweise
 * mit JustWatch-Angebot auf diese Adresse zu stellen.
 *
 * Diese Funktion wählt nur aus, sie ändert nichts. Die Regeln:
 *
 * 1. Kennt JustWatch **genau eine** gti, gilt sie. Nur dieser Fall ist belegt.
 * 2. Kennt JustWatch mehrere (Kanal, Kauf, Prime — gemessen 64 von 268), gibt es
 *    **keine Wahl**. Der Trockenlauf wählte dort die Ausgabe mit deutschem Ton und
 *    stellte damit z. B. Mushi-Shi von einer Kaufseite auf den Aniverse-Kanal um —
 *    eine andere Ausgabe mit anderem Zugang. Erst nach eigener Gegenprobe.
 * 3. Trägt der Verweis `dub: true`, muss die Ausgabe Deutsch führen oder ihren Ton
 *    gar nicht nennen. Sonst zeigte ein „DE ✓" auf eine Ausgabe, die JustWatch nur
 *    mit anderem Ton kennt.
 */
export interface JwAngebot {
  anbieter: string
  art?: string
  audio?: string[]
  url?: string
}

export interface GtiWahl {
  gti: string
  url: string
  /** Alle JustWatch-Angebote dieser Ausgabe, z. B. „Aniverse Amazon Channel/FLATRATE". */
  angebote: string[]
  audio: string[]
}

const GTI = /[?&]gti=(amzn1\.dv\.gti\.[0-9a-f-]{36})/

export function gtiAus(url: string | undefined): string | undefined {
  return GTI.exec(url ?? '')?.[1]
}

export function amazonGtiWahl(angebote: JwAngebot[], dub: boolean | undefined): GtiWahl | undefined {
  const jeGti = new Map<string, GtiWahl>()
  for (const a of angebote) {
    const gti = gtiAus(a.url)
    if (!gti) continue
    const w = jeGti.get(gti) ?? { gti, url: `https://watch.amazon.de/detail?gti=${gti}`, angebote: [], audio: [] }
    w.angebote.push(`${a.anbieter}/${a.art ?? ''}`)
    for (const s of a.audio ?? []) if (!w.audio.includes(s)) w.audio.push(s)
    jeGti.set(gti, w)
  }
  if (jeGti.size !== 1) return undefined
  const wahl = [...jeGti.values()][0]!
  if (dub === true && wahl.audio.length && !wahl.audio.includes('de')) return undefined
  return wahl
}
