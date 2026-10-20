/**
 * Der Schluss von `fetch-rohfolgen.ts`: Prüflisten schreiben, die abzuhakenden Kennungen merken, dann zählen.
 * Ausgelagert (16.10.2026), damit der Zuordner nicht weiter wächst; Inhalt und Reihenfolge unverändert.
 */
import { log, writeJson } from './util.ts'
import { merkeZumQuittieren, ROHFOLGEN_ABHAKEN } from './spaeter-quittieren.ts'
import { recordSource } from './health.ts'
import { verschiebeKanalGruppen, type KanalAussortiert } from './kanal-aussortieren.ts'
import { leseZugeordnet } from './prime-meldung-riegel.ts'

/** Ein Fall, der geklärt werden muss, statt geraten zu werden. */
export interface Offen {
  url: string
  titel: string | null
  grund: string
  folgen: number
  /** Ob mindestens eine Rohfolge eine Titel-Kennung mitbrachte — siehe unten. */
  mitKennung?: boolean
}

export interface Zugeordnet {
  titleId: number
  asin: string | null
  seite?: string | null
  plattform: string
  folgen: { unsere: number | null; sprachen: string[] }[]
}

export interface Zaehler {
  ueberFolgentitel: number
  uebersprungenStaffel: number
  ohneFolgenzuordnung: number
}

export function schliesseRohfolgenAb({
  zugeordnet,
  kanalWeg,
  offen,
  erledigt,
  veraltet,
  zaehler: { ueberFolgentitel, uebersprungenStaffel, ohneFolgenzuordnung },
}: {
  zugeordnet: Record<string, Zugeordnet>
  /** Offene Kanal-Gruppen ohne Deutsch (lib/kanal-aussortieren.ts): kommen aus der offenen Liste und werden abgehakt. */
  kanalWeg: KanalAussortiert[]
  offen: Offen[]
  erledigt: number[]
  veraltet: number[]
  zaehler: Zaehler
}): void {
  /*
    **Der Bestand dieser Datei ist der Ertrag aller Läufe, nicht der des letzten.**

    Geschrieben wurde hier `zugeordnet` — die Zuordnungen **dieses** Laufs. Und
    weil der Briefkasten danach abgehakt wird, kommen die alten Meldungen nie
    wieder: Was gestern zugeordnet war, war heute weg. Der Verlauf der Datei
    zeigt es unmissverständlich — 0, 1, 2, 0, 1 Adressen, nie mehr. Am
    04.09.2026 standen dort die zwölf deutschen Takagi-Folgen (AniList 99468),
    am 05.09. nicht mehr.

    Der Schaden ist nicht die Datei, sondern was daran hängt: `build.ts` legt aus
    ihr die Prime-Verweise an. Ein Verweis, der aus gemeldeten Folgen entsteht,
    hielt damit genau einen Bau.

    Zusammengeführt wird über den Schlüssel `url#asin` — eine erneute Meldung
    derselben Ausgabe **ersetzt** ihren Eintrag, alle übrigen bleiben stehen.
    Dasselbe Muster wie beim Filmblock-Abruf, aus demselben Grund: Ein Lauf, der
    nichts findet, darf nicht löschen, was ein früherer gefunden hat.
  */
  erledigt.push(...verschiebeKanalGruppen(kanalWeg, offen))
  const bisher = leseZugeordnet<(typeof zugeordnet)[string]>()
  writeJson('data/prime-zugeordnet.json', leseZugeordnet({ ...bisher, ...zugeordnet }))
  writeJson('data/prime-unzugeordnet.json', offen)

  /*
    **Abgehakt wird erst nach dem Commit** (17.10.2026): Hier wird nur gemerkt, der Schritt
    „Rohfolgen abhaken" (`pipeline/rohfolgen-abhaken.ts`) schickt es nach „Änderungen committen" ab.
    Am 16.10.2026 hakte dieser Lauf 13.350 Rohfolgen ab, dann scheiterte der Bau — 1.029 Adressen gingen verloren.
  */
  erledigt.push(...veraltet)
  merkeZumQuittieren(ROHFOLGEN_ABHAKEN, erledigt)
  if (erledigt.length) log(`${erledigt.length} Rohfolgen werden nach dem Commit abgehakt`)

  const gesamtZugeordnet = Object.values(zugeordnet).reduce((n, z) => n + z.folgen.length, 0)
  log(
    `${Object.keys(zugeordnet).length} Adressen zugeordnet (${gesamtZugeordnet} Folgen), ${offen.length} offen` +
      (ueberFolgentitel ? `, davon ${ueberFolgentitel} allein über die Folgentitel gefunden` : '') +
      (uebersprungenStaffel
        ? `, ${uebersprungenStaffel} übersprungen: die Meldung nennt eine Staffel ab 2, der Treffer war der Reihenkopf`
        : ''),
  )
  if (ohneFolgenzuordnung)
    log(`${ohneFolgenzuordnung} Adressen belegen nur den Titel — die Folgen sind dort nicht zuzuordnen`)
  for (const o of offen.slice(0, 5)) log(`  offen: ${o.titel ?? o.url} — ${o.grund}`)
  recordSource('rohfolgen', gesamtZugeordnet, undefined, Object.keys(zugeordnet).length)
}
