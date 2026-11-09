/**
 * Neue Belege aus Browser-Meldungen an `data/dub-confirmed.yaml` hängen (aus `fetch-pruefungen.ts`
 * ausgelagert, damit der Schreibweg mit Datei und Zeilen als Parameter testbar ist).
 */
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import yaml from 'js-yaml'
import { neueBelegBloecke, schreibeBelege } from './dub-confirmed.ts'
import { erneuereNeinDatum } from './nein-datum-erneuern.ts'
import { merkeNachmessung, type NachmessMeldung } from './nein-nachmessung.ts'
import { blockIstEntfernt, ladeBelegeEntfernt } from './belege-entfernt.ts'

/** Liste der entfernten Fehlbelege neben der Beleg-Datei (`belege-entfernt.yaml`): kommen sie in den Meldungen wieder, werden sie nicht angehängt. */
const ENTFERNT_NAME = 'belege-entfernt.yaml'

/** `zeilen`: die erzeugten Beleg-Zeilen; `heute`: Abholdatum für die Kopfzeile. */
export function haengeBelegeAn(o: {
  datei: string
  zeilen: string[]
  /** Die abgeholten Meldungen: Kanal-Meldungen „kein Deutsch“ starten die Nein-Frist neu (`nein-nachmessung.ts`). */
  meldungen?: NachmessMeldung[]
  heute: string
  log: (text: string) => void
  warn: (text: string) => void
  /** Kommentarzeile über dem Block; ohne Angabe die der Browser-Meldungen. */
  kopf?: string
}): void {
  const { datei: p, zeilen, heute, log, warn } = o
  /* Dasselbe Nein noch einmal gemessen: das Datum des vorhandenen Belegs rückt vor (`nein-datum-erneuern.ts`). */
  const { text: datiert, erneuert } = erneuereNeinDatum(readFileSync(p, 'utf8'), zeilen)
  if (erneuert) log(`${erneuert} Nein-Beleg(e) mit neuem Messdatum`)
  const { text: alt, gemerkt } = merkeNachmessung(datiert, o.meldungen ?? [])
  if (gemerkt) log(`${gemerkt} Nein-Beleg(e) mit Nachmessung durch eine Kanal-Meldung (Frist läuft neu)`)
  const kopf = `\n${o.kopf ?? `# --- Aus dem Browser gemeldet, abgeholt am ${heute} ---`}`
  /* Ein Beleg, der schon dasteht, wird nicht noch einmal angehängt (Solo Leveling, 15.09.2026). */
  const { bloecke, neu: ungeprueft } = neueBelegBloecke(alt, zeilen)
  const entfernt = ladeBelegeEntfernt(join(dirname(p), ENTFERNT_NAME))
  const neueBloecke = ungeprueft.filter((b) => !blockIstEntfernt(entfernt, b))
  if (neueBloecke.length < ungeprueft.length) log(`${ungeprueft.length - neueBloecke.length} Beleg(e) stehen in belege-entfernt.yaml — nicht angehängt`)
  const uebersprungen = bloecke.length - ungeprueft.length
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
  if (erneuert || gemerkt || neueZeilen.some((z) => z.startsWith('- '))) schreibeBelege(p, neu, warn)
}
