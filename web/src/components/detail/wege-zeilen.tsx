import { PLATFORMS, type Release, type Title, type DiscAusgabe, type StreamLink } from '@shared/types.ts'
import { streamNurOmu, synchroAngekuendigt } from '@shared/ankuendigung.ts'
import { anzeigeName } from '@shared/titles.ts'
import { farbeZuAnbieter, istToggo } from './pillen.tsx'
import { DiscBereich } from './disc-bereich.tsx'
import { TerminZeile } from './termin-zeile.tsx'
import { Pille, DubStatus } from './pille.tsx'
import { istAnnahme, streamStatus, streamWegStatus } from './legende-zeilen.ts'
import { DiscZeichen } from '../ui.tsx'
import { AnbieterIcon, anbieterDatei } from '../../lib/anbieter-icon.tsx'
import { MerkenKnopf } from './merken.tsx'
import { toggoAngabe, jetztBerlin } from '../../lib/toggo.ts'
import type { TvZuletzt } from '../../lib/tv-zuletzt.ts'
import { tvVorbeiPillen } from './tv-vorbei.tsx'
import type { Translate } from '../../lib/i18n.tsx'
import type { Dispatch, SetStateAction } from 'react'
import { pillenSchluessel, type sortiereNachZugang } from './wege-sortieren.ts'
import { tvAngabe } from '../../lib/tv-angabe.ts'
import { teilAngaben } from './wege-falten.ts'
import { pilleUnten } from './pille-unten.ts'
import { ausgabenOhneDeSichtbar, kanalTerminQuelle } from './chips-regeln.ts'

/** Eine Zeile je Termin: Sender oder Anbieter, Datum, Folge; ein Prime-Kanal-Termin mit deutschem Anbieter-Weg trägt dessen Folgen und „Deutsch“. */
export function terminPillen(rs: Release[], title: Title, releases: Release[], today: string, folgenAngabeFuer: FolgenAngabeFuer) {
  return rs.map((r) => {
    const quelle = kanalTerminQuelle(r, title)
    return (
      <TerminZeile
        key={r.slug}
        release={r}
        titel={anzeigeName(title)}
        today={today}
        tvText={tvAngabe(r, title, releases, today, jetztBerlin().slice(11, 16))}
        deutsch={quelle ? { folgen: folgenAngabeFuer(quelle) } : undefined}
      />
    )
  })
}

type Sortiert = ReturnType<typeof sortiereNachZugang>
type FolgenAngabeFuer = (s: { platform?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; dub?: boolean; fenster?: StreamLink['fenster'] } | undefined) => string

/** Die Zeilen unter „Stream" im Antwortkasten (Anbieter, Ausgaben ohne Deutsch, Bezugswege, Termine, TV). */
export function streamZeilen({ sortiertNachZugang, title, t, today, folgenAngabeFuer, dubZeilen, releaseJePlattform, streamReleases, releases, tvVorbei }: {
  sortiertNachZugang: Sortiert
  title: Title
  t: Translate
  today: string
  folgenAngabeFuer: FolgenAngabeFuer
  dubZeilen: (s: { dubRanges?: StreamLink['dubRanges'] }) => string[]
  releaseJePlattform: Map<string, Release>
  streamReleases: Release[]
  releases: Release[]
  tvVorbei: TvZuletzt[]
}) {
            /*
              **Stream ist, wo man es ansehen kann.** Die Zugangsart
              (kostenlos, Abo, Kauf) stand bis zum 03.09.2026 als eigene
              Zwischenüberschrift darüber; sie steht jetzt an der Pille
              selbst, wo sie hingehört — drei Überschriften über je einer
              Pille waren mehr Gliederung als Inhalt.
            */
            return sortiertNachZugang.flatMap(({ plattformen }) =>
              plattformen.map((s) => {
                /*
                  **Was da ist, nicht was fehlt.**

                  Der Verlag hat von „Date a Live" genau Folge 1 auf YouTube.
                  `dubLuecken` machte daraus „✕ DE 2–12" —
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
                      unter „Disc".
                    */
                    key={pillenSchluessel(s)}
                    name={s.kanal ? `${PLATFORMS[s.platform].name} (${s.kanal})` : PLATFORMS[s.platform].name}
                    farbe={PLATFORMS[s.platform].color}
                    icon={<AnbieterIcon was={s.platform} />}
                    url={s.url}
                    unten={pilleUnten({ title, s, releases, folgenAngabe, today, t })}
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
                        streamNurOmu(title, s, releases) ? t(synchroAngekuendigt(title, s) ? 'detail.pilleNurOmu' : 'detail.pilleNurOmuOffen') : '',
                        s.teilBereich ? teilAngaben(title, s.teilBereich, t, folgenAngabe).titel : '',
                        (s.sharedWith ?? 0) > 1
                          ? t('detail.sharedUrlNote', { count: s.sharedWith! })
                          : '',
                      ]
                        .filter(Boolean)
                        .join('\n') || undefined
                    }
                    status={<DubStatus art={streamStatus(title, s, releases)} />}
                    aktion={<MerkenKnopf release={releaseJePlattform.get(s.platform)} today={today} zeile />}
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
                ausgabenOhneDeSichtbar(title).map((a) => (
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
                        gar nichts. Die Angabe steht am Weg, weil sie zu ihm
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
                        if (g.eintraege[0].dubRanges?.length && !istAnnahme(g.eintraege[0])) return folgenAngabeFuer({ dubRanges: g.eintraege[0].dubRanges, url: g.eintraege[0].url, nurFolge: g.eintraege[0].nurFolge }) || undefined
                        const verweis = (title.streams ?? []).find((x) => x.url === g.eintraege[0].url)
                        return verweis?.dub === true ? folgenAngabeFuer(verweis) || undefined : undefined
                      })()}
                      status={<DubStatus art={streamWegStatus(g, title)} />}
                    />
                  )),
                ),
              )
              .concat(
                terminPillen(streamReleases, title, releases, today, folgenAngabeFuer),
              ).concat(tvVorbeiPillen(tvVorbei, anzeigeName(title), today, t('detail.tvNurVorbei')))
}

/** Die Kaufweg-Pillen unter „Disc": eine Pille je Shop; die aniSearch-Ausgaben ersetzen die eine aniSearch-Pille, sobald sie geladen sind. */
function kaufwegPillen({ sortiertNachZugang, t, folgenAngabeFuer, discAusgaben }: {
  sortiertNachZugang: Sortiert
  t: Translate
  folgenAngabeFuer: FolgenAngabeFuer
  discAusgaben: DiscAusgabe[]
}) {
  return sortiertNachZugang.flatMap(({ shops }) =>
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
          status={g.eintraege[0].dubRanges?.some((r) => r.dub) ? <DubStatus art="belegt" /> : undefined}
          /* Der Weg trägt die Farbe seines Anbieters; aniSearch bekommt die Silberscheibe. */
          farbe={farbeZuAnbieter(g.shop)}
          icon={anbieterDatei(g.shop) ? <AnbieterIcon was={g.shop} /> : <DiscZeichen />}
        />
      )),
  )
}

/** Die Zeilen unter „Disc": Händler, aniSearch-Ausgaben, Disc-Termine. */
export function discZeilen({ sortiertNachZugang, title, t, today, folgenAngabeFuer, discAusgaben, discReleases }: {
  sortiertNachZugang: Sortiert
  title: Title
  t: Translate
  today: string
  folgenAngabeFuer: FolgenAngabeFuer
  discAusgaben: DiscAusgabe[]
  discOffen: boolean
  setDiscOffen: Dispatch<SetStateAction<boolean>>
  discReleases: Release[]
}) {
  /*
    **Disc ist, was man kauft** — Händler und Vorbestellungen. Vier Ausgaben desselben Verlags
    sind **eine** Auskunft: eine Pille je Shop, die Zahl der Ausgaben in der zweiten Zeile.
  */
  const kaufwege = kaufwegPillen({ sortiertNachZugang, t, folgenAngabeFuer, discAusgaben })
  /* Die Varianten stehen als Matrix (Mockup B3, F96); ohne Ausgabe und Termin bleiben nur die Kaufwege. */
  if (!discAusgaben.length && !discReleases.length) return kaufwege
  return [<DiscBereich key="disc-bereich" title={title} today={today} discAusgaben={discAusgaben} discReleases={discReleases} kaufwege={kaufwege} />]
}
