import { recordSource } from './health.ts'

/** Positivliste: HTTP-Status außer 403/429 (Abwehr, beweist nichts) und Amazons Regionssatz; `unklar`, `timeout`, `fehler` zählen nicht. */
export function istAuskunft(status: unknown): boolean {
  if (status === 'region') return true
  return typeof status === 'number' && status !== 403 && status !== 429
}

/**
 * Zwischenstand der Quellen-Gesundheit für `check-links.ts`.
 *
 * Die Zeitgrenze des Wochenlaufs (45 min) bricht den Schritt mitten in der Amazon-Pause ab, bevor die
 * Schlusszeile `recordSource` läuft (19.10.2026). Darum wird vor der Pause und alle 100 Adressen geschrieben.
 * Als Erfolg zählt nur, was heute eine echte Auskunft war (nicht `unklar`): sonst würde ein Lauf, der nur
 * gegen die Sperre rannte, „gesund“ melden.
 */
export function meldeLinkCheckZwischenstand(
  bestand: Record<string, { status: unknown; geprueftAm?: string }>,
  heute: string,
  melde: typeof recordSource = recordSource,
): number {
  const auskuenfte = Object.values(bestand).filter((b) => b.geprueftAm === heute && istAuskunft(b.status)).length
  melde('link-check', auskuenfte, auskuenfte ? undefined : 'bisher nur Nichtauskünfte', undefined, false)
  return auskuenfte
}

type Bestand = Parameters<typeof meldeLinkCheckZwischenstand>[0]

const heute = () => new Date().toISOString().slice(0, 10)

/** Vor der Sperr-Pause: Befunde sichern, Stand melden, dann warten (die Zeitgrenze kann in der Pause zuschlagen). */
export async function pauseMitStand(ms: number, bestand: Bestand, warte: (ms: number) => Promise<void>, sichere: () => void, melde: typeof recordSource = recordSource, tag = heute()): Promise<void> {
  sichere()
  meldeLinkCheckZwischenstand(bestand, tag, melde)
  await warte(ms)
}

/** Fortschrittszeile alle 100 Adressen samt Zwischenstand und gesicherten Befunden. */
export function fortschritt(geprueft: number, von: number, tot: number, bestand: Bestand, log: (s: string) => void, sichere: () => void, melde: typeof recordSource = recordSource, tag = heute()): void {
  if (geprueft % 100 !== 0) return
  log(`  ${geprueft}/${von} — ${tot} unbrauchbar`)
  sichere()
  meldeLinkCheckZwischenstand(bestand, tag, melde)
}

/**
 * Zeitbudget des Wochenlaufs: Die Grenze des Schritts ist 45 min (`refresh-weekly.yml`); gemessen am 19.10.2026
 * (Lauf 39202358845) rannte er hinein, weil die Sperr-Pause allein 60 min dauert. 75 % davon lassen den Lauf
 * fertig werden und die Schlusszeile `recordSource` erreichen.
 * Ein Amazon-Skip nach Sperre gilt trotzdem als „ok“ (gewollt, 20.10.2026): der Lauf hat alle anderen Hosts geprüft; die
 * übersprungenen Adressen nennt die Logzeile „Amazon-Adressen wegen der Sperre übersprungen“.
 */
export const ZEITBUDGET_SEKUNDEN = 2025

/** Passt eine Wartezeit von `wartenMs` noch in das Budget? Ohne Budget (<= 0) immer. */
export function passtInsBudget(startMs: number, jetztMs: number, budgetSekunden: number, wartenMs = 0): boolean {
  if (budgetSekunden <= 0) return true
  return jetztMs - startMs + wartenMs <= budgetSekunden * 1000
}

/**
 * Reihenfolge und Umfang eines Laufs: Vorrang zuerst, dann nie Geprüftes und die ältesten Befunde.
 * Was wegen des Limits nicht drankommt, bleibt fällig und rückt im nächsten Lauf nach vorn.
 * Der gesperrte Host (Amazon) bekommt höchstens `GEDROSSELT_JE_LAUF` Plätze: seine Nichtauskünfte behalten ihr
 * altes Datum und stünden sonst jede Woche vorn, bis das Limit nur noch aus übersprungenen Adressen besteht.
 */
export const GEDROSSELT_JE_LAUF = 60

/** Drossel nur, wenn der Vorlauf eine Sperre erlebt hat; sonst bleibt Amazon bis zum Limit ungedrosselt. */
export function drosselNachVorlauf(vorlaufGesperrt: boolean | undefined): number {
  return vorlaufGesperrt ? GEDROSSELT_JE_LAUF : Number.POSITIVE_INFINITY
}

export function waehleArbeit(
  offen: string[],
  geprueftAm: (url: string) => string | undefined,
  vorrang: ReadonlySet<string>,
  limit: number,
  gedrosselt: (url: string) => boolean = () => false,
  maxGedrosselt = GEDROSSELT_JE_LAUF,
): string[] {
  const alter = (u: string) => geprueftAm(u) ?? ''
  const sortiert = [...offen].sort((a, b) => Number(vorrang.has(b)) - Number(vorrang.has(a)) || alter(a).localeCompare(alter(b)))
  let drossel = 0
  const zugelassen = sortiert.filter((u) => !gedrosselt(u) || ++drossel <= maxGedrosselt)
  return limit > 0 ? zugelassen.slice(0, limit) : zugelassen
}

/** Zählt einen Befund dieses Laufs: unbrauchbar (404/region) und, getrennt davon, echte Auskunft. */
export function zaehleBefund(zaehler: { tot: number; auskuenfte: number }, status: unknown): void {
  if (status === 404 || status === 'region') zaehler.tot++
  if (istAuskunft(status)) zaehler.auskuenfte++
}

/**
 * Argumente der Schlusszeile (nach dem Namen) des Laufs: gezählt wird, was in diesem Lauf echte Auskunft war (`istAuskunft`), nicht jede
 * geprüfte Adresse. Nichts fällig (0 geprüft) ist Normalfall; geprüft ohne eine Auskunft ist Misserfolg.
 */
export function linkCheckEnde(geprueft: number, auskuenfte: number, gesperrt: boolean): [number, string | undefined, undefined, boolean, boolean] {
  return [auskuenfte, geprueft && !auskuenfte ? 'nur Nichtauskünfte' : undefined, undefined, geprueft === 0, gesperrt]
}
