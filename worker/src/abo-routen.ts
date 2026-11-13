/** Abo-Routen des Newsletter-Dienstes: Anmeldung, Bestätigung, Abgleich, Wiederherstellung, Einstellungen, Abmeldung. */
import { type Env } from './env.ts'
import { json, baseUrl } from './antwort.ts'
import { schreibeFavoriten, leseFavoriten, ladeKennungen, zaehleFavoriten } from './favoriten-kennung.ts'
import { EMAIL_RE } from './anmelde-schutz.ts'
import { confirmMail, restoreMail, page } from './templates.ts'
import { sendeUndZaehle } from './mail-zaehler.ts'
import { fehlerLog } from './werte.ts'

export async function handleSubscribe(request: Request, env: Env): Promise<Response> {
  let payload: { email?: string; frequency?: string; platforms?: string[]; favorites?: number[]; ak?: number }
  try {
    payload = await request.json()
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }

  const email = (payload.email ?? '').trim().toLowerCase()
  const frequency = payload.frequency === 'daily' ? 'daily' : 'weekly'
  const platforms = (payload.platforms ?? []).filter((p) => /^[a-z]+$/.test(p)).join(',')
  const favorites = schreibeFavoriten(payload.favorites, payload.ak)

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
   * Ein sofortiges `ON CONFLICT(email) DO UPDATE` ließe jeden, der eine fremde
   * Adresse ins Formular tippt, ohne einen Klick die Einstellungen und gemerkten
   * Titel eines anderen Menschen ersetzen.
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
    await sendeUndZaehle(env, { to: email, ...mail })
  } catch (err) {
    fehlerLog('Versand der Bestätigungsmail fehlgeschlagen', err)
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
export async function imRahmen(env: Env, key: string, grenze: number, fensterMinuten: number): Promise<boolean> {
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
export async function handleRestore(request: Request, env: Env): Promise<Response> {
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
    await sendeUndZaehle(env, { to: email, ...restoreMail(url) })
  } catch (err) {
    // Auch ein Fehlschlag beim Versand ändert die Antwort nicht — sonst
    // verriete die Fehlermeldung, dass es die Adresse gibt.
    fehlerLog('Wiederherstellungsmail fehlgeschlagen', err)
  }
  return immerGleich
}

/**
 * Löst den befristeten Abgleich-Link aus einer Newsletter-Mail ein.
 *
 * Der `pref_token` gilt unbefristet — stünde er in der Mail, könnte jeder, der eine
 * weitergeleitete Mail oder einen Screenshot sah, die gemerkten Titel dauerhaft
 * ändern. Deshalb verlässt der Dauerschlüssel den Server nicht. In der Mail steht
 * ein eigener, nach dreißig Tagen verfallender Schlüssel; erst sein Einlösen
 * übergibt den `pref_token` an den Browser. Anders als beim Wiederherstellen
 * wird er **nicht** sofort entwertet: Dieselbe Mail auf zwei Geräten zu öffnen
 * ist ein normaler Vorgang, kein Angriff.
 */
export async function handleSync(request: Request, env: Env): Promise<Response> {
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
export async function handleRhythmus(request: Request, env: Env): Promise<Response> {
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
export async function handleRestoreConfirm(request: Request, env: Env): Promise<Response> {
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

export async function handleConfirm(request: Request, env: Env): Promise<Response> {
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
 * Ohne ihn nützte auch der beste Wiederherstellungslink nichts: Er brächte den
 * Schlüssel, aber keine Daten.
 *
 * Der Schlüssel ist der Ausweis. Wer ihn hat, hat ihn aus einer Mail an genau
 * dieses Postfach — dieselbe Grenze wie überall sonst hier.
 */
export async function handleFavoritesGet(request: Request, env: Env): Promise<Response> {
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
   * informieren dich über deine hinterlegte Newsletter-E-Mail-Adresse: …".
   * Das ist kein Datenleck — der Schlüssel liegt nur in
   * dem Browser, in dem das Abo bestätigt wurde, und er beantwortet ohnehin
   * schon die schärfere Frage, ob es zu dieser Adresse ein Abo gibt.
   */
  return json(env, { ok: true, favorites: [...leseFavoriten(row.favorites, await ladeKennungen(env))], email: row.email })
}

export async function handleFavorites(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string; favorites?: number[]; ak?: number }
  try {
    payload = await request.json()
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }

  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)

  const favorites = schreibeFavoriten(payload.favorites, payload.ak)
  const result = await env.DB.prepare(
    "UPDATE subscribers SET favorites = ?1, favorites_at = ?2 WHERE pref_token = ?3 AND status = 'active'",
  )
    .bind(favorites, new Date().toISOString(), token)
    .run()

  if (!result.meta.changes) {
    return json(env, { error: 'Dieser Abgleich-Schlüssel gehört zu keinem aktiven Abo.' }, 404)
  }
  return json(env, { ok: true, count: zaehleFavoriten(favorites) })
}

/**
 * Abmelden aus dem verbundenen Browser heraus.
 *
 * Der Abmeldelink aus der Mail trägt den `unsub_token`, die Seite kennt aber
 * nur den `pref_token`. Wer verbunden war, musste deshalb erst eine alte Mail
 * heraussuchen — dabei weiß die Seite in dem Moment genau, um welches Abo es
 * geht.
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
export async function handlePrefsGet(request: Request, env: Env): Promise<Response> {
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

export async function handlePrefsPost(request: Request, env: Env): Promise<Response> {
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

export async function handleUnsubscribeByPref(request: Request, env: Env): Promise<Response> {
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

export async function handleUnsubscribe(request: Request, env: Env): Promise<Response> {
  const token = new URL(request.url).searchParams.get('token') ?? ''
  const result = await env.DB.prepare('DELETE FROM subscribers WHERE unsub_token = ?1').bind(token).run()
  if (!result.meta.changes) {
    return page('Nichts zu tun', 'Zu diesem Link gibt es kein Abo mehr — vermutlich schon abgemeldet.', env.SITE_URL)
  }
  return page('Abgemeldet', 'Deine Adresse wurde gelöscht. Du bekommst keine Mails mehr von uns.', env.SITE_URL)
}

/**
 * **Persönlicher Kalender-Feed: nur die Termine der eigenen Favoriten** (18.09.2026,
 * Feature-Vergleich: Simkl). Die Sammelfeeds tragen hunderte Termine; wer drei Titel
 * verfolgt, will drei im Kalender.
 *
 * Die Adresse trägt `feed_token`, nicht den Abgleich-Schlüssel: Sie liegt dauerhaft bei
 * einem fremden Kalenderdienst, und wer sie sieht, soll damit nur lesen können
 * (Migration 031). `POST /feed-token` gibt sie aus, mit `neu: true` wird sie ersetzt —
 * die alte Adresse ist danach tot.
 */
export async function handleFeedToken(request: Request, env: Env): Promise<Response> {
  let payload: { token?: string; neu?: boolean }
  try {
    payload = await request.json()
  } catch {
    return json(env, { error: 'Ungültige Anfrage.' }, 400)
  }
  const token = (payload.token ?? '').trim()
  if (!token) return json(env, { error: 'Kein Abgleich-Schlüssel übergeben.' }, 400)
  if (!(await schluesselErneuert(env, token))) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  const row = await env.DB.prepare("SELECT feed_token FROM subscribers WHERE pref_token = ?1 AND status = 'active'")
    .bind(token)
    .first<{ feed_token: string | null }>()
  if (!row) return json(env, { error: SCHLUESSEL_UNGUELTIG }, 404)
  let feed = row.feed_token
  if (!feed || payload.neu) {
    feed = crypto.randomUUID()
    await env.DB.prepare("UPDATE subscribers SET feed_token = ?1 WHERE pref_token = ?2 AND status = 'active'")
      .bind(feed, token)
      .run()
  }
  return json(env, { ok: true, feedToken: feed })
}
