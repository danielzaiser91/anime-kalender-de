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
 */
import { ereignisSenden } from './ereignisse.ts'
import { zahlOderNull, jetztIso } from './werte.ts'
import { type Env } from './env.ts'
import { verarbeiteStapel } from './pruefung-stapel.ts'
import { speichereRohfolgen } from './pruefung-rohfolgen-speichern.ts'

export async function speicherePruefung({ request, antwort, token, env, ctx }: Kontext) {
  let daten: Record<string, unknown>
  try {
    daten = (await request.json()) as Record<string, unknown>
  } catch {
    return antwort({ error: 'Kein gültiges JSON' }, 400)
  }

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
  /*
    **Stufe 1 des neuen Modells: Verfügbarkeit und Sprache getrennt** (22.09.2026,
    docs/konzept-meldungen-architektur.md). Die Erweiterung schickt `vorhanden`, `ton_de`, `art`;
    ältere Fassungen schicken nur `befund`. Beides wird angenommen, und das jeweils andere abgeleitet:
    `befund` braucht der heutige Einleser.
    **Befristet:** Die Ableitung von `befund` entfällt, sobald Stufe 2 den Einleser ersetzt; die
    Annahme des alten `befund` entfällt, sobald alle Erweiterungen ≥ 4.21.0 melden.
  */
  let vorhanden = daten.vorhanden != null ? String(daten.vorhanden).trim() : ''
  let tonDe = daten.ton_de != null ? String(daten.ton_de).trim() : ''
  let art = daten.art != null ? String(daten.art).trim() : ''
  let befund = String(daten.befund ?? '').trim()
  if (vorhanden) {
    if (!['ja', 'nein'].includes(vorhanden)) return antwort({ error: 'vorhanden muss ja oder nein sein' }, 400)
    if (vorhanden === 'nein') tonDe = 'unbekannt'
    if (!['ja', 'nein', 'unbekannt'].includes(tonDe)) return antwort({ error: 'ton_de muss ja, nein oder unbekannt sein' }, 400)
    /* Eine vorhandene Folge ohne Sprachauskunft ist eine Störung, keine Beobachtung (Szenario 10). */
    if (vorhanden === 'ja' && tonDe === 'unbekannt') return antwort({ error: 'vorhanden ja braucht ton_de ja oder nein' }, 400)
    if (!art) art = 'gemessen'
    if (!['gemessen', 'angenommen'].includes(art)) return antwort({ error: 'art muss gemessen oder angenommen sein' }, 400)
    befund = vorhanden === 'nein' ? 'weg' : tonDe === 'ja' ? 'dub' : 'kein_dub'
  } else {
    if (!['dub', 'kein_dub', 'weg'].includes(befund)) {
      return antwort({ error: 'befund muss dub, kein_dub oder weg sein' }, 400)
    }
    vorhanden = befund === 'weg' ? 'nein' : 'ja'
    tonDe = befund === 'weg' ? 'unbekannt' : befund === 'dub' ? 'ja' : 'nein'
    art = /ANGENOMMEN/.test(String(daten.notiz ?? '')) ? 'angenommen' : 'gemessen'
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
   * 10 Folgen und FSK 18, mit völlig anderen Folgentiteln.
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
    /*
      **`titel_id` sagt, für welchen Auftrag gemeldet wurde — die Adresse sagt es nicht.**

      Anbieter führen denselben Anime unter mehreren Kennungen; wer aus der
      Prüfliste heraus öffnet, weiß trotzdem, welcher Titel gemeint war. Ohne
      dieses Feld musste der Bau die Adresse im Datensatz suchen und fiel sonst
      auf einen Namensvergleich zurück, der ausdrücklich kein Beleg ist — am
      02.09.2026 warteten so 36 Meldungen auf Daniels Bestätigung.
    */
    `INSERT INTO pruefung (plattform, url, sprachen, befund, titel, folgen, folge_nr, staffel, staffeln, serientitel, notiz, gemeldet_am, zugang, abos, teil_von, teil_bis, seiten_kennung, titel_id, such_url, folge, vorhanden, ton_de, art)
     VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9, ?10, ?11, ?12, ?13, ?14, ?15, ?16, ?17, ?18, ?19, ?20, ?21, ?22, ?23)`,
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
      zahlOderNull(daten.titelId ?? daten.titel_id),
      /* Die Suchadresse, unter der der Auftrag stand — siehe Migration 025. */
      daten.suchUrl ? String(daten.suchUrl).slice(0, 500) : null,
      /**
       * **Der Folgentitel — seit Migration 028, und er war die ganze Zeit da.**
       *
       * `melder.js` setzt `folge: stand.folge` in jede Meldung; bei Haikyu!!
       * Staffel 1 Folge 26 steht dort „Haikyu! OVA". Gespeichert wurde er nie —
       * erhoben, übertragen, beim Empfang verworfen.
       *
       * Er ist der Anker, den Nummern nicht ersetzen können: Ein Anbieter mischt
       * Nebenausgaben in seine Staffeln, und über Folgenzahlen allein sind zwei
       * Zerlegungen mit derselben Summe nicht zu unterscheiden (am 10.09.2026
       * real passiert, vier falsche Belege). Ein Wort im Titel entscheidet es.
       */
      daten.folge ? String(daten.folge).slice(0, 200) : null,
      /* Stufe 1 (22.09.2026): Verfügbarkeit, Sprache, gemessen oder angenommen — getrennt. */
      vorhanden,
      tonDe,
      art,
    )
    .run()

  await speichereRohfolgen(env, daten, url, seitenKennung)

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

type Kontext = {
  request: Request<unknown, CfProperties<unknown>>
  antwort: (body: unknown, status?: number) => Response
  token: string
  env: Env
  ctx: ExecutionContext<unknown> | undefined
}

async function speichereStapel({ request, antwort, token, env, ctx }: Kontext, stapel: unknown[]) {
  const ergebnisse = await verarbeiteStapel(stapel, async (einzeln) => {
    if (!einzeln || typeof einzeln !== 'object' || 'stapel' in einzeln) {
      return { ok: false, status: 400, grund: 'Meldung ist kein Objekt oder ein verschachtelter Stapel' }
    }
    const r = await speicherePruefung({
      request: new Request(request.url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'X-Lauf-Token': token },
        body: JSON.stringify(einzeln),
      }),
      antwort,
      token,
      env,
      ctx: undefined,
    })
    const inhalt = (await r.json().catch(() => ({}))) as { befund?: string; error?: string }
    return r.ok ? { ok: true, befund: inhalt.befund ?? null } : { ok: false, status: r.status, grund: inhalt.error ?? 'ohne Grund' }
  })
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
