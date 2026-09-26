import { AntwortKasten } from './antwort-kasten.tsx'
import { PLATFORMS, type StreamLink, type Release, type Title, type DiscAusgabe } from '@shared/types.ts'
import { formatDate } from '@shared/time.ts'
import { Pille, farbeZuAnbieter, DiscZeichen, istToggo, ReleasePille, discPillen } from './pillen.tsx'
import { AnbieterIcon, anbieterDatei } from '../../lib/anbieter-icon.tsx'
import { DubEcke } from './vermerk.tsx'
import { MerkenKnopf } from './merken.tsx'
import { toggoAngabe, jetztBerlin } from '../../lib/toggo.ts'
import { anzeigeName } from '@shared/titles.ts'
import { tvAngabe } from '../../lib/tv-angabe.ts'
import type { Translate } from '../../lib/i18n.tsx'
import type { NewsletterVerbindung } from '../../lib/newsletterSync.ts'
import type { Dispatch, SetStateAction } from 'react'
import { type berechneAntwort } from './antwort-berechnen.ts'
import { type sortiereNachZugang } from './wege-sortieren.ts'

export function AntwortBereich({ antwort, sortiertNachZugang, streamReleases, title, t, today, wegeHinweis, kastenNotiz, kaufausgabeZeile, folgenLuecke, verbindung, favorites, folgenAngabeFuer, dubZeilen, releaseJePlattform, releases, discAusgaben, discOffen, setDiscOffen, discReleases }: {
  antwort: ReturnType<typeof berechneAntwort>
  sortiertNachZugang: ReturnType<typeof sortiereNachZugang>
  streamReleases: Release[]
  title: Title
  t: Translate
  today: string
  wegeHinweis: string | undefined
  kastenNotiz: Release | undefined
  kaufausgabeZeile: string | undefined
  folgenLuecke: string | null
  verbindung: NewsletterVerbindung
  favorites: Set<number>
  folgenAngabeFuer: (s: { platform?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; dub?: boolean; fenster?: StreamLink['fenster']; } | undefined) => string
  dubZeilen: (s: { dubRanges?: StreamLink['dubRanges']; }) => string[]
  releaseJePlattform: Map<string, Release>
  releases: Release[]
  discAusgaben: DiscAusgabe[]
  discOffen: boolean
  setDiscOffen: Dispatch<SetStateAction<boolean>>
  discReleases: Release[]
}) {
  return (
    <>
      {antwort && (
        <AntwortKasten
          pillenGruppen={
            new Map([
              ...sortiertNachZugang.flatMap(({ art, plattformen, streamWege }) =>
                [
                  ...plattformen.map((x) => `${x.platform}|${x.url}`),
                  ...streamWege.map((g) => `sw-${g.shop}-${g.eintraege[0].url}`),
                ].map((k) => [k, art === 'kostenlos' ? 'frei' : art] as const),
              ),
              ...streamReleases.map((r) => [r.slug, r.platform === 'tv' ? 'tv' : 'abo'] as const),
            ])
          }
          antwort={antwort}
          title={title}
          t={t}
          today={today}
          wegeHinweis={wegeHinweis}
          notiz={kastenNotiz?.note}
          schnitt={kastenNotiz?.schnitt}
          angebotSeit={
            /* Nennt die Erstausgabe denselben Anbieter früher, ist das spätere Angebot keine
               Auskunft mehr („Auf Deutsch seit 28.12.2023 · Netflix, Inc." über „Bei Netflix im
               Angebot seit 08.03.2024", Pokémon-Concierge, Stichprobe 16.09.2026). */
            title.angebotSeit &&
            !(
              title.deErstausgabe?.von &&
              title.deErstausgabe.von <= title.angebotSeit.date &&
              (title.deErstausgabe.publisher ?? '').toLowerCase().includes((PLATFORMS[title.angebotSeit.platform]?.name ?? '§').toLowerCase())
            )
              ? t('antwort.imAngebotSeit', {
                  datum: formatDate(title.angebotSeit.date),
                  anbieter: PLATFORMS[title.angebotSeit.platform]?.name ?? title.angebotSeit.platform,
                })
              : undefined
          }
          kaufausgabe={kaufausgabeZeile}
          hinweis={
            folgenLuecke ? (
              <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-slate-400">
                {t(/^\d+$/.test(folgenLuecke) ? 'detail.folgeOhneAnbieter' : 'detail.folgenOhneAnbieter', { bereich: folgenLuecke })}
              </p>
            ) : /* Beim Kinofilm sagt der Kino-Hinweis darunter dasselbe (Daniel, 17.09.2026: „doppelte info"). */
            title.ohneSynchro && antwort?.art !== 'kino' ? (
              <>
                <p className="mt-2 text-xs leading-relaxed text-amber-600 dark:text-amber-400">
                  {verbindung.verbunden
                    ? t('detail.noDubWatchConnected', { mail: verbindung.mail ?? '' })
                    : t('detail.noDubWatchOpen')}
                </p>
                {favorites.has(title.id) && (
                  <p className="mt-1 text-xs font-medium text-amber-600 dark:text-amber-400">
                    {t('detail.noDubWatched')}
                  </p>
                )}
              </>
            ) : undefined
          }
            /*
              **Stream ist, wo man es ansehen kann.** Die Zugangsart
              (kostenlos, Abo, Kauf) stand bis zum 03.09.2026 als eigene
              Zwischenüberschrift darüber; sie steht jetzt an der Pille
              selbst, wo sie hingehört — drei Überschriften über je einer
              Pille waren mehr Gliederung als Inhalt.
            */
            stream={sortiertNachZugang.flatMap(({ plattformen }) =>
              plattformen.map((s) => {
                /*
                  **Was da ist, nicht was fehlt.**

                  Der Verlag hat von „Date a Live" genau Folge 1 auf YouTube
                  (Daniel, 07.09.2026: „schreib auch das es nur diese ep
                  unter diesem verweis gibt, sodass kein falscher eindruck
                  entsteht"). `dubLuecken` machte daraus „✕ DE 2–12" —
                  richtig, aber von hinten gedacht: Wer die Pille sieht, will
                  wissen, was er bekommt, nicht was ihm fehlt.

                  Der Fall ist eng gefasst — **ein** deutscher Bereich, und
                  der ist Folge 1. Alles Übrige bleibt bei der Lücken-Form,
                  die dort die kürzere Auskunft ist.
                */
                /* Regeln an `folgenAngabeFuer()` — Film, Bereiche, laufend, abgeschlossen. */
                const folgenAngabe = folgenAngabeFuer(s)
                return (
                  <Pille
                    /*
                      Anbieter **und** Adresse (21.09.2026): Mit `key={s.platform}` trugen zwei
                      Prime-Pillen denselben Schlüssel, und beim Umschalten auf „Disc" blieb eine
                      als verwaister Knoten stehen — Lupin III. Part 6 zeigte die Kanal-Pille
                      unter „Disc" (Daniel mit Bild: „das ist keine disc").
                    */
                    key={`${s.platform}|${s.url}`}
                    name={s.kanal ? `${PLATFORMS[s.platform].name} (${s.kanal})` : PLATFORMS[s.platform].name}
                    farbe={PLATFORMS[s.platform].color}
                    icon={<AnbieterIcon was={s.platform} />}
                    url={s.url}
                    unten={
                      [
                        folgenAngabe,
                        s.teilBereich
                          ? t('detail.teilBereich', { von: s.teilBereich.von, bis: s.teilBereich.bis })
                          : '',
                      ]
                        .filter(Boolean)
                        .join(' · ') || undefined
                    }
                    /*
                      **Was in der Pille kürzt, steht hier ausgeschrieben.**

                      Die Unterzeile trägt seit dem 03.09.2026 nur noch
                      „✕ DE 2–33" statt „Ohne deutschen Ton: Folge 2–33" — sie
                      wurde sonst ausgepunktet, und eine halbe Auskunft ist
                      schlechter als eine kurze. Der Tooltip nennt beides:
                      was fehlt, und wozu die Adresse sonst noch führt.
                    */
                    titel={
                      [
                        ...dubZeilen(s),
                        s.teilBereich
                          ? t('detail.teilBereichTitel', {
                              von: s.teilBereich.von,
                              bis: s.teilBereich.bis,
                            })
                          : '',
                        (s.sharedWith ?? 0) > 1
                          ? t('detail.sharedUrlNote', { count: s.sharedWith! })
                          : '',
                      ]
                        .filter(Boolean)
                        .join('\n') || undefined
                    }
                    rechts={
                      <>
                        <DubEcke dub={s.dub} />
                        <MerkenKnopf
                          release={releaseJePlattform.get(s.platform)}
                          today={today}
                          farbe={PLATFORMS[s.platform].color}
                        />
                      </>
                    }
                  />
                )
              }),
            )
              /*
                **Ein Abgang ist eine Auskunft, kein Loch — und er gehört zu
                den anderen Wegen.**

                Bis zum 01.09.2026 fiel ein Verweis stillschweigend heraus,
                sobald er ins Leere führte. Daniel damals: „auch bei titeln
                die aus dem katalog eines anbieters fliegen entsprechend
                anzeigen … sie sind schließlich nicht mehr klickbar."

                Er stand danach als eigene Zeile über den Pillen — zwei
                Zeilen für eine Auskunft, die in eine Pille passt (Daniel,
                03.09.2026: „nicht mehr abrufbar auf netflix -> umstylen zu
                grauer netflix-pill und in box schieben"). Das Datum steht
                jetzt im Tooltip; sichtbar bleibt, was zählt: dieser Weg ist
                zu.
              */
              /*
                **Zwei Ausgaben derselben Staffel — die ohne Deutsch steht
                daneben, durchgestrichen.**

                Daniel am 14.09.2026 an Digimon: Prime führt die Serie „In
                Prime enthalten" mit deutscher Synchro und über den
                Crunchyroll-Kanal nur mit Untertiteln. Wer bei Prime sucht,
                findet beide; die Pille sagt, welche es nicht ist, statt sie
                zu verschweigen („sodass nutzer sich selbst ein bild machen
                können"). Welche Ausgaben es gibt, entscheidet der Bau
                (`ausgabenOhneDe`).
              */
              .concat(
                (title.ausgabenOhneDe ?? []).map((a) => (
                  <Pille
                    key={`ausgabe-${a.url}`}
                    name={PLATFORMS[a.platform]?.name ?? a.platform}
                    farbe={PLATFORMS[a.platform]?.color}
                    url={a.url}
                    durchgestrichen
                    unten={[
                      a.kanal ? t('detail.ausgabeKanal', { kanal: a.kanal }) : t('detail.ausgabeAndere'),
                      t(a.untertitelDe ? 'detail.ausgabeNurUt' : 'detail.ausgabeOhneDe'),
                    ].join(' · ')}
                    titel={t('detail.ausgabeTitel', { anbieter: PLATFORMS[a.platform]?.name ?? a.platform })}
                  />
                )),
              )
              /* Ein Abo, das über einen Dritten läuft — „Crunchyroll über
                 Prime Video". Es steht bei den Streams, weil man es ansieht
                 und nicht kauft. */
              .concat(
                sortiertNachZugang.flatMap(({ streamWege }) =>
                  streamWege.map((g) => (
                    <Pille
                      key={`sw-${g.shop}-${g.eintraege[0].url}`}
                      name={g.shop}
                      url={g.eintraege[0].url}
                      /*
                        **Dasselbe Zeichen wie am Verweis mit derselben Adresse.**

                        Daniel am 07.09.2026 an „Kill Blue": „warum ist bei
                        ‚… über prime' pills kein ‚DE' zeichen?" Die Pille
                        „Aniverse über Prime Video" und der Prime-Verweis
                        zeigen auf dieselbe Kennung — der eine trug „DE ✓",
                        die andere nichts.

                        Das Urteil erbt der Bezugsweg beim Bauen (`build.ts`,
                        „Ein Weg, ein Urteil"); hier wird es nur angezeigt.
                        Wo keins geerbt wurde, zeigt `DubMark` weiterhin das
                        Fragezeichen — das ist die ehrliche Antwort.
                      */
                      /*
                        **Ein Weg zu einem Anbieter, den wir kennen, sieht aus wie einer.**

                        Die Bezugswege standen weiß und randlos neben den
                        farbigen Anbieter-Pillen, obwohl beide dasselbe
                        beantworten: wo man es sehen kann. Daniel am
                        07.09.2026: „vom blau gefärbten button style ist es
                        deutlich besser als die weiße pill daneben, deshalb
                        mach das so wie beschrieben für alle pills die
                        aktuell noch das weiße style haben".

                        Die Farbe kommt aus dem Namen, und der ist unsere
                        eigene Erzeugung („Amazon Prime
                        (Crunchyroll)"): Wo er mit dem Namen einer bekannten
                        Plattform beginnt, gilt deren Farbe. Ein Shop, den
                        wir nicht als Plattform führen (Videobuster,
                        maxdome), bleibt neutral — dort gibt es keine Farbe,
                        die etwas bedeuten würde.
                      */
                      farbe={farbeZuAnbieter(g.shop)}
                      icon={g.shop === 'aniSearch' ? <DiscZeichen /> : <AnbieterIcon was={g.shop} />}
                      /*
                        **Ein Weg zu einer einzelnen Folge sagt das.**

                        Bei „Banana Fish" führt die Akibapass-Pille auf eine
                        Dub-Vorschau der ersten Folge, und daneben stand als
                        Termin der 06.11.2026 — der zweite Blu-ray-Band.
                        Beides zusammen las sich, als gäbe es bis November
                        gar nichts (Daniel, 12.09.2026: „folge 1 jetzt, rest
                        06.11."). Die Angabe steht am Weg, weil sie zu ihm
                        gehört, nicht zum Titel.
                      */
                      /*
                        **Eine Folgenzahl nur, wo die deutsche Fassung an diesem Weg belegt ist.**

                        „Amazon Prime (Crunchyroll) · 100 Fg." stand über „Dragon Quest: The
                        Adventure of Dai" — der Kanal führt die Serie nur auf Japanisch (Daniel,
                        16.09.2026, mit Bild; Crunchyrolls deutscher Katalog: 0 von 101 Folgen
                        deutsch). Die Zahl stammte aus der Titelregel von `folgenAngabeFuer()`,
                        die für Verweise mit `dub: true` gemessen war und hier ohne jeden Verweis
                        griff. 160 Titel zeigten so eine Stream-Pille mit Folgenzahl, ohne dass
                        dort Deutsch belegt war.

                        Ohne Urteil also keine Zahl — und rechts das Zeichen, das der Kommentar
                        darüber schon lange versprach: „DE ?", die ehrliche Antwort.
                      */
                      unten={(() => {
                        if (istToggo(g.eintraege[0].url))
                          return toggoAngabe((title.watchLinks ?? []).find((w) => w.url === g.eintraege[0].url)?.toggo)
                        if (g.eintraege[0].nurFolge) return t('detail.nurFolge', { n: g.eintraege[0].nurFolge })
                        if (g.eintraege[0].dubRanges?.length) return folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges, url: g.eintraege[0].url, nurFolge: g.eintraege[0].nurFolge }) || undefined
                        const verweis = (title.streams ?? []).find((x) => x.url === g.eintraege[0].url)
                        return verweis?.dub === true ? folgenAngabeFuer(verweis) || undefined : undefined
                      })()}
                      rechts={
                        <DubEcke
                          dub={
                            istToggo(g.eintraege[0].url) ||
                            g.eintraege[0].dubRanges?.some((r) => r.dub) ||
                            (title.streams ?? []).find((x) => x.url === g.eintraege[0].url)?.dub
                          }
                        />
                      }
                    />
                  )),
                ),
              )
              .concat(
                streamReleases.map((r) => (
                  <ReleasePille
                    key={r.slug}
                    release={r}
                    titel={anzeigeName(title)}
                    today={today}
                    tvText={tvAngabe(r, title, releases, today, jetztBerlin().slice(11, 16))}
                  />
                )),
              )}
            /*
              **Disc ist, was man kauft** — Händler und Vorbestellungen.
              Vier Ausgaben desselben Verlags sind **eine** Auskunft, keine
              vier (Daniel, 20.08.2026): eine Pille je Shop, die Zahl der
              Ausgaben in der zweiten Zeile.
            */
            disc={[
              /* Die aniSearch-Ausgaben ersetzen die eine aniSearch-Pille, sobald sie geladen sind. */
              ...discPillen(discAusgaben, discOffen, () => setDiscOffen((o) => !o), t as unknown as (k: string, v?: Record<string, string | number>) => string),
              ...sortiertNachZugang.flatMap(({ shops }) =>
                shops
                  .filter((g) => !(g.shop === 'aniSearch' && discAusgaben.length))
                  .map((g) => (
                  <Pille
                    key={g.shop + g.eintraege[0].url}
                    name={g.shop}
                    url={g.eintraege[0].url}
                    unten={
                      g.eintraege.length > 1
                        ? t('where.angebote', { count: g.eintraege.length })
                        : g.eintraege[0].dubRanges?.length
                          ? folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges }) || undefined
                          : undefined
                    }
                    rechts={g.eintraege[0].dubRanges?.some((r) => r.dub) ? <DubEcke dub /> : undefined}
                    /*
                      Auch hier trägt der Weg die Farbe seines Anbieters —
                      derselbe Grund wie bei den Stream-Wegen darüber. Für
                      aniSearch kommt die Silberscheibe dazu: Sie ersetzt
                      das Wort „Disc", das bis zum 07.09.2026 im Namen stand.
                    */
                    farbe={farbeZuAnbieter(g.shop)}
                    icon={anbieterDatei(g.shop) ? <AnbieterIcon was={g.shop} /> : <DiscZeichen />}
                  />
                )),
              ),
              ...discReleases.map((r) => (
                <ReleasePille key={r.slug} release={r} titel={anzeigeName(title)} today={today} />
              )),
            ]}
        />
      )}
    </>
  )
}
