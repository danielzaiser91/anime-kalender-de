/**
 * Der Laufstatus — was läuft, was fertig ist, was der Verlauf zeigt.
 *
 * Eigenes Modul seit dem 28.09.2026 (vorher in `index.ts`, das über die Dateigrenze wuchs).
 * Inhalt unverändert, bis auf die Kürzung der Übersicht auf laufende Einträge und die zwei
 * Verlaufs-Abfragen (`?verlauf=<Workflow>` und die Kästchenreihe je Lauf-Art).
 */
import { type Env } from './env.ts'
import { jetztIso, zahlOderNull } from './werte.ts'
import { SQL_AUFRAEUMEN, SQL_EINE_ART, SQL_LAEUFE_LAUFEND, SQL_VERLAUF, LAUF_ARTEN } from './lauf-sql.ts'
import { ereignisSenden } from './ereignisse.ts'
import { crZugangAuffrischen } from './cr-zugang.ts'

/**
 * **Was gerade läuft — und was die Kacheln sonst zeigen** (28.09.2026 umgebaut).
 *
 * Bis heute lieferte diese Abfrage die offenen und frisch fertigen Läufe der letzten drei Tage.
 * Daniel am 21.08.2026: „fertige statuse sollen verschwinden, vorallem wenn sie von dir
 * abgenommen und weiterverarbeitet wurden." Die Regel war: „ok" und „abgebrochen" fielen nach
 * dreißig Minuten heraus, „fehler" und „warnung" blieben stehen, bis ein späterer grüner Lauf
 * desselben Workflows sie aufhob (`NOT EXISTS … spaeter.zustand = 'ok'`). Anlass für die
 * Unterabfrage war der 27.08.2026: drei rote Deploys von 15:40 Uhr standen noch da, als ihre
 * Ursache längst weggeräumt und derselbe Workflow zehnmal grün gelaufen war.
 *
 * Mit den Kacheln („alle Lauf-Arten immer sichtbar") trägt der **Verlauf** diese Aufgabe: Der
 * Stand je Lauf-Art steht in `verlauf`, die Liste hier führt nur noch, was **läuft** — daran
 * hängen Fortschritt und die Erkennung eines hängenden Laufs.
 *
 * Das ist zugleich billiger. Die alte Abfrage scannte die ganze Tabelle samt Unterabfrage; bei
 * erschöpftem Tageskontingent (28.09.2026) fiel genau sie aus, während der kleine Verlaufs-Abruf
 * mit Index weiter antwortete — gemessen, nicht vermutet.
 *
 * Die Zustände bleiben, wie sie sind: `laeuft`, `ok`, `warnung` (durchgelaufen, aber etwas
 * aussortiert, seit 17.09.2026), `fehler` (bleibt rot, bis jemand ihn ansieht), `abgebrochen`
 * (meist gewollt — der Deploy bricht den vorigen Lauf ab) und `erledigt` (abgenommen).
 */
async function laufUebersicht(env: Env, request: Request, ctx?: ExecutionContext) {
  // Was älter als drei Tage ist, würde die Anzeige nur verstopfen — ein hängender
  // Lauf bleibt so lange sichtbar, dann verschwindet auch er.
  const { results } = await env.DB.prepare(SQL_LAEUFE_LAUFEND).all()
  // Die Gelegenheit nutzen: Diese Anfrage kommt aus Daniels Browser, also aus
  // Deutschland — und nur von dort gibt Crunchyroll ein deutsches Paket her.
  ctx?.waitUntil(crZugangAuffrischen(env, request.cf?.colo as string | undefined))
  return {
    jetzt: jetztIso(),
    laeufe: results ?? [],
    /* Die Kästchenreihe im Gitter — je Lauf-Art die letzten Ergebnisse, eine Abfrage. */
    verlauf: await letzteZustaende(env),
  }
}

export async function handleLauf(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const offen = { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  if (request.method === 'GET') {
    /*
      **Der Verlauf einer Lauf-Art** (28.09.2026, Daniel: „alle läufe der vergangenheit, letzter
      lauf, aktueller lauf"). Die Übersicht darunter blendet Fertiges nach dreißig Minuten aus —
      für die Detailseite ist genau das der Zweck. Kostet nur die Zeilen, die sie zeigt.
    */
    const adresse = new URL(request.url)
    const art = adresse.searchParams.get('verlauf')
    if (art) {
      const n = Math.min(50, Math.max(1, Number(adresse.searchParams.get('n')) || 20))
      return antwort({ jetzt: jetztIso(), laeufe: await laufVerlauf(env, art, n) })
    }
    return antwort(await laufUebersicht(env, request, ctx))
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
  if (!['laeuft', 'ok', 'warnung', 'fehler', 'abgebrochen', 'erledigt'].includes(zustand)) {
    return antwort({ error: 'zustand muss laeuft, ok, warnung, fehler, abgebrochen oder erledigt sein' }, 400)
  }

  await laufMerken(env, laufId, zustand, daten, jetztIso())

  ctx?.waitUntil(ereignisSenden(env, 'lauf', { lauf_id: laufId, zustand }))
  return antwort({ ok: true, lauf_id: laufId, zustand })
}

/**
 * **Eine Laufmeldung schreiben** — Start, Fortschritt und Abschluss in einem Satz.
 *
 * Herausgelöst am 28.09.2026, damit `handleLauf` kurz genug für einen Verlaufs-Abruf bleibt.
 * `?15` sagt nur, ob diese Meldung überhaupt einen Fortschritt enthält: Ein späterer Start
 * („Sofort anmelden") darf den Zähler nicht auf null zurückwerfen.
 */
async function laufMerken(
  env: Env,
  laufId: string,
  zustand: string,
  daten: Record<string, string | undefined>,
  jetzt: string,
): Promise<void> {
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
  await env.DB.prepare(SQL_AUFRAEUMEN).run()
}

/**
 * **Der Verlauf einer Lauf-Art** (28.09.2026).
 *
 * Daniel: „alle läufe der vergangenheit, letzter lauf, aktueller lauf". Die Übersicht blendet
 * Fertiges nach dreißig Minuten aus — dort richtig, auf der Detailseite falsch: Die will den
 * Verlauf. Diese Abfrage liefert die letzten Läufe **einer** Lauf-Art, Abgehaktes inbegriffen,
 * und liest nur die Zeilen, die sie auch zeigt.
 */
async function laufVerlauf(env: Env, art: string, n: number): Promise<unknown[]> {
  const { results } = await env.DB.prepare(SQL_VERLAUF)
    .bind(art, n)
    .all()
  return results ?? []
}

/**
 * **Je Lauf-Art die letzten zwölf Ergebnisse** — nur die Ampel, fürs Kachel-Gitter.
 *
 * **Eine Abfrage je Lauf-Art, nicht eine über alles** (29.09.2026). Vorher stand hier eine
 * Fensterfunktion (`ROW_NUMBER() OVER (PARTITION BY workflow …)`); sie liest die **ganze** Tabelle —
 * gemessen 3.666 Zeilen je Aufruf, bei 5-Minuten-Takt der Anzeige rund 1 Mio. am Tag. Zwölf Zeilen
 * je Art über den Index `(workflow, gemeldet_am)` sind rund 200 und wachsen nicht mit dem Bestand.
 *
 * Ein `batch` ist ein Aufruf zur Datenbank — siebzehn kleine Abfragen kosten dort ein Vielfaches
 * weniger als eine, die alles liest (dieselbe Lehre wie bei den `DISTINCT`-Listen).
 */
async function letzteZustaende(env: Env): Promise<Record<string, { z: string; am: string }[]>> {
  const ergebnisse = await env.DB.batch(
    LAUF_ARTEN.map((art) => env.DB.prepare(SQL_EINE_ART).bind(art)),
  )
  const karte: Record<string, { z: string; am: string }[]> = {}
  ergebnisse.forEach((ergebnis, i) => {
    const art = LAUF_ARTEN[i]
    const zeilen = (ergebnis.results ?? []) as { workflow: string; zustand: string; gemeldet_am: string }[]
    if (!art || !zeilen.length) return
    /* Die Abfrage liefert neueste zuerst; das Gitter malt älteste zuerst. */
    karte[art] = zeilen.reverse().map((r) => ({ z: r.zustand, am: r.gemeldet_am }))
  })
  return karte
}

