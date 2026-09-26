import { readJson, log, discSlug, writeJson } from '../lib/util.ts'
import { alleTermine, ausgelassen as termineAusgelassen, beobachtungenAusBlock } from '../lib/crunchyroll-termine.ts'
import { beobachtungenZusammenfuehren } from '../lib/crunchyroll.ts'
import { meldeAnClaude } from '../lib/meldung.ts'
import { type Title, type Release } from '../../shared/types.ts'
import { type AnisearchEintrag } from './01-quellen.ts'
import { type CrDubData } from '../lib/crunchyroll-dub.ts'

export function legeCrVerweiseUndTermineAn({ titles, anisearch, belegt, crDub, verschwunden, usNeinOffen, nachUrl, releases }: {
  titles: Map<number, Title>
  anisearch: Record<string, AnisearchEintrag>
  belegt: number
  crDub: CrDubData
  verschwunden: number
  usNeinOffen: number
  nachUrl: Map<string, Title[]>
  releases: Release[]
}) {
    /**
     * **Neunte Runde: der Katalog legt den Verweis an, nicht nur das Urteil.**
     *
     * Die Runde darüber beurteilt einen Verweis, der schon dasteht. Genau daran
     * ist am 07.09.2026 „Kill Blue" gescheitert, von Daniel gemeldet:
     *
     * - Am 24.08. hatte Crunchyroll dort **null** deutsche Folgen — der Verweis
     *   flog zu Recht heraus.
     * - Am **06.09.** erschienen die Folgen 1–8 auf Deutsch.
     * - Der Kalender zeigte weiter keinen Crunchyroll-Weg und behauptete damit
     *   das Gegenteil.
     *
     * **Kein einziger Lauf hätte es finden können**, und das ist der eigentliche
     * Befund:
     *
     * | Lauf | was er sieht |
     * |---|---|
     * | `crunchyroll` (stündlich) | den **Sendekalender** — dort steht Kill Blue nicht, denn eine nachgereichte Katalog-Synchro ist kein Simulcast-Termin |
     * | `crunchyroll-dub` (wöchentlich) | nur Serien, die **schon** einen Verweis haben |
     * | `cr-katalog` | den ganzen deutschen Katalog — läuft aber nicht automatisch, weil er eine deutsche IP braucht |
     *
     * Diese Runde schließt die Lücke: Der Katalog nennt zu jeder Serienkennung
     * ihre Tonspuren. Führt er `de-DE` und der Titel hat keinen
     * Crunchyroll-Weg, entsteht er hier — mit Urteil, denn dieselbe Antwort
     * belegt beides.
     *
     * **Die Zuordnung läuft über die aniSearch-Adresse**, nicht über den Namen.
     * Ein Namensabgleich gegen 1.589 Katalogeinträge ist genau der Fehler, der
     * am 29.08.2026 fünfzehn von sechzehn Zuordnungen falsch gemacht hat. Wo
     * aniSearch eine Crunchyroll-Adresse mit Kennung führt, ist die Zuordnung
     * dagegen eine Zeichenkette.
     *
     * **Und nur bei genau einer Staffel** — aus demselben Grund wie eine Runde
     * darüber: Eine Serienkennung ist ein Franchise.
     */
    let ausKatalogNeu = 0
    {
      const katalog = readJson<{
        eintraege?: { id: string; audio?: string[]; folgen?: number; staffeln?: number }[]
      }>('data/cr-katalog-de.json', {})
      const nachKennung = new Map((katalog.eintraege ?? []).map((e) => [e.id, e]))
      if (nachKennung.size) {
        for (const title of titles.values()) {
          if (title.streams.some((s) => s.platform === 'crunchyroll')) continue
          const asCr = (anisearch[title.id]?.streams ?? []).find((q) => q.provider === 'crunchyroll')
          const kennung = /\/series\/([A-Z0-9]+)/.exec(asCr?.url ?? '')?.[1]
          if (!kennung) continue
          const eintrag = nachKennung.get(kennung)
          if (!eintrag?.folgen || (eintrag.staffeln ?? 0) !== 1) continue
          if (!(eintrag.audio ?? []).includes('de-DE')) continue
          const url = (asCr?.url ?? '').split('?')[0]!
          title.streams.push({ platform: 'crunchyroll', url, dub: true })
          ausKatalogNeu++
        }
      }
      if (ausKatalogNeu)
        log(`${ausKatalogNeu} Crunchyroll-Wege neu angelegt: der deutsche Katalog führt sie mit deutscher Tonspur`)
    }
    log(`${belegt} Synchro-Angaben aus den Crunchyroll-Serienseiten belegt (${crDub.serien.length} Seiten gelesen)`)
    if (verschwunden) log(`${verschwunden} Crunchyroll-Verweise entfernt — die Serie ist dort nicht mehr verfügbar`)
    if (usNeinOffen) log(`${usNeinOffen} Crunchyroll-Serien mit US-„nicht verfügbar" bleiben offen — der deutsche Katalog führt sie`)
    /*
      **Und aus denselben Daten kommen die Termine.**

      Bis zum 02.09.2026 endete der Crunchyroll-Abschnitt hier: Er beantwortete
      **ob** es eine deutsche Fassung gibt und warf weg, **wann** sie kam —
      obwohl beides in derselben Antwort steht. Der Kalender zeigte für „Die
      Tagebücher der Apothekerin“ deshalb nur eine Blu-ray im September 2026,
      für eine Serie, die seit dem 18.11.2023 vollständig deutsch läuft
      (Daniel, 02.09.2026: „CRUNCHY WIRD VON UNS GESCANNED!!! WIE Kann so
      unglaublich falsche info bei uns stehen???“). 21.689 datierte deutsche
      Folgen lagen ungenutzt im Repo.

      Die Ableitung steht in `lib/crunchyroll-termine.ts` und ist bewusst
      streng: Sie liefert nur, wo genau ein Titel an der Adresse hängt, genau
      ein Block datierte Folgen hat und dessen Folgenzahl exakt zur unseren
      passt. Was sie liegen lässt, lässt sie mit Absicht liegen.
    */
    const crTermine = alleTermine(crDub.serien, nachUrl)
    let termineNeu = 0
    let termineSchonDa = 0
    for (const t of crTermine) {
      const title = titles.get(t.titleId)
      if (!title) continue
      /*
        **Ein vorhandener Streaming-Termin gewinnt.** Was aus dem Kalender oder
        aus einem kuratierten Eintrag stammt, ist näher an der Quelle als eine
        Ableitung — und ein zweites Release derselben Plattform würde
        behaupten, es gäbe die Staffel zweimal.
      */
      const vorhanden = releases.filter((r) => r.titleId === t.titleId && r.platform === 'crunchyroll')
      if (vorhanden.length) {
        /*
          **Ein gemessener Wochentakt schlägt den Aufnahmetag** (Daniel, 20.09.2026, „Das Band
          der Unterwelt"): Die Serie kam als Katalogtitel herein — ein Eintrag vom 04.04.2026,
          `available-from`, alles an einem Tag. Ihre deutsche Fassung erscheint seitdem Folge
          für Folge; Folge 21 lief am 19.09., im Kalender stand nichts. Crunchyrolls
          Simulcast-Kalender kennt solche Titel nicht, die Folgendaten schon.

          Ersetzt wird nur der **Termin**, nicht der Eintrag: Der Slug bleibt, damit die
          Adresse nicht wandert (CLAUDE.md, „Ein Slug ist eine Adresse").
        */
        const sammel = vorhanden.find(
          (r) =>
            r.schedule?.firstEpisodeDate === r.schedule?.lastEpisodeDate &&
            (r.dateMeaning === 'available-from' || r.releaseType === 'batch'),
        )
        if (t.rhythmus !== 'weekly' || !sammel || vorhanden.length > 1) {
          termineSchonDa++
          continue
        }
        sammel.releaseType = 'weekly'
        sammel.dateMeaning = undefined
        sammel.schedule = {
          ...sammel.schedule,
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time ?? sammel.schedule?.time,
          episodeCount: t.episodeCount,
          observed: beobachtungenZusammenfuehren(t.beobachtet, sammel.schedule?.observed),
        }
        sammel.herkunft = `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}"), Sammeldatum ersetzt`
        termineNeu++
        continue
      }
      const name = title.titleDe ?? title.titleEn ?? title.titleRomaji ?? `Titel ${t.titleId}`
      const adresse = title.streams.find((x) => x.platform === 'crunchyroll')?.url
      releases.push({
        /*
          **Der Slug wird gebaut, nicht gekappt.** `slugify` schneidet bei 80
          Zeichen ab — bei „I Was Reincarnated as the 7th Prince…“ (84 Zeichen)
          fiel damit genau der unterscheidende Teil weg, das Datum, und beide
          Staffeln beanspruchten dieselbe Adresse. Der Bau brach ab: „Termin
          2025-07-30 (Folge 1) liegt nach dem belegten Ende 2024-07-16“ — zwei
          Staffeln in einem Eintrag.

          Denselben Fehler gab es am 30.08.2026 schon einmal bei den
          Disc-Terminen, und `discSlug()` ist die Antwort darauf: Der **Name**
          wird gekappt, das Datum danach angehängt.
        */
        slug: discSlug(`${name} crunchyroll de`, t.firstEpisodeDate),
        titleId: t.titleId,
        name,
        platform: 'crunchyroll',
        platformUrl: adresse,
        releaseType: t.rhythmus,
        schedule: {
          firstEpisodeDate: t.firstEpisodeDate,
          lastEpisodeDate: t.lastEpisodeDate,
          time: t.time,
          episodeCount: t.episodeCount,
          /* Die gemessenen Tage je Folge — sonst rechnet die Fortschreibung an Pausen vorbei. */
          ...(Object.keys(t.beobachtet).length ? { observed: t.beobachtet } : {}),
        },
        /*
          **„Im Angebot seit“, wenn alles an einem Tag kam.** Bei einem
          Katalogtitel nimmt Crunchyroll die ganze Staffel auf einmal auf; das
          Datum ist dann der Tag der Aufnahme, nicht der Erstausstrahlung —
          dieselbe Unterscheidung wie bei ADN.
        */
        dateMeaning: t.rhythmus === 'batch' ? 'available-from' : undefined,
        fsk: title.fsk,
        herkunft: `Deutsche Fassung bei Crunchyroll — ${t.datiert} Folgen mit belegtem Termin (Block „${t.blockName}“)`,
        year: Number(t.firstEpisodeDate.slice(0, 4)),
        sources: [adresse ?? 'https://www.crunchyroll.com/de'],
      })
      termineNeu++
    }
    /*
      **Was die Ableitung verworfen hat, wird sichtbar** (Daniel, 20.09.2026): Riegel, die
      eine Serie stumm durchfallen lassen, kosten Termine, die niemand vermisst — „Das Band
      der Unterwelt" fehlte ein halbes Jahr. Die Gründe stehen ab jetzt in einer Datei, die
      Zahl im Lauf (Skill `stille-ausfaelle-verhindern`).
    */
    if (termineAusgelassen.length) {
      const jeGrund = new Map<string, number>()
      for (const a of termineAusgelassen) jeGrund.set(a.grund, (jeGrund.get(a.grund) ?? 0) + 1)
      const vorher = readJson<{ jeGrund?: Record<string, number> }>('data/termine-ausgelassen.json', {})
      writeJson('data/termine-ausgelassen.json', {
        erzeugtAm: new Date().toISOString(),
        jeGrund: Object.fromEntries(jeGrund),
        faelle: termineAusgelassen.slice(0, 400),
      })
      /*
        **Ein Zuwachs geht in den Posteingang** (Daniel, 20.09.2026): eine Datei, die niemand
        öffnet, ist keine Meldung. `~/.claude/hooks/posteingang.js` liest
        `data/meldungen-an-claude.jsonl` und nennt neue Zeilen beim nächsten Prompt.
      */
      const gestiegen = [...jeGrund].filter(([g, n]) => n > (vorher.jeGrund?.[g] ?? 0))
      if (gestiegen.length && Object.keys(vorher.jeGrund ?? {}).length) {
        meldeAnClaude(
          'bestand-bauen',
          'warnung',
          `Terminableitung verwirft mehr: ${gestiegen
            .map(([g, n]) => `${g} ${vorher.jeGrund?.[g] ?? 0} → ${n}`)
            .join(', ')}`,
          'data/termine-ausgelassen.json',
        )
      }
      log(
        `Terminableitung übersprungen: ${termineAusgelassen.length} Serien — ` +
          [...jeGrund].map(([g, n]) => `${n}× ${g}`).join(', ') +
          ' (data/termine-ausgelassen.json)',
      )
    }
    if (termineNeu || termineSchonDa)
      log(
        `${termineNeu} deutsche Streaming-Termine aus den Crunchyroll-Folgendaten abgeleitet` +
          (termineSchonDa ? ` (${termineSchonDa} hatten schon einen)` : ''),
      )

    /* Vorhandene Wochentermine bekommen die Tage der Folgen, die das Kalenderfenster nicht sah — siehe `beobachtungenAusBlock()`. */
    const crNachKennung = new Map(crDub.serien.map((s) => [s.seriesId, s]))
    let folgenDatiert = 0
    for (const r of releases) {
      if (r.platform !== 'crunchyroll' || r.releaseType !== 'weekly' || !r.schedule.observed) continue
      const kennung = /series\/([A-Z0-9]+)/.exec(r.platformUrl ?? '')?.[1]
      const serie = kennung ? crNachKennung.get(kennung) : undefined
      if (!serie) continue
      const erste = r.schedule.firstEpisodeNumber ?? 1
      const letzte = erste + (r.schedule.episodeCount ?? 0) - 1
      const neu = Object.entries(beobachtungenAusBlock(serie, r.schedule.observed)).filter(
        ([n]) => Number(n) >= erste && Number(n) <= letzte,
      )
      for (const [n, datum] of neu) r.schedule.observed[Number(n)] = datum
      folgenDatiert += neu.length
    }
    if (folgenDatiert) log(`${folgenDatiert} Crunchyroll-Folgen mit ihrem deutschen Tag nachgetragen (vorher geschätzt)`)
}
