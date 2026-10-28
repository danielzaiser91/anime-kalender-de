import { type StreamLink, type Release, type Title } from '@shared/types.ts'
import { joynAngabe } from '../../lib/joyn.ts'
import { dubBild, bereicheGekuerzt, dubLuecken, dubGrenze, bereicheKurz } from '@shared/dub-grenze.ts'
import { releaseStatus, expandEvents } from '@shared/logic.ts'
import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'
import { abgeleiteteFolgen, ungefaehr, zaehleErschienen } from './antwort-regeln.ts'
import { zaehlPlattform } from './prime-kanal.ts'
import { erschieneneSpanne, ergaenzungGeschaetzt, planGeschaetzt } from './folgen-spanne.ts'

/** Überlappende und aneinanderstoßende Bereiche zu einem: 1–5 und 6–12 sind „1–12“. */
export function zusammengefasst(bereiche: { from: number; to: number }[]): { from: number; to: number }[] {
  const raus: { from: number; to: number }[] = []
  for (const b of [...bereiche].sort((x, y) => x.from - y.from)) {
    const letzter = raus[raus.length - 1]
    if (letzter && b.from <= letzter.to + 1) letzter.to = Math.max(letzter.to, b.to)
    else raus.push({ from: b.from, to: b.to })
  }
  return raus
}

export function folgenAuskunft({ releases, title, t, releaseJePlattform, today }: {
  releases: Release[]
  title: Title | undefined
  t: Translate
  releaseJePlattform: Map<string, Release>
  today: string
}) {

  const folgenAngabeFuer = (
    s:
      | { platform?: string; kanal?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; ergaenzteFolgen?: number[]; dub?: boolean; fenster?: StreamLink['fenster'] }
      | undefined,
  ): string => {
    /*
      **Joyn: nur das gerechnete Fenster, nie die Folgenzahl des Titels**. Joyn hält
      ein rollendes Fenster; bei Dragon Ball Super stand sonst „131 Fg.“, abrufbar waren 20.
    */
    if (s?.platform === 'joyn') return joynAngabe(s.fenster) ?? ''
    /* Ein Prime-Kanal-Weg ohne eigene Bereiche zählt wie der Anbieter, dessen Bestand er führt (Slime Staffel 4, 10.10.2026; `prime-kanal.ts`). */
    const bestandsPlattform = s && zaehlPlattform(s, title?.streams ?? [])
    /*
      **Alle Releases des Anbieters zusammen** (21.09.2026, Steel Ball Run). Netflix führt Folge 1
      als eigenes Release (19.03.) und die Folgen 2–12 als Wochenserie ab 25.09.; AniList kennt nur
      die erste. Die Pille zählte ein Release und hielt das Werk für einfolgig — sie blieb leer.
    */
    const anbieterReleases = bestandsPlattform ? releases.filter((r) => r.platform === bestandsPlattform) : []
    const folgenLautReleases = Math.max(
      0,
      ...anbieterReleases.map((r) => (r.schedule?.firstEpisodeNumber ?? 1) - 1 + (r.schedule?.episodeCount ?? 1)),
    )
    /* Ein Werk mit genau einer Folge ist wie ein Film: „1 Fg." sagt nichts (Dr. Stone Ryusui, Stichprobe 17.09.2026). */
    if (!title || title.format === 'MOVIE' || (title.episodes === 1 && folgenLautReleases <= 1)) return ''
    const deutsch = (s?.dubRanges ?? []).filter((r) => r.dub)
    /*
      **„nur" nur, wo der Weg wirklich nur diese Folge enthält** (18.09.2026). Bei Date a
      Live auf YouTube stimmte es — dort liegt ein einzelnes Video. Bei „Monster" auf
      Netflix (74 Folgen, belegt ist Folge 1) behauptete es eine Lücke, die niemand
      gemessen hat; dort steht jetzt der Bereich („Fg. 1") wie bei jedem anderen
      Teilbeleg.
    */
    const einzelneFolge =
      s?.nurFolge != null || (/youtube\.com\/watch\?/.test(s?.url ?? '') && !/[?&]list=/.test(s?.url ?? ''))
    if (einzelneFolge && deutsch.length === 1 && deutsch[0]!.from === 1 && deutsch[0]!.to === 1)
      return t('detail.dubNurEine')
    /*
      **Gemischt heißt: das Label nennt die deutschen Folgen**. Vorher stand dort die Lücke („✕ DE
      5–7") oder die
      Grenze („✓ DE 1–155"). Beide beantworten nur einen Teil der Frage, und die Lücken-Form
      stellt sogar das Fehlende nach vorn. Bei drei Bereichen und mehr kürzt die Pille; der
      Hinweis daneben zählt alle auf.
    */
    const bild = dubBild(s?.dubRanges, title.episodes)
    if (bild?.ohneTon.length && bild.deutsch.length) {
      const { text: bereiche, rest } = bereicheGekuerzt(bild.deutsch)
      return rest ? t('detail.dubDeMehr', { bereiche, n: rest }) : t('detail.dubDe', { bereiche })
    }
    const luecken = dubLuecken(s?.dubRanges)
    if (luecken) return t('detail.dubLuecken', { n: luecken })
    const grenze = dubGrenze(s?.dubRanges)
    /* „Fg. 1–n“ nur, wenn der deutsche Ton wirklich bei Folge 1 beginnt; sonst nennt die Pille unten die echten Bereiche. */
    if (grenze && (grenze.schluessel === 'detail.dubFrom' || Math.min(...deutsch.map((r) => r.from)) <= 1)) return t(grenze.schluessel, { n: grenze.n })
    const release = bestandsPlattform ? releaseJePlattform.get(bestandsPlattform) : undefined
    /*
      Ein RTL+-Wochentermin setzt mitten in der Serie ein (Beyblade X ab Folge 101); die
      erschienenen zu zählen ergäbe „16 Fg." bei 115 Folgen auf RTL+ (19.09.2026).
    */
    if (release?.tvLetzteSichtung && release.platform !== 'tv' && releaseStatus(release, today) === 'airing')
      return t('detail.neuAm', { d: formatDate(release.tvLetzteSichtung) })
    /* Wochenserie, oder mehrere Releases mit einer Wochenserie: gezählt wird, was bei diesem Anbieter schon da ist (Abwurf Folge 1–11 plus Wochentakt ab 12 ergibt 15). */
    const wochenlauf = release?.releaseType === 'weekly' && releaseStatus(release, today) === 'airing'
    if (wochenlauf || (anbieterReleases.length > 1 && anbieterReleases.some((r) => r.releaseType === 'weekly'))) {
      const events = anbieterReleases.flatMap((r) => expandEvents(r))
      const spanne = erschieneneSpanne(events)
      const raus = zaehleErschienen(events)
      const text = spanne ? t('detail.folgenBereich', { bereich: spanne }) : raus ? t('detail.folgenKurz', { n: raus }) : ''
      return text && ungefaehr(text, planGeschaetzt(events, s?.dubRanges, s?.ergaenzteFolgen))
    }
    /* Liegen Bereiche vor, nennt die Pille immer sie selbst — nie eine Zählung ab 1 aus den Releases: Bei Mushoku Tensei Cour 2 steht der Beleg in Staffelzählung (1–12), Netflix zählt durchgehend 12–23 (11.10.2026; Belege umgerechnet 28.10.2026). */
    if (deutsch.length) return ungefaehr(t('detail.folgenBereich', { bereich: bereicheKurz(zusammengefasst(deutsch)) }), ergaenzungGeschaetzt(anbieterReleases, s?.ergaenzteFolgen))
    /*
      **Ohne Sprachbeleg keine Titelzahl** (21.09.2026). Regel 4 war an 1.982 deutschen
      Verweisen gemessen — für einen Weg ohne Urteil schrieb sie trotzdem die Folgen des
      Titels hin. Golden Wind: zwei Prime-Pillen über den Crunchyroll-Kanal, dort nur
      Französisch und Japanisch, und beide zeigten „39 Fg." unter „Alle 39 Folgen auf
      Deutsch". Eine Zahl am Weg braucht einen Beleg an genau diesem Weg.
    */
    if (s && s.dub !== true) return ''
    const abgeleitet = abgeleiteteFolgen(title, releases, today)
    return abgeleitet ? ungefaehr(t('detail.folgenKurz', { n: abgeleitet }), true) : ''
  }
  return folgenAngabeFuer
}
