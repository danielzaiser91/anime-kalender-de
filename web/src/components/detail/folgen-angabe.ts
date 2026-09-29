import { type StreamLink, type Release, type Title } from '@shared/types.ts'
import { joynAngabe } from '../../lib/joyn.ts'
import { dubBild, bereicheGekuerzt, dubLuecken, dubGrenze, dubAbdeckung, bereicheKurz } from '@shared/dub-grenze.ts'
import { releaseStatus, expandEvents, istErschienen } from '@shared/logic.ts'
import { formatDate } from '@shared/time.ts'
import type { Translate } from '../../lib/i18n.tsx'

export function folgenAuskunft({ releases, title, t, releaseJePlattform, today }: {
  releases: Release[]
  title: Title | undefined
  t: Translate
  releaseJePlattform: Map<string, Release>
  today: string
}) {

  const folgenAngabeFuer = (
    s:
      | { platform?: string; url?: string; nurFolge?: number; dubRanges?: StreamLink['dubRanges']; dub?: boolean; fenster?: StreamLink['fenster'] }
      | undefined,
  ): string => {
    /*
      **Joyn: nur das gerechnete Fenster, nie die Folgenzahl des Titels** (Daniel, 22.09.2026). Joyn hält
      ein rollendes Fenster; bei Dragon Ball Super stand sonst „131 Fg.“, abrufbar waren 20.
    */
    if (s?.platform === 'joyn') return joynAngabe(s.fenster) ?? ''
    /*
      **Alle Releases des Anbieters zusammen** (21.09.2026, Steel Ball Run). Netflix führt Folge 1
      als eigenes Release (19.03.) und die Folgen 2–12 als Wochenserie ab 25.09.; AniList kennt nur
      die erste. Die Pille zählte ein Release und hielt das Werk für einfolgig — sie blieb leer
      (Daniel mit Bild: „warum steht in der pill nicht wieviele folgen auf netflix … sind").
    */
    const anbieterReleases = s?.platform ? releases.filter((r) => r.platform === s.platform) : []
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
      **Gemischt heißt: das Label nennt die deutschen Folgen** (Daniel, 23.09.2026: „de in
      fokus und nicht de in tooltip"). Vorher stand dort die Lücke („✕ DE 5–7") oder die
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
    if (grenze) return t(grenze.schluessel, { n: grenze.n })
    const release = s?.platform ? releaseJePlattform.get(s.platform) : undefined
    /*
      Ein RTL+-Wochentermin setzt mitten in der Serie ein (Beyblade X ab Folge 101); die
      erschienenen zu zählen ergäbe „16 Fg." bei 115 Folgen auf RTL+ (19.09.2026).
    */
    if (release?.tvLetzteSichtung && release.platform !== 'tv' && releaseStatus(release, today) === 'airing')
      return t('detail.neuAm', { d: formatDate(release.tvLetzteSichtung) })
    if (release?.releaseType === 'weekly' && releaseStatus(release, today) === 'airing') {
      const raus = expandEvents(release).filter((e) => istErschienen(e)).length
      return raus ? t('detail.folgenKurz', { n: raus }) : ''
    }
    /* Mehrere Releases, eines davon als Wochenserie: gezählt wird, was bei diesem Anbieter schon da ist. */
    if (anbieterReleases.length > 1 && anbieterReleases.some((r) => r.releaseType === 'weekly')) {
      const raus = anbieterReleases.flatMap((r) => expandEvents(r)).filter((e) => istErschienen(e)).length
      return raus ? t('detail.folgenKurz', { n: raus }) : ''
    }
    /* Decken die Bereiche den Titel nicht ab, nennt die Pille sie selbst — „Fg. 1–75" statt
       „75 Fg." (Dai-DVD-Box, 16.09.2026): Die Zahl allein sagt nicht, welche fehlen. */
    if (deutsch.length && !dubAbdeckung(s?.dubRanges, title.episodes).vollstaendig)
      return t('detail.folgenBereich', { bereich: bereicheKurz(deutsch) })
    if (deutsch.length) return t('detail.folgenKurz', { n: dubAbdeckung(s?.dubRanges, title.episodes).belegt })
    /*
      **Ohne Sprachbeleg keine Titelzahl** (21.09.2026). Regel 4 war an 1.982 deutschen
      Verweisen gemessen — für einen Weg ohne Urteil schrieb sie trotzdem die Folgen des
      Titels hin. Golden Wind: zwei Prime-Pillen über den Crunchyroll-Kanal, dort nur
      Französisch und Japanisch, und beide zeigten „39 Fg." unter „Alle 39 Folgen auf
      Deutsch" (Daniel mit Bild: „wieso tauchen diese 2 prime pills auf, obwohl sie keine
      deutsche synchro haben?"). Eine Zahl am Weg braucht einen Beleg an genau diesem Weg.
    */
    if (s && s.dub !== true) return ''
    const abgeschlossen = title.jpEnd
      ? title.jpEnd < today
      : Boolean(title.jpYear && title.jpYear < Number(today.slice(0, 4)))
    return abgeschlossen && title.episodes ? t('detail.folgenKurz', { n: title.episodes }) : ''
  }
  return folgenAngabeFuer
}
