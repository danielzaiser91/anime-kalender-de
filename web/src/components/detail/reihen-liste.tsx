import { type FranchiseMember, type Title } from '@shared/types.ts'
import { hauptstaffeln, nachJahrUndId, staffelBeschriftungen, staffelStaende } from '@shared/titles.ts'
import { angabenZeile, kuenftig as istKuenftig, teilNamen } from './reihen-teil.ts'
import { ReihenCover } from './reihen-cover.tsx'
import { ReihenSpur } from './reihen-spur.tsx'
import { istEingeklappt } from './reihen-regeln.ts'
import { OhneSynchroSchalter, ReihenKopf } from './reihen-kopf.tsx'
import { ReihenKarte } from './reihen-karte.tsx'
import { reihenGruppen } from './reihen-gruppen.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'

export function ReihenListe({ reihenTeile, t, reihenName, title, favorites, wechselt, wechsleZu, reiheOhneOffen, reihenSchluessel, reiheSuche, setReiheOhneOffen, setReiheSuche }: {
  reihenTeile: FranchiseMember[]
  t: Translate
  reihenName: string
  title: Title
  favorites: Set<number>
  wechselt: boolean
  wechsleZu: (id: number) => void
  reiheOhneOffen: number | null
  reihenSchluessel: number
  reiheSuche: { reihe: number; text: string; }
  setReiheOhneOffen: Dispatch<SetStateAction<number | null>>
  setReiheSuche: Dispatch<SetStateAction<{ reihe: number; text: string; }>>
}) {
  return (
    <>
      {reihenTeile.length > 1 && (
        <ReihenKarte reihenTeile={reihenTeile} reihenName={reihenName} title={title}>
          <div data-reihe-liste className="p-0.5">
            {(() => {
              const jahr = new Date().getFullYear()
              const kuenftig = (m: FranchiseMember) => istKuenftig(m, jahr)
              /*
                **Vier Gruppen mit Überschrift, nicht zwei Töpfe.**

                Bei „One Piece" standen 64 Teile in einer Liste, und der erste
                sichtbare war eine ONA von 2018.

                Die Reihenfolge folgt dem, was jemand sucht: erst die
                Hauptserie, dann das Beiwerk, dann die Filme — und ganz unten,
                was es noch nicht gibt. Innerhalb jeder Gruppe chronologisch.
              */
              /*
                **Ein Titel ohne Jahr gehört ans Ende, nicht an den Anfang.**

                `?? 0` machte aus „unbekannt" das Jahr null. Bei „One Piece"
                standen dadurch drei undatierte Kurzformate vor der Serie von
                1999, und sie selbst hieß in der Liste „Staffel 4" (Daniel,
                03.09.2026, mit Bild).
              */
              const nachJahr = nachJahrUndId

              /*
                **Was eine Hauptstaffel ist, entscheidet die Reihe selbst.**

                `istStaffel` zählt ONA mit, und das ist richtig: Viele neue
                Serien laufen als ONA („Beastars"). Für die **Zählung** einer
                Reihe ist es falsch, sobald sie daneben Kurzformate führt —
                „One Piece: Annecy Festival" und „Koisuru One Piece" sind keine
                Staffeln, sie haben nur dasselbe Format.

                Also: Gibt es in der Reihe echte Fernsehstaffeln, zählen nur
                die. Gibt es keine, zählen die ONAs — dann sind sie die Serie.

                **Kurzformate zählen nie mit.** „Chopper's" ist ein TV_SHORT und
                stand damit unter „Hauptserie" (Daniel, 03.09.2026:
                „choppers gehört nicht zur hauptserie"). Eine Sendung von fünf
                Minuten ist Beiwerk, auch wenn sie im Fernsehen läuft.
              */
              /*
                **Und bei chinesischen Produktionen entscheidet das Format
                gar nichts.** Dort ist jeder Teil eine ONA — Serie, Specials
                und Chibi-Kurzfilme gleichermaßen. Bei „Lord of Mysteries"
                standen deshalb alle vier Teile unter „Hauptserie" (Daniel,
                12.09.2026: „they are specials and categorized as
                hauptserie").

                AniList sagt es trotzdem: Ein Special nennt die Serie, zu
                der es gehört (`PARENT`), eine Staffel tut das nicht. Der
                Bau reicht das als `beiwerk` durch.
              */
              const hauptIds = new Set(hauptstaffeln(reihenTeile).map((m) => m.id))
              const istHauptstaffel = (m: FranchiseMember) => hauptIds.has(m.id)
              /*
                **Was noch nicht da ist, gehört trotzdem zu seiner Art.**

                Bis zum 04.09.2026 gab es dafür eine vierte Gruppe, „NOCH
                NICHT ERSCHIENEN", ganz unten. Bei „Black Clover" stand
                Staffel 2 damit **unter** zwei Specials und einem Film —
                Daniel sah sie erst nach dem Scrollen und hielt sie für
                fehlend: „ich hab staffel 2 nicht gesehen unter hauptserie
                … keine seperate kategorie ,noch nicht erschienen', sondern
                direkt dort einsortieren wozu es gehört."

                Er hat recht, und zwar nicht nur für diesen Fall: Wer eine
                Reihe aufschlägt, sucht die nächste Staffel — und die ist
                per Definition die, die noch aussteht. Sie ans Ende aller
                Kategorien zu schieben versteckt genau das, wonach gesucht
                wird.

                Innerhalb einer Kategorie stehen die künftigen Teile hinten,
                nach Jahr sortiert. Als **gestrichelt** bleiben sie erkennbar
                — das war ohnehin die Zeilenmarkierung, nicht die Überschrift.
              */
              const nachStandUndJahr = (a: FranchiseMember, b: FranchiseMember) =>
                Number(kuenftig(a)) - Number(kuenftig(b)) || nachJahr(a, b)
              const gruppen = reihenGruppen(reihenTeile, istHauptstaffel, nachStandUndJahr, t)

              /*
                Gezählt wird nur, wo die Nummer etwas unterscheidet: One Piece (ein Eintrag) bleibt ohne „Staffel 1".
                Ab zwei Staffeln trägt jede ihre Nummer, auch mit eigenem Namen; `staffelLabel` bleibt der Rückfall.
              */
              const staffelLabel = staffelBeschriftungen(reihenTeile.filter(istHauptstaffel), reihenName)
              const nummern = staffelStaende(reihenTeile.filter(istHauptstaffel), reihenName)

              const karte = (m: FranchiseMember) => {
                const offen = kuenftig(m)
                return (
                  <ReihenCover
                    key={m.id}
                    m={m}
                    t={t}
                    offen={offen}
                    gewaehlt={m.id === title.id}
                    gemerkt={favorites.has(m.id)}
                    nr={nummern.get(m.id)}
                    namen={teilNamen(m, reihenName, istHauptstaffel(m), staffelLabel.get(m.id))}
                    angaben={angabenZeile(m, offen, t)}
                    gesperrt={wechselt}
                    onWaehlen={wechsleZu}
                  />
                )
              }

              /* Teile ohne belegte deutsche Synchro sind eingeklappt — nur der gewählte Teil bleibt sichtbar (`reihen-regeln.ts`). */
              const ohneOffen = reiheOhneOffen === reihenSchluessel
              const eingeklappt = (m: FranchiseMember) => istEingeklappt(m, title.id)
              const sichtbar = (m: FranchiseMember) => ohneOffen || !eingeklappt(m)
              const lang = reihenTeile.length >= 15
              const suchText = reiheSuche.reihe === reihenSchluessel ? reiheSuche.text.trim() : ''
              const suchKern = (x: string) => x.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase()
              const passtSuche = (m: FranchiseMember) =>
                !suchText || suchKern(`${m.name} ${m.jpYear ?? ''}`).includes(suchKern(suchText))
              const gefiltert = gruppen
                .map((g) => ({ ...g, teile: g.teile.filter((m) => passtSuche(m) && (suchText ? true : sichtbar(m))) }))
                .filter((g) => g.teile.length > 0)
              /* Alle Gruppen stehen offen untereinander (Daniel, 20.10.2026), die Zahl am Schalter gilt der ganzen Reihe. */
              const zahlOhne = reihenTeile.filter(eingeklappt).length
              /*
                **Ein Schalter in der Leiste statt einer Zeile unter der Liste** (Daniel,
                19.09.2026: „ohne deutsche synchro ausblenden zeile entfernen und stattdessen
                toggle oben in die leiste … default toggle state auf ausgeblendet").
              */
              const ohneSchalter =
                zahlOhne > 0 && !suchText ? (
                  <OhneSynchroSchalter
                    t={t}
                    zahl={zahlOhne}
                    ohneOffen={ohneOffen}
                    onChange={() => setReiheOhneOffen(ohneOffen ? null : reihenSchluessel)}
                  />
                ) : null

              return (
                <div className="flex flex-col gap-0.5">
                  {lang && (
                    <ReihenKopf
                      t={t}
                      suche={suchText ? reiheSuche.text : ''}
                      onSuche={(text) => setReiheSuche({ reihe: reihenSchluessel, text })}
                      schalter={ohneSchalter}
                    />
                  )}
                  {!lang && ohneSchalter && <div className="mb-1 flex">{ohneSchalter}</div>}
                  {!gefiltert.length && (
                    <span className="px-1 py-2 text-t4 text-ak-leise">{t(!suchText && zahlOhne > 0 ? 'detail.reiheNurOhne' : 'detail.reiheKeinTreffer')}</span>
                  )}
                  {gefiltert.map((g, i) => (
                    <ReihenSpur key={g.titel} titel={g.titel} gewaehltId={title.id} erste={i === 0} t={t}>
                      {g.teile.map(karte)}
                    </ReihenSpur>
                  ))}
                </div>
              )
            })()}
          </div>
          {wechselt && <span className="text-t5 text-ak-sehr-leise">{t('detail.seasonLoading')}</span>}
        </ReihenKarte>
      )}
    </>
  )
}
