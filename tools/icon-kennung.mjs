import { createHash } from 'node:crypto'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'
import { join, resolve } from 'node:path'

/** Eine Icon-Adresse in Anführungszeichen, z. B. `"/icons/icon.svg"` (HTML-Attribut oder Manifest-Wert), mit oder ohne Kennung. */
const ICON_ADRESSE = /(?<=["'])\/icons\/[\w.-]+\.(?:png|svg)(?:\?v=([0-9a-f]+))?(?=["'])/g

/** Kennung einer Icon-Datei: die ersten 8 Hex-Zeichen des SHA-256 ihres Inhalts, also nur bei echter Änderung neu. */
export function iconKennung(pfad) {
  return createHash('sha256').update(readFileSync(pfad)).digest('hex').slice(0, 8)
}

/** Hängt `?v=<Kennung>` an jede Icon-Adresse im Text; `ordner` enthält `icons/`. Adressen ohne Datei bleiben unverändert. */
export function versioniereIcons(text, ordner) {
  return text.replace(ICON_ADRESSE, (adresse) => {
    const pfad = adresse.split('?')[0]
    const datei = join(ordner, pfad)
    return existsSync(datei) ? `${pfad}?v=${iconKennung(datei)}` : adresse
  })
}

/** Mängel: jede Icon-Adresse im Text ohne `?v=` oder mit einer Kennung, die nicht zum Dateiinhalt passt. */
export function iconMaengel(text, ordner, name) {
  const mangel = []
  for (const treffer of text.matchAll(ICON_ADRESSE)) {
    const pfad = treffer[0].split('?')[0]
    const datei = join(ordner, pfad)
    if (!existsSync(datei)) continue
    if (treffer[1] === undefined) mangel.push(`${name}: ${pfad} ohne ?v=`)
    else if (treffer[1] !== iconKennung(datei)) mangel.push(`${name}: ${pfad}?v=${treffer[1]} passt nicht zum Inhalt (${iconKennung(datei)})`)
  }
  return mangel
}

/** Vite-Plugin: versioniert die Icon-Adressen in `index.html` und, nach dem Bau, in den kopierten Dateien `manifest.webmanifest` und `404.html`. */
export function iconKennungen(publicOrdner) {
  let dist = ''
  return {
    name: 'icon-kennungen',
    configResolved(c) {
      dist = resolve(c.root, c.build.outDir)
    },
    transformIndexHtml: (html) => versioniereIcons(html, publicOrdner),
    closeBundle() {
      for (const name of ['manifest.webmanifest', '404.html']) {
        const pfad = join(dist, name)
        if (existsSync(pfad)) writeFileSync(pfad, versioniereIcons(readFileSync(pfad, 'utf8'), publicOrdner))
      }
    },
  }
}
