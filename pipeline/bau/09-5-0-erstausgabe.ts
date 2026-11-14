import { ladeAnisearchAbruf } from '../lib/anisearch-verworfen.ts'
import { readJson, log } from '../lib/util.ts'
import { sammeleintragTitel, ladeJustwatchDeutsch, ohneSammelSynchro } from '../lib/anisearch-sammeleintrag.ts'
import { anisearchBruecke } from '../lib/anisearch-katalog-ids.ts'
import {
  mitDubKennzeichen,
  terminAusEintrag,
  eigenerTerminVerdraengt,
  verlagAlsDienst,
} from '../lib/anisearch-termine.ts'
import { japanStartTag, istNahAmJapanStart } from '../lib/nah-am-japan-start.ts'
import { type Release, type Title } from '../../shared/types.ts'
import { anisearchFelderAnwenden } from '../lib/anisearch-felder.ts'
import { ladeErstausgabeVonHand, handErstausgabe } from '../lib/erstausgabe-von-hand.ts'

export function ergaenzeErstausgabeAusWikiUndHand({ titles }: {
  titles: Map<number, Title>
}) {
  /*
    **Erste deutsche Ausstrahlung aus der Wikipedia-Episodenliste** (19.09.2026). Titel mit
    eigenem Termin bekommen von aniSearch kein Datum (siehe oben) — eine TV-Sichtung ist aber
    kein Starttermin. Dragon Ball, One Piece, Conan, Dragon Ball Super, Pokémon Horizonte und
    Daima standen deshalb ohne „Auf Deutsch seit". Die Liste nennt je Folge `EAD`; die früheste
    gilt, wenn der Titel noch keine Angabe hat.
  */
  {
    const wiki = readJson<{ titel?: Record<string, { folgen: { ead?: string }[] }> }>('data/wikipedia-folgen.json', {}).titel ?? {}
    let ausWiki = 0
    for (const [id, liste] of Object.entries(wiki)) {
      const title = titles.get(Number(id))
      const erste = liste.folgen.map((f) => f.ead).filter((d): d is string => Boolean(d)).sort()[0]
      if (!title || title.deErstausgabe || !erste) continue
      title.deErstausgabe = { von: erste, quelle: 'wikipedia' }
      ausWiki++
    }
    if (ausWiki) log(`${ausWiki} deutsche Erstausstrahlungen aus Wikipedia-Episodenlisten`)

    log(anisearchFelderAnwenden(titles))
    /* Von Hand, wo aniSearchs Datum nicht die Synchro meint (`data/erstausgabe-von-hand.yaml`). */
    for (const e of ladeErstausgabeVonHand()) {
      const title = e.anilistId ? titles.get(e.anilistId) : undefined
      if (!title || !e.von || !e.sources?.length) continue
      title.deErstausgabe = handErstausgabe(e, title)
    }
  }
}

export function uebernehmeAnisearchErstausgabe({ releases, titles }: {
  releases: Release[]
  titles: Map<number, Title>
}) {
  /**
   * **Seit wann gibt es das auf Deutsch? — die Antwort aus aniSearch.**
   *
   * Gemessen am 03.09.2026: 2.202 Titel im Bestand haben eine belegte deutsche
   * Synchro und keinen einzigen Termin. Der Kasten im Detail-Panel sagt dort
   * „Auf Deutsch verfügbar" und kann nicht sagen, seit wann — obwohl aniSearch
   * es für 1.985 von ihnen weiß, mit Datum und Verlag. „Cowboy Bebop,
   * 08.01.2003 – 02.04.2003, Dybex" liegt seit Wochen im Haus und wurde von
   * nichts gelesen.
   *
   * **Es wird ein Feld, kein Release.** Der erste Anlauf baute daraus 1.985
   * Kalendereinträge — und `titles-core.json`, die Datei, die jeder Besucher
   * beim Erstaufruf lädt, wuchs von 554 KB auf 2,7 MB. Ein DVD-Datum von 2003
   * ist kein Termin, den jemand im Kalender sucht; es beantwortet eine
   * Stammdatenfrage im Detail-Panel. Die Regeln der Übernahme stehen in
   * `lib/anisearch-termine.ts`, die Begründung des Feldes bei `deErstausgabe`
   * in `shared/types.ts`.
   */
  {
    const asRoh = ladeAnisearchAbruf<{ info?: { languages?: unknown[] } }>()
    const eigenerStart = new Map<number, string>()
    for (const r of releases) if (r.schedule?.firstEpisodeDate && !(eigenerStart.get(r.titleId)! <= r.schedule.firstEpisodeDate)) eigenerStart.set(r.titleId, r.schedule.firstEpisodeDate)
    let asNeu = 0
    let asVorJp = 0
    let asSimulcast = 0
    let asDiscDatum = 0
    const discFuerErstausgabe = readJson<Record<string, { datum: string }[]>>('data/disc-ausgaben.json', {})
    const sammeleintrag = sammeleintragTitel(anisearchBruecke(), titles.keys(), ladeJustwatchDeutsch())
    for (const title of titles.values()) {
      const info = asRoh[String(title.id)]?.info as { languages?: never[] } | undefined
      const termin = ohneSammelSynchro(mitDubKennzeichen(title.id, terminAusEintrag(info)), sammeleintrag.has(title.id))
      if (!termin || eigenerTerminVerdraengt(eigenerStart.get(title.id), termin)) continue
      /*
        **Eine deutsche Fassung gibt es nicht vor dem Original.** Sechs Einträge
        scheitern daran — meist eine Verwechslung mit einem Vorgänger im
        aniSearch-Datensatz. Sie wären in der Anzeige nicht als falsch zu
        erkennen, also bleiben sie draußen.
      */
      if (termin.start && title.jpYear && Number(termin.start.slice(0, 4)) < title.jpYear) {
        asVorJp++
        continue
      }
      /*
        **Ein Simulcast-Datum ist kein Synchro-Datum.** aniSearchs deutscher Block
        nennt die erste deutsche Veröffentlichung überhaupt, und das ist oft der
        OmU-Simulcast: „Dragon Quest: The Adventure of Dai" — 03.10.2020, Publisher
        Crunchyroll, Kazé Deutschland. Die Synchro gibt es nur auf Kazés Disc; im
        Panel stand „Auf Deutsch seit 03.10.2020 · Crunchyroll".
        Gemessen: 375 Titel mit deutschem Datum am japanischen Start und einem
        Streamingdienst als erstem Verlag, 119 davon ohne belegten Dub-Stream dort.
        Bei denen fallen Datum und Dienst weg; ein Disc-Verlag bleibt als Spur.
      */
      const asDe = (asRoh[String(title.id)]?.info?.languages as { language?: string; released?: string; publisher?: string[] }[] | undefined) ?? []
      const tagAus = (s?: string) => {
        const m = /(\d{2})\.(\d{2})\.(\d{4})/.exec(s ?? '')
        return m ? Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1])) : undefined
      }
      const deTag = tagAus(asDe.find((l) => l.language === 'Deutsch')?.released)
      const jpTag = japanStartTag(asDe)
      const verlage = asDe.find((l) => l.language === 'Deutsch')?.publisher ?? []
      const simulcast =
        deTag !== undefined && jpTag !== undefined && Math.abs(deTag - jpTag) <= 7 * 864e5 &&
        verlage.length > 0 && verlagAlsDienst(verlage[0]!) !== undefined &&
        !(title.streams ?? []).some((s) => s.dub === true && s.platform === verlagAlsDienst(verlage[0]!))
      /*
        **Und ein Datum dicht am japanischen Start ist Simulcast, wenn die Discs erst später kamen.**
        „Undefeated Bahamut Chronicle": deutscher Block 20.01.–02.04.2016 (neun Tage nach dem
        japanischen Start, Verlag Nipponart), die deutschen Discs ab 30.06.2017 — Volume 1 bis 4,
        Gesamtausgabe 25.05.2020. Dann gilt das früheste Disc-Datum.
      */
      const fruehesteDisc = (discFuerErstausgabe[String(title.id)] ?? [])
        .map((a) => a.datum)
        .filter(Boolean)
        .sort()[0]
      const nahAmStart = istNahAmJapanStart(deTag, jpTag, title.format)
      const discDatumGilt =
        Boolean(fruehesteDisc) && (simulcast || nahAmStart) && (!termin.start || fruehesteDisc! > termin.start)
      if (discDatumGilt) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        title.deErstausgabe = { von: fruehesteDisc!, ...(disc ? { publisher: disc } : {}), ...(termin.synchro ? { synchro: true } : {}), ...(termin.teil ? { teil: true } : {}) }
        asDiscDatum++
        asNeu++
        continue
      }
      if (simulcast) {
        const disc = verlage.find((v) => verlagAlsDienst(v) === undefined)
        asSimulcast++
        if (!disc) continue
        title.deErstausgabe = { publisher: disc, ...(termin.synchro ? { synchro: true } : {}), ...(termin.teil ? { teil: true } : {}) }
        asNeu++
        continue
      }
      title.deErstausgabe = {
        ...(termin.start ? { von: termin.start } : {}),
        ...(termin.zeitraum ? { zeitraum: termin.zeitraum } : {}),
        ...(termin.ende ? { bis: termin.ende } : {}),
        ...(termin.publisher ? { publisher: termin.publisher } : {}),
        ...(termin.synchro ? { synchro: true } : {}), ...(termin.teil ? { teil: true } : {}),
      }
      asNeu++
    }
    if (asNeu) {
      log(
        `${asNeu} deutsche Erstausgaben aus aniSearch übernommen ` +
          `(${asVorJp} vor der japanischen Ausstrahlung verworfen, ` +
          `${asSimulcast} Simulcast-Daten ohne Dub-Stream nicht als Synchro-Datum, ` +
          `${asDiscDatum} durch das früheste Disc-Datum ersetzt)`,
      )
    }
  }
}
