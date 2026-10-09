import { useEffect, useMemo, useState } from 'react'
import { saisonText } from '@shared/saison.ts'
import { todayIso } from '@shared/time.ts'
import { loadJson, loadOhneSynchro, type Dataset } from '../lib/data.ts'
import { useLang } from '../lib/i18n.tsx'
import type { SaisonDatei, SaisonKatalogTitel, SaisonZeile } from '../lib/saison.ts'
import { ausblickGruppen, type AusblickGruppe } from '../lib/saison-ausblick.ts'
import { SaisonKarte, zeilenName } from './SaisonKarte.tsx'

/**
 * **Der Ausblick** (Daniel, 09.10.2026): alle kommenden Saisons mit Karten, Japan-Start und deutscher Termin so genau wie bekannt. Die erste Gruppe steht offen, die
 * weiteren sind eingeklappt — ihre Titelbilder laden erst beim Aufklappen. Die Datei `saison-ausblick.json` wird erst geholt, wenn dieser Reiter offen ist.
 */
export function SaisonAusblick({ data, datei, favorites, oeffne }: { data: Dataset; datei: SaisonDatei | undefined; favorites: Set<number>; oeffne: (id: number) => void }) {
  const { t } = useLang()
  const [ausblick, setAusblick] = useState<SaisonKatalogTitel[]>()
  useEffect(() => {
    let aktiv = true
    void loadJson<{ katalog: SaisonKatalogTitel[] }>('saison-ausblick.json').then((d) => aktiv && setAusblick(d.katalog)).catch(() => undefined)
    return () => {
      aktiv = false
    }
  }, [])
  const gruppen = useMemo(() => ausblickGruppen(data.titles, data.releasesByTitle, datei, ausblick, todayIso()), [data, datei, ausblick])
  const anzahl = gruppen.reduce((n, g) => n + g.zeilen.length, 0)
  return (
    <>
      <p className="mt-3 text-sm text-ak-leise">{t('saison.hinweisAusblick', { n: anzahl })}</p>
      {gruppen.map((g, i) => (
        <details key={g.schluessel} open={i === 0} className="mt-4">
          <summary className="cursor-pointer text-sm font-bold text-ak-leise">
            {g.saison ? saisonText(g.saison) : g.jahr ? t('saison.jahrOffen', { jahr: g.jahr }) : t('saison.ohneTermin')} <span className="font-normal">· {g.zeilen.length}</span>
          </summary>
          {g.schluessel === 'ohne' ? <OhneTermin g={g} data={data} oeffne={oeffne} /> : (
            <ul className="mt-2 grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
              {g.zeilen.map((z) => (
                <SaisonKarte key={z.id} z={z} data={data} favorit={favorites.has(z.id)} oeffne={oeffne} ausblick />
              ))}
            </ul>
          )}
        </details>
      ))}
    </>
  )
}

/** Titel ohne jedes Datum: nur Namen, ohne Titelbild — es sind viele, und sie haben nichts zu zeigen außer dem Namen. */
function OhneTermin({ g, data, oeffne }: { g: AusblickGruppe; data: Dataset; oeffne: (id: number) => void }) {
  const klick = async (z: SaisonZeile) => {
    if (!z.titel) await loadOhneSynchro(data)
    oeffne(z.id)
  }
  return (
    <ul className="mt-2 columns-1 gap-4 text-sm sm:columns-2 lg:columns-3">
      {g.zeilen.map((z) => (
        <li key={z.id} className="break-inside-avoid py-0.5">
          <button type="button" onClick={() => void klick(z)} className="cursor-pointer text-left hover:underline">{zeilenName(z)}</button>
        </li>
      ))}
    </ul>
  )
}
