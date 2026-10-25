/**
 * **Wann welcher Datenlauf gestartet wird** — der Plan des Cloudflare-Weckers (`worker/src/wecker.ts`). Steht in `shared/`, damit `check:logic` ihn prüft, ohne den
 * Worker (und dessen Cloudflare-Typen) zu laden.
 *
 * Zeiten in UTC (der Worker-Cron feuert zur vollen Stunde); `wochentag`: 1 = Montag … 7 = Sonntag.
 */
export interface Weckplan {
  workflow: string
  /** Fremdes Repo (`besitzer/name`), in dem der Workflow liegt; fehlt es, gilt dieses Repo. Die Wecker-Wache (läuft nur hier) deckt fremde Einträge nicht ab. */
  repo?: string
  /** Leer = jede Stunde. */
  stunden?: number[]
  wochentag?: number
  /** Tag im Monat (UTC); fehlt er, gilt der Eintrag an jedem Tag. */
  tagImMonat?: number
  /** Mit `tagImMonat`: gilt ab diesem Tag bis zum Monatsende, solange der letzte nicht abgebrochene Start älter als `abstandMin` ist (Nachholen eines abgebrochenen Monatslaufs). */
  nachholen?: boolean
  /** Mindestabstand zum letzten Start desselben Workflows in Minuten — schützt vor Doppelstarts (gemessen 05.10.2026: zwei Starts im Abstand von zehn Sekunden). Der Workflow-Name ist Schlüssel für Abstand und Nachholen und muss über alle Repos eindeutig sein (`daten.yml` gibt es hier nicht). */
  abstandMin: number
}

export const WECKPLAN: Weckplan[] = [
  { workflow: 'refresh-hourly.yml', abstandMin: 40 },
  // Vorher 04:17 / 05:41 / 06:00 nach GitHub-Cron; der Tageslauf endet nach höchstens 75 Minuten, bevor der aniSearch-Katalog um 06:00 beginnt.
  { workflow: 'refresh-data.yml', stunden: [4], abstandMin: 600 },
  { workflow: 'refresh-weekly.yml', stunden: [5], wochentag: 1, abstandMin: 4320 },
  { workflow: 'adn-laufende.yml', stunden: [2, 8, 14, 20], abstandMin: 240 },
  { workflow: 'claude-verpasst-recherche.yml', stunden: [11], abstandMin: 600 },
  { workflow: 'claude-anime2you-extraktion.yml', stunden: [12], abstandMin: 600 },
  { workflow: 'claude-wache-urteil.yml', stunden: [9], abstandMin: 600 },
  { workflow: 'anisearch-katalog.yml', stunden: [6], abstandMin: 600 },
  // Ladezeiten am Handy auf dem GitHub-Rechner (ab 12.10.2026, Eichung der Grenzen); 16 Uhr, zu der Stunde läuft kein anderer Tageslauf.
  { workflow: 'ladezeiten.yml', stunden: [16], abstandMin: 600 },
  // Meldungen offizieller Anime-Websites (ab 13.10.2026): 13 Uhr, nach Tageslauf (04), aniSearch-Katalog (06) und Anime2You-Auswertung (12), vor den Ladezeiten (16).
  { workflow: 'offizielle-news.yml', stunden: [13], abstandMin: 600 },
  // Meldungskopie (ab 14.10.2026): D1-Export der drei Meldungstabellen, 03 Uhr (kein anderer Tageslauf; ein Export blockiert die D1 kurz). Spätestens nach 33 h nachgeholt (wecker-wache), Grenze 36 h. Abstand 13 h: ein Handlauf um 12 Uhr (15 h vor 03 Uhr) darf den nächsten Wecker-Start nicht sperren (16.10.2026 fehlte er so).
  { workflow: 'meldungskopie.yml', stunden: [3], abstandMin: 780 },
  // Nativ-Repo (ab 25.10.2026): GitHubs Zeitplan schaltet sich dort nach 60 Ruhetagen ab und feuert unpünktlich; das Wecker-Token gilt für beide Repos.
  { workflow: 'daten.yml', repo: 'danielzaiser91/anime-kalender-nativ', abstandMin: 40 },
  // Monatskontingent der Streaming Availability API (Reset am Ersten). Vorher nur GitHubs Cron: ein abgebrochener Lauf blieb ohne Nachhol-Start (`motn` am 08.10.2026 36 Tage still).
  { workflow: 'tonspuren-monatlich.yml', stunden: [4], tagImMonat: 2, nachholen: true, abstandMin: 20160 },
]

/** Mindestabstand eines Workflows in Minuten (Vorgabe 30 für Unbekannte). */
export const abstandMin = (workflow: string, plan: Weckplan[] = WECKPLAN): number => plan.find((p) => p.workflow === workflow)?.abstandMin ?? 30

/** Die Plan-Einträge, die zu diesem Zeitpunkt (UTC) starten sollen. */
export function faelligeEintraege(jetzt: Date, plan: Weckplan[] = WECKPLAN): Weckplan[] {
  const stunde = jetzt.getUTCHours()
  const wochentag = jetzt.getUTCDay() === 0 ? 7 : jetzt.getUTCDay()
  return plan.filter((p) => (!p.stunden || p.stunden.includes(stunde)) && (!p.wochentag || p.wochentag === wochentag) && (!p.tagImMonat || (p.nachholen ? jetzt.getUTCDate() >= p.tagImMonat : p.tagImMonat === jetzt.getUTCDate())))
}

/** Die Workflows, die zu diesem Zeitpunkt (UTC) starten sollen. */
export const faelligeLaeufe = (jetzt: Date, plan: Weckplan[] = WECKPLAN): string[] => faelligeEintraege(jetzt, plan).map((p) => p.workflow)

/** Ein Lauf, wie ihn die GitHub-API liefert (neuester zuerst). */
export interface LaufStand {
  created_at?: string
  status?: string | null
  conclusion?: string | null
}

/**
 * Darf der Wecker diesen Workflow jetzt starten? Normal zählt der neueste Lauf (Schutz vor Doppelstarts). Bei `nachholen` zählt der neueste *nicht abgebrochene*
 * Lauf, und ein gerade laufender oder wartender Lauf sperrt — so holt der nächste Tag einen abgebrochenen Monatslauf nach, ein Lauf im selben Monat wird nicht wiederholt.
 * `null` im Altersfall (keine Läufe) heißt: starten.
 */
export function startErlaubt(workflow: string, laeufe: LaufStand[], jetzt: Date, plan: Weckplan[] = WECKPLAN): boolean {
  const nachholen = plan.find((p) => p.workflow === workflow)?.nachholen === true
  if (nachholen && laeufe.some((l) => l.status === 'in_progress' || l.status === 'queued' || l.status === 'pending' || l.status === 'waiting')) return false
  const massgeblich = nachholen ? laeufe.find((l) => l.conclusion !== 'cancelled') : laeufe[0]
  // Ein Monatslauf im laufenden Monat genügt: der Abstand allein startete am 23.10. einen zweiten (Handlauf 08.10. + 14 Tage) und leerte das Kontingent.
  if (nachholen && massgeblich?.created_at?.slice(0, 7) === jetzt.toISOString().slice(0, 7)) return false
  const t = Date.parse(massgeblich?.created_at ?? '')
  return !Number.isFinite(t) || (jetzt.getTime() - t) / 60000 >= abstandMin(workflow, plan)
}
