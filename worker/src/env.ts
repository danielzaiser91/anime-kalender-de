import { type MailEnv } from './mail.ts'
import { type PushEnv } from './push.ts'

export interface Env extends MailEnv, PushEnv {
  DB: D1Database
  /**
   * Der Push-Kanal zur Statusanzeige. Optional: Ohne das Binding läuft alles
   * weiter, die Anzeige erfährt Änderungen dann nur beim nächsten Nachfragen.
   */
  EREIGNISSE?: DurableObjectNamespace
  SITE_URL: string
  /** Öffentliche Adresse dieses Workers — steckt in den Abmeldelinks. */
  WORKER_URL: string
  SEND_HOUR_BERLIN: string
  ALLOWED_ORIGIN: string
  /** Optional. Ist es gesetzt, lässt sich der Versand über /debug/digest auslösen. */
  DEBUG_TOKEN?: string
  /** Optional. Nur damit dürfen Läufe ihren Zustand melden. Fehlt es, ist /lauf schreibgeschützt. */
  LAUF_TOKEN?: string
  /** Nur Lesen in der Beleg-Ablage — liegt im Browser des Prüfers, nicht in den Läufen (04.10.2026). */
  BELEG_LESETOKEN?: string
  /** Empfänger der Überwachungsmeldungen. Fehlt sie, wird nur geprüft, nicht gemeldet. */
  MONITOR_EMAIL?: string
  /** Private Beleg-Ablage (Screenshots, HTML). Optional: Ohne Bindung antwortet /beleg mit 503. */
  BELEGE?: R2Bucket
}
