export type ZielAufgabe = { status: 'aktiv' | 'bald' | 'geplant' | 'erledigt'; titel: string; datei: string | null }
export type ZielPlan = { name: string; kennzahl: string | null; erreicht: number; gesamt: number; aufgaben: ZielAufgabe[]; plan: string }
export type Groesse = 'gross' | 'normal' | 'klein'
export type Eintrag = { titel: string; rest: string; groesse: Groesse }
export type Liste = { inArbeit: Eintrag[]; todo: Eintrag[] }
export type DanielEintrag = Eintrag & { icon?: 'kalender' | 'wartet' | 'blockiert'; zeit?: { tag?: { tag: number; monat: number }; std: number; min: number }; faellig?: boolean }
export type Regel = Eintrag & { rhythmus: string; cron?: string }
export type DanielTodo = { jetzt: DanielEintrag[]; spaeter: DanielEintrag[] }

export type PipelineEintrag = Eintrag & { zeit: number; ort: 'pipeline' | 'worker' | 'warteliste' | 'deploy' | '?' }
export type UnterwegsEintrag = { status: string; seit: number; titel: string; meta: string; start: number | null; startArt: 'Info' | 'Bestand' | null; live: number | null }

declare module 'claude-code' {
  interface PluginState {
    arbeitsliste: {
      // „## In Pipeline“: gemergt, noch nicht live; älteste zuerst.
      pipeline: PipelineEintrag[]
      // Endzeit des autonomen Modus (ISO), null = aus.
      autonomBis: string | null
      // Index des aufgeklappten Now-Eintrags.
      offen: number | null
      // Kennungen der ausgeklappten Bereiche („+ N weitere“) und Gruppen (Kleinigkeiten); jeder Bereich zeigt sonst höchstens fünf.
      // `bereich:<id>` kehrt den Standard des Bereichs um (zu, nur „jetzt“ offen).
      aufgeklappt: string[]
      // „Daniel-Todo“ aus stand.md: Jetzt und Später.
      vonDir: DanielTodo
      // Anzahl fälliger 📅-Einträge: ändert sich nur an einer Zeitgrenze und zeichnet dann neu.
      faellig: number
      // „## Titel unterwegs“: Synchro-Infos mit Status, Zeitstempel des letzten Wechsels und Dauer bis live.
      unterwegs: UnterwegsEintrag[]
      // „## Regelmäßig“ aus stand.md.
      regeln: Regel[]
      // Minute (Epoch/60000) der letzten Neuzeichnung der Regelmäßig-Gruppe: der nächste Lauf zählt herunter.
      minute: number
      // Ruhemodus aus ruhemodus.txt: hart, sanft oder aus.
      ruhe: 'hart' | 'sanft' | null
      // Sparmodus aus sparmodus.txt: nur Sonnet mittel und Haiku als Subagenten.
      spar: boolean
      // Ziele aus daniel-zum-abarbeiten/ziele/<n>-<slug>/plan.md (Kasten im Pane; V2: Form mit Aufgaben).
      zieleV2: ZielPlan[]
      // „Kalender heute“: Zeilen des Berliner Tages aus woche.json bzw. events.json.
      kalender: { datum: string; zeilen: { zeit: string | null; geschaetzt: boolean; name: string; anbieter: string; folgen: string }[] }
    }
  }
}
