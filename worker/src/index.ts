/**
 * Newsletter-Dienst des Anime-Kalenders.
 *
 *   POST /subscribe          — Anmeldung, verschickt die Bestätigungsmail (Double-Opt-in)
 *   GET  /confirm?token=…    — Bestätigung, ab hier ist das Abo aktiv
 *   GET  /unsubscribe?token=…— Abmeldung, löscht den Datensatz
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

  const row = await env.DB.prepare(
    "SELECT favorites FROM subscribers WHERE pref_token = ?1 AND status = 'active'",
  )
    .bind(token)
    .first<{ favorites: string }>()

  if (!row) return json(env, { error: 'Dieser Abgleich-Schlüssel gehört zu keinem aktiven Abo.' }, 404)
  return json(env, { ok: true, favorites: [...parseIdList(row.favorites)] })
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
      const syncUrl = sub.pref_token
        ? `${env.SITE_URL.replace(/\/$/, '')}/#/newsletter?sync=${sub.pref_token}`
        : undefined
      const mail = digestMail(events, frequency, env.SITE_URL, unsubUrl, {
        favorites,
        syncUrl,
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

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') return new Response(null, { headers: cors(env) })

    switch (url.pathname) {
      case '/subscribe':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handleSubscribe(request, env)
      case '/confirm':
        return handleConfirm(request, env)
      case '/unsubscribe':
        return handleUnsubscribe(request, env)
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
