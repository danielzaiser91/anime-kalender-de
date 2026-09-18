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
