import { antworteSitzung, istFertig, naechstesPaar, type Antwort, type Sitzung } from '@shared/empfehlung-kern.ts'
import type { Kontext } from '@shared/empfehlung-vektor.ts'
import { coverBild } from './cover.ts'

/** Ab dieser Fensterbreite zeigt eine Karte das Hochformat-Cover, darunter das Banner. */
export const BREIT_AB_PX = 720

export interface KartenQuelle {
  src?: string
  srcSet?: string
  sizes?: string
}

/** Die eine Entscheidung, welches Bild eine Duell-Karte zeigt; Anzeige und Vorladen rufen sie beide. */
export function kartenQuelle(banner: string | undefined, coverUrl: string | undefined, breit: boolean): KartenQuelle {
  const cover = coverBild(coverUrl, 300)
  if (breit && cover.src) return { src: cover.src, srcSet: cover.srcSet, sizes: cover.sizes }
  return { src: banner ?? cover.src }
}

/** Das Bild-Objekt des Browsers, soweit das Vorladen es braucht (in Tests ersetzbar). */
export interface Lader {
  src: string
  srcset: string
  sizes: string
  decode: () => Promise<void>
}

/** Lädt und dekodiert alle Quellen; ein Fehler eines Bildes hält die anderen nicht auf (die Karte zeigt es dann eben nachladend). */
export function ladeUndDekodiere(quellen: KartenQuelle[], neuerLader: () => Lader): Promise<void> {
  const eins = (q: KartenQuelle): Promise<void> => {
    if (!q.src) return Promise.resolve()
    const l = neuerLader()
    if (q.sizes) l.sizes = q.sizes
    if (q.srcSet) l.srcset = q.srcSet
    l.src = q.src
    return l.decode().catch(() => undefined)
  }
  return Promise.all(quellen.map(eins)).then(() => undefined)
}

export const browserLader = (): Lader => new Image() as unknown as Lader

/** Das Paar, das nach dieser Antwort kommt; null, wenn die Reise dann zu den Vorschlägen geht. Rein, denn die Kernfunktionen sind es. */
export function paarNachAntwort(k: Kontext, s: Sitzung, antwort: Antwort, ziel: number): [number, number] | null {
  const danach = antworteSitzung(k, s, antwort)
  return istFertig(k, danach.zustand, ziel) ? null : naechstesPaar(k, danach.zustand)
}
