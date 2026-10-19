import type { StreamLink, Title } from '../../shared/types.ts'
import { adressKern } from '../lib/dub-confirmed.ts'
import { amazonAdresseRichten } from '../lib/amazon-adresse.ts'

/**
 * **Ein Prime-Weg wird an einem Ort gerichtet: `url` und `seite` zusammen.**
 *
 * Bei der gti-Brücke (`11-4-ausgaben.ts`) steht JustWatchs Adresse in `url` und die ASIN-Seite in
 * `seite`. Gerichtet wurde nur `url`, also blieb `seite` unter `/dp/` — die Prüfliste der Erweiterung
 * (`tools/extension-offene-amazon.mjs`) las sie und lieferte `/dp/`-Adressen (Deploy 18.10.2026).
 * Auch der Kanal ging verloren: er ist unter dem Adresskern der ASIN gemerkt, den die gti-Adresse
 * nicht trägt (Blue Giant, „aniverse").
 *
 * Gibt zurück, wie viele der beiden Adressen sich geändert haben.
 */
export function richtePrimeWeg(s: StreamLink, kanalJeAdresse: Map<string, string | undefined>): number {
  let gerichtet = 0
  const neu = amazonAdresseRichten(s.url)
  if (neu !== s.url) gerichtet++
  s.url = neu
  if (s.seite) {
    const neueSeite = amazonAdresseRichten(s.seite)
    if (neueSeite !== s.seite) gerichtet++
    s.seite = neueSeite
  }
  /* Hier, hinter allen Quellen, trifft der Kanal auch Wege, deren Adresse spät entsteht. */
  const kanal = kanalJeAdresse.get(adressKern(s.url)) ?? kanalJeAdresse.get(adressKern(s.seite))
  if (kanal) s.kanal = kanal
  return gerichtet
}

/** Alle Prime-Wege aller Titel; gibt die Zahl der geänderten Adressen zurück. */
export function richtePrimeWege(titel: Title[], kanalJeAdresse: Map<string, string | undefined>): number {
  let gerichtet = 0
  for (const t of titel) {
    for (const s of t.streams ?? []) {
      if (s.platform === 'primevideo') gerichtet += richtePrimeWeg(s, kanalJeAdresse)
    }
  }
  return gerichtet
}
