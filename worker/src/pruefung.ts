import { type Env } from './env.ts'
import { speicherePruefung } from './pruefung-speichern.ts'
import { loeschePruefungen } from './pruefung-loeschen.ts'
import { beantwortePruefungLesen } from './pruefung-lesen.ts'

export async function handlePruefung(request: Request, env: Env, ctx?: ExecutionContext): Promise<Response> {
  const offen = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  }
  const antwort = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), { status, headers: offen })

  /**
   * **Gelesene Zeilen sind das Kontingent — also wird nicht zweimal dasselbe gelesen.**
   *
   * Die beiden Übersichts-Endpunkte (`?zaehlen=1`, `?stand=1`) lesen je Aufruf
   * die **ganze** Tabelle `pruefung`: einmal die offenen Meldungen, einmal alle
   * je gemeldeten Adressen. Am 01.09.2026 waren das rund 6.900 Zeilen — und die
   * Erweiterung fragt im Minutentakt, aus jedem offenen Tab. Ein einziger Tab
   * kommt so auf **9,9 Millionen gelesene Zeilen am Tag**, bei einem
   * Tageskontingent von fünf.
   *
   * Genau das ist an dem Tag passiert (8,82 Mio., der Worker antwortete
   * stundenlang mit HTTP 500). Die Unterabfrage ohne Index war der Auslöser,
   * aber nicht die Ursache: Der Takt allein hätte es auch geschafft.
   *
   * Die Antwort ist für **alle** Fragenden dieselbe und ändert sich nur, wenn
   * jemand schreibt. Sie wird deshalb im Cache der Edge gehalten und bei **jedem**
   * Schreibzugriff verworfen (`briefkastenCacheLeeren`, angehängt an die
   * Weiterleitung) — ein frisch gemeldeter Titel steht also nicht weiter als
   * offen. Das ist der Fall, den Daniel am 01.09.2026 viermal melden musste; er
   * darf durch eine Sparmaßnahme nicht zurückkommen.
   *
   * **Deshalb ist die halbe Stunde keine Wartezeit.** Die Frische kommt aus dem
   * Verwerfen, nicht aus dem Ablaufen; die Dauer deckt nur den Fall ab, dass ein
   * Verwerfen ein anderes Rechenzentrum nicht erreicht. Bei fünf Minuten
   * blieben 2,0 Millionen gelesene Zeilen am Tag je offenem Tab — bei drei Tabs
   * wieder über dem Kontingent. Mit dreißig sind es 331.000.
   *
   * `caches.default` gilt je Rechenzentrum. Meldung und Abfrage kommen aus
   * demselben Browser, also aus demselben — für einen fremden Leser ist die
   * Antwort im schlimmsten Fall fünf Minuten alt, und das ist bei einer
   * Prüfliste folgenlos.
   */
  /**
   * **Und die Haltedauer gehoert zur Frage, nicht zum Endpunkt.**
   *
   * Bis zum 05.09.2026 hielten alle drei Uebersichts-Antworten eine halbe
   * Stunde. Fuer `?zaehlen=1` ist das richtig — dort liegt die teure Abfrage
   * (`SELECT DISTINCT url`, die ganze Tabelle), und die Frist ist der Grund,
   * warum das Tageskontingent haelt.
   *
   * Fuer `?stand=1` war es falsch, und zwar sichtbar: Die Zahl darin stammt aus
   * `pruefstand.json`, und die schreibt ein **Datenlauf**, kein Schreibzugriff
   * auf den Worker. Das Verwerfen haengt aber genau an den Schreibzugriffen
   * (`briefkastenCacheLeeren`). Nach einem Datenlauf zeigte die Statusanzeige
   * deshalb bis zu dreissig Minuten den Stand von davor: Am 05.09.2026 standen
   * vier neue Prime-Auftraege im Bestand, und in der App war die Leiste leer
   * (Daniel: „die prime auftraege muessen auch als pill in status app").
   *
   * Eine Minute deckt genau den Takt ab, in dem die Anzeige ohnehin fragt. Sie
   * ist billig: `?stand=1` liest nur die **offenen** Meldungen
   * (`WHERE uebernommen = 0`), nicht die ganze Tabelle — das ist der
   * Unterschied zu `?zaehlen=1`.
   */
  const ausCache = async (
    bauen: () => Promise<Response>,
    sekunden = 1800,
  ): Promise<Response> => {
    const schluessel = new Request(new URL(request.url).toString(), { method: 'GET' })
    const cache = caches.default
    const getroffen = await cache.match(schluessel)
    if (getroffen) return getroffen
    const frisch = await bauen()
    /* Nur erfolgreiche Antworten werden gehalten — ein Fehler soll sich nicht festsetzen. */
    if (frisch.status === 200) {
      const zumHalten = new Response(frisch.clone().body, frisch)
      zumHalten.headers.set('Cache-Control', `public, max-age=${sekunden}`)
      ctx?.waitUntil(cache.put(schluessel, zumHalten))
    }
    return frisch
  }

  if (request.method === 'GET') {
    return await beantwortePruefungLesen({ request, env, antwort, ausCache })
  }

  if (request.method === 'DELETE') {
    return await loeschePruefungen({ request, env, antwort })
  }

  if (request.method !== 'POST') return antwort({ error: 'GET, POST oder DELETE erwartet' }, 405)

  const token = request.headers.get('X-Lauf-Token') ?? ''
  if (!env.LAUF_TOKEN || token !== env.LAUF_TOKEN) return antwort({ error: 'Nicht erlaubt' }, 403)

  return await speicherePruefung({ request, antwort, token, env, ctx })
}
