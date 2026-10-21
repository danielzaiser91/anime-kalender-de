export type Groesse = 'gross' | 'normal' | 'klein'
export type Eintrag = { titel: string; rest: string; groesse: Groesse }
export type Liste = { inArbeit: Eintrag[]; todo: Eintrag[] }
export type DanielEintrag = Eintrag & { icon?: 'kalender' | 'wartet' | 'blockiert'; zeit?: { tag?: { tag: number; monat: number }; std: number; min: number }; faellig?: boolean }
export type Regel = Eintrag & { rhythmus: string; cron?: string }
export type DanielTodo = { jetzt: DanielEintrag[]; spaeter: DanielEintrag[] }

export type LiveEintrag = Eintrag & { zeit: number }

export type PipelineEintrag = Eintrag & { zeit: number; ort: 'pipeline' | 'worker' | 'warteliste' | 'deploy' | '?' }
export type PrioEintrag = Eintrag & { status: string; details: string[] }

declare module 'claude-code' {
  interface PluginState {
    arbeitsliste: {
      liste: Liste
      // „## Neu und live testbar“, schon auf 2 Tage gefiltert, neueste zuerst.
      live: LiveEintrag[]
      // „## In Pipeline“: gemergt, noch nicht live; älteste zuerst.
      pipeline: PipelineEintrag[]
      // Endzeit des autonomen Modus (ISO), null = aus.
      autonomBis: string | null
      // Index des aufgeklappten Now-Eintrags.
      offen: number | null
      // Kennungen der ausgeklappten Bereiche („+ N weitere“) und Gruppen (Kleinigkeiten); jeder Bereich zeigt sonst höchstens fünf.
      // `bereich:<id>` kehrt den Standard des Bereichs um (zu, nur „jetzt“ offen).
      aufgeklappt: string[]
      // „## Top-Prios“: Kasten ganz oben, immer offen (Schlüssel V2: Form mit status und details).
      topPriosV2: PrioEintrag[]
      // „Daniel-Todo“ aus stand.md: Jetzt und Später.
      vonDir: DanielTodo
      // Anzahl fälliger 📅-Einträge: ändert sich nur an einer Zeitgrenze und zeichnet dann neu.
      faellig: number
      // „## Regelmäßig“ aus stand.md.
      regeln: Regel[]
      // Minute (Epoch/60000) der letzten Neuzeichnung der Regelmäßig-Gruppe: der nächste Lauf zählt herunter.
      minute: number
      // Ruhemodus aus ruhemodus.txt: hart, sanft oder aus.
      ruhe: 'hart' | 'sanft' | null
    }
  }
}
