/** Der eine Satz für „der Newsletter-Dienst antwortet gerade nicht“: Worker (Tageslimit) und Seite (Anmeldung, Einstellungen, Push). */
export const DIENST_PAUSE = 'Der Dienst macht gerade Pause. Versuch es später noch einmal.'

/** Fehlercode von `POST /subscribe`, wenn alle Newsletter-Plätze vergeben sind (503, aber keine Pause des Dienstes). */
export const NEWSLETTER_VOLL = 'newsletter_voll'
/** Hinweis dazu im Anmeldeformular: schreiben, was geht (Push und .ics brauchen keine Anmeldung). */
export const TEXT_NEWSLETTER_VOLL = 'Alle Newsletter-Plätze sind gerade vergeben. Push-Mitteilungen und die Kalender-Dateien (.ics) erinnern dich trotzdem, ganz ohne Anmeldung.'
