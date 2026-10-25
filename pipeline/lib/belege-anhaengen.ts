/**
 * Neue Belege aus Browser-Meldungen an `data/dub-confirmed.yaml` hängen (aus `fetch-pruefungen.ts`
 * ausgelagert, damit der Schreibweg mit Datei und Zeilen als Parameter testbar ist).
 */
import { readFileSync } from 'node:fs'
import yaml from 'js-yaml'
import { neueBelegBloecke, schreibeBelege } from './dub-confirmed.ts'
import { erneuereNeinDatum } from './nein-datum-erneuern.ts'

/** `zeilen`: die erzeugten Beleg-Zeilen; `heute`: Abholdatum für die Kopfzeile. */
export function haengeBelegeAn(o: {
  datei: string
  zeilen: string[]
  heute: string
  log: (text: string) => void
  warn: (text: string) => void
}): void {
  const { datei: p, zeilen, heute, log, warn } = o
  /* Dasselbe Nein noch einmal gemessen: das Datum des vorhandenen Belegs rückt vor (`nein-datum-erneuern.ts`). */
  const { text: alt, erneuert } = erneuereNeinDatum(readFileSync(p, 'utf8'), zeilen)
  if (erneuert) log(`${erneuert} Nein-Beleg(e) mit neuem Messdatum`)
  const kopf = `\n# --- Aus dem Browser gemeldet, abgeholt am ${heute} ---`
  /* Ein Beleg, der schon dasteht, wird nicht noch einmal angehängt (Solo Leveling, 15.09.2026). */
  const { bloecke, neu: neueBloecke } = neueBelegBloecke(alt, zeilen)
  const uebersprungen = bloecke.length - neueBloecke.length
  if (uebersprungen) log(`${uebersprungen} Beleg(e) standen wörtlich schon da — nicht erneut angehängt`)
  const neueZeilen = neueBloecke.flatMap((b) => ['', ...b.filter((z, i) => i === 0 || z !== '')])
  const neu = neueBloecke.length ? alt.trimEnd() + '\n' + kopf + '\n' + neueZeilen.join('\n') + '\n' : alt
  /*
    **Erst lesen, dann schreiben — sonst fällt der Fehler drei Schritte später.**

    Am 30.08.2026 bekam ein Eintrag zwei `url:`-Zeilen: Eine Amazon-Suchadresse
    mit zugeordneter `/dp/`-Adresse durchlief oben den Zweig für die echte
    Adresse und unten noch einmal den für „Kanal-Meldung ohne Urteil". YAML
    verbietet doppelte Schlüssel, und der stündliche Lauf brach ab — nicht hier,
    sondern beim Bau, mit einer Zeilennummer aus 24.000 Zeilen und ohne Hinweis
    darauf, wer sie geschrieben hat.

    Ein Parse-Versuch kostet Millisekunden und meldet den Fehler dort, wo er
    entsteht. Geschrieben wird nur, was sich danach auch wieder lesen lässt.
  */
  try {
    yaml.load(neu)
  } catch (e) {
    throw new Error(
      `Die erzeugten Zeilen ergeben kein gültiges YAML — nichts geschrieben. ${(e as Error).message}`,
    )
  }
  if (erneuert || neueZeilen.some((z) => z.startsWith('- '))) schreibeBelege(p, neu, warn)
}
