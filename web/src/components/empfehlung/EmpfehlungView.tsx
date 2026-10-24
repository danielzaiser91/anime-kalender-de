import { useMemo, useState } from 'react'
import type { Dataset } from '../../lib/data.ts'
import { useEmpfehlungsDaten } from '../../lib/empfehlung-daten.ts'
import { empfehlungGesehen, empfehlungVerworfen, useReiseAnbieter } from '../../lib/empfehlung-speicher.ts'
import { baueAktionen, nimmWeg } from '../../lib/empfehlung-aktionen.ts'
import { mosaikIds } from '../../lib/empfehlung-reise.ts'
import { useFavorites, useHidden } from '../../lib/favorites.ts'
import { useLang } from '../../lib/i18n.tsx'
import { AnbieterBlatt, poolAnbieter } from './AnbieterBlatt.tsx'
import { Hintergrund } from './bilder.tsx'
import { Duell } from './Duell.tsx'
import { Einleitung } from './Einleitung.tsx'
import { Kopfzeile, AnbieterLasche } from './Kopfzeile.tsx'
import { Leinwand } from './Leinwand.tsx'
import { useReise } from './use-reise.ts'
import { Vorschlaege } from './Vorschlaege.tsx'
import './empfehlung.css'

/** Zahl der Cover im Mosaik der Einleitung. */
const MOSAIK_COVER = 24

const zufallsStart = (): number => Math.floor(Math.random() * 1e6)

/** „Was gucken?“: Einleitung → Duelle → fünf Vorschläge → Leinwand. Liegt als Fläche über der Seite; erreichbar nur per Adresse (`#/empfehlung`). */
export default function EmpfehlungView({ data }: { data: Dataset }) {
  const { t } = useLang()
  const { kontext, titel, fehler } = useEmpfehlungsDaten(data)
  const { favorites, toggle } = useFavorites()
  const { hidden } = useHidden()
  const gesehen = empfehlungGesehen.use()
  const verworfen = empfehlungVerworfen.use()
  const [eigene, setzeEigene] = useReiseAnbieter()
  const [blatt, setBlatt] = useState(false)
  const [schein, setSchein] = useState<string>()
  const reise = useReise(kontext, { favoriten: favorites, ausgeblendet: hidden, gesehen: gesehen.ids, verworfen: verworfen.ids, eigene }, zufallsStart)
  const mosaik = useMemo(() => mosaikIds(kontext?.datei.einstiege ?? [], MOSAIK_COVER), [kontext])
  const kandidat = (id: number) => kontext!.datei.einstiege[kontext!.index.get(id)!]
  const genresVon = (id: number) => kandidat(id).g.map((i) => kontext!.datei.genres[i])
  const aktionen = baueAktionen({ gesehen: empfehlungGesehen, verworfen: empfehlungVerworfen, favorit: toggle, oeffne: reise.oeffne, entferne: reise.entferne })
  const zurueckholen = (id: number) => nimmWeg(empfehlungVerworfen, id)
  const verworfeneKandidaten = kontext ? [...verworfen.ids].filter((id) => kontext.index.has(id)).map(kandidat) : []
  const phase = kontext ? reise.phase : 'start'

  return (
    <div className="empf fixed inset-0 z-50 flex flex-col bg-ak-grund text-ak-text">
      <Hintergrund url={schein} />
      <Kopfzeile phase={phase} anbieter={eigene.length} blattOffen={blatt} vorschlaege={() => reise.setPhase('ergebnis')} vonVorn={reise.neu} blatt={() => setBlatt(true)} />
      {fehler && <p className="m-auto text-ak-fehler-text">{t('empf.fehler')}</p>}
      {!fehler && !kontext && <p className="m-auto text-ak-leise">{t('empf.laedt')}</p>}
      {kontext && phase === 'start' && <Einleitung titel={titel} ids={mosaik} los={reise.neu} />}
      {kontext && phase === 'duell' && reise.sitzung && (
        <Duell kontext={kontext} sitzung={reise.sitzung} ziel={reise.ziel} titel={titel} antworte={reise.antworte} zurueck={reise.zurueckDuell} schein={setSchein} />
      )}
      {kontext && phase === 'ergebnis' && reise.stehen && (
        <Vorschlaege
          kontext={kontext}
          gezeigt={reise.gezeigt}
          titel={titel}
          favoriten={favorites}
          aktionen={aktionen}
          stand={reise.stehen}
          genauer={reise.kannGenauer ? reise.genauer : undefined}
          vonVorn={reise.neu}
          verworfen={verworfeneKandidaten}
          zurueckholen={zurueckholen}
        />
      )}
      {kontext && phase === 'leinwand' && reise.aktuell !== undefined && (
        <Leinwand
          key={reise.aktuell}
          k={kandidat(reise.aktuell)}
          titel={titel?.get(reise.aktuell)}
          genres={genresVon(reise.aktuell)}
          eigene={reise.eigene}
          istFavorit={favorites.has(reise.aktuell)}
          aktionen={{
            favorit: () => toggle(reise.aktuell!),
            nein: () => aktionen.nein(reise.aktuell!),
            gesehen: () => aktionen.gesehen(reise.aktuell!),
            zurueck: () => reise.setPhase('ergebnis'),
          }}
        />
      )}
      {kontext && phase !== 'start' && <AnbieterLasche anbieter={eigene.length} offen={blatt} umschalten={() => setBlatt(!blatt)} />}
      {kontext && <AnbieterBlatt offen={blatt} zu={() => setBlatt(false)} alle={poolAnbieter(kontext.datei.einstiege)} gewaehlt={eigene} setze={setzeEigene} />}
    </div>
  )
}
