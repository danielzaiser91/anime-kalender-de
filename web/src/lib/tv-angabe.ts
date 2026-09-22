/**
 * **Was die TV-Pille sagt: Folge, Tag und Uhrzeit, Premiere oder Wiederholung** (Daniel,
 * 19.09.2026: „im tv muss auch sagen welche folge an dem termin kommt + uhrzeit ist
 * wichtig" und „premiere bzw wiederholung … je nachdem ob die folge das aller erste mal
 * auf deutsch erscheint, oder ob es bereits in streaming erhältlich ist").
 *
 * **Premiere** heißt: Zum Sendetermin gab es die Folge noch nirgends auf Deutsch im
 * Streaming. Geprüft wird je Streaming-Anbieter — hat er einen Termin (Release), zählen
 * dessen Folgentermine; sonst sein Weg: belegte Bereiche decken ihre Folgen ab, ein
 * `dub: true` ohne Bereiche den ganzen Titel. Dragon Ball DAIMA am 16.–18.09.2026 auf
 * TOGGO plus: YouTube hat nur Folge 1 deutsch, RTL+ startet am 25.09. → Premiere.
 * Eine Disc zählt nicht mit — gefragt ist Streaming.
 */
import type { Release, ReleaseEvent, Title } from '@shared/types.ts'
import { expandEvents } from '@shared/logic.ts'

export function istPremiere(
  folge: number,
  datum: string,
  title: Title,
  releases: Release[],
  ersteDeutsch?: Record<number, string>,
): boolean {
  /* Lief sie schon früher auf Deutsch (Wikipedia-EAD, RTL+-Start), ist es eine Wiederholung —
     Dragon Ball Folge 1 auf ProSieben MAXX 2026 ist nicht deren Premiere (1999). */
  const erst = ersteDeutsch?.[folge]
  if (erst && erst < datum) return false
  const plattformen = new Set([
    ...(title.streams ?? []).filter((s) => s.dub === true).map((s) => s.platform as string),
    ...releases.filter((r) => r.platform !== 'tv' && r.releaseType !== 'disc').map((r) => r.platform as string),
  ])
  for (const p of plattformen) {
    if (p === 'tv') continue
    const eigene = releases.filter((r) => r.platform === p && r.releaseType !== 'disc')
    if (eigene.length) {
      if (eigene.some((r) => expandEvents(r).some((e) => e.episode === folge && e.date <= datum))) return false
      continue
    }
    const s = (title.streams ?? []).find((x) => x.platform === p && x.dub === true)
    if (!s) continue
    const bereiche = s.dubRanges ?? []
    if (!bereiche.length) return false
    if (bereiche.some((r) => r.dub && r.from <= folge && folge <= r.to)) return false
  }
  return true
}

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
): { text: string; premiere: boolean; laeuft?: TvLaeuft } | undefined {
  if (release.platform !== 'tv') return undefined
  const termine = expandEvents(release)
  const jetzt = `${heute}T${jetztZeit}`
  const sendungen = release.sendungen ?? []
  const laufend = sendungen.find((s) => s.start <= jetzt && jetzt < s.ende)
  /* Die Sendung zum Termin: gleicher Tag, gleiche Uhrzeit — daher kommen Folgentitel und Nummer. */
  const sendungZu = (e: ReleaseEvent) => sendungen.find((s) => s.start === `${e.date}T${e.time ?? ''}`)
  const nummer = (e: ReleaseEvent) => (e.episode && !e.sichtung ? e.episode : sendungZu(e)?.nr)
  const kommend = termine.find((e) => e.date > heute || (e.date === heute && (e.time ?? '99') > jetztZeit))
  const e: ReleaseEvent | undefined = kommend ?? termine.at(-1)
  if (!e && !laufend) return undefined
  const laufEvent = laufend && termine.find((x) => `${x.date}T${x.time ?? ''}` === laufend.start)
  /* Premiere gilt der Folge, von der die Pille zuerst spricht — der laufenden, sonst der nächsten. */
  const bezug = laufEvent || e
  const premiere = Boolean(
    bezug?.episode && !bezug.sichtung && istPremiere(bezug.episode, bezug.date, title, releases, release.ersteDeutsch),
  )
  let text = ''
  if (e) {
    const tag =
      e.date === heute
        ? 'heute'
        : kommend && Date.parse(e.date) - Date.parse(heute) < 6.5 * 864e5
          ? TAG[new Date(`${e.date}T12:00:00Z`).getUTCDay()]!
          : `${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.`
    const nr = nummer(e)
    const teile = [
      nr ? `Fg. ${nr}` : undefined,
      [kommend ? '' : 'zuletzt', tag, e.time].filter(Boolean).join(' '),
      e.episode && !e.sichtung && !premiere && !laufend ? 'Wiederholung' : undefined,
      /* Ohne laufende Sendung trägt die Zeile den Folgentitel der nächsten. */
      !laufend && kommend ? sendungZu(e)?.folge : undefined,
    ]
    text = (laufend && kommend ? 'Nächste: ' : '') + teile.filter(Boolean).join(' · ')
  }
  if (!laufend) return { text, premiere }
  const nr = laufend.nr ?? (laufEvent ? nummer(laufEvent) : undefined)
  return {
    text: kommend ? text : '',
    premiere,
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
      istPremiere(e.episode, e.date, titel, data.releasesByTitle.get(e.titleId) ?? [], data.releaseBySlug.get(e.releaseSlug)?.ersteDeutsch),
  )
}
