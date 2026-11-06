import { istErschienen } from '../../shared/logic.ts'
import type { NewsEintrag, ReleaseEvent } from '../../shared/types.ts'
import type { PushEreignis } from './push-text.ts'
import { imTagesfenster } from './push-fenster.ts'
import { pushVersand, type PushEnv } from './push.ts'
import { weitereAusNews } from './news-quelle.ts'
import { fehlerLog } from './werte.ts'

/**
 * **Pünktlicher Push** (05.11.2026): Der stündliche Lauf meldete eine Folge um 18:25 erst um 19:00 (Yaiba, ProSieben MAXX).
 * Dieser Trigger läuft alle fünf Minuten, schaut aber zuerst nur in die Termindatei und fasst D1 nur an, wenn in den
 * letzten `PUSH_FENSTER_MS` ein Termin erschienen ist. Alle Uhrzeiten der Daten sind Vielfache von fünf Minuten, die
 * Verspätung ist also höchstens ein Takt. Der stündliche Lauf bleibt als Netz (Ausfall eines Takts, aufgeschobene Abos,
 * Netzfehler, „Jetzt auch bei“): Er arbeitet weiter ab der Marke `push_marke`.
 */
export const PUSH_CRON = '*/5 * * * *'
/** Zwei Takte plus Reserve: ein ausgefallener oder verspäteter Takt wird vom nächsten nachgeholt. */
export const PUSH_FENSTER_MS = 10 * 60_000

/** Ist seit dem Fenster ein Termin erschienen? Reine Rechnung über die Termindatei, ohne D1. */
export function pushFaellig(
  ereignisse: PushEreignis[],
  jetzt: Date,
  erschienen: (e: PushEreignis, zeit: Date) => boolean = istErschienen,
): boolean {
  const seit = new Date(jetzt.getTime() - PUSH_FENSTER_MS)
  return imTagesfenster(ereignisse, seit, jetzt).some((e) => erschienen(e, jetzt) && !erschienen(e, seit))
}

/** Der Fünf-Minuten-Lauf. Zur vollen Stunde läuft zugleich der stündliche Trigger: dort aussteigen, sonst gäbe es doppelte Pushes. */
export async function pushSchnell(
  env: PushEnv & { DB: D1Database },
  jetzt: Date,
  ladeEreignisse: () => Promise<ReleaseEvent[]>,
  erschienen: (e: PushEreignis, zeit: Date) => boolean = istErschienen,
): Promise<string> {
  if (jetzt.getUTCMinutes() === 0) return 'volle Stunde: der Stundenlauf übernimmt'
  const ereignisse = await ladeEreignisse()
  if (!pushFaellig(ereignisse, jetzt, erschienen)) return 'nichts fällig, D1 unberührt'
  return pushVersand(env, jetzt, ereignisse, erschienen, [], true)
}

/** Wie `pushSchnell`, mit Protokollzeile und aufgefangenem Fehler. */
export const pushSchnellMitLog = (env: PushEnv & { DB: D1Database }, jetzt: Date, ladeEreignisse: () => Promise<ReleaseEvent[]>): Promise<void> =>
  pushSchnell(env, jetzt, ladeEreignisse)
    .then((msg) => console.log(`[push5] ${msg}`))
    .catch((err) => fehlerLog('[push5] fehlgeschlagen', err))

/** Der stündliche Lauf: Termine und „Jetzt auch bei“-Meldungen. */
export async function pushStuendlich(
  env: PushEnv & { DB: D1Database },
  jetzt: Date,
  ladeEreignisse: () => Promise<ReleaseEvent[]>,
  ladeNews: () => Promise<NewsEintrag[]>,
): Promise<string> {
  const [ereignisse, news] = await Promise.all([ladeEreignisse(), ladeNews()])
  return pushVersand(env, jetzt, ereignisse, (e, zeit) => istErschienen(e, zeit), weitereAusNews(news))
}
