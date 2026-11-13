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
import type { PlatformId, Release, ReleaseEvent } from '../../shared/types.ts'
import { OFFENE_PFADE, mitEingang } from './auffangnetz.ts'
import { sichereSchnellmessung } from './schnellmesser.ts'
import { handleVerlauf } from './verlauf.ts'
import { ladeKennungen } from './favoriten-kennung.ts'
import { anbieterName } from '../../shared/types.ts'
import { addDays, weekdayIndex } from '../../shared/time.ts'
import { handleFavoritenFeed } from './favoriten-feed.ts'
import { sendeUndZaehle, tagesstand } from './mail-zaehler.ts'
import { checkAllSites, confirmOutages } from './monitor.ts'
import { schreibeStaende, schreibeVerlauf } from './monitor-speicher.ts'
import { ladeMesswerte } from './monitor-statistik.ts'
import {
  BRAND, outageMail, weeklyStatusMail,
  type NeuMitSynchro,
  type ReleaseLink
} from './templates.ts'
import { Ereignisse } from './ereignisse.ts'
import { PUSH_CRON, pushSchnellMitLog, pushStuendlich } from './push-takt.ts'
import { handlePushAbo, handlePushTest } from './push-abo.ts'
import { type Env } from './env.ts'
import { digestFuer, type DigestKontext, type Reihen, type SubscriberRow } from './digest-inhalt.ts'
import { DIGEST_CRON, versendeDigest } from './digest-versand.ts'
import { berlinParts, fehlerLog, jetztIso } from './werte.ts'
import { handlePruefung } from './pruefung.ts'
import { loadNews, weitereAusNews } from './news-quelle.ts'
import { handleLauf } from './lauf.ts'
import { handleCrZugang } from './cr-zugang.ts'
import { tokenAusKopf, tokenGleich } from './lauf-token.ts'
import { mitAnmeldeSchutz } from './anmelde-schutz.ts'
import { digestStand, mitPlatzpruefung, wochenAboFaellig } from './newsletter-kapazitaet.ts'
import { handleBeleg } from './beleg.ts'
import { loescheAbgelaufenes } from './loeschfristen.ts'
import { starteFaelligeLaeufe } from './wecker.ts'
import { cors, json } from './antwort.ts'
import { handleSubscribe, imRahmen, handleRestore, handleSync, handleRhythmus, handleRestoreConfirm, handleConfirm, handleFavoritesGet, handleFavorites, handlePrefsGet, handlePrefsPost, handleUnsubscribeByPref, handleUnsubscribe, handleFeedToken } from './abo-routen.ts'

export { Ereignisse }
export { Schnellmesser } from './schnellmesser.ts'

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
    fehlerLog('Reihen-Zuordnung nicht abrufbar', err)
    return {}
  }
}

/**
 * „Jetzt auch bei X" aus der Nachrichtenseite: je Titel und weiterem Anbieter ein Eintrag
 * mit dem Tag der Meldung. Fehlt die Datei, bleibt der Versand wie bisher.
 */
async function loadWeitereAnbieter(env: Env): Promise<{ id: number; name: string; anbieter: string; am: string }[]> {
  const url = new URL('data/news.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    const eintraege = (await res.json()) as {
      am: string
      titelId: number
      titel: string
      meldungen: { art: string; platform?: string; weiterer?: boolean; teilId?: number; teil?: string }[]
    }[]
    return eintraege.flatMap((e) =>
      e.meldungen
        .filter((m) => m.art === 'neu' && m.weiterer && m.platform)
        .map((m) => ({
          id: m.teilId ?? e.titelId,
          name: m.teil ? `${e.titel} – ${m.teil}` : e.titel,
          anbieter: anbieterName(m.platform as PlatformId),
          am: e.am.slice(0, 10),
        })),
    )
  } catch (err) {
    fehlerLog('News nicht abrufbar', err)
    return []
  }
}

async function loadNeuMitSynchro(env: Env): Promise<NeuMitSynchro[]> {
  const url = new URL('data/neu-mit-synchro.json', env.SITE_URL).toString()
  try {
    const res = await fetch(url, { cf: { cacheTtl: 900 } } as RequestInit)
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return (await res.json()) as NeuMitSynchro[]
  } catch (err) {
    fehlerLog('Neuzugänge mit Synchro nicht abrufbar', err)
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
    fehlerLog('Anbieter-Links nicht abrufbar', err)
    return new Map()
  }
}

/** Der eigentliche Versand — als eigene Funktion, damit /debug/send ihn testen kann. */
export async function runDigest(env: Env, now: Date, force?: 'daily' | 'weekly'): Promise<string> {
  const { hour, iso } = berlinParts(now)
  const sendHour = Number(env.SEND_HOUR_BERLIN || '7')

  const due: ('daily' | 'weekly')[] = []
  if (force) due.push(force)
  else if (hour === sendHour) {
    due.push('daily')
    due.push('weekly') // jeden Tag: welche Wochen-Abos dran sind, entscheidet wochenAboFaellig (Eimer-Tag)
  }
  if (!due.length) return `nichts zu tun (Berliner Stunde ${hour})`

  const allEvents = await loadEvents(env)
  const links = await loadReleaseLinks(env)
  const alleNeu = await loadNeuMitSynchro(env)
  const news = await loadNews(env)
  const weitereAnbieter = weitereAusNews(news)
  const reihen = await loadReihen(env)
  const kennungen = await ladeKennungen(env)
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
      `SELECT id, email, frequency, platforms, favorites, franchise_hinweis, unsub_token, pref_token, last_sent_at, created_at FROM subscribers
       WHERE status = 'active' AND frequency = ?1 ORDER BY last_sent_at`,
    )
      .bind(frequency)
      .all<SubscriberRow>()

    const kontext: DigestKontext = {
      frequency,
      iso,
      until,
      window,
      alleNeu,
      reihen,
      weitereAnbieter,
      kennungen,
      news,
      links,
      workerUrl: env.WORKER_URL || '',
      siteUrl: env.SITE_URL,
    }
    const faellige = frequency === 'weekly' && !force ? (results ?? []).filter((s) => wochenAboFaellig(s, iso)) : (results ?? [])
    const posten = faellige.map((sub) => digestFuer(sub, kontext)).filter((p) => p !== null)
    const stand = await digestStand(env, now)
    const sent = await versendeDigest(env, posten.slice(0, stand.platz), now)

    // Nur Erfolg (oder nichts zu senden) schließt den Tag ab; Abgewiesenes geht am Folgetag raus.
    if (!force && (sent > 0 || !posten.length)) {
      await env.DB.prepare('INSERT OR REPLACE INTO send_log (run_key, sent_at, recipients) VALUES (?1, ?2, ?3)')
        .bind(runKey, now.toISOString(), sent)
        .run()
    }
    log.push(`${runKey}: ${sent} von ${posten.length} Mails (Platz ${stand.platz}; heute Digest ${stand.digestHeute}, Mails ${stand.mailsHeute}, Monat ${stand.mailsMonat}), ${window.length} Termine im Fenster`)
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

  await schreibeStaende(
    env.DB,
    results,
    lines.map((l) => l.failStreak),
    new Map([...before].map(([url, row]) => [url, row.last_ok_at])),
    nowIso,
  )
  await schreibeVerlauf(env.DB, results, nowIso)

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
      await sendeUndZaehle(env, { to, ...mail, fromName: BRAND.monitor.name })
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
      const mail = weeklyStatusMail(lines, env.SITE_URL, await ladeMesswerte(env.DB, nowIso))
      await sendeUndZaehle(env, { to, ...mail, fromName: BRAND.monitor.name })
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
  const token = tokenAusKopf(request)
  if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) {
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
 * sich die Handarbeit.
 *
 * GET gibt die Funde zurück, damit die Pipeline sie auswerten kann. Beides
 * hinter demselben Token wie `/pruefung`.
 */
async function handleNetzfund(request: Request, env: Env): Promise<Response> {
  const offen = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    const token = tokenAusKopf(request)
    if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)
    const { results } = await env.DB.prepare(
      'SELECT id, url, reihe, laenge, felder, proben, gemeldet_am FROM netzfund ORDER BY gemeldet_am DESC LIMIT 200',
    ).all()
    return antwort({ funde: results ?? [] })
  }

  if (request.method !== 'POST') return antwort({ error: 'GET oder POST erwartet' }, 405)
  const token = tokenAusKopf(request)
  if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)

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

/**
 * **Was der Erweiterung auffällt, ohne dass jemand die Konsole öffnet.**
 *
 * Daniel am 10.09.2026: „info bringt nix, du liest nix aus der console aus, ich
 * lese auch nix aus. denk darüber nach auch bezüglich allen anderen derartigen
 * logs, du musst informiert werden über issues."
 *
 * Er hat recht, und der Punkt geht weiter als das eine Log. Die Erweiterung
 * schreibt seit Monaten Diagnosen in die Browserkonsole — „keine Tonspur
 * gelesen", „Folge gehört zu fremder Reihe", „Durchlauf abgebrochen bei
 * M7111". Gelesen hat sie nie jemand: Er schaut dort nicht hin, und ich komme
 * gar nicht daran. Die Information existierte nur, wenn er zufällig hinsah und
 * ein Bildschirmfoto schickte.
 *
 * Der Weg ist derselbe wie bei den Prüfungen, und genau deshalb ist er richtig:
 * melden, abholen, unter `daniel-zum-abarbeiten/` ablegen. Dort lese ich es
 * beim nächsten Durchgang ohnehin.
 *
 * **Was hier nicht landet:** der normale Ablauf. Ein Vorfall ist etwas, das
 * anders lief als vorgesehen — nicht jede geprüfte Folge.
 */
async function handleVorfall(request: Request, env: Env): Promise<Response> {
  const offen = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    const token = tokenAusKopf(request)
    if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)
    const { results } = await env.DB.prepare(
      `SELECT id, plattform, art, url, reihe, folge_nr, staffel, text, version, gemeldet_am
         FROM vorfall ORDER BY gemeldet_am DESC LIMIT 500`,
    ).all()
    return antwort({ vorfaelle: results ?? [] })
  }

  /*
    **Löschen gehört dazu.** Ein abgeholter Vorfall, der liegen bleibt, taucht
    beim nächsten Lauf wieder auf und sieht aus wie ein neuer — dieselbe Falle,
    die `/pruefung` mit seinem DELETE vermeidet.
  */
  if (request.method === 'DELETE') {
    const token = tokenAusKopf(request)
    if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)
    let ids: number[] = []
    try {
      const daten = (await request.json()) as { ids?: unknown }
      ids = Array.isArray(daten.ids) ? daten.ids.map(Number).filter(Number.isFinite) : []
    } catch {
      return antwort({ error: 'Kein gültiges JSON' }, 400)
    }
    if (!ids.length) return antwort({ ok: true, geloescht: 0 })
    const platzhalter = ids.map((_, i) => `?${i + 1}`).join(', ')
    await env.DB.prepare(`DELETE FROM vorfall WHERE id IN (${platzhalter})`)
      .bind(...ids)
      .run()
    return antwort({ ok: true, geloescht: ids.length })
  }

  if (request.method !== 'POST') return antwort({ error: 'GET, POST oder DELETE erwartet' }, 405)
  const token = tokenAusKopf(request)
  if (!env.LAUF_TOKEN || !tokenGleich(token, env.LAUF_TOKEN)) return antwort({ error: 'Nicht erlaubt' }, 403)

  let daten: Record<string, unknown>
  try {
    daten = (await request.json()) as Record<string, unknown>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

  const art = String(daten.art ?? '').slice(0, 40)
  const plattform = String(daten.plattform ?? '').slice(0, 20)
  if (!art || !plattform) return antwort({ error: 'art und plattform fehlen' }, 400)

  /*
    **Dieselbe Sache am selben Tag zählt einmal.** Ein Durchlauf über zwölf
    Folgen, die alle keine Tonspur liefern, ist **ein** Vorfall — zwölf Zeilen
    wären dieselbe Auskunft zwölfmal, und sie würden das Wesentliche zudecken.
    Die Folgennummer geht dabei nicht verloren: Sie steht im Text der ersten.
  */
  const tag = jetztIso().slice(0, 10)
  const schon = await env.DB.prepare(
    `SELECT id FROM vorfall
      WHERE art = ?1 AND plattform = ?2 AND IFNULL(url, '') = ?3 AND substr(gemeldet_am, 1, 10) = ?4`,
  )
    .bind(art, plattform, String(daten.url ?? '').slice(0, 500), tag)
    .first()
  if (schon) return antwort({ ok: true, doppelt: true })

  await env.DB.prepare(
    `INSERT INTO vorfall (plattform, art, url, reihe, folge_nr, staffel, text, version, gemeldet_am)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)`,
  )
    .bind(
      plattform,
      art,
      daten.url ? String(daten.url).slice(0, 500) : null,
      daten.reihe ? String(daten.reihe).slice(0, 60) : null,
      Number.isFinite(Number(daten.folge_nr)) ? Number(daten.folge_nr) : null,
      Number.isFinite(Number(daten.staffel)) ? Number(daten.staffel) : null,
      daten.text ? String(daten.text).slice(0, 500) : null,
      daten.version ? String(daten.version).slice(0, 20) : null,
      jetztIso(),
    )
    .run()

  const anzahl = await env.DB.prepare('SELECT COUNT(*) AS n FROM vorfall').first<{ n: number }>()
  return antwort({ ok: true, vorfaelle: anzahl?.n ?? 0 })
}

async function verteile(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url)

    if (request.method === 'OPTIONS') {
      // Der Laufstatus wird auch aus einer Datei gelesen (Ursprung `null`) — daher `*` für diese Pfade.
      if (OFFENE_PFADE.includes(url.pathname)) {
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
        return mitPlatzpruefung(request, env, () => mitAnmeldeSchutz(request, env, handleSubscribe, imRahmen, cors(env)), cors(env))
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
      case '/beleg':
        return handleBeleg(request, env, url)
      case '/favorites':
        // GET holt, POST schreibt.
        if (request.method === 'GET') return handleFavoritesGet(request, env)
        if (request.method !== 'POST') return json(env, { error: 'GET oder POST erwartet' }, 405)
        return handleFavorites(request, env)
      case '/push/schluessel':
        /* Der öffentliche VAPID-Schlüssel — der Client braucht ihn zum Abonnieren. */
        return json(env, { schluessel: env.VAPID_PUBLIC ?? null })
      case '/push/test':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handlePushTest(request, env, imRahmen, (body, status) => json(env, body, status))
      case '/push/abo':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handlePushAbo(request, env, imRahmen, (body, status) => json(env, body, status))
      case '/push/nachricht': {
        /* Der Service Worker holt beim Push den Text ab — einmal, danach ist er weg. */
        const endpoint = new URL(request.url).searchParams.get('endpoint') ?? ''
        const zeile = await env.DB.prepare('SELECT offen, offen_ziel FROM push_abo WHERE endpoint = ?1')
          .bind(endpoint)
          .first<{ offen: string | null; offen_ziel: string | null }>()
        if (zeile?.offen)
          await env.DB.prepare('UPDATE push_abo SET offen = NULL, offen_ziel = NULL WHERE endpoint = ?1')
            .bind(endpoint)
            .run()
        /* Das Ziel steht seit dem 23.09.2026 daneben: Eine einzelne Meldung öffnet ihr Panel. */
        return json(env, { text: zeile?.offen ?? null, ziel: zeile?.offen_ziel ?? null })
      }
      case '/feed-token':
        if (request.method !== 'POST') return json(env, { error: 'POST erwartet' }, 405)
        return handleFeedToken(request, env)
      case '/feed/favoriten.ics':
        return handleFavoritenFeed(request, env, ctx, cors(env))
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
        // Versand von Hand auslösen. Nur mit dem Secret DEBUG_TOKEN; ohne Secret abgeschaltet.
        const token = tokenAusKopf(request)
        if (!env.DEBUG_TOKEN || !tokenGleich(token, env.DEBUG_TOKEN)) {
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
        if (!env.DEBUG_TOKEN || !tokenGleich(tokenAusKopf(request), env.DEBUG_TOKEN)) return json(env, { error: 'Nicht erlaubt' }, 403)
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
      case '/verlauf':
        return json(env, await handleVerlauf(env))
      case '/cr-zugang':
        return handleCrZugang(request, env)
      case '/land':
        return handleLand(request, env)
      case '/netzfund':
        return handleNetzfund(request, env)
      /*
        **Was der Erweiterung auffaellt** — siehe handleVorfall(). Der Weg ist
        derselbe wie bei den Pruefungen: melden, abholen, ablegen.
      */
      case '/vorfall':
        return handleVorfall(request, env)
      /*
        **Der Kanal, auf dem die Statusanzeige zuhört.** Kein Token: Hier fließt nur die Nachricht
        „es hat sich etwas geändert", keine Daten — die holt die Anzeige über ihre Endpunkte.
      */
      case '/ereignisse': {
        if (!env.EREIGNISSE) return json(env, { error: 'Kein Ereignis-Kanal eingerichtet' }, 501)
        if (request.headers.get('Upgrade') !== 'websocket') {
          return json(env, { error: 'WebSocket erwartet' }, 426)
        }
        const stub = env.EREIGNISSE.get(env.EREIGNISSE.idFromName('status'))
        return stub.fetch(request)
      }
      case '/pruefung': {
        return await handlePruefung(request, env, ctx)
      }
      case '/lauf':
        return handleLauf(request, env, ctx)
      case '/health': {
        ctx.waitUntil(sichereSchnellmessung(env.SCHNELLMESSER).catch(() => {})) // stellt den Taktgeber der Schnellmessung sicher
        const count = await env.DB.prepare(
          "SELECT COUNT(*) AS n FROM subscribers WHERE status = 'active'",
        ).first<{ n: number }>()
        return json(env, { ok: true, activeSubscribers: count?.n ?? 0, heute: await tagesstand(env), newsletter: await digestStand(env, new Date()) })
      }
      default:
        return json(env, { error: 'Unbekannter Pfad' }, 404)
    }
}

const digestMitLog = (env: Env, now: Date) =>
  runDigest(env, now)
    .then((msg) => console.log(`[digest] ${msg}`))
    .catch((err) => fehlerLog('[digest] fehlgeschlagen', err))

export default {
  fetch: (request: Request, env: Env, ctx: ExecutionContext): Promise<Response> =>
    mitEingang(request, env, cors(env), (e) => verteile(request, e, ctx)),

  /** Der Digest hat einen eigenen Trigger und damit eigene 50 Unteraufrufe; alles Übrige teilt sich den stündlichen. */
  async scheduled(event: ScheduledController, env: Env, ctx: ExecutionContext): Promise<void> {
    const now = new Date(event.scheduledTime)
    if (event.cron === DIGEST_CRON) {
      ctx.waitUntil(digestMitLog(env, now))
      return
    }
    if (event.cron === PUSH_CRON) return ctx.waitUntil(pushSchnellMitLog(env, now, () => loadEvents(env)))
    ctx.waitUntil(sichereSchnellmessung(env.SCHNELLMESSER).catch((e) => fehlerLog('[schnell]', e))); ctx.waitUntil(loescheAbgelaufenes(env, now)) // Löschfristen der Datenschutzerklärung
    ctx.waitUntil(starteFaelligeLaeufe(env, now).catch((e) => fehlerLog('[wecker]', e))) // Newsletter und Überwachung laufen getrennt, fällt eines aus, laufen die anderen weiter
    // Welches Land bekommt ein Cron-Lauf? Entscheidet, ob sich die Erneuerung des Crunchyroll-Zugangs ohne Daniels Rechner automatisieren lässt.
    ctx.waitUntil(
      crunchyrollLand('cron')
        .then((m) =>
          env.DB.prepare(
            'INSERT INTO netzfund (url, reihe, laenge, felder, proben, gemeldet_am) VALUES (?1, ?2, ?3, ?4, ?5, ?6)',
          )
            .bind('messung:cron-land', String(m.land ?? '?'), 0, JSON.stringify(m), '[]', jetztIso())
            .run(),
        )
        .catch((err) => fehlerLog('[land] fehlgeschlagen', err)),
    )
    ctx.waitUntil(
      pushStuendlich(env, now, () => loadEvents(env), () => loadNews(env))
        .then((msg) => console.log(`[push] ${msg}`))
        .catch((err) => fehlerLog('[push] fehlgeschlagen', err)),
    )
    ctx.waitUntil(
      runMonitor(env, now)
        .then((msg) => console.log(`[monitor] ${msg}`))
        .catch((err) => fehlerLog('[monitor] fehlgeschlagen', err)),
    )
  },
}
