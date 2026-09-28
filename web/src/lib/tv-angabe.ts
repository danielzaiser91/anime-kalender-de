/**
 * **Was die TV-Pille sagt: Folge, Tag und Uhrzeit, Premiere oder Wiederholung** (Daniel,
 * 19.09.2026: „im tv muss auch sagen welche folge an dem termin kommt + uhrzeit ist
 * wichtig").
 *
 * **Premiere oder Wiederholung entscheidet `shared/tv-signale.ts`** (28.09.2026): Dieselbe
 * Antwort braucht der Newsletter im Worker, der den Datensatz nicht hat. Hier bleibt, was nur
 * die Pille angeht — Text, laufende Sendung, Uhrzeit.
 */
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'
import { expandEvents } from '@shared/logic.ts'
import { istPremiere } from '@shared/tv-signale.ts'

export { istPremiere }

const TAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/** Was die Pille zu einer laufenden Sendung sagt — Folge, Titel und wie weit sie ist. */
export interface TvLaeuft {
  /** „Fg. 1093 · Erneuter Albtraum – …", ohne das Wort „Läuft". */
  text: string
  /** 0 … 1, Anteil der verstrichenen Sendezeit laut Programm. */
  anteil: number
  /** Programmende „HH:MM". */
  bis: string
}

/** Minuten seit 1970 für eine Berliner Ortszeit „YYYY-MM-DDTHH:MM" — nur zum Vergleichen. */
const minuten = (lokal: string) => Date.parse(`${lokal}:00Z`) / 60_000

/**
 * „Fg. 16 · heute 21:15" plus `premiere` — oder `undefined`, wenn es keinen Termin gibt.
 * „Premiere" ist ein eigenes Abzeichen an der Pille (Daniel, 19.09.2026: „zu unauffällig"),
 * „Wiederholung" steht im Text.
 *
 * **Läuft eine Sendung, kommt `laeuft` dazu, und der Text nennt die nächste** (Daniel, 22.09.2026:
 * „es muss beides angezeigt werden, also was vorher dort stand + läuft gerade"). Beginn und Ende
 * stammen aus dem Programm (`release.sendungen`), nicht aus einer Rechnung: „anhand von
 * episodenlänge + sendestart nicht ausmachen wie lang es läuft wegen werbepause". One Piece am
 * 22.09.2026 lief 18:25–18:50 und 18:50–19:20 — eine feste Dauer hätte die zweite um 19:15 beendet.
 */
export function tvAngabe(
  release: Release,
  title: Title,
  releases: Release[],
  heute: string,
  jetztZeit: string,
): { text: string; premiere: boolean; laeuft?: TvLaeuft; programm?: string; zeit?: string } | undefined {
  if (release.platform !== 'tv') return undefined
  const termine = expandEvents(release)
  const jetzt = `${heute}T${jetztZeit}`
  const sendungen = release.sendungen ?? []
  const laufend = sendungen.find((s) => s.start <= jetzt && jetzt < s.ende)
  /* Die Sendung zum Termin: gleicher Tag, gleiche Uhrzeit — daher kommen Folgentitel und Nummer. */
  const sendungZu = (e: ReleaseEvent) => sendungen.find((s) => s.start === `${e.date}T${e.time ?? ''}`)
  const nummer = (e: ReleaseEvent) => (e.episode && !e.sichtung ? e.episode : sendungZu(e)?.nr)
  const kommend = termine.find((e) => e.date > heute || (e.date === heute && (e.time ?? '99') > jetztZeit))
  /*
    **Ohne kommenden Termin gibt es nichts zu sagen** (Daniel, 22.09.2026: „es ist ein
    Fernsehtermin in der vergangenheit, niemand kann in die vergangenheit reisen und dort die
    folge gucken … also weg damit"). Vorher nannte die Pille den letzten Termin mit „zuletzt";
    das beantwortet die Frage „wo kann ich das sehen" nicht. Die Pille entfällt damit ganz —
    der Aufrufer zeigt einen TV-Weg nur, solange `tvAngabe` etwas liefert.
  */
  if (!kommend && !laufend) return undefined
  const e: ReleaseEvent | undefined = kommend
  const laufEvent = laufend && termine.find((x) => `${x.date}T${x.time ?? ''}` === laufend.start)
  /* Premiere gilt der Folge, von der die Pille zuerst spricht — der laufenden, sonst der nächsten. */
  const bezug = laufEvent || e
  const premiere = Boolean(
    bezug?.episode &&
      !bezug.sichtung &&
      istPremiere(bezug.episode, bezug.date, title, releases, release.ersteDeutsch, bezug.time),
  )
  let text = ''
  /*
    **Tag und Uhrzeit werden farbig hervorgehoben** (Daniel, 22.09.2026, ProSieben-MAXX-Pille).
    Sie stehen mitten im Text; damit die Oberfläche sie einfärben kann, kommen sie zusätzlich als
    eigene Angabe zurück. Der Text selbst bleibt unverändert — daran hängen die Zusicherungen.
  */
  let zeit: string | undefined
  if (e) {
    const tag =
      e.date === heute
        ? 'heute'
        : kommend && Date.parse(e.date) - Date.parse(heute) < 6.5 * 864e5
          ? TAG[new Date(`${e.date}T12:00:00Z`).getUTCDay()]!
          : `${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.`
    const nr = nummer(e)
    zeit = [kommend ? '' : 'zuletzt', tag, e.time].filter(Boolean).join(' ')
    const teile = [
      nr ? `Fg. ${nr}` : undefined,
      zeit,
      e.episode && !e.sichtung && !premiere && !laufend ? 'Wiederholung' : undefined,
      /* Ohne laufende Sendung trägt die Zeile den Folgentitel der nächsten. */
      !laufend && kommend ? sendungZu(e)?.folge : undefined,
    ]
    text = (laufend && kommend ? 'Nächste: ' : '') + teile.filter(Boolean).join(' · ')
  }
  /* Das Fernseh-Zeichen führt ins Programm, zur laufenden Sendung, sonst zur nächsten (22.09.2026). */
  const programm = (laufend ?? (kommend && sendungZu(kommend)))?.url
  if (!laufend) return { text, premiere, ...(programm ? { programm } : {}), ...(zeit ? { zeit } : {}) }
  const nr = laufend.nr ?? (laufEvent ? nummer(laufEvent) : undefined)
  return {
    text: kommend ? text : '',
    premiere,
    ...(programm ? { programm } : {}),
    ...(kommend && zeit ? { zeit } : {}),
    laeuft: {
      text: [nr ? `Fg. ${nr}` : undefined, laufend.folge].filter(Boolean).join(' · '),
      anteil: Math.min(1, Math.max(0, (minuten(jetzt) - minuten(laufend.start)) / (minuten(laufend.ende) - minuten(laufend.start) || 1))),
      bis: laufend.ende.slice(11, 16),
    },
  }
}

/**
 * **Ist dieser Kalendertermin eine TV-Premiere?** (22.09.2026) — dieselbe Frage, die der
 * TV-Schalter stellt („ausgeschaltet bleiben Premieren sichtbar") und die das Fähnchen an der
 * Kachel beantwortet. Eine Sichtung ohne Folgennummer ist nie eine.
 */
export function tvPremiere(
  e: ReleaseEvent,
  data: { titleById: Map<number, Title>; releasesByTitle: Map<number, Release[]>; releaseBySlug: Map<string, Release> },
): boolean {
  if (e.platform !== 'tv' || !e.episode || e.sichtung) return false
  const titel = data.titleById.get(e.titleId)
  return Boolean(
    titel &&
      istPremiere(
        e.episode,
        e.date,
        titel,
        data.releasesByTitle.get(e.titleId) ?? [],
        data.releaseBySlug.get(e.releaseSlug)?.ersteDeutsch,
        e.time,
      ),
  )
}
