/**
 * **Eine Meldung speichern — und aufräumen, was ihre Adresse schon hat.**
 *
 * ## Warum die Löschanfragen den Index erzwingen (28.09.2026)
 *
 * `wrangler d1 insights` für die 24 Stunden des Kontingent-Ausfalls nennt **zwei** Anweisungen aus
 * dieser Datei unter den größten Lesern:
 *
 *     DELETE FROM prime_folge WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND gti = ?3
 *     DELETE FROM prime_folge WHERE url = ?1 AND plattform = ?2 AND uebernommen = 0 AND seiten_kennung IS ?3
 *     537 Aufrufe · im Mittel 3430 gelesene Zeilen · 1,84 Mio. (26 % des Tageskontingents)
 *
 * **Beide** nahmen denselben falschen Weg: `EXPLAIN QUERY PLAN` zeigte
 * `prime_folge_plattform (plattform=?, uebernommen=?)` — also erst alle offenen Prime-Folgen, dann
 * die Kennung prüfen. Die passenden Indizes waren vorhanden (`prime_folge_gti` aus Migration 038,
 * `prime_folge_seite` aus 042) und leisten eine Punktabfrage (gemessen: eine reine gti-Suche liest
 * 0 Zeilen). Mit `INDEXED BY` steht im Plan `SEARCH … (gti=?)` bzw. `(seiten_kennung=?)`.
 * Das Verhalten bleibt dasselbe: Die Bedingungen gelten weiter, nur der Weg dorthin ist ein anderer.
 * Seit 12.10.2026 stehen diese Bedingungen als SELECT (mit Hash) in `rohfolgen-abgleich.ts`.
 */
import { ereignisSenden } from './ereignisse.ts'
import { type Env } from './env.ts'
import { verarbeiteStapel } from './pruefung-stapel.ts'
import { speichereRohfolgen } from './pruefung-rohfolgen-speichern.ts'
import { istMeldung, mitTagesdeckel, type Zeilen } from './tagesdeckel.ts'
import { exporteVerwerfen } from './export-speicher.ts'
import { loescheOffene } from './pruefung-ersetzen.ts'
import { fuegePruefungEin } from './pruefung-einfuegen.ts'
import { rohfolgeFuerMeldung, rohfolgeFuerZeile } from './pruefung-rohfolge-spalte.ts'
import { leiteAb } from './pruefung-ableiten.ts'
import { mitTitelzeilenAuftrag, titelzeileOderNull } from './titelzeile-speichern.ts'
import { titelzeilenImStapel } from './titelzeile-stapel.ts'
import { abhakAnweisungen, hakeRohfolgenAb } from './rohfolgen-abhaken.ts'
import { adressenDerMeldung, verwirfGemeldet } from './pruefung-gemeldet-cache.ts'
import { pruefeUnveraendert, ladeOffeneHashes, folgeVon, type OffeneHashes } from './pruefung-unveraendert.ts'

export async function speicherePruefung(kontext: Kontext) {
  let daten: Record<string, unknown>
  try {
    daten = (await kontext.request.json()) as Record<string, unknown>
  } catch {
    return kontext.antwort({ error: 'Kein gültiges JSON' }, 400)
  }
  /* Aufträge der Pipeline (abhaken, wieder öffnen) bleiben unter dem Tagesdeckel frei. */
  if (!istMeldung(daten)) return await speichereAuftrag(kontext, daten)
  const geschrieben = { zeilen: 0 }
  try {
    const beiZeilen = (z: Zeilen) => void (geschrieben.zeilen = z.geschrieben)
    return await mitTagesdeckel({ ...kontext, beiZeilen }, async (k) => {
      const folgen = typeof daten.url === 'string' ? [folgeVon(daten)] : []
      return await speichereDaten({ ...k, offene: await ladeOffeneHashes(k.env, folgen) }, daten)
    })
  } finally {
    /* Ihre Antwort auf `?gemeldet=` hat sich geändert; auch nach einer Ausnahme, es kann teilweise geschrieben sein. */
    await verwirfGemeldet(kontext.request.url, adressenDerMeldung(daten))
    /* Die Auszüge des Baus ändern sich nur, wenn die Meldung Zeilen geschrieben hat (eine unveränderte schreibt keine). */
    if (geschrieben.zeilen > 0) await exporteVerwerfen(kontext.env)
  }
}

/** Abhaken und Wiederöffnen ändern nur `uebernommen`, das allein der Auszug `offen-*` enthält. */
async function speichereAuftrag(kontext: Kontext, daten: Record<string, unknown>) {
  const liste = (v: unknown) => Array.isArray(v) && v.length > 0
  const aendert = liste(daten.uebernommen) || liste(daten.rohfolgenUebernommen) || Boolean(daten.reoeffnen)
  let abgelehnt = false
  try {
    const antwort = await mitTitelzeilenAuftrag(kontext.env, daten, () => speichereDaten(kontext, daten))
    abgelehnt = !antwort.ok
    return antwort
  } finally {
    /*
      Auch nach einer Ausnahme: Ein Teil kann schon geschrieben sein. Ohne Marke lieferte der Auszug `offen-*` dem
      nächsten Bau dieselben Ids, und jeder Bau hakte sie erneut ab (16.10.2026: 22.557 Rohfolgen in jedem Bau).
    */
    if (aendert && !abgelehnt) await exporteVerwerfen(kontext.env, 'offen')
  }
}

/** Eine geparste Meldung — oder ein Auftrag der Pipeline (abhaken, wieder öffnen) — speichern. */
export async function speichereDaten({ request, antwort, token, env, ctx, offene, ohneTitelzeile }: Kontext, daten: Record<string, unknown>) {
  const titelzeile = ohneTitelzeile ? null : await titelzeileOderNull({ env, ctx, antwort }, daten)
  if (titelzeile) return titelzeile
  /*
    **Ein Stapel: mehrere Meldungen in einer Anfrage**.
    Die Randprobe einer Netflix-Staffel schickte je Folge eine Anfrage — 25 Folgen, 25 Rundreisen.

    Jedes Element läuft durch genau denselben Weg wie eine Einzelmeldung (dieselbe Funktion,
    gleichzeitig), damit es keine zweite Fassung der Annahme gibt. Ein Ereignis für alle, und die
    Cache-Marke schreibt `handlePruefung` einmal am Ende — nicht je Meldung (siehe pruefung-stapel.ts).

    **Höchstens 10 je Stapel — eine Größengrenze, kein gemessenes Limit.** Die Doku nennt 50
    D1-Abfragen je Aufruf im kostenlosen Plan, jede `batch`-Anweisung einzeln gezählt
    (developers.cloudflare.com/d1/platform/limits, gelesen 25.09.2026). Das greift hier nicht:
    Eine Prime-Meldung vom 19.09.2026 schrieb 90 Rohfolgen in einem Aufruf, also rund 93
    Anweisungen (gezählt in `prime_folge`, 25.09.2026). Eine Netflix-Meldung braucht 4. Die
    Erweiterung schickt mehrere Stapel gleichzeitig, deshalb bringt eine höhere Grenze wenig.
  */
  if (Array.isArray(daten.stapel)) {
    const stapel = daten.stapel as unknown[]
    if (!stapel.length || stapel.length > PRUEFUNG_STAPEL_HOECHSTENS) {
      return antwort({ error: `stapel braucht 1 bis ${PRUEFUNG_STAPEL_HOECHSTENS} Meldungen` }, 400)
    }
    return await speichereStapel({ request, antwort, token, env, ctx }, stapel)
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
    await hakeRohfolgenAb(env, ids)
    return antwort({ ok: true, markiert: ids.length })
  }

  if (Array.isArray(daten.uebernommen)) {
    const ids = (daten.uebernommen as unknown[]).map(Number).filter((n) => Number.isInteger(n) && n > 0)
    if (!ids.length) return antwort({ ok: true, markiert: 0 })

    /**
     * D1 begrenzt die gebundenen Werte je Anweisung auf 100 (am 23.08.2026 scheiterte ein Lauf mit 107 Kennungen
     * an HTTP 500): je 50 Ids eine Anweisung, alle in einem `batch`, nur offene Zeilen (Begründung: `rohfolgen-abhaken.ts`).
     */
    await env.DB.batch(abhakAnweisungen(env, 'pruefung', 'uebernommen', ids))
    return antwort({ ok: true, markiert: ids.length })
  }

  /*
    **Welche Ausgaben zu einem Suchauftrag gehören — vom Menschen bestätigt.**

    Prime führt denselben Anime regelmäßig zweimal (Kanal-Abo und Kauftitel).
    Welche Karten dasselbe Werk meinen, sieht nur ein Mensch; er kreuzt sie auf
    der Trefferliste an, und der Auftrag gilt erst als erledigt, wenn jede
    gemeldet ist.

    Das gehört hierher, nicht in den Browser: Der erste Anlauf legte es in
    `sessionStorage` ab und war nach einem Neuladen weg (02.09.2026). Daniels
    Regel vom 28.08.2026: „kein localstorage dafür … single source of truth."
  */
  /*
    **Vor der Pflichtfeld-Prüfung — eine Erwartung hat keine `url`.**

    Der erste Einbau stand hinter `if (!url) return`, und der Worker antwortete
    mit „url fehlt": Die Bestätigung meldet keinen Befund zu einer Adresse,
    sondern welche Ausgaben zusammengehören. Am Knopf stand deshalb „Auswahl
    bestätigen — nicht angekommen", und die Anzeige war
    ehrlich: Es kam wirklich nichts an.
  */
  if (daten.erwartung && typeof daten.erwartung === 'object') {
    const e = daten.erwartung as { suchUrl?: unknown; kennungen?: unknown }
    const suchUrl = e.suchUrl ? String(e.suchUrl).slice(0, 500) : null
    if (suchUrl) {
      const liste = Array.isArray(e.kennungen)
        ? e.kennungen.map((k) => String(k).slice(0, 40)).filter(Boolean).slice(0, 20)
        : []
      if (liste.length) {
        await env.DB.prepare(
          `INSERT INTO such_erwartung (such_url, kennungen, gesetzt_am) VALUES (?1, ?2, ?3)
           ON CONFLICT(such_url) DO UPDATE SET kennungen = ?2, gesetzt_am = ?3`,
        )
          .bind(suchUrl, JSON.stringify(liste), new Date().toISOString())
          .run()
      } else {
        /* Leere Liste heißt zurücknehmen — das ↺ neben dem Bestätigen-Knopf. */
        await env.DB.prepare('DELETE FROM such_erwartung WHERE such_url = ?1').bind(suchUrl).run()
      }
      return antwort({ ok: true, erwartung: liste.length })
    }
  }

  const url = String(daten.url ?? '').trim()
  if (!url) return antwort({ error: 'url fehlt' }, 400)
  const abgeleitet = leiteAb(daten)
  if ('fehler' in abgeleitet) return antwort({ error: abgeleitet.fehler }, 400)
  const { befund, vorhanden, tonDe, art } = abgeleitet
  /* Dieselbe Folge zweimal geschickt: der jüngere Blick gilt (Schlüssel und Begründung: `folgeVon`). */
  const { folgeNr, staffelNr, seitenKennung } = folgeVon(daten)
  /* Dieselbe Meldung wie die offene Zeile: nichts zu schreiben (pruefung-unveraendert.ts). */
  const { hash, unveraendert } = await pruefeUnveraendert(env, offene, daten, { url, folgeNr, staffelNr, seitenKennung })
  if (unveraendert) {
    return antwort({ ok: true, befund, unveraendert: true })
  }
  /* Netflix und Disney+: die eine Rohfolge steht in der Zeile der Meldung (Migration 054), `prime_folge` bleibt leer. */
  const rohfolge = await rohfolgeFuerMeldung(daten, url, seitenKennung)
  /* Rohfolgen vor der Zeile, deren Hash den nächsten Klick „unveraendert“ macht (sonst Verlust bei D1-Export, 16.10.2026). */
  if (rohfolge === null) await speichereRohfolgen(env, daten, url, seitenKennung)
  await loescheOffene(env, offene, { url, folgeNr, staffelNr, seitenKennung })
  const roh = rohfolgeFuerZeile(offene, { url, folgeNr, staffelNr, seitenKennung }, rohfolge)
  await fuegePruefungEin(env, daten, url, { befund, vorhanden, tonDe, art, staffelNr, seitenKennung, hash, ...roh })

  /*
    Bis zum 24.09.2026 zählte hier jede Meldung alle offenen Meldungen nach (`COUNT(*) … WHERE
    uebernommen = 0`) und schickte die Zahl zurück. Kein Melder las sie; an jenem Tag waren es
    1.904 Zählungen und 560.000 gelesene Zeilen — ein Zehntel des Tageskontingents.
  */
  /*
    **Die Anzeige erfährt es sofort, nicht beim nächsten Nachfragen.**

    Über `ctx.waitUntil`, damit die Erweiterung nicht auf den Versand wartet:
    Sie hat ihre Arbeit getan, sobald die Meldung in der Datenbank steht.
  */
  ctx?.waitUntil(ereignisSenden(env, 'pruefung', { plattform: String(daten.plattform ?? 'unbekannt') }))
  return antwort({ ok: true, befund })
}

export type Kontext = {
  request: Request<unknown, CfProperties<unknown>>
  antwort: (body: unknown, status?: number) => Response
  token: string
  env: Env
  ctx: ExecutionContext<unknown> | undefined
  /** Hashes der offenen Zeilen der gemeldeten Adressen, einmal je Aufruf geladen. */
  offene?: OffeneHashes
  /** Im Stapel schon entschieden (`titelzeile-stapel.ts`): diese Meldung geht den bisherigen Weg. */
  ohneTitelzeile?: boolean
}

async function speichereStapel({ request, antwort, token, env, ctx }: Kontext, stapel: unknown[]) {
  /* Folgen in Titelzeilen gebündelt je Titel (Begründung in titelzeile-stapel.ts), der Rest einzeln wie bisher. */
  const inTitelzeile = await titelzeilenImStapel(env, stapel)
  const rest = stapel.filter((_, i) => !inTitelzeile.has(i))
  const mitUrl = rest.filter((m): m is Record<string, unknown> => typeof (m as { url?: unknown } | null)?.url === 'string')
  const offene = await ladeOffeneHashes(env, mitUrl.map(folgeVon))
  const uebrige = await verarbeiteStapel(rest, async (einzeln) => {
    if (!einzeln || typeof einzeln !== 'object' || 'stapel' in einzeln) {
      return { ok: false, status: 400, grund: 'Meldung ist kein Objekt oder ein verschachtelter Stapel' }
    }
    const r = await speichereDaten({ request, antwort, token, env, ctx: undefined, offene, ohneTitelzeile: true }, einzeln as Record<string, unknown>)
    const inhalt = (await r.json().catch(() => ({}))) as { befund?: string; error?: string }
    return r.ok ? { ok: true, befund: inhalt.befund ?? null } : { ok: false, status: r.status, grund: inhalt.error ?? 'ohne Grund' }
  })
  const ergebnisse = stapel.map((_, i) => inTitelzeile.get(i) ?? uebrige.shift()!)
  const erste = stapel[0] as Record<string, unknown>
  ctx?.waitUntil(ereignisSenden(env, 'pruefung', { plattform: String(erste?.plattform ?? 'unbekannt') }))
  return antwort({ ok: true, ergebnisse })
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
const PRUEFUNG_STAPEL_HOECHSTENS = 10
