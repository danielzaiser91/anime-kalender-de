/**
 * Teilbare Adressen: `#/<ansicht>?t=<Kennung>` muss das Detail-Panel des Titels öffnen.
 *
 * Anlass (11.10.2026): Links mit der AniList-Kennung (`?t=20464`, Haikyu!!) zeigten „keine Metadaten", weil die Seite seit der Stufe 1
 * (05.10.2026) nur noch die eigene Kennung `ak` kennt (Haikyu!! = 7031). Gemessen wird deshalb gegen `dist/data/`, das schon in `ak`
 * geschrieben ist: je Quelldatei (Kern, Hauptbestand, Cartoons, Katalog ohne Synchro) ein paar gleichmäßig verteilte Titel.
 */
import { readFileSync } from 'node:fs'
import path from 'node:path'

const QUELLEN = ['titles-core.json', 'titles.json', 'cartoons.json', 'ohne-synchro.json']
const JE_QUELLE = 3

/** Gleichmäßig über die Datei verteilte Titel (nicht die ersten, die oft Sonderfälle der Reihenfolge sind). */
function stichprobe(dist, datei) {
  const liste = JSON.parse(readFileSync(path.join(dist, 'data', datei), 'utf8'))
  const schritt = Math.floor(liste.length / (JE_QUELLE + 1))
  return Array.from({ length: JE_QUELLE }, (_, i) => liste[(i + 1) * schritt]).map((t) => ({ datei, titel: t }))
}

/** Öffnet die Adresse und gibt zurück, was das Panel zeigt: den Titelnamen oder `null`. */
async function panelName(seite, adresse) {
  await seite.goto('about:blank')
  await seite.goto(adresse, { waitUntil: 'load' })
  const panel = seite.locator('[data-panel="titel"]').first()
  await panel.waitFor({ state: 'attached', timeout: 15_000 }).catch(() => {})
  return panel.getAttribute('aria-label').catch(() => null)
}

/** Die Namen, unter denen die Seite den Titel führen darf (`anzeigeName` wählt einen davon). */
function namen(t) {
  return [t.titleDe, t.titleEn, t.titleRomaji, t.titleNative].filter(Boolean)
}

/**
 * Wahr, wenn alles ok ist. Der Name im Panel muss einer des Titels sein — ein Panel für einen anderen Titel (alte Kennung, die ein
 * fremder Titel trägt) ist schlimmer als gar keins.
 */
export async function pruefeAdressen(seite, dist, basis = 'http://ak.test') {
  const faelle = QUELLEN.flatMap((q) => stichprobe(dist, q))
  const abweichungen = []
  for (const [i, f] of faelle.entries()) {
    const ansichten = i % JE_QUELLE === 0 ? ['datenbank', 'woche'] : ['datenbank']
    for (const ansicht of ansichten) {
      const adresse = `${basis}/#/${ansicht}?t=${f.titel.id}`
      const name = await panelName(seite, adresse)
      if (!name) abweichungen.push(`${adresse} (${f.datei}): kein Panel`)
      else if (!namen(f.titel).includes(name)) abweichungen.push(`${adresse} (${f.datei}): Panel zeigt „${name}", erwartet ${namen(f.titel)[0]}`)
    }
  }
  console.log(`\nAdressen ?t=<ak> (${faelle.length} Titel aus ${QUELLEN.length} Dateien): ${abweichungen.length ? '' : 'ok'}`)
  for (const a of abweichungen) console.log(`  ✕ ${a}`)
  return abweichungen.length > 0
}
