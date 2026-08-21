/**
 * Newsletter-Dienst des Anime-Kalenders.
 *
 *   POST /subscribe          — Anmeldung, verschickt die Bestätigungsmail (Double-Opt-in)
 *   GET  /confirm?token=…    — Bestätigung, ab hier ist das Abo aktiv
 *   GET  /unsubscribe?token=…— Abmeldung, löscht den Datensatz
 *   GET  /rhythmus?token=…    — Rhythmus aus der Mail umstellen
 *   GET  /health             — Status
 *   cron stündlich           — versendet um 07:00 Berliner Zeit Tages- bzw. Wochen-Digest
 *
 * Die Termine kommen aus denselben JSON-Dateien, die auch die Website lädt.
 */
import type { Release, ReleaseEvent } from '../../shared/types.ts'
import { addDays, weekdayIndex } from '../../shared/time.ts'
import { sendMail, type MailEnv } from './mail.ts'
import { checkAllSites, confirmOutages } from './monitor.ts'
import {
  BRAND,
  confirmMail,
  digestMail,
  outageMail,
  page,
  restoreMail,
  weeklyStatusMail,
  type NeuMitSynchro,
  type ReleaseLink,
} from './templates.ts'

export interface Env extends MailEnv {
  DB: D1Database
  SITE_URL: string
  /** Öffentliche Adresse dieses Workers — steckt in den Abmeldelinks. */
  WORKER_URL: string
  SEND_HOUR_BERLIN: string
  ALLOWED_ORIGIN: string
  /** Optional. Ist es gesetzt, lässt sich der Versand über /debug/digest auslösen. */
  DEBUG_TOKEN?: string
  /** Optional. Nur damit dürfen Läufe ihren Zustand melden. Fehlt es, ist /lauf schreibgeschützt. */
  LAUF_TOKEN?: string
  /** Empfänger der Überwachungsmeldungen. Fehlt sie, wird nur geprüft, nicht gemeldet. */
  MONITOR_EMAIL?: string
}

interface SubscriberRow {
  id: string
  email: string
  frequency: 'daily' | 'weekly'
  platforms: string
  favorites: string
  unsub_token: string
  pref_token: string
  /**
   * Wann diese Adresse zuletzt eine Mail bekam — die Grenze dafür, welcher
   * Neuzugang schon gemeldet wurde. `null`, solange noch keine verschickt ist.
   */
  last_sent_at: string | null
}

/** Kommagetrennte Zahlenliste aus der Datenbank in ein Set. */
function parseIdList(raw: string | null | undefined): Set<number> {
  return new Set(
    (raw ?? '')
      .split(',')
      .map((v) => Number(v.trim()))
      .filter((v) => Number.isInteger(v) && v > 0),
  )
}

/** Nur ganze Zahlen übernehmen — die Liste kommt aus dem Browser. */
function cleanIdList(input: unknown): string {
  if (!Array.isArray(input)) return ''
  return [...new Set(input.map(Number).filter((v) => Number.isInteger(v) && v > 0))].join(',')
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i

function cors(env: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': env.ALLOWED_ORIGIN || '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(env: Env, body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...cors(env) },
  })
}

function baseUrl(request: Request): string {
  const u = new URL(request.url)
  return `${u.protocol}//${u.host}`
}

async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let payload: { email?: string; frequency?: string; platforms?: string[]; favorites?: number[] }
  try {
    payload = await request.json()
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }

  const email = (payload.email ?? '').trim().toLowerCase()
  const frequency = payload.frequency === 'daily' ? 'daily' : 'weekly'
  const platforms = (payload.platforms ?? []).filter((p) => /^[a-z]+$/.test(p)).join(',')
  const favorites = cleanIdList(payload.favorites)

  if (!EMAIL_RE.test(email)) return json(env, { error: 'Diese E-Mail-Adresse sieht nicht gültig aus.' }, 400)

  const confirmToken = crypto.randomUUID()
  const unsubToken = crypto.randomUUID()
  const prefToken = crypto.randomUUID()
  const now = new Date().toISOString()
  const ip = request.headers.get('cf-connecting-ip') ?? ''

  /**
   * Anmeldung und Änderung sind zwei verschiedene Dinge.
   *
   * Eine **Anmeldung** darf jeder auslösen — sie bewirkt bis zum Klick nichts.
   * Eine **Änderung an einem bestehenden, bestätigten Abo** darf dagegen nur,
   * wer das zugehörige Postfach lesen kann. Genau dieselbe Grenze, die schon
   * für Bestätigung und Abmeldung gilt.
   *
   * Bis zum 14.08.2026 waren beide dasselbe: Ein `ON CONFLICT(email) DO UPDATE`
   * überschrieb `frequency`, `platforms` und `favorites` **sofort**, und der
   * Status blieb ausdrücklich auf `active`. Wer eine fremde Adresse ins
   * Formular tippte, ersetzte damit ohne einen einzigen Klick die Einstellungen
   * und die gemerkten Titel eines anderen Menschen. Der Betroffene bekam weiter
   * Mails, nur eben die falschen (gefunden auf Daniels Frage hin: „ich möchte
   * nicht, dass andere meinen Newsletter manipulieren").
   *
   * Deshalb: Bei aktivem Abo landen die Wünsche in `pending_*` und werden erst
   * von `/confirm` übernommen. `unsub_token` und `pref_token` bleiben ohnehin
   * unangetastet — sonst könnte ein Fremder die Abmeldelinks aus alten Mails
   * entwerten.
   */
  const vorhanden = await env.DB.prepare('SELECT status FROM subscribers WHERE email = ?1')
    .bind(email)
    .first<{ status: string }>()
  const aenderungAmAktiven = vorhanden?.status === 'active'

  if (aenderungAmAktiven) {
    await env.DB.prepare(
      `UPDATE subscribers
         SET pending_frequency = ?1, pending_platforms = ?2, pending_favorites = ?3,
             confirm_token = ?4
       WHERE email = ?5`,
    )
      .bind(frequency, platforms, favorites, confirmToken, email)
      .run()
  } else {
    await env.DB.prepare(
      `INSERT INTO subscribers
         (id, email, frequency, platforms, favorites, favorites_at, status,
          confirm_token, unsub_token, pref_token, created_at, created_ip)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, 'pending', ?7, ?8, ?9, ?10, ?11)
       ON CONFLICT(email) DO UPDATE SET
         frequency = excluded.frequency,
         platforms = excluded.platforms,
         favorites = excluded.favorites,
         favorites_at = excluded.favorites_at,
         status = 'pending',
         confirm_token = excluded.confirm_token,
         -- Vorhandene Tokens behalten: Links aus alten Mails sollen weiter gehen.
         pref_token = CASE WHEN subscribers.pref_token = '' THEN excluded.pref_token ELSE subscribers.pref_token END,
         created_at = excluded.created_at,
         created_ip = excluded.created_ip`,
    )
      .bind(
        crypto.randomUUID(),
        email,
        frequency,
        platforms,
        favorites,
        favorites ? now : null,
        confirmToken,
        unsubToken,
        prefToken,
        now,
        ip,
      )
      .run()
  }

  const confirmUrl = `${baseUrl(request)}/confirm?token=${confirmToken}`
  const mail = confirmMail(confirmUrl, aenderungAmAktiven)
  try {
    await sendMail(env, { to: email, ...mail })
  } catch (err) {
    console.error('Versand der Bestätigungsmail fehlgeschlagen', err)
    return json(env, { error: 'Die Bestätigungsmail konnte nicht verschickt werden.' }, 502)
  }

  return json(env, { ok: true })
}

/**
 * Gibt den Abgleich-Schlüssel zurück — und legt ihn an, falls er fehlt.
 *
 * `pref_token` kam erst mit Migration 002 und hat den Vorgabewert `''`. Jedes
 * Abo, das **vorher** bestätigt wurde, hat bis heute keinen: Diese Abonnenten
 * bekommen keinen Abgleich-Link in ihren Mails und können ihre Favoriten
 * nirgends abgleichen — sie merken es nur nicht, weil nichts fehlschlägt.
 *
 * Ohne diese Stelle hätte der neue Wiederherstellungs-Link es sogar schlimmer
 * gemacht: Er hätte auf `…?sync=` verwiesen, der Browser hätte einen leeren
 * Schlüssel gespeichert, und jeder spätere Abgleich wäre ins Leere gelaufen
 * (aufgefallen 14.08.2026, als Daniel fragte, warum sein Browser als „nicht
 * verbunden" gilt — er ist genau so ein Alt-Abo).
 */
async function sichereSchluessel(env: Env, id: string, vorhanden: string | null | undefined): Promise<string> {
  if (vorhanden) return vorhanden
  const neu = crypto.randomUUID()
  await env.DB.prepare('UPDATE subscribers SET pref_token = ?1 WHERE id = ?2').bind(neu, id).run()
  return neu
}

/** Um wie viel jede Benutzung die Frist des Dauerschlüssels weiterschiebt. */
const PREF_FRIST_TAGE = 365

/**
 * Prüft den Dauerschlüssel und schiebt seine Frist weiter — in einem Zug.
 *
 * Migration 005 hat den `pref_token` aus den Mails geholt; in der Mail steht
 * seither ein eigener Schlüssel mit dreißig Tagen Frist. Der Dauerschlüssel
 * selbst blieb unbefristet, und `handleSync` hängt ihn beim Weiterleiten an die
 * Adresse (`/#/newsletter?sync=…`) — er liegt damit im Browserverlauf und war
 * dort gültig, solange es das Abo gibt.
 *
 * Eine **feste** Frist wäre die falsche Antwort: Sie träfe genau die Leute, die
 * alles richtig machen, und kappte ihnen ohne Anlass die Verbindung. Die Frist
 * gleitet deshalb — jede Benutzung schiebt sie um zwölf Monate. Wer die Seite
 * benutzt, bleibt verbunden; ein Schlüssel, den niemand mehr anfasst, verfällt.
 *
 * `NULL` gilt. Deshalb verliert beim Deploy kein bestehendes Abo seine
 * Verbindung: Die Frist entsteht bei der ersten Benutzung danach.
 *
 * Prüfen und Weiterschieben stehen absichtlich in **einer** Anweisung. Zwei
 * Abfragen hintereinander wären ein Zeitfenster, in dem zwischen „gilt noch" und
 * „verlängert" etwas anderes passieren kann — und sie wären auch nicht kürzer.
 */
async function schluesselErneuert(env: Env, token: string): Promise<boolean> {
  const jetzt = Date.now()
  const ergebnis = await env.DB.prepare(
    `UPDATE subscribers SET pref_expires = ?1
     WHERE pref_token = ?2 AND status = 'active'
       AND (pref_expires IS NULL OR pref_expires > ?3)`,
  )
    .bind(new Date(jetzt + PREF_FRIST_TAGE * 86_400_000).toISOString(), token, new Date(jetzt).toISOString())
    .run()
  return !!ergebnis.meta.changes
}

/** Dieselbe Auskunft für jeden abgelaufenen oder unbekannten Schlüssel. */
const SCHLUESSEL_UNGUELTIG = 'Dieser Abgleich-Schlüssel gehört zu keinem aktiven Abo.'

/**
 * Zähler je Schlüssel und Zeitfenster — gibt `true`, wenn noch Platz ist.
 *
 * Bewusst schlicht: ein Zähler, ein Fensteranfang, kein gleitendes Fenster.
 * Für den Zweck reicht das, und was die Datenbank nicht kann, muss sie hier
 * auch nicht können.
 */
async function imRahmen(env: Env, key: string, grenze: number, fensterMinuten: number): Promise<boolean> {
  const jetzt = Date.now()
  const zeile = await env.DB.prepare('SELECT count, window_start FROM rate_limit WHERE key = ?1')
    .bind(key)
    .first<{ count: number; window_start: string }>()

  const fensterOffen = zeile && jetzt - Date.parse(zeile.window_start) < fensterMinuten * 60_000
  if (fensterOffen && zeile.count >= grenze) return false

  const neuerStand = fensterOffen ? zeile.count + 1 : 1
  const start = fensterOffen ? zeile.window_start : new Date(jetzt).toISOString()
  await env.DB.prepare(
    `INSERT INTO rate_limit (key, count, window_start) VALUES (?1, ?2, ?3)
     ON CONFLICT(key) DO UPDATE SET count = excluded.count, window_start = excluded.window_start`,
  )
    .bind(key, neuerStand, start)
    .run()
  return true
}

/**
 * Wiederherstellung anfordern: Adresse rein, Mail ans Postfach raus.
 *
 * **Dem Browser wird nie etwas zurückgegeben.** Wer eine fremde Adresse
 * eintippt, erfährt weder, ob sie ein Abo hat, noch bekommt er irgendwelche
 * Daten — die Mail geht an das Postfach, und wer das lesen kann, ist der
 * Berechtigte. Genau darauf beruhen schon Double-Opt-in und Abmeldelink; ein
 * Passwort brächte hier nichts hinzu, was die Mail nicht schon leistet
 * (Daniels Entscheidung, 14.08.2026).
 *
 * Drei Schutzmaßnahmen, ohne die der Link zur Waffe würde:
 *   1. **Einmal-Link mit 30 Minuten Frist** — nicht der unbefristete
 *      `pref_token`, der in jeder Newsletter-Mail steht.
 *   2. **Ratenbegrenzung** je Adresse und je IP: Sonst könnte man ein fremdes
 *      Postfach damit zumüllen.
 *   3. **Immer dieselbe Antwort**, auch bei unbekannter Adresse. Sonst wäre das
 *      Feld ein Werkzeug, um herauszufinden, wer abonniert hat.
 */
async function handleRestore(request: Request, env: Env): Promise<Response> {
  let payload: { email?: string }
  try {
    payload = (await request.json()) as { email?: string }
  } catch {
    return json(env, { error: 'Ungültige Anfrage' }, 400)
  }
  const email = (payload.email ?? '').trim().toLowerCase()
  if (!EMAIL_RE.test(email)) return json(env, { error: 'Diese E-Mail-Adresse sieht nicht gültig aus.' }, 400)

  // Dieselbe Antwort in jedem Ausgang — sie steht hier oben, damit kein Zweig
  // sie versehentlich anders formuliert.
  const immerGleich = json(env, {
    ok: true,
    message: 'Falls für diese Adresse ein Abo besteht, ist eine Mail unterwegs.',
  })

  const ip = request.headers.get('cf-connecting-ip') ?? 'unbekannt'
  // Zehn Anfragen je IP und Stunde fangen das Ausprobieren ganzer Adresslisten
  // ab, ohne einen Haushalt mit gemeinsamer Leitung zu behindern.
  if (!(await imRahmen(env, `restore-ip:${ip}`, 10, 60))) return immerGleich

  const row = await env.DB.prepare(
    "SELECT id, restore_sent_at FROM subscribers WHERE email = ?1 AND status = 'active'",
  )
    .bind(email)
    .first<{ id: string; restore_sent_at: string | null }>()
  if (!row) return immerGleich

  // Eine Mail je Adresse in fünfzehn Minuten. Wer den Link wirklich braucht,
  // wartet notfalls; wer ein fremdes Postfach zumüllen will, kommt nicht weit.
  if (row.restore_sent_at && Date.now() - Date.parse(row.restore_sent_at) < 15 * 60_000) {
    return immerGleich
  }

  const token = crypto.randomUUID()
  const now = new Date()
  await env.DB.prepare(
    'UPDATE subscribers SET restore_token = ?1, restore_expires = ?2, restore_sent_at = ?3 WHERE id = ?4',
  )
    .bind(token, new Date(now.getTime() + 30 * 60_000).toISOString(), now.toISOString(), row.id)
    .run()

  const url = `${baseUrl(request)}/restore/confirm?token=${token}`
  try {
    await sendMail(env, { to: email, ...restoreMail(url) })
  } catch (err) {
    // Auch ein Fehlschlag beim Versand ändert die Antwort nicht — sonst
    // verriete die Fehlermeldung, dass es die Adresse gibt.
    console.error('Wiederherstellungsmail fehlgeschlagen', err)
  }
  return immerGleich
}

/**
 * Löst den befristeten Abgleich-Link aus einer Newsletter-Mail ein.
 *
 * Bis zum 14.08.2026 stand der `pref_token` **selbst** in jeder Mail. Er gilt
 * unbefristet — wer jemals eine weitergeleitete Mail sah oder einen Screenshot
 * davon, konnte die gemerkten Titel dieses Abos dauerhaft ändern, Monate
 * später noch.
 *
 * Jetzt verlässt der Dauerschlüssel den Server nicht mehr. In der Mail steht
 * ein eigener, nach dreißig Tagen verfallender Schlüssel; erst sein Einlösen
 * übergibt den `pref_token` an den Browser. Anders als beim Wiederherstellen
 * wird er **nicht** sofort entwertet: Dieselbe Mail auf zwei Geräten zu öffnen
 * ist ein normaler Vorgang, kein Angriff.
 */
async function handleSync(request: Request, env: Env): Promise<Response> {
  const token = (new URL(request.url).searchParams.get('token') ?? '').trim()
  if (!token) return page('Link nicht gültig', 'Dieser Link ist unvollständig.', env.SITE_URL)

  const row = await env.DB.prepare(
    "SELECT id, pref_token, sync_expires FROM subscribers WHERE sync_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ id: string; pref_token: string; sync_expires: string | null }>()

  if (!row || !row.sync_expires || Date.parse(row.sync_expires) < Date.now()) {
    return page(
      'Link abgelaufen',
      'Abgleich-Links aus dem Newsletter gelten dreißig Tage. Nimm den Link aus einer neueren Mail — oder fordere auf der Newsletter-Seite unter „Favoriten verloren?" einen neuen an.',
      env.SITE_URL,
    )
  }

  const schluessel = await sichereSchluessel(env, row.id, row.pref_token)
  /**
   * Die Frist wird hier **gesetzt**, nicht geprüft.
   *
   * Wer diesen Link einlöst, hat gerade Zugriff auf das Postfach nachgewiesen —
   * den stärksten Nachweis, den dieser Dienst kennt. Ein Dauerschlüssel, der
   * zwischenzeitlich verfallen war, lebt damit wieder auf; ihn stattdessen
   * abzulehnen wäre die eine Antwort, die dem Berechtigten nicht hilft.
   */
  await env.DB.prepare('UPDATE subscribers SET pref_expires = ?1 WHERE id = ?2')
    .bind(new Date(Date.now() + PREF_FRIST_TAGE * 86_400_000).toISOString(), row.id)
    .run()
  return Response.redirect(`${env.SITE_URL.replace(/\/$/, '')}/#/newsletter?sync=${schluessel}`, 302)
}

/**
 * Der Knopf „Auf wöchentlich umstellen" aus der Mail — und er stellt jetzt um.
 *
 * Bis zum 17.08.2026 zeigte er auf `…#/newsletter`, ohne jeden Parameter. Er
 * öffnete also nur die Seite, die den unveränderten Rhythmus anzeigt. Daniel hat
 * geklickt, „Täglich" stand weiter da, und das ist genau das Versprechen, das ein
 * Knopf mit dieser Aufschrift gibt und nicht halten konnte.
 *
 * Ein Klick erledigt jetzt beides: den Rhythmus setzen **und** den Browser mit
 * dem Abo verbinden. Der Ausweis ist derselbe befristete Schlüssel wie bei
 * `/sync` — er steht ohnehin in derselben Mail, und wer sie lesen kann, ist der
 * Berechtigte.
 *
 * Ein GET, das etwas ändert, ist hier vertretbar: Ein Mail-Programm kann nur
 * GET, der Vorgang ist ohne Verlust umkehrbar (zwei Rhythmen, ein Klick zurück),
 * und ein Mail-Scanner, der den Link vorab öffnet, stellt bestenfalls einmal auf
 * denselben Wert. Für das Abmelden gilt das ausdrücklich nicht — Löschen ist
 * nicht umkehrbar, dort bleibt es bei der Bestätigungsseite.
 */
async function handleRhythmus(request: Request, env: Env): Promise<Response> {
  const url = new URL(request.url)
  const token = (url.searchParams.get('token') ?? '').trim()
  const auf = url.searchParams.get('auf') === 'daily' ? 'daily' : 'weekly'
  if (!token) return page('Link nicht gültig', 'Dieser Link ist unvollständig.', env.SITE_URL)

  const row = await env.DB.prepare(
    "SELECT id, pref_token, sync_expires FROM subscribers WHERE sync_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ id: string; pref_token: string; sync_expires: string | null }>()

  if (!row || !row.sync_expires || Date.parse(row.sync_expires) < Date.now()) {
    return page(
      'Link abgelaufen',
      'Links aus dem Newsletter gelten dreißig Tage. Nimm den Link aus einer neueren Mail — oder stell den Rhythmus auf der Newsletter-Seite um.',
      env.SITE_URL,
    )
  }

  const schluessel = await sichereSchluessel(env, row.id, row.pref_token)
  await env.DB.prepare('UPDATE subscribers SET frequency = ?1, pref_expires = ?2 WHERE id = ?3')
    .bind(auf, new Date(Date.now() + PREF_FRIST_TAGE * 86_400_000).toISOString(), row.id)
    .run()
  return Response.redirect(`${env.SITE_URL.replace(/\/$/, '')}/#/newsletter?sync=${schluessel}`, 302)
}

/**
 * Der Klick aus der Mail: Einmal-Link einlösen und zurück auf die Seite.
 *
 * Der Schlüssel wird sofort entwertet — ein zweiter Klick, etwa aus dem
 * Verlauf oder von einem Mail-Scanner, führt ins Leere.
 */
async function handleRestoreConfirm(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  if (!token) return page('Link nicht gültig', 'Dieser Link ist unvollständig.', env.SITE_URL)

  const row = await env.DB.prepare(
    'SELECT id, pref_token, restore_expires FROM subscribers WHERE restore_token = ?1',
  )
    .bind(token)
    .first<{ id: string; pref_token: string; restore_expires: string | null }>()

  if (!row || !row.restore_expires || Date.parse(row.restore_expires) < Date.now()) {
    return page(
      'Link abgelaufen',
      'Dieser Wiederherstellungslink gilt dreißig Minuten und wurde entweder schon benutzt oder ist abgelaufen. Fordere auf der Newsletter-Seite einen neuen an.',
      env.SITE_URL,
    )
  }

  await env.DB.prepare('UPDATE subscribers SET restore_token = NULL, restore_expires = NULL WHERE id = ?1')
    .bind(row.id)
    .run()

  const schluessel = await sichereSchluessel(env, row.id, row.pref_token)
  const ziel = `${env.SITE_URL.replace(/\/$/, '')}/#/newsletter?sync=${schluessel}&restored=1`
  return Response.redirect(ziel, 302)
}

async function handleConfirm(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const now = new Date().toISOString()
  const ip = request.headers.get('cf-connecting-ip') ?? ''

  /**
   * Der Klick ist der Moment, in dem vorgemerkte Änderungen greifen.
   *
   * `COALESCE` übernimmt sie nur, wenn welche dastehen — eine gewöhnliche
   * Erstbestätigung lässt die Spalten unberührt. Danach werden sie geleert,
   * damit ein zweiter Klick auf denselben Link nichts mehr bewegt.
   */
  const result = await env.DB.prepare(
    `UPDATE subscribers
       SET status = 'active', confirmed_at = ?1, confirmed_ip = ?2,
           frequency = COALESCE(pending_frequency, frequency),
           platforms = COALESCE(pending_platforms, platforms),
           favorites = COALESCE(pending_favorites, favorites),
           favorites_at = CASE WHEN pending_favorites IS NULL THEN favorites_at ELSE ?1 END,
           pending_frequency = NULL, pending_platforms = NULL, pending_favorites = NULL
     WHERE confirm_token = ?3`,
  )
    .bind(now, ip, token)
    .run()

  if (!result.meta.changes) {
    return page('Link nicht gültig', 'Dieser Bestätigungslink ist abgelaufen oder wurde schon benutzt.', env.SITE_URL)
  }

  // Statt einer Bestätigungsseite zurück auf die Website — mit dem
  // Abgleich-Token. Der Browser merkt es sich und schickt ab da jede Änderung
  // an den Favoriten von selbst. Ohne diesen Schritt bliebe die im Dienst
  // gespeicherte Liste auf dem Stand der Anmeldung stehen.
  const row = await env.DB.prepare('SELECT id, pref_token FROM subscribers WHERE confirm_token = ?1')
    .bind(token)
    .first<{ id: string; pref_token: string }>()

  // Fehlt der Schlüssel (Alt-Abo von vor Migration 002), wird er hier angelegt
  // statt den Abgleich stillschweigend wegzulassen.
  const schluessel = row ? await sichereSchluessel(env, row.id, row.pref_token) : ''
  const target = `${env.SITE_URL.replace(/\/$/, '')}/#/newsletter?welcome=1${
    schluessel ? `&sync=${schluessel}` : ''
  }`
  return Response.redirect(target, 302)
}

/**
 * Gleicht die Favoriten eines Abonnenten ab.
 *
 * Nötig, weil die Favoriten im Browser des Nutzers liegen und sich dort
 * jederzeit ändern, ohne dass der Dienst davon erfährt. Jede Mail trägt einen
 * Link hierher; die Seite schickt beim Öffnen ihren aktuellen Stand.
 */
/**
 * Der Rückweg: die gespeicherten Favoriten abrufen.
 *
 * Bis zum 14.08.2026 war `/favorites` reines POST — der Dienst **hatte** die
 * Liste jedes Abonnenten, gab sie aber nie heraus. Es fehlte also nicht die
 * Speicherung, sondern der Weg zurück. Ohne ihn nützt auch der beste
 * Wiederherstellungslink nichts: Er brächte den Schlüssel, aber keine Daten.
 *
 * Der Schlüssel ist der Ausweis. Wer ihn hat, hat ihn aus einer Mail an genau
 * dieses Postfach — dieselbe Grenze wie überall sonst hier.
 */
async function handleFavoritesGet(request: Request, env: Env): Promise<Response> {
  const token = (new URL(request.url).searchParams.get('token') ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const row = await env.DB.prepare(
    "SELECT favorites, email FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ favorites: string; email: string }>()

  if (!row) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  /**
   * Die Adresse geht mit zurück, damit die Seite sie nennen kann: „Wir
   * informieren dich über deine hinterlegte Newsletter-E-Mail-Adresse: …"
   * (Daniel, 15.08.2026). Das ist kein Datenleck — der Schlüssel liegt nur in
   * dem Browser, in dem das Abo bestätigt wurde, und er beantwortet ohnehin
   * schon die schärfere Frage, ob es zu dieser Adresse ein Abo gibt.
   */
  return json(env, { ok: true, favorites: [...parseIdList(row.favorites)], email: row.email })
}

async function handleFavorites(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string; favorites?: number[] }
  try {
    payload = await request.json()
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }

  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const favorites = cleanIdList(payload.favorites)
  const result = await env.DB.prepare(
    "UPDATE subscribers SET favorites = ?1, favorites_at = ?2 WHERE pref_token = ?3 AND status = 'active'",
  )
    .bind(favorites, new Date().toISOString(), token)
    .run()

  if (!result.meta.changes) {
    return json(env, { error: 'Dieser Abgleich-Schlüssel gehört zu keinem aktiven Abo.' }, 404)
  }
  return json(env, { ok: true, count: favorites ? favorites.split(',').length : 0 })
}

/**
 * Abmelden aus dem verbundenen Browser heraus.
 *
 * Der Abmeldelink aus der Mail trägt den `unsub_token`, die Seite kennt aber
 * nur den `pref_token`. Wer verbunden war, musste deshalb erst eine alte Mail
 * heraussuchen — dabei weiß die Seite in dem Moment genau, um welches Abo es
 * geht (Daniel, 14.08.2026).
 *
 * Dasselbe Vertrauensniveau: Auch der `pref_token` stammt aus einer Mail an
 * dieses Postfach. Und Abmelden leichter zu machen ist nie der Fehler — die
 * DSGVO verlangt genau das, und ein Abo, das man nicht loswird, wird als Spam
 * gemeldet.
 */
/**
 * Liest und ändert die Einstellungen eines verbundenen Browsers.
 *
 * Bis zum 15.08.2026 gab es beides nicht: Wer verbunden war, sah auf der
 * Newsletter-Seite trotzdem das Anmeldeformular für Unverbundene und konnte
 * weder Rhythmus noch Plattformen ändern, ohne sich neu anzumelden (Daniel:
 * „wenn ich bereits verbunden bin, sollte ich wechseln können, abbestellen,
 * etc").
 *
 * Der Abgleich-Schlüssel genügt als Ausweis — er liegt nur in dem Browser, in
 * dem das Abo bestätigt wurde, und öffnet ohnehin schon die Favoritenliste.
 * Die Adresse selbst lässt sich hier **nicht** ändern: Das wäre eine neue
 * Anmeldung mit neuer Bestätigung, und genau die gibt es dafür.
 */
async function handlePrefsGet(request: Request, env: Env): Promise<Response> {
  const token = (new URL(request.url).searchParams.get('token') ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const row = await env.DB.prepare(
    "SELECT email, frequency, platforms FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ email: string; frequency: string; platforms: string }>()

  if (!row) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  return json(env, {
    ok: true,
    email: row.email,
    frequency: row.frequency === 'daily' ? 'daily' : 'weekly',
    platforms: row.platforms ? row.platforms.split(',').filter(Boolean) : [],
  })
}

async function handlePrefsPost(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string; frequency?: string; platforms?: string[] }
  try {
    payload = (await request.json()) as { token?: string; frequency?: string; platforms?: string[] }
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }
  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const frequency = payload.frequency === 'daily' ? 'daily' : 'weekly'
  const platforms = (payload.platforms ?? []).filter((p) => /^[a-z]+$/.test(p)).join(',')

  const result = await env.DB.prepare(
    "UPDATE subscribers SET frequency = ?1, platforms = ?2 WHERE pref_token = ?3 AND status = 'active'",
  )
    .bind(frequency, platforms, token)
    .run()

  if (!result.meta.changes) {
    return json(env, { error: 'Dieser Abgleich-Schlüssel gehört zu keinem aktiven Abo.' }, 404)
  }
  return json(env, { ok: true })
}

async function handleUnsubscribeByPref(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string }
  try {
    payload = (await request.json()) as { token?: string }
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }
  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  /**
   * Auch hier gilt die Frist — Löschen ist die folgenreichste Handlung im ganzen
   * Dienst, und ein Schlüssel aus einem alten Browserverlauf soll sie nicht
   * auslösen können. Niemand bleibt dadurch gefangen: Der Abmeldelink in **jeder**
   * Mail hängt am `unsub_token` und ist von dieser Frist unberührt.
   *
   * In der Oberfläche kann der Fall ohnehin kaum eintreten. Über den Bestand des
   * Abos entscheidet allein `/favorites`; sagt es „unbekannt", räumt der Browser
   * seinen Schlüssel weg und zeigt sich als nicht verbunden — der Knopf ist dann
   * gar nicht da.
   */
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const result = await env.DB.prepare('DELETE FROM subscribers WHERE pref_token = ?1').bind(token).run()
  if (!result.meta.changes) {
    return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  }
  return json(env, { ok: true })
}

async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const result = await env.DB.prepare('DELETE FROM subscribers WHERE unsub_token = ?1').bind(token).run()
  if (!result.meta.changes) {
    return page('Nichts zu tun', 'Zu diesem Link gibt es kein Abo mehr — vermutlich schon abgemeldet.', env.SITE_URL)
  }
  return page('Abgemeldet', 'Deine Adresse wurde gelöscht. Du bekommst keine Mails mehr von uns.', env.SITE_URL)
}

async function loadEvents(env: Env): Promise<ReleaseEvent[]> {
  const url = new URL('data/events.json', env.SITE_URL).toString()
  let res: Response
  try {
    res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
  } catch (err) {
    // Häufigster Fall: die Seite ist erreichbar, aber ihr TLS-Zertifikat wird
    // gerade erst ausgestellt. Die Meldung soll das benennen statt nur
    // „fetch failed" zu sagen.
    throw new Error(`Termine nicht abrufbar (${url}): ${(err as Error).message}`)
  }
  if (!res.ok) throw new Error(`Termine nicht abrufbar (${url}): HTTP ${res.status}`)
  return (await res.json()) as ReleaseEvent[]
}

/**
 * Titel, die zuletzt neu eine belegte deutsche Synchro bekommen haben.
 *
 * Erzeugt der Build aus `data/synchro-historie.json`. Fehlt die Datei oder ist
 * sie nicht abrufbar, bleibt der Versand vollständig funktionsfähig — nur ohne
 * diesen Abschnitt. Das ist der richtige Ausgang: Lieber ein Newsletter ohne
 * die frohe Botschaft als gar keiner.
 */
async function loadNeuMitSynchro(env: Env): Promise<NeuMitSynchro[]> {
  const url = new URL('data/neu-mit-synchro.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as NeuMitSynchro[]
  } catch (err) {
    console.error('Neuzugänge mit Synchro nicht abrufbar', err)
    return []
  }
}

/** Anbieter-Deeplinks je Release — dieselbe Datei, die auch die Web-App laedt. */
async function loadReleaseLinks(env: Env): Promise<Map<string, ReleaseLink>> {
  const url = new URL('data/releases.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const releases = (await res.json()) as Release[]
    return new Map(
      releases.map((r) => [r.slug, { platformUrl: r.platformUrl, buyUrl: r.buyUrl }] as const),
    )
  } catch (err) {
    // Ohne Deeplinks bleibt die Mail brauchbar — sie verlinkt dann nur den
    // Kalender. Das ist ein besserer Ausgang als gar kein Versand.
    console.error('Anbieter-Links nicht abrufbar', err)
    return new Map()
  }
}

function berlinParts(date: Date): { hour: number; iso: string } {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Berlin',
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
  })
  const parts = fmt.formatToParts(date)
  const get = (t: string) => parts.find((p) => p.type === t)!.value
  return { hour: Number(get('hour')) % 24, iso: `${get('year')}-${get('month')}-${get('day')}` }
}

/** Der eigentliche Versand — als eigene Funktion, damit /debug/send ihn testen kann. */
export async function runDigest(env: Env, now: Date, force?: 'daily' | 'weekly'): Promise<string> {
  const { hour, iso } = berlinParts(now)
  const sendHour = Number(env.SEND_HOUR_BERLIN || '7')

  const due: ('daily' | 'weekly')[] = []
  if (force) due.push(force)
  else if (hour === sendHour) {
    due.push('daily')
    if (weekdayIndex(iso) === 0) due.push('weekly')
  }
  if (!due.length) return `nichts zu tun (Berliner Stunde ${hour})`

  const allEvents = await loadEvents(env)
  const links = await loadReleaseLinks(env)
  const alleNeu = await loadNeuMitSynchro(env)
  const log: string[] = []

  for (const frequency of due) {
    const runKey = `${frequency}:${iso}`
    if (!force) {
      const already = await env.DB.prepare('SELECT run_key FROM send_log WHERE run_key = ?1')
        .bind(runKey)
        .first()
      if (already) {
        log.push(`${runKey}: schon gelaufen`)
        continue
      }
    }

    const until = frequency === 'daily' ? iso : addDays(iso, 6)
    const window = allEvents.filter((e) => e.date >= iso && e.date <= until)

    const { results } = await env.DB.prepare(
      `SELECT id, email, frequency, platforms, favorites, unsub_token, pref_token, last_sent_at FROM subscribers
       WHERE status = 'active' AND frequency = ?1`,
    )
      .bind(frequency)
      .all<SubscriberRow>()

    let sent = 0
    for (const sub of results ?? []) {
      const wanted = sub.platforms ? sub.platforms.split(',') : []
      const events = wanted.length ? window.filter((e) => wanted.includes(e.platform)) : window

      // Gemerkte Titel nach vorn: Eine neue Folge einer Serie, der jemand
      // folgt, ist ihm wichtiger als irgendein Disc-Release.
      const favorites = parseIdList(sub.favorites)

      /**
       * Gemerkte Titel, die **seit der letzten Mail an diesen Abonnenten** eine
       * Synchro bekommen haben.
       *
       * Die Grenze ist bewusst der persönliche Versandzeitpunkt und nicht ein
       * festes Fenster: Wer eine Woche lang keine Mail bekam, weil nichts
       * anstand, soll die Nachricht trotzdem noch sehen. Umgekehrt verhindert
       * sie, dass derselbe Titel in jeder Mail erneut gefeiert wird.
       */
      const seit = (sub.last_sent_at ?? '').slice(0, 10)
      const neuMitSynchro = alleNeu.filter((n) => favorites.has(n.id) && (!seit || n.seit > seit))

      /**
       * Ohne Termine **und** ohne Neuzugang gibt es nichts zu erzählen.
       *
       * Bis zum 13.08.2026 stand hier nur `if (!events.length) continue` — eine
       * angekündigte Synchro ohne Termin hätte damit nie eine Mail ausgelöst,
       * und genau die ist die Nachricht, auf die jemand monatelang wartet.
       */
      if (!events.length && !neuMitSynchro.length) continue

      const base = (env.WORKER_URL || '').replace(/\/$/, '')
      const unsubUrl = `${base}/unsubscribe?token=${sub.unsub_token}`
      /**
       * Befristeter Abgleich-Link statt des Dauerschlüssels.
       *
       * Der `pref_token` verlässt den Server nicht mehr (siehe `handleSync`).
       * Je Versand entsteht ein neuer, dreißig Tage gültiger Schlüssel — eine
       * drei Monate alte weitergeleitete Mail führt damit ins Leere, eine
       * gestern empfangene funktioniert.
       */
      const syncToken = crypto.randomUUID()
      await env.DB.prepare('UPDATE subscribers SET sync_token = ?1, sync_expires = ?2 WHERE id = ?3')
        .bind(syncToken, new Date(now.getTime() + 30 * 24 * 60 * 60_000).toISOString(), sub.id)
        .run()
      const syncUrl = `${base}/sync?token=${syncToken}`
      // Der Umstell-Knopf zeigt auf den jeweils **anderen** Rhythmus — was in
      // der Mail steht, ist ja der aktuelle.
      const rhythmusUrl = `${base}/rhythmus?token=${syncToken}&auf=${frequency === 'daily' ? 'weekly' : 'daily'}`
      const mail = digestMail(events, frequency, env.SITE_URL, unsubUrl, {
        favorites,
        syncUrl,
        rhythmusUrl,
        links,
        neuMitSynchro,
      })
      try {
        await sendMail(env, { to: sub.email, ...mail, unsubscribeUrl: unsubUrl })
        sent++
        await env.DB.prepare('UPDATE subscribers SET last_sent_at = ?1 WHERE id = ?2')
          .bind(now.toISOString(), sub.id)
          .run()
      } catch (err) {
        console.error(`Versand an ${sub.email} fehlgeschlagen`, err)
      }
    }

    if (!force) {
      await env.DB.prepare('INSERT OR REPLACE INTO send_log (run_key, sent_at, recipients) VALUES (?1, ?2, ?3)')
        .bind(runKey, now.toISOString(), sent)
        .run()
    }
    log.push(`${runKey}: ${sent} Mails, ${window.length} Termine im Fenster`)
  }

  return log.join('; ')
}

/**
 * Erreichbarkeitsprüfung mit gedeckelten Benachrichtigungen.
 *
 * Der Takt kommt vom stündlichen Cron. Gemeldet wird:
 *   - höchstens **einmal am Tag**, und erst wenn eine Seite **zwei** Läufe
 *     hintereinander nicht antwortet
 *   - **montags**, wenn `SEND_HOUR_BERLIN` erreicht ist, eine Wochenübersicht
 *     — auch wenn alles läuft, als Lebensnachweis der Überwachung selbst
 */
export async function runMonitor(
  env: Env,
  now: Date,
  force?: 'alert' | 'weekly',
): Promise<string> {
  const { hour, iso } = berlinParts(now)
  const ersterLauf = await checkAllSites()

  // Rote Seiten sofort nachprüfen, statt bis zum nächsten Stundenlauf zu warten.
  // Erst was auch danach noch schweigt, gilt als Störung — und der Stand in der
  // Datenbank ist dann schon der bestätigte, damit `/status` und das
  // Admin-Panel keinen Aussetzer als Ausfall zeigen.
  const bestaetigt = await confirmOutages(ersterLauf.filter((r) => !r.ok))
  const bestaetigteUrls = new Set(bestaetigt.map((r) => r.site.url))
  const results = ersterLauf.map((r) => {
    if (r.ok || bestaetigteUrls.has(r.site.url)) return r
    // Hat sich beim Nachprüfen erholt: als erreichbar führen, aber den Grund
    // behalten — im Wochenbericht ist „war kurz weg" eine nützliche Auskunft.
    return { ...r, ok: true, reason: `kurzzeitig: ${r.reason ?? 'nicht erreichbar'}` }
  })
  const nowIso = now.toISOString()

  // Vorherige Stände laden, um „seit wann weg" beantworten zu können.
  const { results: previous } = await env.DB.prepare(
    'SELECT url, last_ok_at, fail_streak FROM site_status',
  ).all<{ url: string; last_ok_at: string | null; fail_streak: number }>()
  const before = new Map((previous ?? []).map((row) => [row.url, row]))

  const lines = results.map((r) => {
    const old = before.get(r.site.url)
    return {
      name: r.site.name,
      url: r.site.url,
      ok: r.ok,
      reason: r.reason,
      ms: r.ms,
      downSince: r.ok ? undefined : (old?.last_ok_at ?? undefined),
      // Derselbe Wert, der gleich in die Datenbank geschrieben wird — hier
      // schon gebraucht, weil die Alarmschwelle daran hängt.
      failStreak: r.ok ? 0 : (old?.fail_streak ?? 0) + 1,
    }
  })

  // Stände fortschreiben. Einzeln statt gebündelt, damit ein Fehler bei einer
  // Zeile nicht die übrigen mitreißt.
  for (const [i, r] of results.entries()) {
    const old = before.get(r.site.url)
    await env.DB.prepare(
      `INSERT INTO site_status (url, name, ok, status, ms, reason, checked_at, last_ok_at, fail_streak)
       VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
       ON CONFLICT(url) DO UPDATE SET
         name = excluded.name, ok = excluded.ok, status = excluded.status, ms = excluded.ms,
         reason = excluded.reason, checked_at = excluded.checked_at,
         last_ok_at = excluded.last_ok_at, fail_streak = excluded.fail_streak`,
    )
      .bind(
        r.site.url,
        r.site.name,
        r.ok ? 1 : 0,
        r.status,
        r.ms,
        r.reason ?? null,
        nowIso,
        r.ok ? nowIso : (old?.last_ok_at ?? null),
        lines[i].failStreak,
      )
      .run()
  }

  // Seiten, die aus SITES entfernt wurden, blieben als Zeile stehen und damit
  // auf ihrem letzten Stand — meist rot, weil sie ja wegen eines Fehlers
  // herausgenommen wurden. In /status und im Admin-Panel sah das aus wie eine
  // dauerhafte Störung, obwohl gar nichts mehr geprüft wird.
  const known = results.map((r) => r.site.url)
  // Die Wächter-Liste ist fest im Code, leer werden kann sie nur durch einen
  // Fehler — dann aber würde `NOT IN ()` als SQL-Syntaxfehler den ganzen Lauf
  // abbrechen und aus einem Versehen einen Ausfall der Überwachung machen.
  // Und ein Aufräumen ohne bekannte Seiten hieße: alles löschen.
  if (known.length) {
    await env.DB.prepare(
      `DELETE FROM site_status WHERE url NOT IN (${known.map((_, i) => `?${i + 1}`).join(', ')})`,
    )
      .bind(...known)
      .run()
  }

  // `results` trägt bereits das Ergebnis nach der Nachprüfung — was hier rot
  // ist, war es über anderthalb Minuten und drei Versuche hinweg.
  //
  // Ein einzelner Fehlschlag ist meistens keiner: Am 11.08.2026 meldete der
  // Wächter für die Isekai-Idle-Mockups ein HTTP 503, das eine Stunde später
  // schon wieder weg war — GitHub Pages hatte keinen Vorfall, die Seite war
  // unverändert, das 503 kam aus dem Fastly-Edge davor. Eine Mail, die man
  // dreimal umsonst bekommt, liest man beim vierten Mal nicht mehr.
  const confirmed = lines.filter((l) => !l.ok)
  // Wie viele sich beim Nachprüfen wieder gefangen haben — nur fürs Protokoll.
  const erholt = ersterLauf.filter((r) => !r.ok).length - confirmed.length
  const to = env.MONITOR_EMAIL
  if (!to) return `${confirmed.length}/${lines.length} gestört — MONITOR_EMAIL nicht gesetzt, keine Mail`

  const log: string[] = [
    `${confirmed.length}/${lines.length} gestört` +
      (erholt ? `, ${erholt} nur kurzzeitig (beim Nachprüfen wieder erreichbar)` : ''),
  ]

  // --- Störungsmeldung, höchstens einmal am Tag ------------------------------
  if (confirmed.length > 0 || force === 'alert') {
    const key = `alert:${iso}`
    const already = force ? null : await env.DB.prepare('SELECT run_key FROM send_log WHERE run_key = ?1').bind(key).first()
    if (already) {
      log.push('Störungsmail heute bereits verschickt')
    } else {
      // Ohne bestätigte Störung kann nur ein erzwungener Lauf hier landen —
      // dann geht eine Testmail mit der ersten Seite als Beispiel hinaus, und
      // die Vorlage benennt das auch so.
      const report = confirmed.length ? confirmed : lines.slice(0, 1)
      const mail = outageMail(report, lines.length, env.SITE_URL, lines.length - confirmed.length)
      await sendMail(env, { to, ...mail, fromName: BRAND.monitor.name })
      if (!force) {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO send_log (run_key, sent_at, recipients) VALUES (?1, ?2, 1)',
        )
          .bind(key, nowIso)
          .run()
      }
      log.push('Störungsmail verschickt')
    }
  } else if (erholt > 0) {
    log.push(`${erholt} kurzzeitig rot, beim Nachprüfen wieder erreichbar — keine Mail`)
  }

  // --- Wochenübersicht, montags ---------------------------------------------
  const sendHour = Number(env.SEND_HOUR_BERLIN || '7')
  const isWeeklySlot = weekdayIndex(iso) === 0 && hour === sendHour
  if (isWeeklySlot || force === 'weekly') {
    // Kalenderwoche als Schlüssel: so kommt die Mail auch dann genau einmal,
    // wenn der Cron in derselben Stunde mehrfach feuert.
    const [y, m, d] = iso.split('-').map(Number)
    const week = Math.floor((Date.UTC(y, m - 1, d) - Date.UTC(y, 0, 1)) / (7 * 86400000)) + 1
    const key = `weekly-status:${y}-W${String(week).padStart(2, '0')}`
    const already = force ? null : await env.DB.prepare('SELECT run_key FROM send_log WHERE run_key = ?1').bind(key).first()
    if (already) {
      log.push('Wochenübersicht diese Woche bereits verschickt')
    } else {
      const mail = weeklyStatusMail(lines, env.SITE_URL)
      await sendMail(env, { to, ...mail, fromName: BRAND.monitor.name })
      if (!force) {
        await env.DB.prepare(
          'INSERT OR REPLACE INTO send_log (run_key, sent_at, recipients) VALUES (?1, ?2, 1)',
        )
          .bind(key, nowIso)
          .run()
      }
      log.push('Wochenübersicht verschickt')
    }
  }

  return log.join('; ')
}

/**
 * Zustand der Cloud-Läufe — melden und abfragen.
 *
 * Warum überhaupt hier und nicht über die GitHub-API: Die erlaubt ohne
 * Anmeldung 60 Abrufe je Stunde. Eine Anzeige, die alle zehn Sekunden nachsieht,
 * verbraucht das in vier Minuten. Ein Token in eine Datei auf dem Schreibtisch zu
 * legen war die Alternative und ist der schlechtere Handel.
 *
 * Der zweite Grund wiegt schwerer: Ein Lauf weiß, was er tut. Die GitHub-API
 * sieht nur „Claude — Auftrag abarbeiten", der Lauf selbst kennt seinen Auftrag.
 *
 * GET ist offen — es sind Metadaten öffentlicher Läufe in einem öffentlichen
 * Repo. Deshalb bekommt dieser eine Pfad `Access-Control-Allow-Origin: *`
 * statt der sonst geltenden Beschränkung auf die eigene Seite: Die Anzeige läuft
 * als Datei vom Schreibtisch und hätte sonst den Ursprung `null`.
 */
/**
 * Zeitstempel in genau dem Format, in dem SQLite vergleichen kann.
 *
 * `datetime('now')` liefert `2026-08-21 13:00:48`, `toISOString()` dagegen
 * `2026-08-21T13:30:24.525Z`. SQLite vergleicht diese Spalte als **Text**, und
 * an Position 10 steht dann `T` (0x54) gegen ein Leerzeichen (0x20) — jeder
 * unserer Werte galt damit als neuer, unabhängig vom Datum. Die Folge: Weder
 * der Drei-Tage-Filter noch das Aufräumen nach vierzehn Tagen haben je
 * gegriffen, und niemandem wäre es aufgefallen, weil beide stumm zu viel
 * durchließen statt zu wenig (gefunden am 21.08.2026).
 *
 * Deshalb: Millisekunden weg, und die Abfragen rechnen mit `strftime` im
 * selben Format.
 */
const ISO_JETZT = "strftime('%Y-%m-%dT%H:%M:%SZ', 'now'"
function jetztIso(): string {
  return new Date().toISOString().slice(0, 19) + 'Z'
}
/** Aus der Meldung eine Zahl machen — oder nichts, wenn dort keine steht. */
function zahlOderNull(wert: unknown): number | null {
  const n = Number(wert)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

async function handleLauf(request: Request, env: Env): Promise<Response> {
  const offen = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    // Was älter als drei Tage ist, interessiert niemanden mehr und würde die
    // Anzeige nur verstopfen.
    /**
     * Was die Anzeige zeigt — und was nicht mehr.
     *
     * Daniel am 21.08.2026: „fertige statuse sollen verschwinden, vorallem wenn
     * sie von dir abgenommen und weiterbearbeitet wurden." Eine Übersicht, in
     * der Abgehaktes stehen bleibt, verliert genau das, wofür sie da ist.
     *
     * Drei Stufen:
     *   laeuft   — immer sichtbar, das ist der Zweck
     *   ok       — eine halbe Stunde lang, damit ein Abschluss nicht unbemerkt
     *              vorbeigeht, wenn gerade niemand hinsieht
     *   abgebrochen — ebenso. Ein Abbruch ist fast immer gewollt: Am 21.08.2026
     *              standen neun davon in der Anzeige, alle von Hand gestoppt,
     *              weil der jeweils nächste Anlauf besser war. Sie verstopften
     *              die Übersicht, ohne dass jemand sie hätte abnehmen müssen.
     *   fehler   — bleibt stehen, bis ihn jemand abnimmt. Ein roter Lauf, der
     *              von selbst verschwindet, ist schlimmer als keine Anzeige.
     *   erledigt — sofort weg. Das setze ich, wenn ich einen Lauf durchgesehen
     *              und weiterverarbeitet habe.
     */
    const { results } = await env.DB.prepare(
      `SELECT lauf_id, repo, workflow, auftrag, zweck, ziel, zustand, begonnen_am, gemeldet_am, url, notiz,
              fortschritt, fortschritt_gesamt, fortschritt_text
         FROM lauf_status
        WHERE zustand != 'erledigt'
          AND gemeldet_am > ${ISO_JETZT}, '-3 days')
          AND (zustand NOT IN ('ok', 'abgebrochen') OR gemeldet_am > ${ISO_JETZT}, '-30 minutes'))
        ORDER BY (zustand = 'laeuft') DESC, (zustand = 'fehler') DESC, gemeldet_am DESC
        LIMIT 40`,
    ).all()
    return antwort({ jetzt: jetztIso(), laeufe: results ?? [] })
  }

  if (request.method !== 'POST') return antwort({ error: 'GET oder POST erwartet' }, 405)

  // Ohne gesetztes Secret bleibt der Pfad lesbar, aber nicht beschreibbar —
  // sonst könnte jeder Beliebige falsche Läufe melden.
  const token = request.headers.get('X-Lauf-Token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

  let daten: Record<string, string | undefined>
  try {
    daten = (await request.json()) as Record<string, string | undefined>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

  const laufId = (daten.lauf_id ?? '').trim()
  const zustand = (daten.zustand ?? '').trim()
  if (!laufId) return antwort({ error: 'lauf_id fehlt' }, 400)
  if (!['laeuft', 'ok', 'fehler', 'abgebrochen', 'erledigt'].includes(zustand)) {
    return antwort({ error: 'zustand muss laeuft, ok, fehler, abgebrochen oder erledigt sein' }, 400)
  }

  const jetzt = jetztIso()
  await env.DB.prepare(
    `INSERT INTO lauf_status (lauf_id, repo, workflow, auftrag, zweck, ziel, zustand, begonnen_am, gemeldet_am, url, notiz,
                             fortschritt, fortschritt_gesamt, fortschritt_text)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14)
     ON CONFLICT(lauf_id) DO UPDATE SET
       zustand = excluded.zustand,
       gemeldet_am = excluded.gemeldet_am,
       notiz = COALESCE(excluded.notiz, lauf_status.notiz),
       auftrag = COALESCE(excluded.auftrag, lauf_status.auftrag),
       zweck = COALESCE(excluded.zweck, lauf_status.zweck),
       ziel = COALESCE(excluded.ziel, lauf_status.ziel),
       fortschritt = COALESCE(excluded.fortschritt, lauf_status.fortschritt),
       fortschritt_gesamt = COALESCE(excluded.fortschritt_gesamt, lauf_status.fortschritt_gesamt),
       fortschritt_text = COALESCE(excluded.fortschritt_text, lauf_status.fortschritt_text)`,
  )
    .bind(
      laufId,
      daten.repo ?? '',
      daten.workflow ?? '',
      daten.auftrag ?? null,
      daten.zweck ?? null,
      daten.ziel ?? null,
      zustand,
      daten.begonnen_am ?? jetzt,
      jetzt,
      daten.url ?? null,
      daten.notiz ?? null,
      zahlOderNull(daten.fortschritt),
      zahlOderNull(daten.fortschritt_gesamt),
      daten.fortschritt_text ?? null,
    )
    .run()

  // Aufräumen im Vorbeigehen: kein eigener Cron für zwei Zeilen Hausputz.
  await env.DB.prepare(
    `DELETE FROM lauf_status WHERE gemeldet_am < ${ISO_JETZT}, '-14 days')`,
  ).run()

  return antwort({ ok: true, lauf_id: laufId, zustand })
}

/**
 * Prüfergebnisse aus dem Browser entgegennehmen.
 *
 * Der Weg (Daniels Vorschlag, 21.08.2026): Er öffnet einen Titel beim Anbieter,
 * eine Chrome-Erweiterung blendet einen Knopf ein, der Klick schickt hierher,
 * was auf der Seite steht. Danach der nächste Titel.
 *
 * Warum das etwas anderes ist als ein Scraper: Die Seite hat **er** geöffnet.
 * `robots.txt` richtet sich an automatische Clients — ein Mensch mit einer
 * Erweiterung ist keiner. Ein Programm, das dieselben Adressen von sich aus
 * abklappert, wäre einer, und deshalb bleibt Netflix für uns gesperrt.
 *
 * CORS ist hier offen wie bei `/lauf`: Die Erweiterung läuft auf
 * `netflix.com`, nicht auf unserer Seite. Geschrieben wird nur mit Token.
 */
async function handlePruefung(request: Request, env: Env): Promise<Response> {
  const offen = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    // Die Pipeline holt sich, was noch nicht übernommen wurde.
    const token = new URL(request.url).searchParams.get('token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
    const { results } = await env.DB.prepare(
      `SELECT id, plattform, url, sprachen, befund, titel, folgen, notiz, gemeldet_am
         FROM pruefung WHERE uebernommen = 0 ORDER BY gemeldet_am LIMIT 500`,
    ).all()
    return antwort({ pruefungen: results ?? [] })
  }

  if (request.method !== 'POST') return antwort({ error: 'GET oder POST erwartet' }, 405)

  const token = request.headers.get('X-Lauf-Token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

  let daten: Record<string, unknown>
  try {
    daten = (await request.json()) as Record<string, unknown>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

  const url = String(daten.url ?? '').trim()
  const befund = String(daten.befund ?? '').trim()
  if (!url) return antwort({ error: 'url fehlt' }, 400)
  if (!['dub', 'kein_dub', 'weg'].includes(befund)) {
    return antwort({ error: 'befund muss dub, kein_dub oder weg sein' }, 400)
  }

  // Wird derselbe Titel zweimal geschickt, gilt der jüngere Blick.
  await env.DB.prepare('DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0').bind(url).run()

  await env.DB.prepare(
    `INSERT INTO pruefung (plattform, url, sprachen, befund, titel, folgen, notiz, gemeldet_am)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)`,
  )
    .bind(
      String(daten.plattform ?? 'unbekannt'),
      url,
      daten.sprachen ? JSON.stringify(daten.sprachen) : null,
      befund,
      daten.titel ? String(daten.titel).slice(0, 200) : null,
      zahlOderNull(daten.folgen),
      daten.notiz ? String(daten.notiz).slice(0, 500) : null,
      jetztIso(),
    )
    .run()

  const offen2 = await env.DB.prepare('SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 0').first<{
    n: number
  }>()
  return antwort({ ok: true, befund, offen: offen2?.n ?? 0 })
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      // Der Laufstatus wird auch von einer Datei auf dem Schreibtisch gelesen;
      // die hat den Ursprung `null` und käme an der sonstigen Beschränkung nicht vorbei.
      if (url.pathname === '/lauf' || url.pathname === '/pruefung') {
        return new Response(null, {
          headers: {
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
            'Access-Control-Allow-Headers': 'Content-Type, X-Lauf-Token',
          },
        })
      }
      return new Response(null, { headers: cors(env) })
    }

    switch (url.pathname) {
      case '/subscribe':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handleSubscribe(request, env)
      case '/confirm':
        return handleConfirm(request, env)
      case '/unsubscribe':
        // GET mit dem `unsub_token` aus der Mail, POST mit dem `pref_token` aus
        // dem verbundenen Browser — beide beenden dasselbe Abo.
        if (request.method === 'POST') return handleUnsubscribeByPref(request, env)
        return handleUnsubscribe(request, env)
      case '/prefs':
        // Der verbundene Browser liest und ändert damit seine Einstellungen.
        if (request.method === 'GET') return handlePrefsGet(request, env)
        if (request.method !== 'POST') return json(env, { error: 'GET oder POST erwartet' }, 405)
        return handlePrefsPost(request, env)
      case '/favorites':
        // GET holt, POST schreibt. Der Rückweg kam am 14.08.2026 dazu.
        if (request.method === 'GET') return handleFavoritesGet(request, env)
        if (request.method !== 'POST') return json(env, { error: 'GET oder POST erwartet' }, 405)
        return handleFavorites(request, env)
      case '/restore':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handleRestore(request, env)
      case '/restore/confirm':
        return handleRestoreConfirm(request, env)
      case '/sync':
        return handleSync(request, env)
      case '/rhythmus':
        // Der Umstell-Knopf aus der Mail. Setzt den Rhythmus und verbindet den
        // Browser gleich mit — ein Klick, beide Wirkungen.
        return handleRhythmus(request, env)
      case '/debug/digest': {
        // Versand von Hand auslösen, ohne bis 07:00 zu warten. Nur mit dem
        // Secret DEBUG_TOKEN erreichbar; ohne gesetztes Secret abgeschaltet.
        const token = url.searchParams.get('token') ?? ''
        if (!env.DEBUG_TOKEN || token !== env.DEBUG_TOKEN) {
          return json(env, { error: 'Nicht erlaubt' }, 403)
        }
        const frequency = url.searchParams.get('frequency') === 'weekly' ? 'weekly' : 'daily'
        try {
          const result = await runDigest(env, new Date(), frequency)
          return json(env, { ok: true, result })
        } catch (err) {
          // Ohne Auffangnetz quittiert Cloudflare das mit einem nackten
          // „error code: 1101", aus dem niemand die Ursache erkennt.
          return json(env, { ok: false, error: (err as Error).message }, 500)
        }
      }
      case '/debug/monitor': {
        const token = url.searchParams.get('token') ?? ''
        if (!env.DEBUG_TOKEN || token !== env.DEBUG_TOKEN) return json(env, { error: 'Nicht erlaubt' }, 403)
        const mode = url.searchParams.get('mail')
        try {
          const result = await runMonitor(
            env,
            new Date(),
            mode === 'alert' || mode === 'weekly' ? mode : undefined,
          )
          return json(env, { ok: true, result })
        } catch (err) {
          return json(env, { ok: false, error: (err as Error).message }, 500)
        }
      }
      case '/status': {
        const { results } = await env.DB.prepare(
          'SELECT name, url, ok, status, ms, reason, checked_at, last_ok_at, fail_streak FROM site_status ORDER BY ok, name',
        ).all()
        return json(env, { sites: results ?? [] })
      }
      case '/pruefung':
        return handlePruefung(request, env)
      case '/lauf':
        return handleLauf(request, env)
      case '/health': {
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM subscribers WHERE status = 'active'",
        ).first<{ n: number }>()
        return json(env, { ok: true, activeSubscribers: count?.n ?? 0 })
      }
      default:
        return json(env, { error: 'Unbekannter Pfad' }, 404)
    }
  },

  async scheduled(_event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date()
    // Beide Aufgaben getrennt halten: Fällt der Newsletter aus, soll die
    // Überwachung trotzdem laufen — und umgekehrt.
    ctx.waitUntil(
      runDigest(env, now)
        .then((msg) => console.log(`[digest] ${msg}`))
        .catch((err) => console.error('[digest] fehlgeschlagen', err)),
    )
    ctx.waitUntil(
      runMonitor(env, now)
        .then((msg) => console.log(`[monitor] ${msg}`))
        .catch((err) => console.error('[monitor] fehlgeschlagen', err)),
    )
  },
}
