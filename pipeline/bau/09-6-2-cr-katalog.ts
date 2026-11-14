import { gehoertAnderem, crKatalog, kennungAusAdresse } from './cr-serie-geteilt.ts'
import { type Title, type PlatformId } from '../../shared/types.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'
import { log } from '../lib/util.ts'

export function ergaenzeCrWegeAusKatalog({ titles, crAdresseZu, crKatalogDeutsch, adressKern, frueherEntfernt, toteCrSerien, belegFuer, lautPruefungTot }: {
  titles: Map<number, Title>
  crAdresseZu: (name: string) => string | undefined
  crKatalogDeutsch: Set<string>
  adressKern: (u: string) => string
  frueherEntfernt: { has: (kern: string, titleId: number) => boolean; }
  toteCrSerien: Set<string>
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
  lautPruefungTot: (url: string) => boolean
}) {
  /*
    **Der deutsche Crunchyroll-Katalog legt Verweise an, nicht nur richtige Adressen.**

    `data/cr-katalog-de.json` liegt seit dem 22.08.2026 im Repo und wurde bis
    heute nur benutzt, um eine **vorhandene** kaputte Adresse zu ersetzen. Für
    einen Titel ganz ohne Crunchyroll-Verweis wurde er nie gefragt — und damit
    auch nie geprüft, denn die Warteschlange des Dub-Laufs bildet sich aus den
    vorhandenen Verweisen.

    Daniel am 16.09.2026, mit vier Bildern: „Code Geass: Akito the Exiled - The
    Brightness Falls" stand als „Noch keine deutsche Fassung" da, während
    Crunchyroll die Reihe unter GRP585ZQR mit „Audio: Japanese, **Deutsch**,
    Français" führt und alle fünf Folgen als „Synchro | Untertitel" ausweist.
    Vier der fünf Teile hatten einen Prime-Weg, der fünfte gar keinen. „Sogar
    auf crunchyroll existent, wo wir 100%-ige abdeckung haben sollten."

    Gemessen über den Bestand: 2.142 Titel ohne Crunchyroll-Verweis, 304 mit
    einem Katalogtreffer, **75 davon in einem Katalogeintrag mit `de-DE`**.

    **Angelegt wird der Weg ohne Sprachurteil.** Die Tonspurliste im Katalog
    gilt der Reihe, nicht der Folge — sie taugt als Wegweiser, nicht als Zeuge
    (dieselbe Trennung wie bei JustWatch, 10.09.2026). Das Urteil je Folge holt
    der nächste `data:cr-dub`-Lauf, der diesen Verweis jetzt überhaupt erst
    sieht. Ohne `de-DE` im Katalog wird nichts angelegt: Ein Weg, der zur Frage
    dieses Projekts nichts sagt, ist die Mühe des Klicks nicht wert.
  */
  let crAusKatalog = 0
  for (const title of titles.values()) {
    if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
    const url = crAdresseZu(title.titleEn ?? title.titleRomaji ?? '')
    if (!url) continue
    const kennung = url.split('/series/')[1]?.split('/')[0] ?? ''
    if (!crKatalogDeutsch.has(kennung) || gehoertAnderem(titles, kennung, title, crKatalog(), kennungAusAdresse())) continue
    const kern = adressKern(url)
    if (frueherEntfernt.has(kern, title.id)) continue
    if (toteCrSerien.has(kennung)) continue
    const beleg = belegFuer(title.id, 'crunchyroll', url)
    if (beleg && (beleg.dub !== true || beleg.available === false)) continue
    if (lautPruefungTot(url)) continue
    title.streams.push({ platform: 'crunchyroll', url })
    crAusKatalog++
  }
  if (crAusKatalog)
    log(`${crAusKatalog} Crunchyroll-Verweise aus dem deutschen Katalog angelegt (Titel, die bisher keinen hatten)`)
}
