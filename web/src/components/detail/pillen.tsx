import { PLATFORMS, type WatchLink } from '@shared/types.ts'
import { translate } from '../../lib/i18n.tsx'
import { plattformVonWegName } from '../../lib/anbieter-wegname.ts'

/*
  Die Pille „nicht mehr abrufbar" (durchgestrichen) ist seit dem 22.09.2026 aus der Oberfläche
  genommen. Die Abgänge bleiben als
  `entfernteStreams` im Bestand.
*/

/**
 * **Die Silberscheibe für aniSearch-Disc-Wege.**
 *
 * Daniel am 07.09.2026: „füg ein cd icon links in die pill statt disc zu
 * schreiben. einfach icon + anisearch und schöner gestyled." Das Zeichen sagt
 * in 14 px, wofür das Wort „Disc" eine Zeile brauchte — und es sagt es auch
 * dem, der die Pille nur streift.
 *
 * `currentColor` statt einer festen Farbe: So trägt das Zeichen dieselbe
 * Tönung wie der Text daneben, in beiden Themen.
 *
 * **Seit dem 02.10.2026 steht es in `ui.tsx`** (`TvZeichen` daneben): Die Schnellfilter im
 * Filterfeld brauchen es, und von hier gezogen lüde das Filterfeld das nachgeladene
 * Detail-Modul mit.
 */


/**
 * Fasst die Bezugswege eines Shops zu einer Zeile zusammen.
 *
 * Vorher stand jede Ausgabe in einer eigenen Zeile: „AniMoon — Vol. 1",
 * „AniMoon — Vol. 2", „AniMoon — Vol. 3", „AniMoon — Vol. 4" untereinander. Das
 * sind vier Zeilen für eine Auskunft — nämlich, dass es die Serie bei AniMoon in
 * vier Ausgaben gibt.
 *
 * Gruppiert wird nach **Hostnamen**, nicht nach Anzeigenamen: Derselbe Shop
 * schreibt sich in unseren Daten mal so, mal anders, die Adresse nicht. Der
 * Anzeigename kommt aus dem gemeinsamen Teil vor dem Gedankenstrich; steht dort
 * nichts Gemeinsames, bleibt der volle Name stehen.
 */
/**
 * Die Farbe eines Bezugswegs — sofern er zu einer Plattform gehört, die wir führen.
 *
 * Die Namen der Kanal-Wege beginnen mit dem Namen der Plattform, auf der man
 * landet („Amazon Prime (Aniverse)"). Wo das zutrifft, bekommt die Pille
 * dieselbe Farbe wie die Anbieter-Pille daneben; ein Shop ohne eigene
 * Plattform (Videobuster, maxdome, JPC) bleibt neutral.
 *
 * Verglichen wird über den **Namensanfang**, nicht über ein Vorkommen
 * irgendwo: „Amazon DVD / Blu-ray" ist ein Kaufweg, kein Prime-Angebot, und
 * soll die Prime-Farbe nicht erben.
 */
/*
  **TOGGO** (Daniel, 19.09.2026, an Dragon Ball Daima). Die Farbe ist abgelesen: „Toggo Logo
  10.2019.svg" und „Toggo plus Logo 10.2019.svg" bei Wikimedia Commons (gemeinfrei, Marke),
  beide #ec6400/#ec6500. Das Zeichen ist das nachgebaute App-Symbol (`public/anbieter/toggo.svg`,
  siehe `anbieter-icon.tsx`).

  **TOGGO zeigt ausschließlich deutsche Fassungen** — der Weg trägt deshalb „DE ✓" ohne Urteil je
  Folge. Welche Folgen gerade
  abrufbar sind, steht in der zweiten Zeile — aus den Fenstern je Folge, die
  `pipeline/fetch-toggo.ts` täglich holt (`web/src/lib/toggo.ts`).
*/
export const TOGGO_ORANGE = '#ec6400'

export const PROSIEBEN_MAXX_ROT = '#d21e00'

export const istToggo = (url: string | undefined) => /(^|\.)toggo\.de$/i.test((() => { try { return new URL(url ?? '').hostname } catch { return '' } })())

export function farbeZuAnbieter(voll: string): string | undefined {
  /* „maxdome (über TMDB)" trägt die Farbe von maxdome (22.09.2026). */
  const name = voll.replace(/\s*\(über TMDB\)$/, '')
  /*
    **„Amazon Prime" steht nicht in `PLATFORMS`** — dort heißt der Anbieter
    „Prime Video". Seit der Umbenennung am 07.09.2026 („das kanalabo ist
    implizit … schreib lieber Amazon Prime (Aniverse)") beginnt kein Kanalname
    mehr mit dem Plattformnamen; ohne diese Zeile hätten alle neun Kanal-Pillen
    ihre Farbe verloren — still, denn eine fehlende Farbe sieht aus wie Absicht.
  */
  if (name.startsWith('Amazon Prime')) return PLATFORMS.primevideo.color
  /*
    **aniSearch ist keine Plattform, aber ein Weg** — und trug als einziger den
    farblosen Umriss, während alles daneben Farbe hatte (Daniel, 07.09.2026:
    „verbesser die pill, style sie gelblich"). Das Gelb ist aniSearchs eigene
    Hausfarbe, nicht geraten.
  */
  if (name === 'aniSearch') return '#f0a500'
  if (name === 'TOGGO') return TOGGO_ORANGE
  /*
    **Die Hausfarben der Shops, die keine Plattform bei uns sind.**

    Daniel am 16.09.2026 zur maxdome-Pille: „das maxdome icon ist blau,
    entsprechend die maxdome pill stylen." Bis dahin blieben diese Wege
    farblos, weil sie nicht in `PLATFORMS` stehen — in einer Reihe bunter
    Pillen sieht das aus wie ein Fehler.

    Jede Farbe ist **abgelesen, nicht gewählt**: aus dem jeweiligen Logo bei
    Wikimedia Commons (maxdome 2021: #0094d7, sechs Vorkommen; MagentaTV 2024:
    #e20074, die Telekom-Hausfarbe). Wo ein Markenzeichen vorliegt, trägt die
    Pille es zusätzlich — die übrigen bekommen wenigstens ihre Farbe.
  */
  const SHOP_FARBEN: Record<string, string> = {
    /* maxdome-Logo 2021 bei Wikimedia Commons, sechs Vorkommen. */
    maxdome: '#0094d7',
    /* MagentaTV-Logo 2024, die Telekom-Hausfarbe. */
    MagentaTV: '#e20074',
    /* Die drei aus der simple-icons-Datenbank, die dort die Marken-Hexwerte pflegt. */
    'Rakuten TV': '#bf0000',
    'Sky Store': '#0072c9',
    'freenet meinVOD': '#84bc34',
    /* Sky Go gehört zu Sky (Hausfarbe wie Sky Store), Videoload zur Telekom (Magenta wie MagentaTV). */
    'Sky Go': '#0072c9',
    Videoload: '#e20074',
    /*
      **Apple TV (#000000) und Google Play (#414141) tragen ein neutrales Grau, keine Hausfarbe.**
      Schwarz wäre auf dunklem Grund unsichtbar; ein Umriss ohne Tönung sah neben den bunten Pillen
      wie ein Platzhalter aus (Daniel, 06.10.2026). Akibapass fehlt, weil zu ihm keine belegte Farbe vorliegt.
    */
    'Apple TV': '#a1a1aa',
    'Google Play': '#a1a1aa',
  }
  if (SHOP_FARBEN[name]) return SHOP_FARBEN[name]
  const schreibweise = plattformVonWegName(name)
  if (schreibweise) return PLATFORMS[schreibweise].color
  for (const p of Object.values(PLATFORMS)) {
    if (p.name && name.startsWith(p.name)) return p.color
  }
  return undefined
}

/** Was die Oberfläche je Weg einer Pille braucht. */
type Eintrag = Pick<WatchLink, 'url' | 'nurFolge' | 'dubRanges' | 'dubAbgeleitet'> & { label?: string }

const eintragVon = (l: WatchLink): Eintrag => ({
  url: l.url,
  nurFolge: l.nurFolge,
  dubRanges: l.dubRanges,
  dubAbgeleitet: l.dubAbgeleitet,
})

export function gruppiereKaufwege(links: WatchLink[]): { shop: string; eintraege: Eintrag[] }[] {
  const nachHost = new Map<string, WatchLink[]>()
  for (const l of links) {
    let host = l.url
    try {
      host = new URL(l.url).hostname.replace(/^www\./, '')
    } catch {
      // Keine gültige Adresse — dann steht der Eintrag eben für sich allein.
    }
    /* Alle Wege über TMDB teilen sich einen Host — gruppiert wird dort nach Anbieter (22.09.2026). */
    if (l.ueberTmdb) host = `tmdb|${l.name}`
    const liste = nachHost.get(host) ?? []
    liste.push(l)
    nachHost.set(host, liste)
  }

  /*
    **Zwei Schreibweisen, dieselbe Absicht: „Basis, dann Zusatz".**

    Bis zum 07.09.2026 trennte ein Gedankenstrich („Prime Video — ADN
    Kanalabo"), seither eine Klammer („Amazon Prime (ADN)"). Ohne den zweiten
    Fall stünden mehrere Kanäle desselben Hosts wieder als einzelne Pillen
    nebeneinander, statt sich eine Basis zu teilen — dieselbe Auskunft, nur
    breiter.
  */
  const zerlege = (name: string): string[] => {
    const klammer = /^(.+?)\s+\((.+)\)$/.exec(name)
    if (klammer) return [klammer[1]!, klammer[2]!]
    return name.split(/\s+—\s+/)
  }

  return [...nachHost.values()].map((liste) => {
    const geteilt = liste.map((l) => zerlege(l.name))
    const gemeinsam = geteilt.every((t) => t.length > 1 && t[0] === geteilt[0][0])
    if (liste.length === 1 || !gemeinsam) {
      /* Die Adresse ist TMDBs Übersicht, nicht der Anbieter — das steht an der Pille. */
      return {
        shop: liste[0].ueberTmdb ? translate('detail.ueberTmdb', { name: liste[0].name }) : liste[0].name,
        eintraege: liste.map(eintragVon),
      }
    }
    return {
      shop: geteilt[0][0],
      eintraege: liste.map((l, i) => ({ label: geteilt[i].slice(1).join(' — '), ...eintragVon(l) })),
    }
  })
}
