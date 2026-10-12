import { DiscZeichen } from '../ui.tsx'
import { AnbieterIcon } from '../../lib/anbieter-icon.tsx'
import { toggoAngabe } from '../../lib/toggo.ts'
import type { Title } from '@shared/types.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { DubEcke } from './vermerk.tsx'
import { Pille, farbeZuAnbieter, istToggo } from './pillen.tsx'
import type { sortiereNachZugang } from './wege-sortieren.ts'
import type { AntwortBereich } from './antwort-bereich.tsx'

type StreamWeg = ReturnType<typeof sortiereNachZugang>[number]['streamWege'][number]

/** Ein Abo, das über einen Dritten läuft — „Crunchyroll über Prime Video" — als Pille. */
export function StreamWegPille({ g, title, t, folgenAngabeFuer }: {
  g: StreamWeg
  title: Title
  t: Translate
  folgenAngabeFuer: Parameters<typeof AntwortBereich>[0]['folgenAngabeFuer']
}) {
  return (
    <Pille
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
  )
}
