import { type Env } from './env.ts'

/**
 * **Eine Spalte der Meldungen, seit dem letzten Datenlauf** — sonst über alles.
 *
 * Mit Zeitgrenze wird für die Adressen `pruefung_gemeldet_url` erzwungen; die Begründung steht im
 * Kopf der Datei („Die Zeitgrenze allein genügte nicht"). Ohne Grenze bleibt es beim Durchlauf in
 * der Reihenfolge der Spalte — dort spart SQLite die Sortierung für `DISTINCT`.
 */
function seitStandAbfrage(
  env: Env,
  seitStand: string | null,
  spalte: 'url' | 'such_url' | 'seiten_kennung',
): D1PreparedStatement {
  if (!seitStand) {
    return env.DB.prepare(`SELECT DISTINCT ${spalte} FROM pruefung WHERE ${spalte} IS NOT NULL AND ${spalte} != ''`)
  }
  const erzwingen = spalte === 'url' ? ' INDEXED BY pruefung_gemeldet_url' : ''
  return env.DB.prepare(
    `SELECT DISTINCT ${spalte} FROM pruefung${erzwingen}
      WHERE ${spalte} IS NOT NULL AND ${spalte} != '' AND gemeldet_am > ?1`,
  ).bind(seitStand)
}

/**
 * **Der Stand für die Erweiterung — sparsam gelesen** (28.09.2026).
 *
 * Hier standen vier `SELECT DISTINCT` über die **ganze** `pruefung`-Tabelle: alle je
 * gemeldeten Adressen, Suchadressen, Seiten. Bei rund zehntausend Zeilen sind das je Aufruf
 * vierzigtausend gelesene Zeilen — und die Erweiterung fragt das bei **jeder** Seite
 * (`?zaehlen=1`). Ein Durchgang über 150 Seiten sprengte damit das Tageskontingent des
 * kostenlosen D1-Plans (5 Mio. gelesene Zeilen): Ab etwa 13:30 antwortete der Worker auf
 * jede Leseabfrage mit `D1_ERROR … daily row read limit` — auch auf `?stand=1` und `/lauf`.
 * Statusanzeige, Erweiterung und Datenläufe waren bis Mitternacht UTC blind.
 *
 * Jetzt gilt für alle drei Spalten dieselbe **Zeitgrenze** wie bisher schon für die Seiten:
 * nur Meldungen seit `pruefstand.erzeugtAm`. An der Auskunft ändert das nichts: Was vor dem
 * letzten Datenlauf gemeldet wurde, steht im gebauten Datensatz — der Prüfstand kennt es,
 * und was er noch offen führt, steht unter den offenen Zeilen (der Abfrage ganz oben). Was
 * der Bau **verworfen** hat, soll die Erweiterung ohnehin erneut fragen. Ohne Prüfstand
 * bleibt es beim alten Verhalten über alles.
 *
 * ## Die Zeitgrenze allein genügte nicht (dieselbe Nacht, am selben Abend gefunden)
 *
 * Der Plan für die **Adressen** zeigte, dass die Grenze dort nichts bewirkte:
 *
 *     SELECT DISTINCT url FROM pruefung WHERE url IS NOT NULL AND url != '' AND gemeldet_am > ?
 *     → SCAN pruefung USING COVERING INDEX pruefung_url_zeit
 *
 * `pruefung_url_zeit` beginnt mit `url`; nach `gemeldet_am` kann SQLite darin nicht springen, und
 * weil der Index beide Spalten trägt, war er „covering" — der Optimierer nahm ihn lieber als einen
 * Sprung mit Sortierung. Gemessen: **8049 Zeilen je Aufruf, 4,35 Mio. an einem Tag, 62 % des
 * Kontingents.** Deshalb erzwingt die Abfrage jetzt `pruefung_gemeldet_url` (Migration 041) —
 * damit steht `SEARCH … (gemeldet_am>?)` im Plan, verifiziert mit `EXPLAIN QUERY PLAN`. Die beiden
 * anderen Spalten liefen schon über `pruefung_gemeldet` und suchen dort korrekt.
 */
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
        die Adresse nicht.

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
      /* Nur seit dem letzten Datenlauf lesen — Begründung über der Funktion. */
      let seitStand: string | null = null
      try {
        const res = await fetch(new URL('data/pruefstand.json', env.SITE_URL).toString(), {
          cf: { cacheTtl: 60 },
        } as RequestInit)
        if (res.ok) seitStand = ((await res.json()) as { erzeugtAm?: string }).erzeugtAm ?? null
      } catch {
        /* Ohne Prüfstand zählen alle Meldungen. */
      }
      const abfrage = (spalte: 'url' | 'such_url' | 'seiten_kennung') => seitStandAbfrage(env, seitStand, spalte)
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
      const { results: alle } = await abfrage('url').all<{ url: string }>()
      const gemeldet = (alle ?? []).map((r) => r.url)
      /*
        **Und die Suchadressen, unter denen gemeldet wurde.**

        Ein Suchauftrag wird auf der Titelseite gemeldet; ohne dieses Feld erfährt
        die Erweiterung nie, dass die Suche erledigt ist, und muss sich auf einen
        lokalen Vermerk verlassen. Der ist nicht abgeglichen — wird die Meldung
        hier verworfen, sperrt er den Auftrag, und nur ein Konsolenbefehl half
        (02.09.2026, „Is This a Zombie?").
      */
      const { results: suchen } = await abfrage('such_url').all<{ such_url: string }>()
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
        erledigt galt. Mit dieser Liste entscheidet die **Seite**, nicht der
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
      const { results: seiten } = await abfrage('seiten_kennung').all<{ seiten_kennung: string }>()
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
