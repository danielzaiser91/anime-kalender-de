/**
 * Der Schluss von `fetch-rohfolgen.ts`: Prüflisten schreiben, dann den Briefkasten abhaken, dann zählen.
 * Ausgelagert (16.10.2026), damit der Zuordner nicht weiter wächst; Inhalt und Reihenfolge unverändert.
 */
import { log, readJson, warn, writeJson } from './util.ts'
import { recordSource } from './health.ts'

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

export async function schliesseRohfolgenAb({
  zugeordnet,
  offen,
  erledigt,
  veraltet,
  zaehler: { ueberFolgentitel, uebersprungenStaffel, ohneFolgenzuordnung },
  worker: WORKER,
  token: TOKEN,
}: {
  zugeordnet: Record<string, Zugeordnet>
  offen: Offen[]
  erledigt: number[]
  veraltet: number[]
  zaehler: Zaehler
  worker: string
  token: string
}): Promise<void> {
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
  const bisher = readJson<typeof zugeordnet>('data/prime-zugeordnet.json', {})
  writeJson('data/prime-zugeordnet.json', { ...bisher, ...zugeordnet })
  writeJson('data/prime-unzugeordnet.json', offen)

  /*
    **Erst schreiben, dann abhaken.** Die Zuordnung steht committet im Repo,
    bevor der Briefkasten sie vergisst — andersherum wäre ein Netzfehler zwischen
    beiden Schritten ein Datenverlust.
  */
  erledigt.push(...veraltet)
  if (erledigt.length) {
    try {
      const res = await fetch(`${WORKER}/pruefung`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': TOKEN },
        body: JSON.stringify({ rohfolgenUebernommen: erledigt }),
      })
      if (res.ok) log(`${erledigt.length} Rohfolgen abgehakt`)
      else warn(`Rohfolgen nicht abgehakt: HTTP ${res.status} — sie kommen beim nächsten Lauf erneut`)
    } catch (e) {
      warn(`Rohfolgen nicht abgehakt: ${(e as Error).message}`)
    }
  }

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
