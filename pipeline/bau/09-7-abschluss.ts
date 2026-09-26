import { readJson, log } from '../lib/util.ts'
import { type Title, type StreamLink, type Release, type PlatformId } from '../../shared/types.ts'
import { todayIso } from '../../shared/time.ts'
import { eindeutschenStaffel } from '../../shared/titles.ts'
import { deutscheFolgenNachDemEnde, type CrDubData } from '../lib/crunchyroll-dub.ts'
import { rtlplusWochentermine, type RtlFolge } from '../lib/rtlplus-folgen.ts'
import { type EntfernterVerweis } from './grundlagen.ts'
import { type DubCheck } from '../lib/dub-confirmed.ts'

export function schliesseSynchroAb({ titles, verweiseEntfernt, releases, crDub, belegFuer }: {
  titles: Map<number, Title>
  verweiseEntfernt: EntfernterVerweis[]
  releases: Release[]
  crDub: CrDubData
  belegFuer: (titleId: number, plattform: PlatformId, url?: string, anzahlWege?: number) => DubCheck | undefined
}) {
  /**
   * **Wer die Staffeln exakt füllt, lässt für einen weiteren keinen Platz.**
   *
   * Die Umkehrung der Rechnung vom 10.09.2026: Meldet der Anbieter seine
   * Staffelaufteilung, und füllen unsere **beurteilten** Titel jede seiner
   * Staffeln der Reihe nach exakt auf, dann ist dort nichts mehr frei. Ein
   * Titel derselben Adresse ohne Urteil läuft dort nicht — sein Verweis führt
   * ins Leere.
   *
   * Das ist kein Umkehrschluss aus Schweigen, sondern eine Abzählung: Netflix
   * zeigt „Sword Art Online" mit 25 und 24 Folgen, unsere ersten beiden Titel
   * haben genau diese Zahlen und sind belegt. Für die 23 Folgen der beiden
   * Alicization-Teile ist kein Platz — sie laufen dort wirklich nicht. Dasselbe
   * bei „Mushoku Tensei": 23 + 25 = 11 + 12 und 13 + 12, der Special mit seiner
   * einen Folge passt in keine der beiden Staffeln.
   *
   * **Drei Bedingungen, alle notwendig**, und zusammen sind sie streng genug:
   * Die Aufteilung des Anbieters muss vorliegen, die beurteilten Titel müssen
   * **jede** Staffel exakt füllen, und es darf keiner von ihnen übrig bleiben.
   * Fehlt eine davon, wird nichts entfernt — das ist der Unterschied zu der
   * Positionspaarung, die am 22.08.2026 sechs Verweise zu Unrecht gestrichen
   * hat (siehe CLAUDE.md, „Der Anbieter zählt kumulativ").
   */
  {
    const staffelStruktur = readJson<
      Record<string, { staffeln?: { seq: number; folgen: number }[] }>
    >('data/anbieter-staffeln.json', {})
    const netflixKennung = (u: string): string | null =>
      /netflix\.com\/(?:[a-z-]+\/)?title\/(\d+)/i.exec(u)?.[1] ?? null
    const jahrRang = (t: Title): number =>
      (t.jpYear ?? 0) * 100 + ({ WINTER: 1, SPRING: 2, SUMMER: 3, FALL: 4 }[t.jpSeason ?? ''] ?? 0)

    /* Alle Titel je Netflix-Adresse, in der Reihenfolge ihrer Ausstrahlung. */
    const jeAdresse = new Map<string, Array<{ title: Title; stream: StreamLink }>>()
    for (const title of titles.values()) {
      for (const stream of title.streams ?? []) {
        const id = netflixKennung(stream.url)
        if (!id) continue
        const liste = jeAdresse.get(id) ?? []
        liste.push({ title, stream })
        jeAdresse.set(id, liste)
      }
    }

    let ohnePlatz = 0
    for (const [id, liste] of jeAdresse) {
      const staffeln = staffelStruktur[id]?.staffeln
      if (!staffeln?.length) continue
      const offen = liste.filter((e) => e.stream.dub !== true && e.stream.dub !== false)
      if (!offen.length) continue
      const sortiert = [...liste].sort((a, b) => jahrRang(a.title) - jahrRang(b.title) || a.title.id - b.title.id)
      const beurteilt = sortiert.filter((e) => e.stream.dub === true || e.stream.dub === false)

      let i = 0
      let fuellt = true
      for (const st of staffeln) {
        let summe = 0
        while (i < beurteilt.length && summe < (st.folgen ?? 0)) {
          const n = beurteilt[i]!.title.episodes ?? 0
          if (!n || summe + n > (st.folgen ?? 0)) break
          summe += n
          i++
        }
        if (summe !== (st.folgen ?? 0)) {
          fuellt = false
          break
        }
      }
      if (!fuellt || i !== beurteilt.length) continue

      for (const { title, stream } of offen) {
        title.streams = title.streams.filter((x) => x !== stream)
        ohnePlatz++
        verweiseEntfernt.push({
          titleId: title.id,
          titel: title.titleDe ?? title.titleEn ?? title.titleRomaji ?? String(title.id),
          plattform: stream.platform,
          url: stream.url,
          seriesId: null,
          grund:
            `der Anbieter führt ${staffeln.map((st) => st.folgen).join(' + ')} Folgen, und die belegten Titel ` +
            `füllen sie exakt — für ${title.episodes ?? '?'} weitere ist dort kein Platz`,
          geprueftAm: null,
          entferntAm: todayIso(),
          letzterWeg: title.streams.length === 0,
        })
      }
    }
    if (ohnePlatz) log(`${ohnePlatz} Netflix-Verweise entfernt: die Staffeln des Anbieters sind voll`)
  }

  if (verweiseEntfernt.length) {
    const ohneWeg = verweiseEntfernt.filter((e) => e.letzterWeg).length
    log(`${verweiseEntfernt.length} entfernte Verweise protokolliert (${ohneWeg} Titel zeigen danach keinen Weg mehr)`)
  }

  /**
   * Adressen vermerken, die mehrere unserer Einträge bedienen.
   *
   * Anlass (Daniel, 12.08.2026): Bei „The Café Terrace and Its Goddesses"
   * zeigten unsere Staffel 1 und Staffel 2 auf **dieselbe** Crunchyroll-Seite —
   * und dort steht das Ganze als *eine* Staffel mit 24 Folgen. Dasselbe bei
   * „The Case Study of Vanitas". Wer bei uns „Staffel 2" anklickt und dort 24
   * Folgen vorfindet, hält eine der beiden Angaben für falsch; tatsächlich
   * zählen bloß beide anders.
   *
   * Was hier belegt wird, ist genau das und nicht mehr: **wie viele unserer
   * Einträge dieselbe Adresse teilen.** Wie die Plattform ihrerseits in
   * Staffeln einteilt, wissen wir nicht — dafür müsste man die Serienseite
   * abrufen, die ihre Staffelliste per JavaScript nachlädt. Der Hinweis in der
   * Oberfläche sagt deshalb „kann abweichen", nicht „weicht ab".
   */
  const proAdresse = new Map<string, number>()
  for (const title of titles.values()) {
    for (const stream of title.streams) proAdresse.set(`${stream.platform}|${stream.url}`, (proAdresse.get(`${stream.platform}|${stream.url}`) ?? 0) + 1)
  }
  let geteilt = 0
  for (const title of titles.values()) {
    for (const stream of title.streams) {
      const anzahl = proAdresse.get(`${stream.platform}|${stream.url}`) ?? 1
      if (anzahl > 1) {
        stream.sharedWith = anzahl
        geteilt++
      }
    }
  }
  log(`${geteilt} Verweise teilen sich eine Adresse mit anderen Einträgen`)

  /**
   * „Season" kommt nicht auf die Seite — auch nicht über einen Release-Namen.
   *
   * Die Namen stammen aus dem Crunchyroll-Kalender und aus AniList und tragen
   * dort „Season 2", „2nd Season", „Final Season". Im Detail-Panel stand das
   * dann neben dem deutschen „Staffel 4" — dasselbe Wort zweimal, in zwei
   * Sprachen, in einem Blickfeld (Daniel, 12.08.2026).
   *
   * Umgestellt wird hier und nicht in der Oberfläche, weil dieselben Namen in
   * die ICS-Feeds und die Teilen-Seiten wandern. Ersetzt wird nur die
   * Staffelmarkierung; der übrige Titel ist ein Eigenname.
   *
   * **Vor** dem Ausrollen der Termine — die kopieren den Namen. Stand die
   * Umstellung dahinter, war sie in `releases.json` erledigt und in
   * `events.json` nicht, und der Kalender zeigte weiter „The 100 Girlfriends …
   * Season 3" (bemerkt bei der Sichtprüfung im Browser, 12.08.2026).
   */
  for (const release of releases) release.name = eindeutschenStaffel(release.name)

  /*
    **Was belegt erschienen ist, ist keine Schätzung mehr.** Eine Meldung mit Folgenbereich
    sagt, bis zu welcher Folge der Anbieter liefert, und ihr Prüftag, bis wann das stand.
    Genau das braucht `expandEvents()` — siehe `schedule.belegtBis`.
  */
  /*
    **Ein Crunchyroll-Verweis nennt seine deutschen Folgen, wo der Bestand sie kennt.**
    Black Clover stand als „155 von 170 Folgen auf Deutsch · Für die übrigen fehlt uns
    eine Angabe", weil nur Netflix Bereiche trug — Crunchyroll führt alle 170 deutsch
    (vier Blöcke, 1–170). Die Stichprobe vom 16.09.2026 fand dasselbe bei JoJo und My
    Hero Academia 4. Gesetzt wird nur bei einem Verweis, der genau einen Titel bedient,
    und nur bei eindeutiger Zählung (keine Nummer doppelt, keine über der Folgenzahl):
    gemessen 160 Verweise, 157 vollständig.
  */
  {
    const crDubNachUrl = new Map(crDub.serien.filter((s) => s.katalog === 'de').map((s) => [s.url, s]))
    let crBereiche = 0
    for (const title of titles.values()) {
      for (const s of title.streams) {
        if (s.platform !== 'crunchyroll' || s.dub !== true || s.dubRanges?.length || s.sharedWith) continue
        const serie = crDubNachUrl.get(s.url)
        if (deutscheFolgenNachDemEnde(serie?.staffeln ?? [], title.episodes)) continue
        const nummern = (serie?.staffeln ?? [])
          .flatMap((st) => (st.deutscheFolgen ?? []).map((f) => f.nummer))
          .filter((n): n is number => Number.isInteger(n) && (n as number) > 0)
        if (!nummern.length || !title.episodes) continue
        if (new Set(nummern).size !== nummern.length || Math.max(...nummern) > title.episodes) continue
        const sortiert = [...nummern].sort((a, b) => a - b)
        const bereiche: { from: number; to: number; dub: boolean }[] = []
        for (const n of sortiert) {
          const letzter = bereiche[bereiche.length - 1]
          if (letzter && letzter.to === n - 1) letzter.to = n
          else bereiche.push({ from: n, to: n, dub: true })
        }
        s.dubRanges = bereiche
        crBereiche++
      }
    }
    if (crBereiche) log(`${crBereiche} Crunchyroll-Verweise mit ihren deutschen Folgen aus dem Bestand`)
  }

  /*
    RTL+-Staffeln, die gerade wöchentlich wachsen (Beyblade X, 19.09.2026). Erst hier: Die
    Bedingung „Synchro am RTL+-Weg belegt" liest `dub`, und das steht erst nach den
    Handbelegen fest (der erste Bau fand deshalb nichts). Und so kann der Termin nicht
    selbst als Beleg in `dubByTitle` einfließen.
  */
  const ausRtl = rtlplusWochentermine(
    readJson<{ titel?: Record<string, { programm: string; folgen: RtlFolge[] }> }>('data/rtlplus-folgen.json', {}).titel ?? {},
    titles,
    releases,
    todayIso(),
  )
  releases.push(...ausRtl)
  if (ausRtl.length) log(`${ausRtl.length} RTL+-Wochentermine: ${ausRtl.map((r) => r.name).join(', ')}`)

  /* kinoheld-Adressen aus der Suche (`fetch-kinoheld.ts`) — der Kino-Banner verlinkt sie. */
  {
    const kinoheld = readJson<Record<string, string>>('data/kinoheld.json', {})
    for (const r of releases) {
      const adresse = kinoheld[r.slug]
      if (r.platform === 'kino' && adresse && !(r.sources ?? []).includes(adresse)) r.sources = [...(r.sources ?? []), adresse]
    }
  }

  let belegtBisGesetzt = 0
  for (const release of releases) {
    if (release.releaseType !== 'weekly') continue
    const title = titles.get(release.titleId)
    const stream = title?.streams.find((s) => s.platform === release.platform && s.dub === true)
    const bis = Math.max(0, ...(stream?.dubRanges ?? []).filter((r) => r.dub).map((r) => r.to))
    if (!title || !stream || !bis) continue
    const am = belegFuer(title.id, stream.platform, stream.url)?.checkedAt?.slice(0, 10)
    if (!am) continue
    release.schedule.belegtBis = { folge: bis, am }
    belegtBisGesetzt++
  }
  if (belegtBisGesetzt) log(`${belegtBisGesetzt} Wochenserien mit belegt erschienenen Folgen — dort keine Schätzung mehr`)
}
