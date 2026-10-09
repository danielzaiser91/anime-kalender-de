import { type FranchiseMember, type Title } from '@shared/types.ts'
import { hauptstaffeln, staffelBeschriftungen, staffelStaende, eindeutschenStaffel } from '@shared/titles.ts'
import { coverBild } from '../../lib/cover.ts'
import { FORMAT_DE } from '@shared/mappings.ts'
import { Fragment } from 'react'
import { SynchroMarke } from './reihen-marke.tsx'
import { istEingeklappt, zeileInListeSichtbar } from './reihen-regeln.ts'
import { OhneSynchroSchalter, ReihenKopf } from './reihen-kopf.tsx'
import { ZeilenName } from './zeilen-name.tsx'
import { ReihenKarte } from './reihen-karte.tsx'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'

export function ReihenListe({ reihenTeile, t, reihenName, title, favorites, wechselt, wechsleZu, reiheOhneOffen, reihenSchluessel, reiheSuche, reiheReiter, setReiheOhneOffen, setReiheSuche, setReiheReiter }: {
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
  reiheReiter: { reihe: number; titel: string; } | null
  setReiheOhneOffen: Dispatch<SetStateAction<number | null>>
  setReiheSuche: Dispatch<SetStateAction<{ reihe: number; text: string; }>>
  setReiheReiter: Dispatch<SetStateAction<{ reihe: number; titel: string; } | null>>
}) {
  return (
    <>
      {reihenTeile.length > 1 && (
        <ReihenKarte reihenTeile={reihenTeile} reihenName={reihenName} title={title}>
          {/* Seit dem 09.10.2026 eine Karte unter dem Antwortkasten: bis 8 Teile ohne Innen-Scroll, darüber fünf Zeilen sichtbar (22rem = Kopf + fünf Zeilen, Reihenliste 10.10.2026). */}
          <div data-reihe-liste className={['relative overflow-y-auto p-0.5', reihenTeile.length > 8 ? 'max-h-[22rem]' : ''].join(' ')}>
            {(() => {
              /*
                **Künftig ist, was nach diesem Jahr anfängt.** Ein Titel aus
                2027 ist angekündigt, einer aus 2023 gelaufen — unabhängig
                davon, ob wir für ihn eine deutsche Fassung kennen. Fehlt das
                Jahr, gilt der Teil als erschienen: Ein Eintrag ohne
                Ausstrahlungsjahr ist fast immer ein alter.
              */
              const jahr = new Date().getFullYear()
              /*
                **Künftig ist, was noch keine deutsche Fassung hat und
                frühestens dieses Jahr anfängt.**

                Das Jahr allein genügt nicht: „Staffel 3 — Teil 1" beginnt am
                02.10.2026 und stand mit `jpYear > jahr` bei den erschienenen.
                Ein Tagesdatum führt die Reihe nicht mit — aber
                `ohneSynchro` sagt genau das, worum es hier geht: Für diesen
                Teil gibt es hier noch nichts zu sehen.

                Ein Titel aus einem späteren Jahr ist immer künftig, auch wenn
                wir schon eine Fassung kennen.
              */
              /*
                **AniList sagt es selbst, wo wir bisher gerechnet haben.**

                Der Jahresvergleich ist eine Ableitung und irrt am
                Jahreswechsel in beide Richtungen. `NOT_YET_RELEASED` ist
                dagegen eine Auskunft — für „Lord of the Mysteries 2" steht
                dort 2027 und genau dieser Status. Der Vergleich bleibt als Rückfall für
                Einträge ohne Status.
              */
              const kuenftig = (m: FranchiseMember) =>
                m.jpStatus === 'NOT_YET_RELEASED' ||
                (m.jpStatus !== 'FINISHED' &&
                  ((m.jpYear ?? 0) > jahr || (Boolean(m.ohneSynchro) && (m.jpYear ?? 0) >= jahr)))
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
              const nachJahr = (a: FranchiseMember, b: FranchiseMember) =>
                (a.jpYear ?? 9999) - (b.jpYear ?? 9999) || a.id - b.id

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
              const gruppen: { titel: string; teile: FranchiseMember[] }[] = [
                {
                  titel: t('detail.gruppeStaffeln'),
                  teile: reihenTeile.filter(istHauptstaffel).sort(nachStandUndJahr),
                },
                /* Filme vor Specials: Ein Film ist ein
                   eigenständiges Werk der Reihe, ein Special ist Beiwerk. */
                {
                  titel: t('detail.gruppeFilme'),
                  teile: reihenTeile.filter((m) => m.format === 'MOVIE').sort(nachStandUndJahr),
                },
                {
                  titel: t('detail.gruppeSpecials'),
                  teile: reihenTeile
                    .filter((m) => !istHauptstaffel(m) && m.format !== 'MOVIE')
                    .sort(nachStandUndJahr),
                },
              ].filter((g) => g.teile.length > 0)

              /*
                Gezählt wird nur, wo die Nummer etwas unterscheidet: One Piece (ein Eintrag) bleibt ohne „Staffel 1".
                Ab zwei Staffeln trägt jede ihre Nummer, auch mit eigenem Namen; `staffelLabel` bleibt der Rückfall.
              */
              const staffelLabel = staffelBeschriftungen(reihenTeile.filter(istHauptstaffel), reihenName)
              const nummern = staffelStaende(reihenTeile.filter(istHauptstaffel), reihenName)

              const zeile = (m: FranchiseMember, offen: boolean) => {
                const gewaehlt = m.id === title.id
                const gemerkt = favorites.has(m.id)
                /* `offen` heißt hier „noch nicht erschienen" — dort ist eine fehlende Synchro kein Befund. */
                const ohneDe = Boolean(m.ohneSynchro) && !offen
                /*
                  **Gezeigt wird der unterscheidende Teil, nicht der ganze
                  Name.** Der Reihenname steht zwei Zeilen höher; ihn hier
                  sechsmal zu wiederholen füllt die Breite, die gerade erst
                  gewonnen wurde. Bleibt nach dem Abzug nichts übrig, steht
                  der volle Name da — bei der ersten Staffel ist das der
                  Normalfall.
                */
                const voll = eindeutschenStaffel(m.name)
                let rest = voll.toLowerCase().startsWith(reihenName.toLowerCase())
                  ? voll.slice(reihenName.length).replace(/^[\s:–—-]+/, '').trim()
                  : voll
                /*
                  **Trägt der Name einen fremden Reihennamen, zählt trotzdem
                  nur die Staffelangabe.**

                  „Kusuriya no Hitorigoto Staffel 3 Teil 2" beginnt nicht mit
                  unserem Reihennamen, weil für diesen Teil kein deutscher
                  Titel existiert — der Abzug oben greift dann nicht, und in
                  der Liste stand der volle japanische Name (Daniel,
                  03.09.2026). Einen deutschen Namen können wir nicht
                  erfinden; die Staffelangabe reicht aber, denn welche Reihe
                  gemeint ist, steht zwei Zeilen höher.
                */
                /* Nur bei einer Hauptstaffel: Beim Beiwerk gehört der fremde Reihenname dazu, er unterscheidet den Eintrag von der Hauptserie. */
                const staffelTeil = /(?:^|\s)(Staffel\s+\d+(?:\s*[-–—]?\s*Teil\s+\d+)?)\s*$/i.exec(rest)
                if (istHauptstaffel(m) && staffelTeil && rest === voll && rest !== staffelTeil[1]) rest = staffelTeil[1]!
                /* Und die erste Staffel heißt „Staffel 1", ein Teil „Staffel 1 - Teil 2". */
                const kurz = (istHauptstaffel(m) && staffelLabel.get(m.id)) || rest || voll
                const beschriftung = <ZeilenName nr={nummern.get(m.id)} rest={rest} kurz={kurz} />
                return (
                  <button
                    key={m.id}
                    type="button"
                    role="tab"
                    aria-selected={gewaehlt}
                    disabled={wechselt}
                    ref={gewaehlt ? zeileInListeSichtbar : undefined}
                    onClick={() => !gewaehlt && wechsleZu(m.id)}
                    className={[
                      /*
                        **Eine Zeile je Teil, nicht zwei.**

                        Gemessen am 04.09.2026: 70 px je Zeile, davon 26 px
                        Luft — das Cover (40×56) gab die Höhe vor, der Text
                        brauchte 37. Bei 216 px sichtbarer Höhe waren das
                        drei Teile; eine Reihe mit acht sah nach dreien aus.

                        Titel und Angaben stehen jetzt nebeneinander statt
                        untereinander, das Cover ist auf 24×36 gekürzt: 44 px
                        je Zeile, fünf statt drei sichtbar.
                      */
                      'flex w-full items-center gap-2 rounded-lg border p-1 text-left transition',
                      'focus:outline-none focus-visible:ring-2 focus-visible:ring-sky-400 disabled:opacity-60',
                      gewaehlt
                        ? 'relative border-sky-400 bg-sky-50 ring-1 ring-sky-400/50 before:absolute before:inset-y-1.5 before:left-px before:w-[3px] before:rounded-sm before:bg-sky-400 dark:bg-sky-400/10'
                        : offen
                          ? 'cursor-pointer border-dashed border-slate-300 opacity-80 hover:opacity-100 dark:border-white/20'
                          : gemerkt
                            ? 'cursor-pointer border-amber-400/70 hover:border-amber-400 dark:border-amber-400/60'
                            : 'cursor-pointer border-transparent hover:border-slate-200 dark:hover:border-white/10',
                    ].join(' ')}
                  >
                    <span
                      className={[
                        'block h-9 w-6 shrink-0 overflow-hidden rounded bg-slate-200 dark:bg-white/5',
                        offen ? 'opacity-60' : '',
                      ].join(' ')}
                    >
                      {m.cover && (
                        <img
                          {...coverBild(m.cover, 24)}
                          alt=""
                          loading="lazy"
                          className="h-full w-full object-cover"
                        />
                      )}
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {/*
                        **Ohne deutsche Synchro steht vor dem Namen, nicht dahinter** (Daniel,
                        23.09.2026: „dieser in der reihe hat keine synchro, das muss sichtbar sein
                        bevor man ihn anklickt"). „Super Dragon Ball Heroes" sah in der Reihe von
                        Dragon Ball Super aus wie jeder andere Teil; den Unterschied erfuhr man
                        erst nach dem Klick.

                        Vier Entwürfe an der echten Liste, Daniels Wahl: Rot mit Fahne und Kreuz,
                        dazu der gedämpfte Name. Rot heißt auf dieser Seite sonst „Fehler" — hier
                        heißt es „gibt es nicht auf Deutsch", und genau das ist die Auskunft, um
                        die es geht.

                        Teile, deren Original noch aussteht, tragen stattdessen „Geplant"
                        (10.10.2026): Eine fehlende Synchro ist dort der Normalzustand.
                      */}
                      <SynchroMarke t={t} m={m} ohneDe={ohneDe} />
                      <span
                        className={[
                          'line-clamp-2 min-w-0 text-sm leading-tight',
                          ohneDe ? 'opacity-75' : '',
                          gewaehlt
                            ? 'font-medium text-sky-700 dark:text-sky-300'
                            : 'text-slate-700 dark:text-slate-200',
                        ].join(' ')}
                      >
                        {beschriftung}
                      </span>
                      {/* Rechts, damit der Titel den ganzen übrigen Platz bekommt —
                          „2026 · 12 Fg." ist immer kurz, ein Titel selten. */}
                      <span className="ml-auto shrink-0 text-[11px] text-slate-500 dark:text-slate-400">
                        {[
                          m.format && m.format !== 'TV' ? (FORMAT_DE[m.format] ?? m.format) : '',
                          /*
                            **Der Termin schlägt das Jahr — wo es einen gibt.**

                            Bei „Lord of Mysteries" stand hinter drei von vier
                            Teilen nur das Format: kein Jahr, kein Datum.
                            AniList kennt für die Specials den
                            19.06.2026; seit dem 12.09.2026 holt der
                            Katalogabruf `startDate` mit.

                            Angezeigt wird so genau, wie die Quelle ist:
                            „2026", „06.2026" oder „19.06.2026".
                          */
                          (() => {
                            /*
                              **Was noch aussteht, sagt es mit einem Wort.**
                              Eine gestrichelte Linie allein hat Daniel am
                              12.09.2026 nicht genügt; „ab 2027" beantwortet
                              die Frage, ohne eine Zeile zu kosten.
                            */
                            /*
                              **Hier steht der deutsche Termin oder gar
                              keiner.**

                              Ein japanisches Datum stand hier neben dem
                              deutschen im Kasten darüber, und niemand sah
                              den Unterschied. Das ist dieselbe Trennlinie wie überall in
                              diesem Projekt: Die Seite beantwortet eine
                              deutsche Frage. Ein japanisches Datum an
                              dieser Stelle sieht aus wie eine Antwort
                              darauf und ist keine.

                              `jpStart` bleibt im Datensatz — die Reihe
                              wird danach sortiert.
                            */
                            /*
                              **In der Reihenliste steht das japanische Erscheinungsjahr**.
                              Die Liste ordnet die Teile einer Reihe
                              zeitlich ein — dafür ist das Jahr des Anime die stabile Angabe.
                              Vorher stand hier der deutsche Termin, und bei Dragon Ball Z war
                              das der Disc-Kauftermin 20.11.2026 zwischen „1986" und „1996".

                              Ein kommender Teil behält sein „ab", denn dort ist der deutsche
                              Termin die Auskunft, auf die jemand wartet.
                            */
                            if (offen && m.deStart) {
                              const [jahr, monat, tag] = m.deStart.split('-')
                              if (tag) return `ab ${tag}.${monat}.${jahr}`
                              if (monat) return `ab ${monat}.${jahr}`
                              return `ab ${jahr}`
                            }
                            return m.jpYear ? String(m.jpYear) : m.deStart ? m.deStart.slice(0, 4) : ''
                          })(),
                          m.episodes ? t('detail.folgenKurz', { n: m.episodes }) : '',
                        ]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </span>
                    {gemerkt && (
                      <span className="shrink-0 text-sm text-amber-400" aria-label={t('card.unfavourite')}>
                        ★
                      </span>
                    )}
                  </button>
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
              /* Reiter nur bei langen Reihen ohne laufende Suche; vorausgewählt ist die Gruppe des geöffneten Titels. */
              const reiterZeile = lang && gruppen.filter((g) => g.teile.some(sichtbar)).length > 1
              const mitReitern = reiterZeile && !suchText && gefiltert.length > 1
              const eigeneGruppe = gefiltert.find((g) => g.teile.some((m) => m.id === title.id))?.titel
              const aktiverReiter =
                reiheReiter?.reihe === reihenSchluessel && gefiltert.some((g) => g.titel === reiheReiter.titel)
                  ? reiheReiter.titel
                  : (eigeneGruppe ?? gefiltert[0]?.titel)
              const angezeigt = mitReitern ? gefiltert.filter((g) => g.titel === aktiverReiter) : gefiltert
              /*
                **Die Zahl am Schalter gilt dem Reiter, nicht der Reihe** (Daniel, 22.09.2026:
                „auf hauptserie reiter gibt es keine ohne synchro, also soll toggle auch nicht
                angezeigt werden dort … die zahl der anzahl der ohne synchro unter diesem reiter
                entsprechen"). Gezählt wird in der ungefilterten Gruppe — die Filterung blendet
                genau diese Teile ja aus.
              */
              const zahlOhne = (
                mitReitern ? (gruppen.find((g) => g.titel === aktiverReiter)?.teile ?? []) : reihenTeile
              ).filter(eingeklappt).length
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
                      reiterZeile={reiterZeile}
                      reiter={mitReitern ? gefiltert.map((g) => ({ titel: g.titel, anzahl: g.teile.length })) : null}
                      aktiv={aktiverReiter}
                      onReiter={(titel) => setReiheReiter({ reihe: reihenSchluessel, titel })}
                    />
                  )}
                  {!lang && ohneSchalter && <div className="mb-1 flex">{ohneSchalter}</div>}
                  {!angezeigt.length && (
                    <span className="px-1 py-2 text-xs text-slate-500 dark:text-slate-400">{t(!suchText && zahlOhne > 0 ? 'detail.reiheNurOhne' : 'detail.reiheKeinTreffer')}</span>
                  )}
                  <div role="tablist" aria-label={t('detail.seriesParts')} className="flex flex-col gap-0.5">
                  {angezeigt.map((g, i) => (
                    <Fragment key={g.titel}>
                      {/*
                        Die Überschrift der ersten Gruppe steht ohne Linie
                        darüber — dort trennt sie nichts, sie benennt nur.
                      */}
                      {!mitReitern && <div
                        className={[
                          'flex items-center gap-2',
                          i === 0 ? 'mb-0.5' : 'my-1.5',
                        ].join(' ')}
                      >
                        {i > 0 && <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />}
                        <span className="text-[10px] uppercase tracking-wide text-slate-400 dark:text-slate-500">
                          {g.titel}
                        </span>
                        <span className="h-px flex-1 bg-slate-200 dark:bg-white/10" />
                      </div>}
                      {g.teile.map((m) => zeile(m, kuenftig(m)))}
                    </Fragment>
                  ))}
                  </div>
                </div>
              )
            })()}
          </div>
          {wechselt && <span className="text-[11px] text-slate-400">{t('detail.seasonLoading')}</span>}
        </ReihenKarte>
      )}
    </>
  )
}
