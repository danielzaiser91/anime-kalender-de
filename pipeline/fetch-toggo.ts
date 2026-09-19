/**
 * **Welche Folgen bei TOGGO gerade kostenlos abrufbar sind** (19.09.2026).
 *
 * Daniel am 19.09.2026 an Dragon Ball Daima, mit Bild: toggo.de zeigt nur die Folgen
 * 14–18 — „diese info soll auch in die pill + aktuell halten". Gemessen am selben Tag:
 * Jede Folge ist **genau sieben Tage** nach der TV-Ausstrahlung frei abrufbar
 * (`catchup_earliest_start_date` 21:37 bis `catchup_latest_end_date` 21:15 eine Woche
 * später). **Bei Boruto dagegen stehen alle 292 Folgen frei bis 31.12.2026** — über ein
 * zweites Fenster (`fvod_*`, „free VOD"). Ein fester Satz wie „nur die neuesten Folgen"
 * wäre dort falsch; gezählt wird deshalb aus beiden freien Fenstern. Ein Abo-Fenster
 * (`svod_*`, bei Daima ab 25.09. bis 2030) gehört zu RTL+ und wird hier nicht gebraucht.
 *
 * **Woher:** Die Seite ist eine JavaScript-Anwendung; sie holt die Folgenliste bei
 * `production-n.toggo.de/api/assetstore/vod/asset` mit den Filtern `type[episode]` und
 * `series_id[VSE…]` (Netzwerkverkehr gelesen, 19.09.2026). Die Serienkennung steht in
 * unserer TOGGO-Adresse (`…/dragon-ball-daima-vse446`).
 *
 * **Rechtslage:** `production-n.toggo.de/robots.txt` lautet `Disallow: /` und darunter
 * `Allow /api/` — ohne Doppelpunkt, formal ungültig, erkennbar gemeint als Freigabe der
 * Schnittstelle. Daniel hat am 19.09.2026 entschieden, sie so zu lesen („Ja, direkt
 * bauen"). Deshalb sparsam: ein Abruf je Serie und Tag, 1,5 s Abstand, erkennbarer
 * User-Agent.
 *
 * Ergebnis: `data/toggo.json` — je unserem Titel die Folgen mit Fenster (Ortszeit
 * Europe/Berlin, ISO ohne Zone, wie überall im Datensatz). Der Bau hängt sie an den
 * TOGGO-Weg; ob eine Folge *jetzt* abrufbar ist, rechnet die Seite beim Anzeigen.
 */
import { readJson, writeJson, log, warn } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { figurAusAdresse, serieFuerFigur, serienAdresse, type ToggoSerie } from './lib/toggo-serien.ts'

const API = 'https://production-n.toggo.de/api/assetstore/vod/asset'
const UA = 'anime-kalender-de (https://anime-kalender.de; ein Abruf je Serie und Tag)'
const ZIEL = 'data/toggo.json'

type Titel = { id: number; titleDe?: string; titleEn?: string; titleRomaji?: string; watchLinks?: { url?: string }[] }
type Folge = { staffel: number; folge: number; ab: string; bis: string }
/** `adresse`: die Serienseite, wenn wir nur die Figurenseite kannten (siehe `lib/toggo-serien.ts`). */
export type ToggoDatei = { geholtAm: string; titel: Record<string, { serie: string; adresse?: string; folgen: Folge[] }> }

/** Unix-Sekunden → „YYYY-MM-DDTHH:MM" in Berliner Ortszeit. */
function ortszeit(sek: number): string {
  const teile = Object.fromEntries(
    new Intl.DateTimeFormat('de-DE', {
      timeZone: 'Europe/Berlin',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(new Date(sek * 1000))
      .map((p) => [p.type, p.value]),
  )
  return `${teile.year}-${teile.month}-${teile.day}T${teile.hour}:${teile.minute}`
}

const warte = (ms: number) => new Promise((r) => setTimeout(r, ms))

const titles = readJson<Titel[] | { titles: Titel[] }>('public/data/titles.json', [])
const liste = Array.isArray(titles) ? titles : titles.titles
const jeSerie = new Map<string, number[]>()
const adressen = new Map<number, string>()

/* Figurenseiten (`…-pty605`) über die Serienliste der Schnittstelle auflösen — ein Abruf. */
const mitFigur = liste.filter((t) => (t.watchLinks ?? []).some((w) => figurAusAdresse(w.url ?? '')))
let serien: ToggoSerie[] = []
if (mitFigur.length) {
  try {
    const r = await fetch(`${API}?expand=false&filter=type[series]&size=500`, { headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const o = (await r.json()) as { data?: { items?: { id?: string; u_name?: string; title?: string; characters?: { u_name?: string }[] }[] } }
    serien = (o.data?.items ?? [])
      .filter((s) => s.id && s.u_name && s.title)
      .map((s) => ({
        id: s.id!.toUpperCase(),
        uname: s.u_name!,
        titel: s.title!,
        figuren: (s.characters ?? []).map((c) => (c.u_name ?? '').toLowerCase()),
      }))
  } catch (err) {
    warn(`TOGGO-Serienliste: ${err instanceof Error ? err.message : String(err)}`)
  }
  await warte(1500)
}

for (const t of liste) {
  for (const w of t.watchLinks ?? []) {
    let serie = /toggo\.de\/.*-(vse\d+)(?:[/?#]|$)/i.exec(w.url ?? '')?.[1]?.toUpperCase()
    const figur = figurAusAdresse(w.url ?? '')
    if (!serie && figur) {
      const s = serieFuerFigur(serien, figur, [t.titleDe, t.titleEn, t.titleRomaji])
      if (s) {
        serie = s.id
        adressen.set(t.id, serienAdresse(figur, s))
      }
    }
    if (!serie) continue
    jeSerie.set(serie, [...new Set([...(jeSerie.get(serie) ?? []), t.id])])
  }
}
if (adressen.size) log(`TOGGO: ${adressen.size} Figurenseite(n) auf die Serienseite aufgelöst`)

const ergebnis: ToggoDatei = { geholtAm: new Date().toISOString(), titel: {} }
let fehler = 0
for (const [serie, ids] of jeSerie) {
  const url = `${API}?expand=false&filter=type[episode]&filter=series_id[${serie}]&sort=episode_no&size=500`
  try {
    const r = await fetch(url, { headers: { 'User-Agent': UA } })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    const o = (await r.json()) as {
      data?: {
        items?: {
          season_no?: number
          episode_no?: number
          title?: string
          catchup_earliest_start_date?: number | null
          catchup_latest_end_date?: number | null
          fvod_earliest_start_date?: number | null
          fvod_latest_end_date?: number | null
        }[]
      }
    }
    const folgen: Folge[] = []
    for (const f of o.data?.items ?? []) {
      if (!f.episode_no) continue
      /* Frei ist, was in einem der beiden kostenlosen Fenster liegt — das weitere gewinnt. */
      const fenster = [
        [f.catchup_earliest_start_date, f.catchup_latest_end_date],
        [f.fvod_earliest_start_date, f.fvod_latest_end_date],
      ].filter((x): x is [number, number] => Boolean(x[0] && x[1]))
      if (!fenster.length) continue
      const ab = Math.min(...fenster.map((x) => x[0]))
      const bis = Math.max(...fenster.map((x) => x[1]))
      folgen.push({ staffel: f.season_no ?? 1, folge: f.episode_no, ab: ortszeit(ab), bis: ortszeit(bis) })
    }
    for (const id of ids) ergebnis.titel[String(id)] = { serie, ...(adressen.has(id) ? { adresse: adressen.get(id)! } : {}), folgen }
    log(`TOGGO ${serie}: ${folgen.length} Folge(n) mit Fenster`)
  } catch (err) {
    fehler++
    warn(`TOGGO ${serie}: ${err instanceof Error ? err.message : String(err)}`)
    /* Ohne Antwort bleibt der Stand von gestern — eine Störung ist kein Befund. */
    const alt = readJson<ToggoDatei>(ZIEL, { geholtAm: '', titel: {} })
    for (const id of ids) if (alt.titel[String(id)]) ergebnis.titel[String(id)] = alt.titel[String(id)]
  }
  await warte(1500)
}

writeJson(ZIEL, ergebnis, true)
recordSource('toggo', Object.keys(ergebnis.titel).length, fehler ? `${fehler} Serie(n) ohne Antwort` : undefined, jeSerie.size, jeSerie.size === 0)
log(`${jeSerie.size} TOGGO-Serie(n) gefragt, ${fehler} ohne Antwort → ${ZIEL}`)
