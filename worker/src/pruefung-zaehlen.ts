import { type Env } from './env.ts'

export async function zaehleOffenePruefungen({ request, env, antwort }: {
  request: Request<unknown, CfProperties<unknown>>
  env: Env
  antwort: (body: unknown, status?: number) => Response
}) {
      /*
        **Die Adressen gehören dazu, nicht nur ihre Anzahl.**

        Daniel am 26.08.2026: „klick auf netflix pill führt zu dem titel den ich
        gerade vor dem letzten change reported habe … ich reporte, reloade,
        steht weiterhin 10."

        Die Prüfliste stammt vom letzten Datenlauf und kennt seine frischen
        Meldungen nicht — sie schickte ihn deshalb immer wieder zum selben
        Titel, und die zweite Meldung überschrieb nur die erste. Eine Zahl
        allein kann das nicht verhindern: Sie sagt, **dass** etwas gemeldet
        wurde, nicht **was**.

        Es sind öffentliche Titelseiten, keine persönlichen Angaben.
      */
      /*
        **Mit `nummern=1` kommen die Folgennummern mit.**

        Die Erweiterung zeigt in ihrer Liste je Titel, welche Folgen schon
        gemeldet sind — als Bereich („1e1-15"), nicht als Anzahl. Dafür genügt
        die Adresse nicht (Daniel, 26.08.2026: „bereits gemeldete folgen und
        fehlende meldungen werden ebenfalls nicht korrekt in der liste
        angezeigt").

        Ein Abruf für alle Titel statt einer je Titel: 31 Disney-Seiten wären
        sonst 31 Anfragen bei jedem Öffnen der Liste.
      */
      const mitNummern = new URL(request.url).searchParams.get('nummern') === '1'
      const { results } = await env.DB.prepare(
        `SELECT plattform, url, folge_nr, staffel FROM pruefung WHERE uebernommen = 0`,
      ).all<{ plattform: string; url: string; folge_nr: number | null; staffel: number | null }>()
      const je: Record<string, number> = {}
      const adressen: string[] = []
      const eintraege: { url: string; folge_nr: number | null; staffel: number | null }[] = []
      for (const r of results ?? []) {
        je[r.plattform] = (je[r.plattform] ?? 0) + 1
        if (!r.url) continue
        adressen.push(r.url)
        if (mitNummern) eintraege.push({ url: r.url, folge_nr: r.folge_nr, staffel: r.staffel })
      }
      /**
       * **„Liegt hier noch was?" ist nicht „wurde das gemeldet?"**
       *
       * `adressen` oben führt nur, was der Datenlauf noch nicht abgeholt hat
       * (`uebernommen = 0`). Die Erweiterung benutzte genau diese Liste, um zu
       * entscheiden, ob ein Titel abgehakt ist — mit der Folge, dass jede
       * übernommene Meldung ihren Titel wieder in die Prüfliste zurückholte.
       *
       * Daniel am 30.08.2026: „3.91 → alles gemeldet, warum eintrag immer noch
       * in liste?" Gemessen an „From Bureaucrat to Villainess": im Briefkasten
       * nicht mehr da, im Datensatz noch ohne Urteil — also gemeldet, geholt,
       * und trotzdem wieder offen. Nach jedem Datenlauf begann die Arbeit von
       * vorn.
       *
       * `gemeldet` beantwortet die Frage, die die Erweiterung wirklich stellt:
       * Ist unter dieser Adresse jemals etwas eingegangen? `DISTINCT`, weil je
       * Staffel und Folge mehrere Zeilen auf dieselbe Adresse zeigen.
       */
      const { results: alle } = await env.DB.prepare(
        `SELECT DISTINCT url FROM pruefung WHERE url IS NOT NULL AND url != ''`,
      ).all<{ url: string }>()
      const gemeldet = (alle ?? []).map((r) => r.url)
      /*
        **Und die Suchadressen, unter denen gemeldet wurde.**

        Ein Suchauftrag wird auf der Titelseite gemeldet; ohne dieses Feld erfährt
        die Erweiterung nie, dass die Suche erledigt ist, und muss sich auf einen
        lokalen Vermerk verlassen. Der ist nicht abgeglichen — wird die Meldung
        hier verworfen, sperrt er den Auftrag, und nur ein Konsolenbefehl half
        (02.09.2026, „Is This a Zombie?").
      */
      const { results: suchen } = await env.DB.prepare(
        `SELECT DISTINCT such_url FROM pruefung WHERE such_url IS NOT NULL AND such_url != ''`,
      ).all<{ such_url: string }>()
      const gemeldeteSuchen = (suchen ?? []).map((r) => r.such_url)
      /*
        **Und die Seiten, auf denen wirklich nachgesehen wurde.**

        Prime führt denselben Anime regelmäßig zweimal: über einen Kanal (aniverse,
        Crunchyroll) und als Kauftitel. Beide sind Antworten auf „wo kann ich das
        sehen", und nur die Meldung sagt uns, dass es sie gibt — vorher kennt der
        Bau höchstens eine Adresse.

        Ein Auftrag steuert, **was** zu prüfen ist. Er darf nicht verbieten, eine
        zweite Seite desselben Titels zu melden: Am 02.09.2026 war nach der
        Kauftitel-Meldung die aniverse-Meldung gesperrt, weil die Suchadresse als
        erledigt galt (Daniel: „nach kaufoption meldung ist aniverse meldung nicht
        mehr möglich"). Mit dieser Liste entscheidet die **Seite**, nicht der
        Auftrag.
      */
      /*
        **Gezählt wird seit dem Prüfstand — wie bei `?stand=1`.**

        Bis zum 15.09.2026 kamen hier die Seiten **aller** Meldungen. Eine Meldung,
        die der Bau eingearbeitet hat und die trotzdem kein Urteil ergab (eine
        Kanal-Meldung ohne Folgenbefund), sperrte ihre Seite damit für immer: Bei
        Touken Ranbu (`B0FQXKKXQW`) verschwand der Melde-Knopf, bei Nukitashi stand
        „gemeldet ✓" auf einem Titel, den die Prüfliste als offen führte. Die
        Ziele zählen seit dem 14.09. nur Meldungen nach `erzeugtAm`; die Seiten
        zählten weiter alles, und die Erweiterung zeigte zwei Stände zugleich.
        Ohne Prüfstand bleibt es beim alten Verhalten.
      */
      let seitStand: string | null = null
      try {
        const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
          cf: { cacheTtl: 60 },
        } as RequestInit)
        if (res.ok) seitStand = ((await res.json()) as { erzeugtAm?: string }).erzeugtAm ?? null
      } catch {
        /* Ohne Prüfstand zählen alle Meldungen. */
      }
      const { results: seiten } = await (seitStand
        ? env.DB.prepare(
            `SELECT DISTINCT seiten_kennung FROM pruefung
             WHERE seiten_kennung IS NOT NULL AND seiten_kennung != '' AND gemeldet_am > ?1`,
          ).bind(seitStand)
        : env.DB.prepare(
            `SELECT DISTINCT seiten_kennung FROM pruefung WHERE seiten_kennung IS NOT NULL AND seiten_kennung != ''`,
          )
      ).all<{ seiten_kennung: string }>()
      const gemeldeteSeiten = (seiten ?? []).map((r) => r.seiten_kennung)
      /* Die bestätigten Erwartungen — siehe Migration 026. */
      const { results: erw } = await env.DB.prepare(
        'SELECT such_url, kennungen FROM such_erwartung',
      ).all<{ such_url: string; kennungen: string }>()
      const erwartungen: Record<string, string[]> = {}
      for (const r of erw ?? []) {
        try {
          const l = JSON.parse(r.kennungen)
          if (Array.isArray(l) && l.length) erwartungen[r.such_url] = l
        } catch {
          /* Eine kaputte Zeile darf die Antwort nicht mitreißen. */
        }
      }
      return antwort(
        mitNummern
          ? { imBriefkasten: je, adressen, gemeldet, gemeldeteSuchen, gemeldeteSeiten, erwartungen, eintraege }
          : { imBriefkasten: je, adressen, gemeldet, gemeldeteSuchen, gemeldeteSeiten, erwartungen },
      )
}
