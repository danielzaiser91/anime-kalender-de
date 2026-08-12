/**
 * Wie ein Anime heißt und wie eine Reihe geordnet wird.
 *
 * Steht in `shared/`, weil dieselbe Antwort an vier Stellen gebraucht wird:
 * Web-App, Teilen-Seiten, ICS-Feeds und Pipeline. Zwei Fassungen derselben
 * Regel laufen auseinander — hier ist der eine Ort.
 */
import type { Title } from './types.ts'

/**
 * „Season" kommt nicht auf die Seite.
 *
 * Die Seite heißt anime-kalender.de und ist auf Deutsch. Daniel am 12.08.2026:
 * Im Kopf des Detail-Panels stand „That Time I Got Reincarnated as a Slime
 * Season 4", vier Zeilen darunter „Meine Wiedergeburt als Schleim in einer
 * anderen Welt Staffel 4" — dasselbe Wort in zwei Sprachen, in einem Blickfeld.
 *
 * Ersetzt wird nur die **Staffelmarkierung**, nicht jedes Vorkommen: „Season"
 * mit Zahl davor oder dahinter, und „Final Season". Der Rest des Titels ist ein
 * Eigenname und bleibt unangetastet — „That Time I Got Reincarnated as a Slime
 * the Movie: Scarlet Bond" heißt so und wird nicht übersetzt.
 */
export function eindeutschenStaffel(name: string): string {
  return name
    .replace(/\bThe Final Season\b/gi, 'Die finale Staffel')
    .replace(/\bFinal Season\b/gi, 'Finale Staffel')
    // Mehrzahl zuerst, sonst greift die Einzahl-Regel nicht: AniList führt
    // „Urusei Yatsura (2022) Seasons 1 & 2" als einen Titel.
    .replace(/\bSeasons\s+(\d+)\s*(?:&|and|\+|–|-)\s*(\d+)/gi, 'Staffeln $1 & $2')
    .replace(/\b(\d+)(?:st|nd|rd|th)\s+Season\b/gi, 'Staffel $1')
    .replace(/\bSeason\s+(\d+)\b/gi, 'Staffel $1')
    .replace(/\bPart\s+(\d+)\b/gi, 'Teil $1')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

/** Der Name, unter dem ein Titel angezeigt wird — deutsch, wo vorhanden. */
export function anzeigeName(title: Pick<Title, 'titleDe' | 'titleEn' | 'titleRomaji' | 'id'>): string {
  return eindeutschenStaffel(title.titleDe ?? title.titleEn ?? title.titleRomaji ?? `#${title.id}`)
}

const JAHRESZEIT: Record<string, number> = { WINTER: 0, SPRING: 1, SUMMER: 2, FALL: 3 }

/** Reihenfolge innerhalb einer Reihe: nach japanischer Ausstrahlung. */
export function nachAusstrahlung<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id'>>(a: T, b: T): number {
  return (
    (a.jpYear ?? 9999) - (b.jpYear ?? 9999) ||
    (JAHRESZEIT[a.jpSeason ?? ''] ?? 9) - (JAHRESZEIT[b.jpSeason ?? ''] ?? 9) ||
    a.id - b.id
  )
}

/** Reguläre Staffel oder Beiwerk (Film, OVA, Special)? */
export function istStaffel(format: string | undefined): boolean {
  return format === 'TV' || format === 'TV_SHORT' || format === 'ONA'
}

/**
 * Wer eine Reihe auf einer einzigen Kachel vertritt.
 *
 * Bis zum 12.08.2026 war das schlicht der **neueste** Eintrag — mit der
 * Begründung, ältere Staffeln lägen ohnehin in der Vergangenheit. Das Ergebnis
 * sah Daniel bei einer Suche nach „slime": Vertreter waren
 * „I've Been Killing Slimes … Season 2" und „That Time I Got Reincarnated as a
 * Slime the Movie: Tears of the Azure Sea" — eine Fortsetzung und ein Film,
 * während die beiden gesuchten Serien selbst nirgends auftauchten.
 *
 * Wer eine Reihe sucht, meint ihren Anfang. Vertreter ist deshalb die **erste
 * reguläre Staffel**; gibt es keine (eine Reihe aus lauter Filmen), der
 * früheste Eintrag überhaupt.
 */
export function reihenVertreter<T extends Pick<Title, 'jpYear' | 'jpSeason' | 'id' | 'format'>>(
  mitglieder: T[],
): T {
  const sortiert = mitglieder.slice().sort(nachAusstrahlung)
  return sortiert.find((m) => istStaffel(m.format)) ?? sortiert[0]
}
