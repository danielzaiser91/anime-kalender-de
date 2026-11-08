/**
 * **Auto-Belege aus Anime2You-Vorschlägen in `data/dub-confirmed.yaml` schreiben** (Auswahl: `synchro-beleg-auswahl.ts`).
 * Kommt aus `anime2you-extraktion.ts --uebernehmen`; die Datei geht danach wie jeder Sammel-Fund über `quellen-pr.sh` als Pull Request raus.
 * Katalog und Belegdatei sind Parameter, damit ein Test gegen eine Wegwerf-Wurzel läuft.
 */
import { existsSync, readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { haengeBelegeAn } from './belege-anhaengen.ts'
import type { GespeicherterVorschlag } from './anime2you-bestand.ts'
import { belegZeilen, HOECHSTENS_AM_TAG, IMMER, NOTIZ_MARKE, waehleSynchroBelege, type AutoBeleg, type Belegstand, type KatalogTitel, type Zurueckgestellt } from './synchro-beleg-auswahl.ts'

interface BelegZeile {
  anilistId?: number
  platform?: string
  dub?: boolean
  available?: boolean
  checkedAt?: string
  note?: string
}

/** Der Katalog: alle vorhandenen Titeldateien hintereinander (Hauptbestand, Titel ohne Synchro). */
export function ladeKatalog(dateien: string[]): KatalogTitel[] {
  return dateien.filter((d) => existsSync(d)).flatMap((d) => JSON.parse(readFileSync(d, 'utf8')) as KatalogTitel[])
}

/** Die Handbelege mit einem Urteil als `Belegstand` (ein Nein sperrt bis zu seinem Messtag, alles andere für immer), und wie viele Auto-Belege heute schon dastehen. */
export function leseBelegStand(belegDatei: string, heute: string): { belegt: Belegstand; heuteAuto: number } {
  const zeilen = (yaml.load(readFileSync(belegDatei, 'utf8')) as BelegZeile[] | null) ?? []
  const belegt: Belegstand = new Map()
  for (const z of zeilen.filter((e) => typeof e.dub === 'boolean' || typeof e.available === 'boolean')) {
    const bis = z.dub === false ? String(z.checkedAt ?? IMMER) : IMMER
    const k = `${z.anilistId}|${z.platform}`
    if ((belegt.get(k) ?? '') < bis) belegt.set(k, bis)
  }
  return {
    belegt,
    heuteAuto: zeilen.filter((z) => z.checkedAt === heute && z.note?.startsWith(NOTIZ_MARKE)).length,
  }
}

export interface AbgabeErgebnis {
  belege: AutoBeleg[]
  zurueck: Zurueckgestellt[]
}

export function gibSynchroBelegeAb(o: {
  vorschlaege: GespeicherterVorschlag[]
  belegDatei: string
  katalogDateien: string[]
  heute: string
  log: (text: string) => void
  warn: (text: string) => void
}): AbgabeErgebnis {
  const { belegt, heuteAuto } = leseBelegStand(o.belegDatei, o.heute)
  const erg = waehleSynchroBelege(o.vorschlaege, ladeKatalog(o.katalogDateien), belegt, o.heute, HOECHSTENS_AM_TAG - heuteAuto)
  if (erg.belege.length) {
    haengeBelegeAn({
      datei: o.belegDatei,
      zeilen: erg.belege.flatMap((b) => belegZeilen(b, o.heute)),
      heute: o.heute,
      log: o.log,
      warn: o.warn,
      kopf: `# --- Anime2You-Automatik, ${o.heute}: Synchro-Aussage im Artikel, Titel und Weg eindeutig ---`,
    })
  }
  for (const b of erg.belege) o.log(`Auto-Beleg: ${b.titel} (${b.anilistId}) bei ${b.plattform}, Artikel ${b.artikelId}`)
  for (const z of erg.zurueck) o.log(`Kein Auto-Beleg: ${z.titel} (Artikel ${z.artikelId}): ${z.grund}`)
  return erg
}

/** Kommentar am Pull Request: die eingetragenen Belege mit Zitat; die Gründe der Übrigen stehen im Log des Laufs. */
export function belegBericht(erg: AbgabeErgebnis, heute: string): string {
  const zeile = (b: AutoBeleg) => `- ${b.titel} (${b.anilistId}) bei ${b.plattform}: [Artikel ${b.artikelId}](${b.quelle}) – „${b.zitat.replace(/[\r\n]+/g, ' ')}“`
  return [
    `## Synchro-Belege aus Anime2You ${heute}`,
    '',
    `${erg.belege.length} Handbeleg(e) \`dub: true\` automatisch eingetragen (Notiz beginnt mit „${NOTIZ_MARKE}“); ${erg.zurueck.length} Vorschläge der letzten Tage blieben ohne Beleg (Gründe im Lauf-Log).`,
    ...erg.belege.map(zeile),
    '',
  ].join('\n')
}
