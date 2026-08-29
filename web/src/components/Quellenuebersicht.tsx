import { useMemo, useState } from 'react'
import type { Release, Title } from '@shared/types.ts'
import { useLang } from '../lib/i18n.tsx'

/**
 * **Woher die Angaben auf dieser Seite stammen — eine Zeile je Quelle.**
 *
 * Daniel am 29.08.2026: „Statt das Quellen an jedem bereich stehen, sollte unten
 * ausklappbar bereich quellen sein, in dem tabellarisch alle bereiche aufgelistet
 * sind und zugehörige quellen beschrieben und verlinkt, wo möglich." Und dazu:
 * „nicht mehrere zeilen für die selbe quelle, 1 quelle -> welche info bereiche
 * werden damit gefüttert."
 *
 * Die Richtung ist damit vorgegeben, und sie ist die richtige: Eine Seite hat
 * drei bis sechs Quellen, aber ein Dutzend Bereiche. Nach Bereichen aufgeteilt
 * stünde dieselbe Adresse fünfmal da.
 *
 * **Was belegt ist und was zugeordnet — der Unterschied steht in der Spalte.**
 * Die Termin-Quellen stehen je Release im Datensatz, mit Adresse und dem Datum,
 * das sie nennen. Für Titel, Cover, Genres und Handlung führt der Datensatz
 * **keine** Herkunft je Feld; sie ergibt sich aus der Pipeline. Ein `titleDe`
 * kann aus vier verschiedenen Quellen stammen — aniSearch-Sprachliste,
 * aniSearch-Titel, Crunchyroll oder TMDB —, je nachdem, welche zuerst etwas
 * hatte.
 *
 * Deshalb behauptet keine Zeile mehr, als nachprüfbar ist: Wo eine Adresse
 * existiert, ist sie verlinkt; wo keine existiert, steht der Name ohne Link
 * statt einer erfundenen Adresse.
 */
export function Quellenuebersicht({ title, releases }: { title: Title; releases: Release[] }) {
  const { t } = useLang()
  const [offen, setOffen] = useState(false)

  /*
    Je Adresse ein Eintrag, auch wenn mehrere Artikel von dort stammen — bei
    Banana Fish standen zwei Anime2You-Artikel hinter zwei Ausgaben, und
    „anime2you.de, anime2you.de" las sich wie ein Fehler statt wie zwei Belege
    (15.08.2026). Die Zahl dahinter sagt, wie viele es sind.
  */
  const terminQuellen = useMemo(() => {
    const je = new Map<string, { url: string; anzahl: number }>()
    for (const r of releases) {
      const liste = r.quellen ?? r.sources.map((url) => ({ url, name: hostVon(url) }))
      for (const q of liste) {
        const host = q.name || hostVon(q.url)
        const da = je.get(host)
        if (da) da.anzahl++
        else je.set(host, { url: q.url, anzahl: 1 })
      }
    }
    return [...je.entries()].map(([host, wert]) => ({ host, ...wert }))
  }, [releases])

  const zeilen = useMemo(() => {
    const raus: { name: string; url?: string; speist: string; anzahl?: number }[] = [
      ...terminQuellen.map((q) => ({
        name: q.host,
        url: q.url,
        speist: t('quellen.feedTermine'),
        anzahl: q.anzahl,
      })),
      { name: 'AniList', url: `https://anilist.co/anime/${title.id}`, speist: t('quellen.feedWerk') },
    ]
    /*
      **Verlinkt, wo wir eine Kennung haben.** Daniels Vorgabe vom 29.08.2026:
      „beschrieben und verlinkt, wo möglich". Die Kennungen lagen im Bestand
      (2.615 bei aniSearch, 8.876 bei ANN) und erreichten die Seite nie — die
      Zeile nannte die Quelle und ließ den Leser dann suchen.

      Ohne Kennung bleibt der Name ohne Verweis stehen; eine geratene Adresse
      wäre schlechter als keine.
    */
    if (title.titleDe) {
      raus.push({
        name: 'aniSearch',
        url: title.anisearchId ? `https://www.anisearch.de/anime/${title.anisearchId}` : undefined,
        speist: t('quellen.feedDeutsch'),
      })
    }
    if (title.hasVoices) {
      raus.push({
        name: 'Anime News Network',
        url: title.annId
          ? `https://www.animenewsnetwork.com/encyclopedia/anime.php?id=${title.annId}`
          : undefined,
        speist: t('quellen.feedStimmen'),
      })
    }
    if ((title.streams ?? []).length) {
      raus.push({ name: t('quellen.feedAnbieterName'), speist: t('quellen.feedAnbieter') })
    }
    if (title.fsk !== undefined) raus.push({ name: 'FSK', speist: t('quellen.feedFsk') })
    return raus
  }, [terminQuellen, title, t])

  return (
    <div className="mt-2 border-t border-slate-200 pt-2 dark:border-white/10">
      <button
        type="button"
        onClick={() => setOffen((v) => !v)}
        className="flex w-full cursor-pointer items-center justify-between text-[11px] text-slate-500 transition hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
      >
        <span>{t('quellen.heading', { count: zeilen.length })}</span>
        <span aria-hidden>{offen ? '▴' : '▾'}</span>
      </button>

      {offen && (
        <div className="mt-2 overflow-x-auto">
          <table className="w-full text-[11px]">
            <thead>
              <tr className="text-left text-slate-400">
                <th className="pb-1 font-medium">{t('quellen.colSource')}</th>
                <th className="pb-1 font-medium">{t('quellen.colFeeds')}</th>
              </tr>
            </thead>
            <tbody className="align-top">
              {zeilen.map((r) => (
                <tr key={r.name} className="border-t border-slate-100 dark:border-white/5">
                  <td className="py-1 pr-3 whitespace-nowrap">
                    {r.url ? (
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-sky-500 hover:underline"
                      >
                        {r.name}
                      </a>
                    ) : (
                      <span className="text-slate-600 dark:text-slate-300">{r.name}</span>
                    )}
                    {r.anzahl !== undefined && r.anzahl > 1 && (
                      <span className="ml-1 tabular-nums text-slate-400">×{r.anzahl}</span>
                    )}
                  </td>
                  <td className="py-1 text-slate-500 dark:text-slate-400">{r.speist}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <p className="mt-1.5 text-[10px] text-slate-400">{t('quellen.note')}</p>
        </div>
      )}
    </div>
  )
}

/** Der Hostname ohne `www.` — für die Anzeige, nicht für einen Vergleich. */
function hostVon(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return url
  }
}
