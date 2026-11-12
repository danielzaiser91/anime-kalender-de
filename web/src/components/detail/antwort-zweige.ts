import { istBelegtAbgeschlossen, deutschBegonnen, fertigAntwort, gesamtGeschaetzt } from './antwort-regeln.ts'
import { expandEvents, istErschienen, istAusgeblieben } from '@shared/logic.ts'
import { bandAngaben } from './antwort-vorstart.ts'
import { filmTermine } from './film-termine.ts'
import { restUndBlock } from './antwort-block.ts'
import { ausgebliebenBis } from './antwort-kasten.tsx'
import { type Title, type Release, type ReleaseEvent } from '@shared/types.ts'
import { jpErschienen, KINO_LAND } from './kino.tsx'
import { addDays } from '@shared/time.ts'

/** Die Antwort für einen Film (aus `berechneAntwort` herausgelöst). */
export function filmAntwort({ title, releases, today, hatSynchro, raus, gesamt }: {
  title: Title
  releases: Release[]
  today: string
  hatSynchro: boolean
  raus: number
  gesamt: number | undefined
}) {
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
  const filmDe = !(title.streams ?? []).some((s) => s.dub === true) ? filmTermine(releases, title, today) : null
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
  const ohneWeg =
    !(title.streams ?? []).length && !(title.watchLinks ?? []).length && !imKino && !releases.some((r) => r.releaseType === 'disc')
  return { art: 'film' as const, hatSynchro, raus, gesamt, ohneWeg, imKino }
}

/** Die Antwort, solange Termine ausstehen (aus `berechneAntwort` herausgelöst). */
export function kuenftigeAntwort({ kuenftig, hatSynchro, title, raus, today, releases, vollstaendig, abgeschlossenFuerKasten, alleEvents, jetzt, gesamt, vereint, ohneDisc, offen }: {
  kuenftig: ReleaseEvent[]
  hatSynchro: boolean
  title: Title
  raus: number
  today: string
  releases: Release[]
  vollstaendig: boolean
  abgeschlossenFuerKasten: boolean
  alleEvents: ReleaseEvent[]
  jetzt: Date
  gesamt: number | undefined
  vereint: Set<number>
  ohneDisc: Release[]
  offen: ReleaseEvent[]
}) {
  const n = kuenftig[0]!
  /* Ein abgeschlossenes, vollständig deutsches Werk bleibt „fertig" (`antwort-regeln.ts`). */
  if (istBelegtAbgeschlossen(hatSynchro && deutschBegonnen(title, raus, today, releases), vollstaendig, abgeschlossenFuerKasten, alleEvents, jetzt)) {
    return fertigAntwort(raus || gesamt, gesamt, vereint.size, alleEvents, today, releases)
  }
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
          raus: istErschienen(e, jetzt),
        })),
      )
      .sort((a, b) => a.datum.localeCompare(b.datum))
    return {
      art: 'disc' as const,
      datum: n.date,
      publisher: quelle?.publisher,
      edition: quelle?.edition,
      baende: baende.length > 1 ? baende : undefined,
      ...bandAngaben(quelle, title),
    }
  }
  /*
    **„Noch X bis zum Finale" zählt die Ausgabe der nächsten Folge, nicht alle.**
    Dragon Ball DAIMA läuft im TV bis 22.09. und steht ab 25.09. bei RTL+; der
    Kasten nannte „noch 5 bis zum Finale am 25.09." (16.09.2026).
  */
  if (title.format === 'MOVIE' || releases.find((r) => r.slug === n.releaseSlug)?.releaseType === 'movie') {
    const film = filmTermine(releases, title, today)
    if (film) return film
  }
  return {
    art: 'laeuft' as const,
    haupt: n,
    ...restUndBlock(kuenftig, n, releases.find((r) => r.slug === n.releaseSlug)),
    raus,
    gesamt, gesamtGeschaetzt: gesamtGeschaetzt(title, releases, n),
    sendetage: releases.find((r) => r.slug === n.releaseSlug)?.schedule.wochentage,
    /* Komplettabwurf (`available-from`): kein Wochentakt — siehe `antwort-kasten.tsx`. */
    komplett: releases.find((r) => r.slug === n.releaseSlug)?.releaseType !== 'weekly',
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
