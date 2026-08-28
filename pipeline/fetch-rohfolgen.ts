/**
 * Die gemeldeten Rohfolgen abholen und unseren Folgen zuordnen.
 *
 * **Der Kern des Umbaus vom 28.08.2026.** Bis dahin entschied die Erweiterung im
 * Browser, welche Amazon-Folge welche unserer ist — und konnte es nicht: Prime
 * führt in einer Liste die deutsche Zählung neben der japanischen, Amazon mischt
 * in einer Staffel 26, 27, 28 und 105, Haikyu Staffel 1 hat dort 44 Folgen und
 * bei uns 25. Neununddreißig Fassungen an einem Abend gingen darauf zurück.
 *
 * Hier passiert es an der richtigen Stelle: Der Bau kennt TMDBs Folgentitel und
 * Erstausstrahlungsdaten (`data/tmdb-folgen.json`) und kann dagegen abgleichen.
 *
 * **Was nicht zugeordnet werden kann, bleibt offen.** `data/prime-unzugeordnet.json`
 * führt die Fälle mit Grund. Eine offene Frage bleibt damit sichtbar, statt zu
 * einer falschen Antwort zu werden — das ist der ganze Unterschied zu vorher.
 *
 * Aufruf: `npx tsx pipeline/fetch-rohfolgen.ts`
 */
import { log, readJson, warn, writeJson } from './lib/util.ts'
import { recordSource } from './lib/health.ts'
import { findeStaffel, ordneZu, type AnbieterFolge, type TmdbFolge } from '../shared/folgen-zuordnung.ts'
import type { Title } from '../shared/types.ts'

const WORKER = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
const TOKEN = process.env.LAUF_TOKEN ?? ''

/** Eine Zeile aus `prime_folge`, so wie der Worker sie ausliefert. */
interface Rohfolge {
  id: number
  url: string
  asin: string | null
  gti: string | null
  nummer: number | null
  titel: string | null
  erschienen: string | null
  dauer_sek: number | null
  sprachen: string | null
  untertitel: string | null
  staffel_text: string | null
  staffel_nr: number | null
  gemeldet_am: string
}

interface TmdbEintrag {
  tmdbId: number
  folgen: TmdbFolge[]
}

/** Ein Fall, der geklärt werden muss, statt geraten zu werden. */
interface Offen {
  url: string
  titel: string | null
  grund: string
  folgen: number
}

async function main(): Promise<void> {
  if (!TOKEN) {
    warn('LAUF_TOKEN fehlt — ohne Token gibt der Worker die Rohfolgen nicht heraus.')
    recordSource('rohfolgen', 0, 'kein Token')
    return
  }

  const antwort = await fetch(`${WORKER}/pruefung?rohfolgen=1&token=${encodeURIComponent(TOKEN)}`)
  if (!antwort.ok) {
    warn(`Rohfolgen nicht abrufbar: HTTP ${antwort.status}`)
    recordSource('rohfolgen', 0, `HTTP ${antwort.status}`)
    return
  }
  const { folgen, gesamt } = (await antwort.json()) as { folgen: Rohfolge[]; gesamt: number }
  if (!folgen.length) {
    log(`keine offenen Rohfolgen (Bestand ${gesamt})`)
    recordSource('rohfolgen', 0)
    return
  }
  log(`${folgen.length} Rohfolgen geholt (offen insgesamt: ${gesamt})`)

  const titles = readJson<Title[]>('public/data/titles.json', [])
  const tmdbFolgen = readJson<Record<string, TmdbEintrag>>('data/tmdb-folgen.json', {})

  /* Je Adresse gruppieren — eine Meldung betrifft immer eine Staffel-Seite. */
  const jeUrl = new Map<string, Rohfolge[]>()
  for (const f of folgen) {
    const l = jeUrl.get(f.url) ?? []
    l.push(f)
    jeUrl.set(f.url, l)
  }

  const offen: Offen[] = []
  const zugeordnet: Record<string, { titleId: number; folgen: { unsere: number; sprachen: string[] }[] }> = {}

  for (const [url, liste] of jeUrl) {
    /*
      Welcher unserer Titel gehört zu dieser Adresse? Über den Bestand, nicht über
      den Namen: Die Adresse steht dort, der Name kann bei Prime jede Form haben.
    */
    const treffer = titles.filter((t) => (t.streams ?? []).some((s) => s.url === url))
    if (treffer.length !== 1) {
      offen.push({
        url,
        titel: liste[0]?.titel ?? null,
        grund: treffer.length ? `${treffer.length} Titel teilen diese Adresse` : 'kein Titel zu dieser Adresse',
        folgen: liste.length,
      })
      continue
    }
    const titel = treffer[0]!

    const tmdb = tmdbFolgen[String(titel.id)]
    if (!tmdb) {
      offen.push({ url, titel: titel.titleDe ?? titel.titleEn ?? null, grund: 'keine TMDB-Folgen vorhanden', folgen: liste.length })
      continue
    }

    const staffel = findeStaffel(tmdb.folgen, titel.episodes ?? null, titel.jpYear ?? null)
    if (staffel === null) {
      offen.push({
        url,
        titel: titel.titleDe ?? titel.titleEn ?? null,
        grund: `keine TMDB-Staffel mit ${titel.episodes ?? '?'} Folgen eindeutig`,
        folgen: liste.length,
      })
      continue
    }

    const tmdbStaffel = tmdb.folgen.filter((f) => f.s === staffel)
    const anbieter: AnbieterFolge[] = liste.map((f) => ({
      nummer: f.nummer,
      titel: f.titel,
      datum: f.erschienen ? f.erschienen.slice(0, 10) : null,
      minuten: f.dauer_sek ? Math.round(f.dauer_sek / 60) : null,
    }))

    const paare = ordneZu(anbieter, tmdbStaffel)
    const treffend = paare.filter((p) => p.unsere !== null)
    if (!treffend.length) {
      offen.push({
        url,
        titel: titel.titleDe ?? titel.titleEn ?? null,
        grund: 'keine einzige Folge zuzuordnen',
        folgen: liste.length,
      })
      continue
    }

    zugeordnet[url] = {
      titleId: titel.id,
      folgen: treffend.map((p) => ({
        unsere: p.unsere!,
        sprachen: JSON.parse(liste[p.index]!.sprachen ?? '[]') as string[],
      })),
    }
  }

  writeJson('data/prime-zugeordnet.json', zugeordnet)
  writeJson('data/prime-unzugeordnet.json', offen)

  const gesamtZugeordnet = Object.values(zugeordnet).reduce((n, z) => n + z.folgen.length, 0)
  log(`${Object.keys(zugeordnet).length} Adressen zugeordnet (${gesamtZugeordnet} Folgen), ${offen.length} offen`)
  for (const o of offen.slice(0, 5)) log(`  offen: ${o.titel ?? o.url} — ${o.grund}`)
  recordSource('rohfolgen', gesamtZugeordnet, undefined, Object.keys(zugeordnet).length)
}

await main()
