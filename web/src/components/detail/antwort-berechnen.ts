import { addDays } from '@shared/time.ts'
import { expandEvents, istErschienen, istAusgeblieben, titleStatus } from '@shared/logic.ts'
import { dubAbdeckung } from '@shared/dub-grenze.ts'
import { anbieterName, type Title, type Release } from '@shared/types.ts'
import { ausgebliebenBis } from './antwort-kasten.tsx'
import { jpErschienen, KINO_LAND } from './kino.tsx'

export function berechneAntwort({ title, releases, today }: {
  title: Title | undefined
  releases: Release[]
  today: string
}) {
  if (!title) return undefined

  /*
    **Der Kopf beantwortet die Streaming-Frage, nicht die Disc-Frage.**

    Bei „Die Tagebücher der Apothekerin" Staffel 1 stand dort „Morgen,
    04.09.2026 · Wöchentlich · 23 von 24 Folgen erschienen" — für eine Staffel,
    die seit dem 20.04.2024 vollständig deutsch bei Crunchyroll liegt. Der
    Termin gehörte zu einer Blu-ray. Daniel am 03.09.2026: „die staffel ist
    komplett erschienen, es gibt nur noch ein disc release, was in der
    folgenzählung etc nicht berücksichtigt werden soll, dort soll nur original
    deutsches frühstes release stehen."

    Es ist dieselbe Falle wie am 21.08.2026, nur andersherum: Damals machte ein
    künftiger Disc-Termin aus „auf Netflix längst fertig" ein „läuft noch,
    0/51". Ein Kaufdatum und ein Sendeplan sind zwei verschiedene Fragen, und
    der Fortschrittsbalken beantwortet nur die zweite.

    **Gibt es kein Streaming-Release, zählt die Disc wieder** — dann ist sie
    die einzige Auskunft, die es gibt, und ein leerer Kopf wäre schlechter als
    ein Kaufdatum.
  */
  /*
    **Synchro belegt heißt nicht nur „ein Stream mit DE ✓".** „Undefeated Bahamut Chronicle"
    stand als „Noch keine deutsche Fassung" da — mit belegten deutschen Sprechrollen und
    einer Blu-ray-Gesamtausgabe seit 2020 im Disc-Reiter (Daniel, 16.09.2026). Belegt ist
    sie auch durch die Sprechrollen und durch einen Kaufweg mit deutscher Folgenspanne.
  */
  /*
    Und durch aniSearchs Marke „Synchronisiert" am deutschen Block (18.09.2026, Stichprobe
    1809): „Niklaas: Der Junge aus Flandern" und „Jakobus Nimmersatt" standen als „Noch
    keine deutsche Fassung" da, während der Kasten daneben ihre deutsche Ausgabe nannte.
    Gemessen 253 Titel mit Marke ohne jeden anderen Beleg, 180 davon Filme und Specials.
  */
  const hatSynchro =
    (title.streams ?? []).some((s) => s.dub === true) ||
    Boolean(title.hasVoices) ||
    Boolean(title.deErstausgabe?.synchro) ||
    (title.watchLinks ?? []).some((w) => w.dubRanges?.some((r) => r.dub))
  /*
    **Was der Kino-Banner zeigt, ist für den Kasten erledigt** (17.09.2026). Sonst liest
    er den Kinotermin als Folge und schreibt „Erste Folge erscheint am … · Wöchentlich ·
    0 von 1 Folgen" über einen Film — derselbe Fehler wie bei Madoka am selben Tag.
  */
  const imKinoBanner = (r: (typeof releases)[number]) =>
    r.platform === 'kino' &&
    (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60))
  /*
    **Eine TV-Sichtung ist keine Erstausstrahlung, wenn es die Synchro schon gibt**
    (Daniel, 19.09.2026, an „Beyblade X": „wir sagen heute erscheint die erste folge? … warum
    weiß unsere seite nicht das es bereits mindestens 2 staffeln komplett synchronisiert
    gibt?"). Das RTL+-TV-Programm zeigte zwei Sendungen bei TOGGO plus; der automatische
    Import machte daraus „Folge 1 und 2 am 19.09." — ohne Folgennummern, denn das Programm
    nennt keine. Der Kasten nahm den Termin als Antwort, zählte 0 erschienene Folgen und
    blendete deshalb **alle** Stream-Pillen aus (Netflix, Disney+, RTL+). Dasselbe Muster wie
    die Kaufausgabe darunter: Gibt es einen belegten deutschen Stream, ist er die Antwort; die
    Sichtung steht als TV-Pille daneben. Ein Handeintrag (`automatisch` fehlt) bleibt Termin.
  */
  const ohneDisc = releases.filter(
    (r) => r.releaseType !== 'disc' && !imKinoBanner(r) && !(hatSynchro && r.platform === 'tv' && r.automatisch),
  )
  /*
    **Eine Kaufausgabe beantwortet nicht die Frage „wann kommt es".**

    Bei „Code Geass" stand über einem Titel, der seit September 2023 auf
    Deutsch bei Crunchyroll liegt: „In 2 Tagen, 18.09.2026 · Kaufausgabe" —
    während die Pillen im selben Kasten „Crunchyroll · 25 Fg. · 🇩🇪 ✓" zeigten
    (Daniel, 16.09.2026, mit Bild: „der titel ist schon lange erschienen …
    es muss klar sein was gemeint ist, worauf bezieht sich das?"). Der Termin
    gehört zu einer **neuen Blu-ray-Ausgabe**, nicht zur Erstveröffentlichung.

    Der Rückfall auf die Disc bleibt richtig, wo sie wirklich die einzige
    Auskunft ist — also **ohne** belegten deutschen Stream. Gibt es einen,
    ist er die Antwort, und die Kaufausgabe steht als eigene Zeile darunter.
    44 Titel sind betroffen, darunter beide Code-Geass-Staffeln, fünf
    Naruto-Filme und „Mila Superstar".
  */
  const fuerKopf = ohneDisc.length ? ohneDisc : hatSynchro ? [] : releases.filter((r) => !imKinoBanner(r))
  const alleEvents = fuerKopf.flatMap((r) => expandEvents(r))
  const offen = alleEvents.filter((e) => !istErschienen(e))
  /*
    **Eine ausgebliebene Folge mit Ersatztermin steht zweimal da — gezählt wird sie einmal.**

    `expandEvents` führt den verstrichenen Tag weiter (durchgestrichen im
    Kalender) und legt die Folge zusätzlich auf ihren recherchierten neuen
    Termin. Für „noch X bis zum Finale" ist das eine Folge, nicht zwei.
  */
  const kuenftig = offen
    .filter((e) => !istAusgeblieben(e) || !offen.some((o) => o.episode === e.episode && !istAusgeblieben(o)))
    .sort((a, b) => a.date.localeCompare(b.date) || (a.episode ?? 0) - (b.episode ?? 0))
  const raus = alleEvents.filter((e) => istErschienen(e)).length
  /*
    **Keine Folgenzahl aus der Zahl der Termine.**

    Bei „One Piece" stand „Alle 1 Folgen auf Deutsch" — für eine Serie mit
    über tausend (Daniel, 03.09.2026: „Totale müll info"). AniList führt dort
    keine Folgenzahl (die Serie läuft weiter), und der Rückfall zählte die
    **Termine**: ein Katalog-Release ergibt ein Ereignis, also „1 Folge".

    Ein Termin ist keine Folge — außer bei einer Wochenserie, wo jede Folge
    ihren eigenen trägt. Nur dort zählt der Rückfall noch.
  */
  /* Eine TV-Sichtung zählt Sendungen, keine Folgen der Serie (Pokémon Horizonte: „Alle 2 Folgen", 16.09.2026). */
  const nurWochen = fuerKopf.every((r) => r.releaseType === 'weekly' && !r.tvLetzteSichtung)
  /*
    **Die Releases kennen die Zählung besser als AniList, solange die Staffel läuft.**
    „Steel Ball Run": AniList führt eine Folge (nur die vorab gezeigte), die
    Releases belegen Folge 1 und 2–12 — im Kasten stand „1 von 1 Folgen
    erschienen" neben „Die Folgen 2 bis 12 im Wochentakt" (Stichprobe 17.09.2026).
    Nur **lückenlos ab Folge 1 aneinandergereihte** Teile zählen, mit belegter
    Stückzahl: Über den Bestand gemessen hätte eine einfache Höchstzahl acht
    Titel verfälscht — ADN-Pakete mit OVAs (Wolf's Rain 30 statt 26) und
    Staffeln mit durchlaufender Zählung (Wistoria 13–24 als „24").
  */
  const teile = fuerKopf
    .filter((r) => r.schedule?.episodeCount && !r.schedule.episodeCountAssumed)
    .map((r) => {
      const von = r.schedule!.firstEpisodeNumber ?? 1
      return { von, bis: von + r.schedule!.episodeCount! - 1 }
    })
    .sort((x, y) => x.von - y.von)
  const aneinander =
    teile.length > 1 && teile[0]!.von === 1 && teile.every((x, i) => i === 0 || x.von === teile[i - 1]!.bis + 1)
  const ausReleases = aneinander ? teile[teile.length - 1]!.bis : 0
  const gesamt =
    Math.max(title.episodes ?? 0, ausReleases) ||
    (nurWochen && alleEvents.length > 1 ? alleEvents.length : undefined)
  /*
    **„Alle N Folgen" nur, wenn alle N belegt sind.**

    Am 07.09.2026 von Daniel gemeldet: „Kill Blue" hat zwölf Folgen, der
    ADN-Verweis trug `dub: true` mit `dubRanges: [{ from: 1, to: 4 }]` — und
    darüber stand **„Alle 12 Folgen auf Deutsch"**. Auf ADN hat Folge 12 nur
    Untertitel; seine Messung ergab 1–8 deutsch, 9–12 nicht.

    **Warum keine vorhandene Prüfung es sah:** `dubLuecken()` sucht Bereiche
    mit `dub: false`. Hier gab es keine — die Folgen 5 bis 12 waren schlicht
    **nicht erfasst**, und die Kopfzeile las nur `dub === true`.

    Nicht erfasst ist nicht dasselbe wie deutsch. Genau diese Unterscheidung
    zieht das Projekt überall sonst („ein unbeantwortetes `undefined` heißt
    ‚wir wissen es nicht'"); in den Bereichen fehlte sie.

    Deckt kein Verweis die Serie vollständig ab, gilt sie als **teilweise**
    synchronisiert — dann zeigt der Kasten die Zahl statt „alle".
  */
  /*
    **Wer Bereiche nennt, hat nachgesehen — wer keine nennt, hat es nicht.**

    Am 07.09.2026 stand über „Kill Blue" zum zweiten Mal an einem Tag „Alle 12
    Folgen auf Deutsch", diesmal aus einer anderen Richtung: Der frisch
    angelegte Crunchyroll-Weg trägt `dub: true` **ohne** `dubRanges` — der
    deutsche Katalog antwortet auf Serienebene und sagt über einzelne Folgen
    nichts. `dubAbdeckung()` liest ein fehlendes Bereichsfeld zu Recht als
    „nichts dagegen bekannt", und damit galt die Serie wieder als vollständig,
    obwohl die ADN-Pille daneben „✕ DE 9–12" trug.

    Zwei Angaben über dieselbe Sache, und die vage überstimmte die gemessene.
    **Sobald überhaupt ein Verweis Bereiche belegt**, entscheiden nur noch
    diese: Sie stammen aus einer Prüfung je Folge, die anderen aus einer
    Angabe über die Serie. Gibt es gar keine Bereiche, bleibt alles wie
    bisher — dann ist „alle" die beste verfügbare Auskunft, und 2.700 Titel
    hängen daran.
  */
  const mitUrteil = (title.streams ?? []).filter((s) => s.dub === true)
  /*
    **Bei einer abgeschlossenen Serie zählt ein Verweis ohne Bereiche wie in der Pille.**
    Die Pille zeigt dort alle Folgen (Regel 4 an `folgenAngabeFuer()`, mit Daniel am
    14.09.2026 abgestimmt); der Kasten ließ ihn weg, sobald ein anderer Verweis Bereiche
    trug, und schrieb „36 von 145" neben „ADN 145 Fg. ✓" (Eyeshield 21, Monster, Death
    Note — Stichprobe 16.09.2026). Die Vorsicht aus Kill Blue gilt weiter für laufende Serien.
  */
  const abgeschlossenFuerKasten = title.jpEnd
    ? title.jpEnd < today
    : Boolean(title.jpYear && title.jpYear < Number(today.slice(0, 4)))
  const belegen =
    mitUrteil.some((s) => s.dubRanges?.length) && !abgeschlossenFuerKasten
      ? mitUrteil.filter((s) => s.dubRanges?.length)
      : mitUrteil
  /*
    Auch Kaufwege mit belegter Spanne zählen — und ein Titel, dessen Synchro nur über
    Sprechrollen belegt ist, gilt als vollständig: Dort ist keine Spanne bekannt, und
    „0 von 100" stand über der Dai-Box mit allen 100 Folgen (16.09.2026).
  */
  const abdeckung = [
    ...belegen.map((s) => dubAbdeckung(s.dubRanges, gesamt)),
    ...(title.watchLinks ?? [])
      .filter((w) => w.dubRanges?.some((r) => r.dub))
      .map((w) => dubAbdeckung(w.dubRanges, gesamt)),
  ]
  if (!abdeckung.length && hatSynchro) abdeckung.push(dubAbdeckung(undefined, gesamt))
  /*
    **Zwei Wege, zwei Hälften — gezählt wird die Vereinigung** (18.09.2026). Prime teilt
    „Berserk" von 1997 in zwei Staffeln; die Pillen zeigten „Fg. 1–13 ✓" und „Fg. 14–25
    ✓", der Kasten „13 von 25 Folgen", weil er je Weg das Maximum nahm. Gezählt wird über
    eine Menge, damit sich überlappende Bereiche zweier Anbieter nicht doppelt zählen.
  */
  const vereint = new Set<number>()
  for (const r of [
    ...belegen.flatMap((s) => s.dubRanges ?? []),
    ...(title.watchLinks ?? []).flatMap((w) => w.dubRanges ?? []),
  ]) {
    if (!r.dub) continue
    for (let n = r.from; n <= Math.min(r.to, gesamt ?? r.to); n++) vereint.add(n)
  }
  const vollstaendig = abdeckung.some((a) => a.vollstaendig) || Boolean(gesamt && vereint.size >= gesamt)
  const belegteFolgen = Math.max(0, vereint.size, ...abdeckung.map((a) => a.belegt))
  /* Sind die übrigen Folgen als „ohne Deutsch" belegt, fehlt keine Angabe (Gundam GQuuuuuuX, Stichprobe 17.09.2026). */
  const restBelegt = mitUrteil.some((s) => {
    const bereiche = s.dubRanges ?? []
    if (!gesamt || !bereiche.some((b) => !b.dub)) return false
    const gedeckt = new Set<number>()
    for (const b of bereiche) for (let n = b.from; n <= Math.min(b.to, gesamt); n++) gedeckt.add(n)
    return gedeckt.size >= gesamt
  })

  /*
    **Kino und Stream eines Films gehören in einen Kasten** (Daniel, 17.09.2026:
    „Meistens kommt Kinofilm wochen vor online streaming, manchmal zeitgleich,
    manchmal streaming zuerst"). Vorher stand über einem Kinostart „Erste Folge
    erscheint … Wöchentlich · 0 von 1 Folgen".
  */
  const filmTermine = () => {
    const start = (r: (typeof releases)[number]) => r.schedule.firstEpisodeDate
    /*
      **Was im Banner steht, steht nicht noch einmal im Kasten** (17.09.2026). „Ab
      29.09.2026 im Kino" stand nach dem Einbau zweimal untereinander.
    */
    const alleKino = releases.filter((r) => r.platform === 'kino' && start(r)).sort((a, b) => start(a)!.localeCompare(start(b)!))
    const imBanner = (r: (typeof releases)[number]) =>
      r.cinemaUntil ? r.cinemaUntil >= today : start(r)! >= addDays(today, -60)
    const kinoRel = alleKino.filter((r) => !imBanner(r))[0]
    const streamRel = releases
      .filter((r) => r.platform !== 'kino' && r.releaseType !== 'disc' && start(r))
      .sort((a, b) => start(a)!.localeCompare(start(b)!))[0]
    if (!kinoRel && !streamRel) return null
    /* Ein Kinostart, der länger als 60 Tage zurückliegt, ist keine Auskunft mehr. */
    if (!streamRel && start(kinoRel!)! < addDays(today, -60)) return null
    return {
      art: 'filmDe' as const,
      kino: kinoRel ? { datum: start(kinoRel)!, raus: start(kinoRel)! <= today } : undefined,
      stream: streamRel
        ? { datum: start(streamRel)!, raus: start(streamRel)! <= today, anbieter: anbieterName(streamRel.platform, streamRel.sender) }
        : undefined,
      streamWege: Boolean(
        (title.streams ?? []).length ||
          (title.watchLinks ?? []).some((w) => w.kind === 'stream'),
      ),
      verleih: kinoRel?.publisher ?? title.kino?.verleih,
      fassung: title.kino?.fassung,
    }
  }
  if (kuenftig.length > 0) {
    const n = kuenftig[0]!
    /*
      **Fällt der Kopf auf die Disc zurück, wird er zur Disc-Auskunft.**

      `ohneDisc.length === 0` heißt: zu diesem Titel gibt es kein
      Streaming-Release, und die Ereignisse oben stammen sämtlich von einer
      Kaufausgabe. Sie als Sendeplan zu lesen erzeugte den Satz „Wöchentlich
      freitags · 0 von 24 Folgen erschienen" über einer Steelbook-Box.
    */
    if (!ohneDisc.length) {
      const quelle = releases.find((r) => expandEvents(r).some((e) => e.date === n.date))
      /*
        **Jeder Band mit seinem Termin, nicht nur der nächste.**

        Der Bandname steht in `name` („Banana Fish – Vol. 1"); abgezogen wird
        der Titel selbst, sonst stünde er in jeder Zeile noch einmal. Bleibt
        nichts übrig — bei einer einzelnen Gesamtausgabe der Normalfall —,
        trägt die Zeile nur ihr Datum.
      */
      const eigenerName = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? ''
      const baende = releases
        .flatMap((r) =>
          expandEvents(r).map((e) => ({
            name:
              r.name && r.name !== eigenerName
                ? r.name.replace(eigenerName, '').replace(/^[\s:–—-]+/, '').trim() || undefined
                : undefined,
            datum: e.date,
            raus: istErschienen(e),
          })),
        )
        .sort((a, b) => a.datum.localeCompare(b.datum))
      return {
        art: 'disc' as const,
        datum: n.date,
        publisher: quelle?.publisher,
        edition: quelle?.edition,
        baende: baende.length > 1 ? baende : undefined,
      }
    }
    /*
      **„Noch X bis zum Finale" zählt die Ausgabe der nächsten Folge, nicht alle.**
      Dragon Ball DAIMA läuft im TV bis 22.09. und steht ab 25.09. bei RTL+; der
      Kasten nannte „noch 5 bis zum Finale am 25.09." (16.09.2026).
    */
    if (title.format === 'MOVIE' || releases.find((r) => r.slug === n.releaseSlug)?.releaseType === 'movie') {
      const film = filmTermine()
      if (film) return film
    }
    const derselben = kuenftig.filter((e) => e.releaseSlug === n.releaseSlug)
    return {
      art: 'laeuft' as const,
      haupt: n,
      rest: derselben.length,
      raus,
      gesamt,
      letzter: derselben[derselben.length - 1]?.date,
      sendetage: releases.find((r) => r.slug === n.releaseSlug)?.schedule.wochentage,
      sichtung: n.sichtung,
      offenesEnde: Boolean(releases.find((r) => r.slug === n.releaseSlug)?.tvLetzteSichtung),
      verschobenVon: istAusgeblieben(n)
        ? undefined
        : offen.find((o) => istAusgeblieben(o) && o.episode === n.episode)?.date,
      ausgebliebenBis: istAusgeblieben(n) ? ausgebliebenBis(n, kuenftig) : undefined,
      vermerk: istAusgeblieben(n)
        ? n.verpasst
        : offen.find((o) => istAusgeblieben(o) && o.episode === n.episode)?.verpasst,
    }
  }
  if (title.format === 'MOVIE') {
    /*
      **Ein angekündigter Kinofilm bekommt seinen Kinostart statt eines Neins.**

      Daniel am 13.09.2026 zum Apothekerin-Film: Statt „Noch keine deutsche
      Fassung — Kein deutscher Anbieter führt ihn bisher" soll dort stehen,
      wann er in Japan ins Kino kommt, dass der deutsche Termin noch fehlt und
      was der Stern bringt. AniList führt `MOVIE` als Film mit Kinostart.

      Als angekündigt gilt: von Hand recherchiert (`kino`), noch nicht
      erschienen, oder in Japan seit höchstens einem Jahr im Kino. Ein Film,
      der vor Jahren lief und nie nach Deutschland kam, behält das Nein — dort
      wäre „seit 2019 in japanischen Kinos" keine Auskunft, auf die jemand
      wartet.
    */
    /* Läuft der Film gerade in deutschen Kinos und ist noch nicht gestreamt, bleibt es die Kino-Auskunft. */
    const filmDe = !(title.streams ?? []).some((s) => s.dub === true) ? filmTermine() : null
    if (filmDe) return filmDe
    const jp = title.kino?.jp ?? title.jpStart
    const land = title.land ?? 'JP'
    /*
      Mit Termin entscheidet der Termin, nicht AniLists Status: „King Gesar"
      steht dort als angekündigt und lief 2023 in China. Ohne Termin bleibt
      nur der Status.
    */
    const angekuendigt = jp
      ? !jpErschienen(jp, today) || jp >= addDays(today, -365)
      : title.jpStatus === 'NOT_YET_RELEASED' || title.jpStatus === 'RELEASING' || Boolean(title.kino)
    if (!hatSynchro && KINO_LAND[land] && title.kino?.kinofilm !== false && angekuendigt) {
      return {
        art: 'kino' as const,
        jp,
        jpRaus: jp !== undefined && jpErschienen(jp, today),
        land,
        deTermin: title.kino?.deTermin,
        deZeitraum: title.kino?.deZeitraum,
        verleih: title.kino?.verleih,
        fassung: title.kino?.fassung,
      }
    }
    /*
      „Kein deutscher Anbieter führt ihn" nur ohne jeden Weg — Digimon tri. 5 hat sechs
      Kaufangebote (Stichprobe 17.09.2026). Und nicht unter einem Kino-Banner: Dort steht
      der Anbieter, es ist das Kino (Madoka, 17.09.2026).
    */
    const imKino = releases.some(
      (r) =>
        r.platform === 'kino' &&
        (r.cinemaUntil ? r.cinemaUntil >= today : (r.schedule?.firstEpisodeDate ?? '') >= addDays(today, -60)),
    )
    const ohneWeg = !(title.streams ?? []).length && !(title.watchLinks ?? []).length && !imKino
    return { art: 'film' as const, hatSynchro, raus, gesamt, ohneWeg, imKino }
  }
  if (hatSynchro && !vollstaendig && gesamt) {
    /*
      Teilweise synchronisiert: Der Kasten nennt die belegte Zahl statt „alle".
      `laeuft` ist der Zustand, der genau das kann — er zeigt „x von y".
    */
    return { art: 'teilweise' as const, raus: belegteFolgen, gesamt, restBelegt }
  }
  if (hatSynchro || titleStatus(releases, today, title) === 'erschienen') {
    return { art: 'fertig' as const, raus: raus || gesamt, gesamt }
  }
  return { art: 'ohne' as const, gesamt }
}
