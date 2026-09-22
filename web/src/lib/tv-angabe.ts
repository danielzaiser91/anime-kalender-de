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

const minuten = (hhmm: string) => Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5))

const TAG = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa']

/**
 * „Fg. 16 · heute 21:15" plus `premiere` — oder `undefined`, wenn es keinen Termin gibt.
 * „Premiere" ist ein eigenes Abzeichen an der Pille (Daniel, 19.09.2026: „zu unauffällig"),
 * „Wiederholung" steht im Text.
 */
export function tvAngabe(
  release: Release,
  title: Title,
  releases: Release[],
  heute: string,
  jetztZeit: string,
): { text: string; premiere: boolean } | undefined {
  if (release.platform !== 'tv') return undefined
  const termine = expandEvents(release)
  /*
    **Läuft sie gerade, sagt die Pille das** (Daniel, 22.09.2026: „solange sie läuft soll die pill
    da stehen und läuft gerade stehen"). Eine Sendung dauert bis zum nächsten Termin desselben
    Tages, höchstens 25 Minuten — gemessen an Dragon Ball Super auf ProSieben MAXX, das Joyn mit
    Sendebeginn + 25 Minuten online stellt; One Piece läuft dort 18:25 und 18:50.
  */
  const jetzt = minuten(jetztZeit)
  const laufend = termine.find((e, i) => {
    if (e.date !== heute || !e.time) return false
    const start = minuten(e.time)
    const folgt = termine[i + 1]
    const ende = Math.min(start + 25, folgt?.date === heute && folgt.time ? minuten(folgt.time) : Infinity)
    return start <= jetzt && jetzt < ende
  })
  const kommend = laufend ?? termine.find((e) => e.date > heute || (e.date === heute && (e.time ?? '99') >= jetztZeit))
  const e: ReleaseEvent | undefined = kommend ?? termine.at(-1)
  if (!e) return undefined
  const tag = laufend
    ? 'läuft gerade'
    : e.date === heute
      ? 'heute'
      : kommend && Date.parse(e.date) - Date.parse(heute) < 6.5 * 864e5
        ? TAG[new Date(`${e.date}T12:00:00Z`).getUTCDay()]!
        : `${e.date.slice(8, 10)}.${e.date.slice(5, 7)}.`
  const premiere = Boolean(e.episode && !e.sichtung && istPremiere(e.episode, e.date, title, releases, release.ersteDeutsch))
  const teile = [
    e.episode && !e.sichtung ? `Fg. ${e.episode}` : undefined,
    [kommend ? '' : 'zuletzt', tag, laufend ? undefined : e.time].filter(Boolean).join(' '),
    e.episode && !e.sichtung && !premiere ? 'Wiederholung' : undefined,
  ]
  return { text: teile.filter(Boolean).join(' · '), premiere }
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
