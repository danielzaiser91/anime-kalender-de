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
import { Ereignisse, ereignisSenden } from './ereignisse.ts'

export { Ereignisse }

export interface Env extends MailEnv {
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
  /** Empfänger der Überwachungsmeldungen. Fehlt sie, wird nur geprüft, nicht gemeldet. */
  MONITOR_EMAIL?: string
}

interface SubscriberRow {
  id: string
  email: string
  frequency: 'daily' | 'weekly'
  platforms: string
  favorites: string
  /** Auch Neues aus Reihen melden, von denen ein Titel gemerkt ist. */
  franchise_hinweis: number
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
    "SELECT favorites, email, franchise_hinweis FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ favorites: string; email: string; franchise_hinweis: number }>()

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
    "SELECT email, frequency, platforms, franchise_hinweis FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ email: string; frequency: string; platforms: string; franchise_hinweis: number }>()

  if (!row) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  return json(env, {
    ok: true,
    email: row.email,
    frequency: row.frequency === 'daily' ? 'daily' : 'weekly',
    platforms: row.platforms ? row.platforms.split(',').filter(Boolean) : [],
    /* Damit der Schalter den echten Stand zeigt und nicht eine Vermutung. */
    franchiseHinweis: row.franchise_hinweis !== 0,
  })
}

async function handlePrefsPost(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string; frequency?: string; platforms?: string[]; franchiseHinweis?: boolean }
  try {
    payload = (await request.json()) as {
      token?: string
      frequency?: string
      platforms?: string[]
      franchiseHinweis?: boolean
    }
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }
  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const frequency = payload.frequency === 'daily' ? 'daily' : 'weekly'
  const platforms = (payload.platforms ?? []).filter((p) => /^[a-z]+$/.test(p)).join(',')
  /*
    **Fehlt das Feld, bleibt die Einstellung, wie sie war.**

    Ein älterer Client schickt es nicht mit; ihn deshalb stillschweigend
    abzumelden wäre der schlimmere Fehler. Nur ein ausdrückliches `false`
    schaltet ab.
  */
  const hinweis = payload.franchiseHinweis === undefined ? null : payload.franchiseHinweis ? 1 : 0

  const result = await env.DB.prepare(
    "UPDATE subscribers SET frequency = ?1, platforms = ?2, franchise_hinweis = COALESCE(?4, franchise_hinweis) WHERE pref_token = ?3 AND status = 'active'",
  )
    .bind(frequency, platforms, token, hinweis)
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
/** Je Titel seine Reihe und sein Jahr — siehe `reihen.json` im Bau. */
type Reihen = Record<string, { f: number; j: number | null }>

/**
 * Die Reihen-Zuordnung, fuer den Hinweis auf Neues aus gemerkten Reihen.
 *
 * Rund 40 KB statt der 2,6 MB von `titles.json`, und mit einer Stunde
 * Zwischenspeicher: Sie aendert sich nur, wenn ein Titel dazukommt.
 */
async function loadReihen(env: Env): Promise<Reihen> {
  const url = new URL('data/reihen.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 3600 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as Reihen
  } catch (err) {
    console.error('Reihen-Zuordnung nicht abrufbar', err)
    return {}
  }
}

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
  const reihen = await loadReihen(env)
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
      `SELECT id, email, frequency, platforms, favorites, franchise_hinweis, unsub_token, pref_token, last_sent_at FROM subscribers
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
      const eigene = alleNeu.filter((n) => favorites.has(n.id) && (!seit || n.seit > seit))

      /**
       * **Neues aus einer Reihe, von der etwas gemerkt ist.**
       *
       * Daniel am 28.08.2026: „ich will informiert werden weil ich es sonst
       * evtl verpasse." Wer die letzte Staffel gemerkt hat, erfaehrt sonst nie,
       * dass eine neue angekuendigt wurde — sie ist ein eigener Titel, und den
       * hat er noch nicht gemerkt, weil es ihn gerade erst gibt.
       *
       * **Zwei Riegel gegen Laerm**, beide einfach:
       *
       * - Nur, was **nicht aelter** ist als der gemerkte Titel. Wird eine OVA
       *   von 2005 erstmals erfasst, ist sie fuer den Bestand neu, aber keine
       *   Ankuendigung. Ohne Jahresangabe gilt sie als neu — Schweigen waere
       *   hier der groessere Fehler.
       * - Nur einmal, ueber dieselbe Grenze wie die uebrigen Neuzugaenge.
       *
       * Gemessen kommen rund 0,2 Titel je Tag neu in den Bestand; eine Flut
       * ist daraus nicht zu erwarten.
       */
      const meineReihen = new Map<number, number>()
      if (sub.franchise_hinweis) {
        for (const id of favorites) {
          const ausReihenDatei = reihen[String(id)]
          const reihe = ausReihenDatei?.f ?? alleNeu.find((n) => n.id === id)?.franchiseId
          if (!reihe) continue
          const jahr = ausReihenDatei?.j ?? null
          const bisher = meineReihen.get(reihe)
          if (bisher === undefined || (jahr !== null && jahr < bisher)) meineReihen.set(reihe, jahr ?? 0)
        }
      }
      const ausReihe = sub.franchise_hinweis
        ? alleNeu.filter(
            (n) =>
              !favorites.has(n.id) &&
              (!seit || n.seit > seit) &&
              n.franchiseId !== undefined &&
              meineReihen.has(n.franchiseId) &&
              (n.jahr == null || n.jahr >= (meineReihen.get(n.franchiseId) ?? 0)),
          )
        : []
      const neuMitSynchro = [...eigene, ...ausReihe.map((n) => ({ ...n, ausReihe: true }))]

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
/**
 * Eine Zahl, oder ehrlich nichts.
 *
 * `Number(null)` ist **0**, und `0 >= 0` bestand die Prüfung — eine Angabe, die
 * es nicht gab, kam als Zahl Null in der Datenbank an. Bei jedem geöffneten
 * Titel entstand so eine Meldung „Folge 0, Staffel 0" (Daniel, 22.08.2026,
 * viermal beobachtet). Null sieht aus wie eine Angabe, ist aber keine.
 *
 * Dasselbe gilt für den leeren String: `Number('')` ist ebenfalls 0.
 */
function zahlOderNull(wert: unknown): number | null {
  if (wert === null || wert === undefined || wert === '') return null
  const n = Number(wert)
  return Number.isFinite(n) && n >= 0 ? Math.round(n) : null
}

/**
 * Das Crunchyroll-Zugangspaket beschaffen und herausgeben.
 *
 * ## Der Kunstgriff
 *
 * Crunchyroll leitet die Region aus der IP ab. Ein Cloudflare Worker läuft
 * dort, wo die **eingehende** Anfrage ankommt — gemessen am 22.08.2026: von
 * Daniels Leitung aus in London, und Crunchyroll gibt ihm `DE`; von einem
 * GitHub-Runner aufgerufen in San Jose, und er bekommt `US`.
 *
 * Daraus wird eine Lösung, die niemanden beschäftigt: Daniels Statusanzeige
 * fragt diesen Worker ohnehin im Sekundentakt ab und startet bei ihm mit dem
 * Anmelden. Bei jeder dieser Anfragen prüft er nebenbei, ob sein Paket noch
 * frisch ist, und holt sonst ein neues — mit deutscher Sicht, weil die Anfrage
 * aus Deutschland kam. Der Lauf in der Cloud holt es sich später hier ab.
 *
 * ## Die Regel, die dabei nicht fallen darf
 *
 * Gespeichert wird **nur ein Paket mit `country: DE`**. Ein Paket aus der
 * falschen Region wäre schlimmer als keines: Der Lauf liefe durch und läse
 * still den falschen Katalog.
 */

/** Wie alt ein Paket werden darf, bevor nebenbei ein neues geholt wird. */
const ZUGANG_FRISCH_STUNDEN = 6

interface CrPaket {
  land: string
  bucket: string
  policy: string
  signature: string
  key_pair_id: string
  gilt_bis: string
}

/** Holt ein anonymes Zugangspaket — von dort, wo dieser Worker gerade läuft. */
async function holeCrPaket(): Promise<CrPaket | { fehler: string }> {
  const UA =
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36'
  const tokenAntwort = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: {
      authorization: 'Basic Y3Jfd2ViOg==',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent': UA,
    },
    body: 'grant_type=client_id',
  })
  if (!tokenAntwort.ok) return { fehler: `Token: HTTP ${tokenAntwort.status}` }
  const token = (await tokenAntwort.json()) as { access_token: string; country: string }
  if (token.country !== 'DE') return { fehler: `Region ${token.country}, nicht DE` }

  const indexAntwort = await fetch('https://beta-api.crunchyroll.com/index/v2', {
    headers: { authorization: `Bearer ${token.access_token}`, 'user-agent': UA },
  })
  if (!indexAntwort.ok) return { fehler: `index/v2: HTTP ${indexAntwort.status}` }
  const index = (await indexAntwort.json()) as {
    cms?: Record<string, string>
    cms_web?: Record<string, string>
  }
  const cms = index.cms ?? index.cms_web
  if (!cms?.bucket) return { fehler: 'kein Bucket in der Antwort' }

  return {
    land: token.country,
    bucket: cms.bucket,
    policy: cms.policy,
    signature: cms.signature,
    key_pair_id: cms.key_pair_id,
    gilt_bis: cms.expires,
  }
}

/**
 * Nebenbei auffrischen, wenn die Gelegenheit da ist.
 *
 * Wird aus dem Statusabruf heraus aufgerufen und läuft im Hintergrund weiter,
 * damit die Anzeige nicht darauf wartet. Schlägt es fehl, bleibt das alte Paket
 * stehen — ein abgelaufenes ist immer noch ehrlicher als ein falsches.
 */
async function crZugangAuffrischen(env: Env, colo?: string): Promise<void> {
  const stand = await env.DB.prepare('SELECT geholt_am, gilt_bis FROM cr_zugang WHERE id = 1').first<{
    geholt_am: string
    gilt_bis: string
  }>()
  if (stand) {
    const alterStunden = (Date.now() - Date.parse(stand.geholt_am)) / 3600_000
    if (alterStunden < ZUGANG_FRISCH_STUNDEN) return
  }

  const paket = await holeCrPaket()
  if ('fehler' in paket) {
    console.log(`[cr-zugang] nicht aufgefrischt: ${paket.fehler} (colo ${colo ?? '?'})`)
    return
  }
  await env.DB.prepare(
    `INSERT INTO cr_zugang (id, land, paket, geholt_am, gilt_bis, colo)
     VALUES (1, ?1, ?2, ?3, ?4, ?5)
     ON CONFLICT(id) DO UPDATE SET
       land = excluded.land, paket = excluded.paket,
       geholt_am = excluded.geholt_am, gilt_bis = excluded.gilt_bis, colo = excluded.colo`,
  )
    .bind(paket.land, JSON.stringify(paket), jetztIso(), paket.gilt_bis, colo ?? null)
    .run()
  console.log(`[cr-zugang] frisches Paket aus ${colo ?? '?'}, gültig bis ${paket.gilt_bis}`)
}

/** Gibt das gespeicherte Paket heraus — hinter demselben Token wie alles andere. */
async function handleCrZugang(request: Request, env: Env): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const token = request.headers.get('X-Lauf-Token') ?? new URL(request.url).searchParams.get('token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) {
    return new Response(JSON.stringify({ error: 'Nicht erlaubt' }), { status: 403, headers: kopf })
  }

  const zeile = await env.DB.prepare(
    'SELECT land, paket, geholt_am, gilt_bis, colo FROM cr_zugang WHERE id = 1',
  ).first<{ land: string; paket: string; geholt_am: string; gilt_bis: string; colo: string }>()

  if (!zeile) {
    return new Response(
      JSON.stringify({ error: 'Noch kein Paket geholt — die Statusanzeige muss einmal gelaufen sein' }),
      { status: 404, headers: kopf },
    )
  }
  const abgelaufen = Date.parse(zeile.gilt_bis) < Date.now()
  return new Response(
    JSON.stringify({ ...JSON.parse(zeile.paket), geholt_am: zeile.geholt_am, colo: zeile.colo, abgelaufen }),
    { status: abgelaufen ? 410 : 200, headers: kopf },
  )
}

/**
 * Welches Land schreibt Crunchyroll diesem Worker zu?
 *
 * Die Frage entscheidet, ob sich die Erneuerung des Zugangspakets vollständig
 * automatisieren lässt. Crunchyroll leitet die Region aus der IP des Abrufs ab;
 * ein Worker ruft mit der Adresse des Rechenzentrums an, in dem er gerade läuft.
 * Cloudflare führt einen Worker dort aus, wo die **eingehende** Anfrage ankommt
 * — ein Aufruf aus Deutschland landet also in Frankfurt, einer aus den USA
 * nicht. Was bei einem **Cron**-Lauf passiert, ist damit noch nicht gesagt, und
 * genau das misst dieser Endpunkt über die Zeit mit.
 *
 * Er ruft nur `/auth/v1/token` an — ein anonymes Token, kein Konto, kein Inhalt.
 */
async function handleLand(request: Request, env: Env): Promise<Response> {
  const kopf = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const token = request.headers.get('X-Lauf-Token') ?? new URL(request.url).searchParams.get('token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) {
    return new Response(JSON.stringify({ error: 'Nicht erlaubt' }), { status: 403, headers: kopf })
  }

  const messung = await crunchyrollLand(request.cf?.colo as string | undefined)
  return new Response(JSON.stringify(messung, null, 1), { headers: kopf })
}

/** Holt ein anonymes Token und gibt zurück, welches Land darin steht. */
async function crunchyrollLand(colo?: string): Promise<Record<string, unknown>> {
  const antwort = await fetch('https://beta-api.crunchyroll.com/auth/v1/token', {
    method: 'POST',
    headers: {
      authorization: 'Basic Y3Jfd2ViOg==',
      'content-type': 'application/x-www-form-urlencoded',
      'user-agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/139.0.0.0 Safari/537.36',
    },
    body: 'grant_type=client_id',
  })
  if (!antwort.ok) return { fehler: `HTTP ${antwort.status}`, colo, gemessen_am: jetztIso() }
  const daten = (await antwort.json()) as { country?: string; access_token?: string }
  return { land: daten.country, colo, gemessen_am: jetztIso() }
}

/**
 * Was Netflix im Hintergrund lädt, entgegennehmen.
 *
 * Die Erweiterung hört mit, während Daniel eine Seite ansieht, und schickt
 * Feldnamen und kurze Fundstellen — nicht die Antworten selbst. Die Frage
 * dahinter ist, ob Netflix die Sprachangaben ohnehin ausliefert; dann erübrigt
 * sich die Handarbeit (Daniel, 22.08.2026).
 *
 * GET gibt die Funde zurück, damit die Pipeline sie auswerten kann. Beides
 * hinter demselben Token wie `/pruefung`.
 */
async function handleNetzfund(request: Request, env: Env): Promise<Response> {
  const offen = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    const token = new URL(request.url).searchParams.get('token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
    const { results } = await env.DB.prepare(
      'SELECT id, url, reihe, laenge, felder, proben, gemeldet_am FROM netzfund ORDER BY gemeldet_am DESC LIMIT 200',
    ).all()
    return antwort({ funde: results ?? [] })
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

  const url = String(daten.url ?? '').slice(0, 500)
  if (!url) return antwort({ error: 'url fehlt' }, 400)

  // Derselbe Pfad zweimal bringt nichts Neues.
  const schon = await env.DB.prepare('SELECT id FROM netzfund WHERE url = ?1').bind(url).first()
  if (schon) return antwort({ ok: true, doppelt: true })

  await env.DB.prepare(
    `INSERT INTO netzfund (url, reihe, laenge, felder, proben, gemeldet_am)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6)`,
  )
    .bind(
      url,
      daten.reihe ? String(daten.reihe).slice(0, 40) : null,
      Number(daten.laenge) || 0,
      JSON.stringify(daten.felder ?? []).slice(0, 4000),
      JSON.stringify(daten.proben ?? []).slice(0, 4000),
      jetztIso(),
    )
    .run()

  const anzahl = await env.DB.prepare('SELECT COUNT(*) AS n FROM netzfund').first<{ n: number }>()
  return antwort({ ok: true, funde: anzahl?.n ?? 0 })
}

async function handleLauf(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
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
          -- Ein roter Lauf verschwindet, sobald derselbe Workflow wieder
          -- durchgelaufen ist.
          --
          -- ok und abgebrochen fielen nach dreißig Minuten heraus, fehler blieb
          -- drei Tage stehen — auch dann noch, wenn der Fehler längst behoben
          -- und der Workflow zehnmal grün gelaufen war. Daniel sah am
          -- 27.08.2026 abends drei rote Deploys von 15:40 Uhr, deren Ursache
          -- zwei Stunden vorher weggeräumt worden war.
          --
          -- Ein späterer Erfolg desselben Workflows ist die Antwort auf die
          -- Frage, die ein roter Lauf stellt. Steht sie da, gibt es nichts
          -- mehr zu melden.
          --
          -- Kein Backtick in diesem Kommentar: Der SQL steht in einem
          -- Template-Literal, und ein Backtick darin beendet es mitten im Satz.
          AND NOT EXISTS (
            SELECT 1 FROM lauf_status AS spaeter
             WHERE spaeter.workflow = lauf_status.workflow
               AND spaeter.zustand = 'ok'
               AND spaeter.gemeldet_am > lauf_status.gemeldet_am
          )
        ORDER BY (zustand = 'laeuft') DESC, (zustand = 'fehler') DESC, gemeldet_am DESC
        LIMIT 40`,
    ).all()
    // Die Gelegenheit nutzen: Diese Anfrage kommt aus Daniels Browser, also aus
    // Deutschland — und nur von dort gibt Crunchyroll ein deutsches Paket her.
    ctx?.waitUntil(crZugangAuffrischen(env, request.cf?.colo as string | undefined))
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
     -- ?15 sagt nur, ob diese Meldung überhaupt einen Fortschritt enthält.
     ON CONFLICT(lauf_id) DO UPDATE SET
       zustand = excluded.zustand,
       gemeldet_am = excluded.gemeldet_am,
       notiz = COALESCE(excluded.notiz, lauf_status.notiz),
       auftrag = COALESCE(excluded.auftrag, lauf_status.auftrag),
       zweck = COALESCE(excluded.zweck, lauf_status.zweck),
       ziel = COALESCE(excluded.ziel, lauf_status.ziel),
       fortschritt = CASE WHEN ?15 = 1 THEN excluded.fortschritt ELSE lauf_status.fortschritt END,
       fortschritt_gesamt = CASE WHEN ?15 = 1 THEN excluded.fortschritt_gesamt ELSE lauf_status.fortschritt_gesamt END,
       fortschritt_text = CASE WHEN ?15 = 1 THEN excluded.fortschritt_text ELSE lauf_status.fortschritt_text END`,
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
      daten.fortschritt === undefined ? 0 : 1,
    )
    .run()

  // Aufräumen im Vorbeigehen: kein eigener Cron für zwei Zeilen Hausputz.
  await env.DB.prepare(
    `DELETE FROM lauf_status WHERE gemeldet_am < ${ISO_JETZT}, '-14 days')`,
  ).run()

  ctx?.waitUntil(ereignisSenden(env, 'lauf', { lauf_id: laufId, zustand }))
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
async function handlePruefung(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const offen = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    /**
     * **Nur zählen — das geht ohne Token.**
     *
     * Daniel am 26.08.2026, nachdem er einen Titel gemeldet hatte: „status app
     * still says 11 offen, even after reporting 1, should be 10 offen."
     *
     * Zwischen der Meldung und dem nächsten Datenlauf liegt bis zu eine Stunde.
     * Solange zeigt `pruefstand.json` den Stand von vorher — richtig für den
     * Datensatz, aber falsch für die Frage „habe ich das schon gemacht?".
     *
     * Diese Route liefert je Plattform, wie viele Meldungen im Briefkasten
     * liegen und noch nicht übernommen sind. Das ist eine Zahl, kein Inhalt:
     * kein Titel, keine Adresse, keine Tonspur. Deshalb braucht sie kein Token
     * — eines in einer Datei auf dem Schreibtisch wäre der schlechtere Handel.
     */
    /**
     * **Welche Folgen dieser Adresse schon gemeldet sind.**
     *
     * Daniel am 26.08.2026 über den lokalen Zähler der Erweiterung: „warum ist
     * das überhaupt notwendig, es sollte synchron zur remote liste sein, fix das
     * sodass die stände nie auseinander laufen können."
     *
     * Er hat recht: Ein Zähler im Browser ist eine zweite Fassung derselben
     * Wahrheit, und zwei Fassungen laufen auseinander. Nach einem Neuladen der
     * Erweiterung stand der lokale Stand auf null, obwohl zwölf Meldungen längst
     * hier lagen.
     *
     * Gefragt wird ohne Rücksicht auf `uebernommen`: Was einmal gemeldet wurde,
     * bleibt gemeldet — sonst wäre nach jedem Datenlauf alles wieder offen.
     *
     * Nur Folgennummern, keine Inhalte; deshalb ohne Token.
     */
    const fuer = new URL(request.url).searchParams.get('gemeldet')
    if (fuer) {
      /*
        **Nummer und Staffel gehören zusammen.**

        Der erste Anlauf gab nur die Folgennummern zurück. Bei Beyblade X waren
        S1E1-15 gemeldet — und weil jede Staffel bei Disney+ ab 1 zählt, hielt
        die Erweiterung damit auch S2E1-15 für erledigt und übersprang sie.
        Im Briefkasten landete Staffel 1 vollständig und Staffel 2 erst ab Folge
        16 (Daniel, 26.08.2026: „2e16? wo sind die ersten 15 von s2?").

        `nummern` bleibt für die Netflix-Seite, die eine durchlaufende Zählung
        hat; `paare` ist die genauere Auskunft.
      */
      const { results } = await env.DB.prepare(
        `SELECT DISTINCT folge_nr, staffel FROM pruefung WHERE url = ? AND folge_nr IS NOT NULL`,
      )
        .bind(fuer)
        .all<{ folge_nr: number; staffel: number | null }>()
      const nummern = [...new Set((results ?? []).map((r) => r.folge_nr))]
      const paare = (results ?? []).map((r) => ({ nummer: r.folge_nr, staffel: r.staffel ?? 1 }))
      return antwort({ nummern, paare })
    }

    /**
     * **Eine Zahl, eine Stelle, die sie rechnet.**
     *
     * Bis zum 26.08.2026 rechneten drei Stellen dasselbe aus verschiedenen
     * Quellen: die Statusanzeige aus `pruefstand.json` minus Briefkasten, die
     * Erweiterung ebenso, und ihre Liste aus dem lokalen Speicher. Das Ergebnis
     * war ein offener Widerspruch — der Knopf sagte „10 offen", die Liste
     * daneben „Alles geprüft", und beide hatten recht (Daniel: „wo sind die 10
     * einträge die es zu prüfen gilt?", danach: „single source of truth").
     *
     * Hier laufen beide Quellen zusammen: `pruefstand.json` sagt, was der
     * Datensatz noch nicht hat, die Datenbank, was davon schon unterwegs ist.
     * Wer die Zahl braucht, liest sie — niemand rechnet sie nach.
     *
     * Gezählt wird in **Staffeln**, wie im Prüfstand; `titel` nennt daneben die
     * Zahl der Adressen, damit eine Liste ihre eigene Länge belegen kann.
     */
    if (new URL(request.url).searchParams.get('stand') === '1') {
      const { results } = await env.DB.prepare(
        `SELECT plattform, url FROM pruefung WHERE uebernommen = 0`,
      ).all<{ plattform: string; url: string }>()
      const gemeldeteAdressen = new Map<string, Set<string>>()
      for (const r of results ?? []) {
        if (!r.url) continue
        const dazu = gemeldeteAdressen.get(r.plattform) ?? new Set<string>()
        dazu.add(r.url)
        gemeldeteAdressen.set(r.plattform, dazu)
      }
      /**
       * **Übernommen ist nicht erledigt — jedenfalls nicht für den Prüfstand.**
       *
       * `pruefstand.json` entsteht beim Datenbau und nennt, was der Datensatz
       * noch nicht weiß. Abgezogen wurde bisher nur, was **offen** im
       * Briefkasten liegt. Zwischen der Übernahme einer Meldung und dem
       * nächsten Datenbau fällt eine Adresse damit durch beide Raster: im
       * Prüfstand noch offen, im Briefkasten nicht mehr da.
       *
       * Genau dort landete Daniel zweimal an einem Tag — die Amazon-Pille
       * schickte ihn auf einen Titel, den er längst gemeldet hatte (30.08.2026:
       * „klick auf amazon pill in status leitet mich erneut zu einem bereits
       * vollständig gemeldeten titel").
       *
       * Für die **Ziele** zählt deshalb jede jemals gemeldete Adresse. Die
       * Zahl `unterwegs` daneben bleibt bei den offenen: Sie beantwortet eine
       * andere Frage — was der nächste Datenlauf noch abholt.
       */
      const { results: jemals } = await env.DB.prepare(
        `SELECT DISTINCT plattform, url FROM pruefung WHERE url IS NOT NULL AND url != ''`,
      ).all<{ plattform: string; url: string }>()
      const jeGemeldet = new Map<string, Set<string>>()
      for (const r of jemals ?? []) {
        const dazu = jeGemeldet.get(r.plattform) ?? new Set<string>()
        dazu.add(r.url)
        jeGemeldet.set(r.plattform, dazu)
      }

      let stand: { anbieter?: unknown[] } = {}
      try {
        const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
          cf: { cacheTtl: 60 },
        } as RequestInit)
        if (res.ok) stand = (await res.json()) as { anbieter?: unknown[] }
      } catch {
        /* Ohne Prüfstand bleibt die Briefkasten-Zahl — besser als keine. */
      }

      const anbieter = (stand.anbieter ?? []).map((roh) => {
        const a = roh as {
          name: string
          plattform: string
          offen: number
          gesamt: number
          gemeldet: number
          ohneSeite?: number
          ziele?: { url: string; titel: string }[]
        }
        const unterwegs = gemeldeteAdressen.get(a.plattform) ?? new Set<string>()
        /*
          Ein Ziel, unter dem jemals gemeldet wurde, ist erledigt — auch wenn
          der Datensatz es noch nicht weiß und der Briefkasten es schon
          abgegeben hat.
        */
        const schonGemeldet = jeGemeldet.get(a.plattform) ?? new Set<string>()
        const offeneZiele = (a.ziele ?? []).filter((z) => !schonGemeldet.has(z.url))
        return {
          name: a.name,
          plattform: a.plattform,
          gesamt: a.gesamt,
          /**
           * Staffeln, zu denen weder der Datensatz noch eine Meldung etwas hat.
           *
           * Abgezogen wird, was **jemals** gemeldet wurde, nicht nur das
           * Offene: Sonst wächst die Zahl nach jedem Datenlauf wieder an, weil
           * die übernommenen Meldungen aus dem Briefkasten verschwinden, bevor
           * der nächste Datenbau sie einarbeitet (30.08.2026).
           */
          offen: Math.max(0, a.offen - schonGemeldet.size),
          /** Adressen, die noch niemand gemeldet hat. */
          titel: offeneZiele.length,
          /** Was davon schon unterwegs ist. */
          unterwegs: unterwegs.size,
          /**
           * Verweise, für die niemand eine Titelseite kennt.
           *
           * Bei Prime sind das 117 Suchadressen — weder AniList noch aniSearch
           * führen für diese Titel eine Produktseite, und weder MOTN noch TMDB
           * kennen eine. Die Erweiterung zeigt auf der Suchseite, welcher Titel
           * gemeint ist; gesucht werden muss er trotzdem von Hand.
           *
           * Der Prüfstand zählt sie seit jeher, der Worker reichte sie nicht
           * weiter — die Anzeige schrieb deshalb „alles geprüft" für einen
           * Anbieter mit dreistelliger offener Arbeit (Daniel, 27.08.2026:
           * „wieso steht in status app oben keine klickbare pill?").
           */
          ohneSeite: a.ohneSeite ?? 0,
          ziel: offeneZiele[0]?.url ?? null,
          ziele: offeneZiele,
        }
      })
      return antwort({ anbieter, erzeugtAm: new Date().toISOString() })
    }

    /*
      **Die Rohfolgen für den Bau.**

      Die Zuordnung passiert nicht mehr im Browser, sondern hier gegen TMDB —
      dafür braucht der Bau, was die Erweiterung gesehen hat: Folgentitel,
      Erstausstrahlung, Laufzeit, Sprachen, je Folge.

      Wie bei `/pruefung` mit Token, und mit derselben Grenze: Was hier
      herauskommt, ist der Rohstoff eines Laufs, nicht eine Ansicht für
      Menschen.
    */
    if (new URL(request.url).searchParams.get('rohfolgen') === '1') {
      const token = new URL(request.url).searchParams.get('token') ?? ''
      if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) {
        return antwort({ error: 'Token fehlt oder stimmt nicht' }, 403)
      }
      /*
        **`titel_id` gehört mit heraus — sonst war die Spalte umsonst.**

        Migration 018 hat sie am 28.08.2026 angelegt, damit eine Meldung sagt,
        **zu welchem Eintrag unseres Bestands** sie gehört, statt dass der Bau es
        aus der Adresse erraten muss. Die Spalte wurde befüllt, im SELECT stand
        sie nie — der Bau hat sie also nie gesehen, und die Zuordnung lief
        weiter über die Adresse. Gemessen am 29.08.2026: 0 von 67 Adressen
        zugeordnet.

        **Und die Abfrage lässt sich fortsetzen.** 5.620 Folgen lagen offen,
        5.000 kamen heraus — 620 hätten den Bau nie erreicht. Eine Abfrage mit
        `LIMIT` beantwortet eine andere Frage als die gestellte (26.08.2026,
        damals kostete es zwei Einträge). `?nach=<id>` setzt dort fort, wo die
        letzte Seite endete; `gesamt` bleibt die ungekürzte Zahl.
      */
      const nach = Number(new URL(request.url).searchParams.get('nach') ?? 0)
      const { results } = await env.DB.prepare(
        `SELECT id, url, asin, gti, nummer, titel, erschienen, dauer_sek, sprachen,
                untertitel, staffel_text, staffel_nr, gemeldet_am, titel_id
           FROM prime_folge
          WHERE uebernommen = 0 AND id > ?1
          ORDER BY id
          LIMIT 5000`,
      )
        .bind(Number.isFinite(nach) ? nach : 0)
        .all()
      /* Die Gesamtzahl getrennt: Eine Abfrage mit LIMIT beantwortet eine andere
         Frage als die gestellte — das hat am 26.08.2026 zwei Einträge gekostet. */
      const gesamt = await env.DB.prepare('SELECT COUNT(*) AS n FROM prime_folge WHERE uebernommen = 0').first<{ n: number }>()
      const zeilen = (results ?? []) as { id: number }[]
      return antwort({
        folgen: zeilen,
        gesamt: gesamt?.n ?? 0,
        /* Ist die Seite voll, steht die Fortsetzung dabei — sonst ausdrücklich null. */
        weiter: zeilen.length === 5000 ? zeilen[zeilen.length - 1]!.id : null,
      })
    }

    if (new URL(request.url).searchParams.get('zaehlen') === '1') {
      /*
        **Die Adressen gehören dazu, nicht nur ihre Anzahl.**

        Daniel am 26.08.2026: „klick auf netflix pill führt zu dem titel den ich
        gerade vor dem letzten change reported habe … ich reporte, reloade,
        steht weiterhin 10."

        Die Prüfliste stammt vom letzten Datenlauf und kennt seine frischen
        Meldungen nicht — sie schickte ihn deshalb immer wieder zum selben
        Titel, und die zweite Meldung überschrieb nur die erste. Eine Zahl
        allein kann das nicht verhindern: Sie sagt, **dass** etwas gemeldet
        wurde, nicht **was**.

        Es sind öffentliche Titelseiten, keine persönlichen Angaben.
      */
      /*
        **Mit `nummern=1` kommen die Folgennummern mit.**

        Die Erweiterung zeigt in ihrer Liste je Titel, welche Folgen schon
        gemeldet sind — als Bereich („1e1-15"), nicht als Anzahl. Dafür genügt
        die Adresse nicht (Daniel, 26.08.2026: „bereits gemeldete folgen und
        fehlende meldungen werden ebenfalls nicht korrekt in der liste
        angezeigt").

        Ein Abruf für alle Titel statt einer je Titel: 31 Disney-Seiten wären
        sonst 31 Anfragen bei jedem Öffnen der Liste.
      */
      const mitNummern = new URL(request.url).searchParams.get('nummern') === '1'
      const { results } = await env.DB.prepare(
        `SELECT plattform, url, folge_nr, staffel FROM pruefung WHERE uebernommen = 0`,
      ).all<{ plattform: string; url: string; folge_nr: number | null; staffel: number | null }>()
      const je: Record<string, number> = {}
      const adressen: string[] = []
      const eintraege: { url: string; folge_nr: number | null; staffel: number | null }[] = []
      for (const r of results ?? []) {
        je[r.plattform] = (je[r.plattform] ?? 0) + 1
        if (!r.url) continue
        adressen.push(r.url)
        if (mitNummern) eintraege.push({ url: r.url, folge_nr: r.folge_nr, staffel: r.staffel })
      }
      /**
       * **„Liegt hier noch was?" ist nicht „wurde das gemeldet?"**
       *
       * `adressen` oben führt nur, was der Datenlauf noch nicht abgeholt hat
       * (`uebernommen = 0`). Die Erweiterung benutzte genau diese Liste, um zu
       * entscheiden, ob ein Titel abgehakt ist — mit der Folge, dass jede
       * übernommene Meldung ihren Titel wieder in die Prüfliste zurückholte.
       *
       * Daniel am 30.08.2026: „3.91 → alles gemeldet, warum eintrag immer noch
       * in liste?" Gemessen an „From Bureaucrat to Villainess": im Briefkasten
       * nicht mehr da, im Datensatz noch ohne Urteil — also gemeldet, geholt,
       * und trotzdem wieder offen. Nach jedem Datenlauf begann die Arbeit von
       * vorn.
       *
       * `gemeldet` beantwortet die Frage, die die Erweiterung wirklich stellt:
       * Ist unter dieser Adresse jemals etwas eingegangen? `DISTINCT`, weil je
       * Staffel und Folge mehrere Zeilen auf dieselbe Adresse zeigen.
       */
      const { results: alle } = await env.DB.prepare(
        `SELECT DISTINCT url FROM pruefung WHERE url IS NOT NULL AND url != ''`,
      ).all<{ url: string }>()
      const gemeldet = (alle ?? []).map((r) => r.url)
      return antwort(
        mitNummern ? { imBriefkasten: je, adressen, gemeldet, eintraege } : { imBriefkasten: je, adressen, gemeldet },
      )
    }

    // Die Pipeline holt sich, was noch nicht übernommen wurde.
    const sucheP = new URL(request.url).searchParams
    const token = sucheP.get('token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

    /*
      **Die Reihenfolge bleibt aufsteigend — daran hängt der Datenlauf.**

      `LIMIT 500` schneidet ab, und die Pipeline arbeitet die ältesten zuerst ab.
      Umgestellt auf absteigend hätte sie bei 562 Meldungen die ältesten 62 nie
      gesehen. Der Deckel ist für sie richtig; er ist nur keine Zählung.

      Zum Nachsehen einzelner Meldungen gibt es deshalb `?plattform=`. Am
      26.08.2026 verdeckten 558 Disney-Meldungen eine frische Prime-Meldung
      vollständig, und die Suche danach ging zweimal ins Leere.
    */
    const nurPlattform = sucheP.get('plattform')
    const abfrage = nurPlattform
      ? `SELECT id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln,
                serientitel, notiz, teil_von, teil_bis, gemeldet_am
           FROM pruefung WHERE uebernommen = 0 AND plattform = ?
           ORDER BY gemeldet_am LIMIT 500`
      : `SELECT id, plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln,
                serientitel, notiz, teil_von, teil_bis, gemeldet_am
           FROM pruefung WHERE uebernommen = 0
           ORDER BY gemeldet_am LIMIT 500`
    const stmt = env.DB.prepare(abfrage)
    const { results } = await (nurPlattform ? stmt.bind(nurPlattform) : stmt).all()

    return antwort({ pruefungen: results ?? [] })
  }

  if (request.method === 'DELETE') {
    /*
      Falsche Meldungen wirklich entfernen — nicht nur abhaken.

      Abhaken heißt „ein Lauf hat es eingearbeitet"; die Route `?gemeldet=`
      zählt solche Meldungen weiter, und das ist richtig. Was falsch war, muss
      dagegen verschwinden, sonst gilt eine Reihe als geprüft, die niemand
      geprüft hat.
    */
    const token = request.headers.get('X-Lauf-Token') ?? ''
    if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)
    let daten: { ids?: number[]; url?: string; nummern?: number[] }
    try {
      daten = (await request.json()) as { ids?: number[]; url?: string; nummern?: number[] }
    } catch {
      return antwort({ error: 'Kein gültiges JSON' }, 400)
    }
    if (Array.isArray(daten.ids) && daten.ids.length) {
      const platzhalter = daten.ids.map(() => '?').join(',')
      const ergebnis = await env.DB.prepare(`DELETE FROM pruefung WHERE id IN (${platzhalter})`)
        .bind(...daten.ids)
        .run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    /*
      Einzelne Folgen einer Adresse — für den Fall, dass nur ein Teil einer
      Reihe neu geprüft werden soll. Bei One Piece waren drei von achtzehn
      Meldungen aus Staffel 1; die übrigen fünfzehn gehören zu anderen
      Staffeln und sollten bleiben.
    */
    if (daten.url && Array.isArray(daten.nummern) && daten.nummern.length) {
      const platzhalter = daten.nummern.map(() => '?').join(',')
      const ergebnis = await env.DB.prepare(
        `DELETE FROM pruefung WHERE url = ? AND folge_nr IN (${platzhalter})`,
      )
        .bind(daten.url, ...daten.nummern)
        .run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    if (daten.url) {
      const ergebnis = await env.DB.prepare('DELETE FROM pruefung WHERE url = ?').bind(daten.url).run()
      return antwort({ ok: true, geloescht: ergebnis.meta?.changes ?? 0 })
    }
    return antwort({ error: 'ids oder url erwartet' }, 400)
  }

  if (request.method !== 'POST') return antwort({ error: 'GET, POST oder DELETE erwartet' }, 405)

  const token = request.headers.get('X-Lauf-Token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

  let daten: Record<string, unknown>
  try {
    daten = (await request.json()) as Record<string, unknown>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

  /**
   * Abhaken, was die Pipeline wirklich eingetragen hat.
   *
   * Vorher markierte der Abruf selbst alles Gelieferte als übernommen — auch
   * eine Meldung, die sich nicht zuordnen ließ. Die war damit still verloren
   * (22.08.2026). Jetzt sagt die Pipeline, was angekommen ist.
   */
  /*
      **Abgehakt ist nicht dasselbe wie eingearbeitet.**

      Am 26.08.2026 hakte der Uebernahme-Lauf 508 Disney-Meldungen ab und
      schrieb daraus einen einzigen Eintrag. Die uebrigen liessen sich nicht
      zuordnen — falsche Adresse im Bestand, abweichende Staffelzahlen — und
      verschwanden trotzdem aus dem Briefkasten. Daniels Arbeit eines ganzen
      Abends war damit unerreichbar.

      Die Zeilen stehen noch in der Datenbank; nur `uebernommen` trennt sie vom
      Briefkasten. Diese Route dreht das zurueck, damit ein berichtigter Lauf
      sie erneut sieht.

      Sie ist ein Werkzeug fuer den Notfall, kein Teil des Ablaufs: Ohne Angabe
      von Plattform und Datum tut sie nichts.
    */
    if (daten.reoeffnen && typeof daten.reoeffnen === 'object') {
      const { plattform, seit } = daten.reoeffnen as { plattform?: string; seit?: string }
      if (!plattform || !seit) return antwort({ error: 'plattform und seit noetig' }, 400)
      const { meta } = await env.DB.prepare(
        `UPDATE pruefung SET uebernommen = 0
           WHERE uebernommen = 1 AND plattform = ? AND gemeldet_am >= ?`,
      )
        .bind(plattform, seit)
        .run()
      return antwort({ ok: true, reoeffnet: meta?.changes ?? 0 })
    }

  /**
   * **Rohfolgen abhaken — sonst wächst die Tabelle für immer.**
   *
   * `pruefung` kennt das seit jeher, `prime_folge` nicht: Der Bau ordnet die
   * Folgen zu, schreibt das Ergebnis ins Repo — und die Zeilen bleiben auf
   * `uebernommen = 0` stehen. Am 29.08.2026 holte jeder Lauf dieselben 5.633
   * Zeilen erneut, davon 3.569 Dubletten aus einem behobenen Fehler.
   *
   * Abgehakt wird, was **zugeordnet** ist. Der Beleg dafür steht committet in
   * `data/prime-zugeordnet.json`; ein Baufehler danach verliert also nichts.
   * Was sich nicht zuordnen ließ, bleibt offen — das ist die Warteschlange, und
   * sie soll bestehen bleiben, bis ein Anker dazukommt.
   */
  if (Array.isArray(daten.rohfolgenUebernommen)) {
    const ids = (daten.rohfolgenUebernommen as unknown[])
      .map(Number)
      .filter((n) => Number.isInteger(n) && n > 0)
    if (!ids.length) return antwort({ ok: true, markiert: 0 })
    /* Dieselbe Stapelgrenze wie unten: D1 bindet höchstens 100 Werte je Anfrage. */
    const STAPEL = 50
    for (let i = 0; i < ids.length; i += STAPEL) {
      const teil = ids.slice(i, i + STAPEL)
      await env.DB.prepare(
        `UPDATE prime_folge SET uebernommen = 1 WHERE id IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(...teil)
        .run()
    }
    return antwort({ ok: true, markiert: ids.length })
  }

  if (Array.isArray(daten.uebernommen)) {
    const ids = (daten.uebernommen as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (!ids.length) return antwort({ ok: true, markiert: 0 })

    /**
     * In Stapeln, nicht in einem Rutsch.
     *
     * D1 begrenzt die gebundenen Werte je Anfrage auf 100. Am 23.08.2026
     * schickte ein Lauf 107 Kennungen und bekam HTTP 500 zurück — die Meldung
     * lautete „sie kommen beim nächsten Lauf erneut", und genau das war das
     * Problem: Was nicht abgehakt wird, wird erneut geholt, erneut
     * geschrieben und scheitert erneut. Der Briefkasten wächst, bis jeder
     * Lauf über dieselbe Grenze stolpert.
     *
     * 50 je Stapel lässt Luft, falls die Grenze je enger wird.
     */
    const STAPEL = 50
    for (let i = 0; i < ids.length; i += STAPEL) {
      const teil = ids.slice(i, i + STAPEL)
      await env.DB.prepare(
        `UPDATE pruefung SET uebernommen = 1 WHERE id IN (${teil.map(() => '?').join(',')})`,
      )
        .bind(...teil)
        .run()
    }
    return antwort({ ok: true, markiert: ids.length })
  }

  const url = String(daten.url ?? '').trim()
  const befund = String(daten.befund ?? '').trim()
  if (!url) return antwort({ error: 'url fehlt' }, 400)
  if (!['dub', 'kein_dub', 'weg'].includes(befund)) {
    return antwort({ error: 'befund muss dub, kein_dub oder weg sein' }, 400)
  }

  /**
   * Wird derselbe Titel zweimal geschickt, gilt der jüngere Blick.
   *
   * **Die Staffel gehört in die Bedingung.** Amazon führt Sammelseiten: Unter
   * `B0GFPBT6FG` liegen alle drei Staffeln von „Oshi no Ko", unterschieden
   * allein durch den Verweis-Parameter (gemessen 23.08.2026). Ohne die
   * Staffel löschte eine Meldung für Staffel 3 die für Staffel 1 — ein Befund
   * verschwände, ohne dass es jemandem auffällt.
   *
   * `IS` statt `=`, weil SQLite bei `NULL = NULL` nichts liefert und die
   * allermeisten Meldungen gar keine Staffelangabe tragen.
   */
  const folgeNr = zahlOderNull(daten.folge_nr)
  const staffelNr = zahlOderNull(daten.staffel)
  /**
   * **Die Seitenkennung gehört in die Ersetzungs-Bedingung.**
   *
   * `url` ist die Adresse aus der Prüfliste — dieselbe für beide Ausgaben eines
   * Titels. Prime führt aber regelmäßig zwei, und sie sind verschiedene
   * Angebote: „My First Girlfriend is a Gal" liegt als Kauftitel mit 11 Folgen
   * und FSK 16 (die KAZÉ-Fassung samt OVA) und über den Crunchyroll-Kanal mit
   * 10 Folgen und FSK 18, mit völlig anderen Folgentiteln (Daniel, 30.08.2026).
   *
   * Ohne diese Bedingung löscht die zweite Meldung die erste, und im Briefkasten
   * bleibt nur eine der beiden Ausgaben übrig.
   *
   * `IS` statt `=`, aus demselben Grund wie bei der Staffel: Ältere Meldungen
   * tragen keine Kennung, und `NULL = NULL` liefert in SQLite nichts.
   */
  const seitenKennung = typeof daten.seiten_kennung === 'string' ? daten.seiten_kennung : null
  await env.DB.prepare(
    folgeNr === null
      ? 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr IS NULL AND staffel IS ?2 AND seiten_kennung IS ?3'
      : 'DELETE FROM pruefung WHERE url = ?1 AND uebernommen = 0 AND folge_nr = ?2 AND staffel IS ?3 AND seiten_kennung IS ?4',
  )
    .bind(
      ...(folgeNr === null ? [url, staffelNr, seitenKennung] : [url, folgeNr, staffelNr, seitenKennung]),
    )
    .run()

  await env.DB.prepare(
    `INSERT INTO pruefung (plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln, serientitel, notiz, gemeldet_am, zugang, abos, teil_von, teil_bis, seiten_kennung)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17)`,
  )
    .bind(
      String(daten.plattform ?? 'unbekannt'),
      url,
      daten.sprachen ? JSON.stringify(daten.sprachen) : null,
      befund,
      daten.titel ? String(daten.titel).slice(0, 200) : null,
      zahlOderNull(daten.folgen),
      // Die Nummer der Folge, auf die sich die Meldung bezieht — daraus bildet
      // die Auswertung Bereiche, statt eine ganze Reihe über einen Kamm zu
      // scheren.
      zahlOderNull(daten.folge_nr),
      staffelNr,
      // Die Aufteilung des Anbieters, als JSON — sie ist der Schlüssel, um die
      // Meldung später einer unserer Staffeln zuzuordnen.
      daten.staffeln ? JSON.stringify(daten.staffeln).slice(0, 4000) : null,
      daten.serientitel ? String(daten.serientitel).slice(0, 200) : null,
      daten.notiz ? String(daten.notiz).slice(0, 500) : null,
      jetztIso(),
      /**
       * Zugangsart und Abos, wie die Seite sie beim Melden auswies.
       *
       * Beides liest die Erweiterung längst aus und zeigt es auf dem Knopf an;
       * abgeschickt wurde es bisher nicht. Bei Prime nennt keine öffentliche
       * Quelle die Zugangsart — deshalb standen dort am 24.08.2026 alle 203
       * Suchadressen auf „Mit Abo", ohne dass es jemand geprüft hatte.
       *
       * Kein Wertebereich erzwungen: Eine Meldung, die an einer Schema-Prüfung
       * scheitert, ist schlechter als eine mit unbekanntem Wert. Die Pipeline
       * entscheidet, was sie damit anfängt.
       */
      daten.zugang ? String(daten.zugang).slice(0, 40) : null,
      daten.abos ? JSON.stringify(daten.abos).slice(0, 1000) : null,
      /*
        Welchen Teil der Anbieter-Liste diese Meldung meint — bei einer Reihe,
        die dort gebündelt liegt. Fehlt im Normalfall.
      */
      zahlOderNull(daten.teil_von),
      zahlOderNull(daten.teil_bis),
      /* Die Seite, auf der wirklich gelesen wurde — trennt zwei Ausgaben desselben Titels. */
      seitenKennung,
    )
    .run()

  /*
    **Die Folgen selbst, roh und ohne Deutung.**

    Bis 3.76 meldete die Erweiterung ein Urteil und warf die Grundlage weg — die
    Folgentitel, Erstausstrahlungsdaten und Laufzeiten, die sie längst gelesen
    hatte. Jede spätere Frage war damit unbeantwortbar, und genau deshalb musste
    sie im Browser entscheiden, was sich dort nicht entscheiden lässt.

    `daten.rohfolgen` ist der neue Weg. Er kommt **neben** dem alten Format an,
    nicht statt seiner: Eine Erweiterung, die ihn noch nicht schickt, meldet
    weiter wie bisher.

    Gespeichert wird ohne Prüfung auf Sinn. Ob eine Nummer stimmt, entscheidet
    der Bau gegen TMDB — hier zählt nur, dass nichts verlorengeht.
  */
  const rohfolgen = Array.isArray(daten.rohfolgen) ? daten.rohfolgen : []
  if (rohfolgen.length) {
    /*
      **Eine neue Meldung ersetzt die alte — sie kommt nicht dazu.**

      Gemessen am 28.08.2026: 5.219 Zeilen in der Tabelle, davon **3.569 allein
      unter „Captain Tsubasa (2018)" — einer Seite mit 91 Folgen. Jede erneute
      Meldung derselben Adresse hing ihre Folgen an, und Daniel hat an dem Titel
      an einem Abend oft gemeldet.

      Die Tabelle daneben macht es seit jeher richtig: `pruefung` loescht die
      noch nicht uebernommenen Zeilen derselben Adresse, bevor sie schreibt. Hier
      fehlte das — ein reines INSERT, und niemandem faellt es auf, weil die
      Zuordnung im Bau die Dubletten stillschweigend mitverarbeitet.

      Uebernommene Zeilen bleiben unberuehrt: Sie sind Geschichte, kein Bestand.
    */
    try {
      await env.DB.prepare('DELETE FROM prime_folge WHERE url = ?1 AND uebernommen = 0').bind(url).run()
    } catch (e) {
      console.error(`prime_folge aufraeumen: ${(e as Error).message}`)
    }
    const jetzt = jetztIso()
    /* Höchstens 500 je Meldung: Eine Staffel hat keine tausend Folgen, und eine
       kaputte Erweiterung soll die Tabelle nicht fluten. */
    const stapel = rohfolgen.slice(0, 500).map((f: Record<string, unknown>) =>
      env.DB.prepare(
        `INSERT INTO prime_folge (url, asin, gti, nummer, titel, erschienen, dauer_sek,
                                  sprachen, untertitel, staffel_text, staffel_nr, gemeldet_am, titel_id)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13)`,
      ).bind(
        url,
        f.asin ? String(f.asin).slice(0, 40) : null,
        f.gti ? String(f.gti).slice(0, 60) : null,
        zahlOderNull(f.nummer),
        f.titel ? String(f.titel).slice(0, 300) : null,
        f.erschienen ? String(f.erschienen).slice(0, 30) : null,
        zahlOderNull(f.dauerSek),
        f.sprachen ? JSON.stringify(f.sprachen).slice(0, 1000) : null,
        f.untertitel ? JSON.stringify(f.untertitel).slice(0, 1000) : null,
        f.staffelText ? String(f.staffelText).slice(0, 120) : null,
        zahlOderNull(f.staffelNr),
        jetzt,
        /*
          **Die Titel-Kennung macht aus einer Suche eine Angabe.**

          Gemessen am 28.08.2026: 1 von 67 Adressen liess sich zuordnen,
          66-mal „kein Titel zu dieser Adresse". Die Suche lief ueber
          `titles.streams.url` — und ein Titel ohne Verweis hat dort nichts
          stehen. Die Erweiterung kennt die Kennung aus ihrem Auftrag; sie
          mitzuschicken kostet ein Feld.
        */
        zahlOderNull(daten.titelId),
      ),
    )
    try {
      await env.DB.batch(stapel)
    } catch (e) {
      /* Die Meldung selbst ist schon gespeichert — ein Fehler hier darf sie
         nicht mitreißen. Ohne Rohfolgen ist der Befund weniger wert, aber gültig. */
      console.error(`prime_folge: ${(e as Error).message}`)
    }
  }

  const offen2 = await env.DB.prepare('SELECT COUNT(*) AS n FROM pruefung WHERE uebernommen = 0').first<{
    n: number
  }>()
  /*
    **Die Anzeige erfährt es sofort, nicht beim nächsten Nachfragen.**

    Über `ctx.waitUntil`, damit die Erweiterung nicht auf den Versand wartet:
    Sie hat ihre Arbeit getan, sobald die Meldung in der Datenbank steht.
  */
  ctx?.waitUntil(ereignisSenden(env, 'pruefung', { plattform: String(daten.plattform ?? 'unbekannt') }))
  return antwort({ ok: true, befund, offen: offen2?.n ?? 0 })
}

export default {
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      // Der Laufstatus wird auch von einer Datei auf dem Schreibtisch gelesen;
      // die hat den Ursprung `null` und käme an der sonstigen Beschränkung nicht vorbei.
      if (url.pathname === '/lauf' || url.pathname === '/pruefung' || url.pathname === '/netzfund') {
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
      case '/cr-zugang':
        return handleCrZugang(request, env)
      case '/land':
        return handleLand(request, env)
      case '/netzfund':
        return handleNetzfund(request, env)
      /*
        **Der Kanal, auf dem die Statusanzeige zuhört.**

        Kein Token: Was hier fließt, ist die Nachricht „es hat sich etwas
        geändert" — keine Daten. Was sich geändert hat, holt die Anzeige über
        die Endpunkte, die sie ohnehin liest.
      */
      case '/ereignisse': {
        if (!env.EREIGNISSE) return json(env, { error: 'Kein Ereignis-Kanal eingerichtet' }, 501)
        if (request.headers.get('Upgrade') !== 'websocket') {
          return json(env, { error: 'WebSocket erwartet' }, 426)
        }
        const stub = env.EREIGNISSE.get(env.EREIGNISSE.idFromName('status'))
        return stub.fetch(request)
      }
      case '/pruefung':
        return handlePruefung(request, env, ctx)
      case '/lauf':
        return handleLauf(request, env, ctx)
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
    /**
     * Welches Land bekommt ein Cron-Lauf?
     *
     * Von Daniels Leitung aus antwortet der Worker aus London und Crunchyroll
     * gibt ihm `DE`; ruft ein Rechner aus den USA denselben Endpunkt auf,
     * läuft er in San Jose und bekommt `US` (gemessen 22.08.2026). Cloudflare
     * führt einen Worker also dort aus, wo die Anfrage ankommt. Ein Cron-Lauf
     * hat keinen Aufrufer — wo er landet, ist damit noch nicht gesagt, und
     * genau das entscheidet, ob sich die Erneuerung des Crunchyroll-Zugangs
     * ohne Daniels Rechner automatisieren lässt.
     */
    ctx.waitUntil(
      crunchyrollLand('cron')
        .then((m) =>
          env.DB.prepare(
            'INSERT INTO netzfund (url, reihe, laenge, felder, proben, gemeldet_am) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
          )
            .bind('messung:cron-land', String(m.land ?? '?'), 0, JSON.stringify(m), '[]', jetztIso())
            .run(),
        )
        .catch((err) => console.error('[land] fehlgeschlagen', err)),
    )
    ctx.waitUntil(
      runMonitor(env, now)
        .then((msg) => console.log(`[monitor] ${msg}`))
        .catch((err) => console.error('[monitor] fehlgeschlagen', err)),
    )
  },
}
