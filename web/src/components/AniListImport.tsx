import { useState } from 'react'
import { loadAllTitles, type Dataset } from '../lib/data.ts'
import { favoritenErgaenzen } from '../lib/favorites.ts'
import { useLang } from '../lib/i18n.tsx'

/**
 * **Die eigene AniList-Liste als Favoriten übernehmen** (18.09.2026, Feature-Vergleich:
 * Simkl-Import). Wer seine Liste mitbringt, sieht sofort, was davon deutsch vertont ist.
 *
 * Unsere Titelkennungen *sind* AniList-Kennungen — es braucht keine Zuordnung, nur den
 * Schnitt mit unserem Bestand. Gefragt wird AniLists öffentliche GraphQL-Schnittstelle
 * direkt aus dem Browser, ohne Anmeldung; das geht nur bei öffentlichen Listen.
 * Übernommen wird „schaue ich", „geplant" und „pausiert": das, wofür eine Erinnerung
 * nützt. Abgeschlossenes bleibt draußen.
 */
const ABFRAGE = `query ($u: String) {
  MediaListCollection(userName: $u, type: ANIME, status_in: [CURRENT, PLANNING, PAUSED, REPEATING]) {
    lists { entries { mediaId } }
  }
}`

/**
 * **MyAnimeList ohne Schnittstelle: die Exportdatei** (18.09.2026). MALs API verlangt eine
 * Client-Kennung; der Listen-Export („Export My List") liefert dagegen eine XML-Datei, meist
 * gzip-gepackt. Sie wird nur im Browser gelesen. Zugeordnet wird über `malId`, die fast
 * jeder unserer Titel trägt. Übernommen wird wie bei AniList: Watching, Plan to Watch, On-Hold.
 */
const MAL_STATUS = new Set(['Watching', 'Plan to Watch', 'On-Hold'])

async function malIdsAusDatei(datei: File): Promise<{ ids: number[]; gesamt: number }> {
  let text: string
  if (datei.name.endsWith('.gz')) {
    const strom = datei.stream().pipeThrough(new DecompressionStream('gzip'))
    text = await new Response(strom).text()
  } else {
    text = await datei.text()
  }
  const xml = new DOMParser().parseFromString(text, 'application/xml')
  const eintraege = [...xml.getElementsByTagName('anime')]
  const ids = eintraege
    .filter((a) => MAL_STATUS.has(a.getElementsByTagName('my_status')[0]?.textContent?.trim() ?? ''))
    .map((a) => Number(a.getElementsByTagName('series_animedb_id')[0]?.textContent))
    .filter((n) => Number.isFinite(n) && n > 0)
  return { ids, gesamt: eintraege.length }
}

export function AniListImport({ data }: { data: Dataset }) {
  const { t } = useLang()
  const [name, setName] = useState('')
  const [lage, setLage] = useState<{ art: 'laeuft' } | { art: 'fertig'; treffer: number; gesamt: number } | { art: 'fehler'; text: string }>()

  const uebernehmen = async () => {
    const u = name.trim()
    if (!u) return
    setLage({ art: 'laeuft' })
    try {
      const res = await fetch('https://graphql.anilist.co', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify({ query: ABFRAGE, variables: { u } }),
      })
      const body = (await res.json()) as {
        data?: { MediaListCollection?: { lists?: { entries?: { mediaId: number }[] }[] } }
        errors?: { message: string; status?: number }[]
      }
      if (!res.ok || body.errors?.length) {
        const nichtDa = body.errors?.some((e) => e.status === 404 || /not found|private/i.test(e.message))
        throw new Error(nichtDa ? t('import.nichtGefunden') : t('import.fehler'))
      }
      const ids = new Set(
        (body.data?.MediaListCollection?.lists ?? []).flatMap((l) => (l.entries ?? []).map((e) => e.mediaId)),
      )
      const bestand = new Set((await loadAllTitles(data)).map((x) => x.id))
      const treffer = [...ids].filter((id) => bestand.has(id))
      favoritenErgaenzen(treffer)
      setLage({ art: 'fertig', treffer: treffer.length, gesamt: ids.size })
    } catch (e) {
      setLage({ art: 'fehler', text: e instanceof Error && e.message ? e.message : t('import.fehler') })
    }
  }

  const malUebernehmen = async (datei: File | undefined) => {
    if (!datei) return
    setLage({ art: 'laeuft' })
    try {
      const { ids, gesamt } = await malIdsAusDatei(datei)
      if (!gesamt) throw new Error(t('import.malLeer'))
      const nachMal = new Map((await loadAllTitles(data)).filter((x) => x.malId).map((x) => [x.malId!, x.id]))
      const treffer = [...new Set(ids.map((m) => nachMal.get(m)).filter((x): x is number => x !== undefined))]
      favoritenErgaenzen(treffer)
      setLage({ art: 'fertig', treffer: treffer.length, gesamt: ids.length })
    } catch (e) {
      setLage({ art: 'fehler', text: e instanceof Error && e.message ? e.message : t('import.malLeer') })
    }
  }

  return (
    <details className="rounded-xl border border-slate-200 p-3 text-sm dark:border-white/10">
      <summary className="cursor-pointer text-slate-600 dark:text-slate-300">{t('import.titel')}</summary>
      <form
        className="mt-3 flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault()
          void uebernehmen()
        }}
      >
        <input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t('import.platzhalter')}
          aria-label={t('import.platzhalter')}
          className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-transparent px-2.5 py-1 dark:border-white/15"
        />
        <button
          type="submit"
          disabled={lage?.art === 'laeuft' || !name.trim()}
          className="cursor-pointer rounded-lg bg-sky-600 px-3 py-1 font-medium text-white transition hover:bg-sky-500 disabled:cursor-default disabled:opacity-50"
        >
          {t('import.knopf')}
        </button>
      </form>
      <label className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-600 dark:text-slate-300">
        {t('import.mal')}
        <input
          type="file"
          accept=".xml,.gz,application/xml,application/gzip"
          onChange={(e) => void malUebernehmen(e.target.files?.[0])}
          className="max-w-full text-xs file:mr-2 file:cursor-pointer file:rounded-lg file:border-0 file:bg-slate-200 file:px-2 file:py-1 dark:file:bg-white/10"
        />
      </label>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {lage?.art === 'fertig'
          ? t('import.ergebnis', { treffer: lage.treffer, gesamt: lage.gesamt })
          : lage?.art === 'fehler'
            ? lage.text
            : lage?.art === 'laeuft'
              ? t('import.laeuft')
              : t('import.hinweis')}
      </p>
    </details>
  )
}
