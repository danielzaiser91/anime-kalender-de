import { providerName } from '../../shared/mappings.ts'

type Angebot = { anbieter: string; url?: string }
export type Staffel = { nr?: number; folgen?: number; angebote?: Angebot[] }
export type MitStaffeln = { staffeln?: Staffel[] }

/**
 * Die JustWatch-Staffeln, die dieser Titel sein kann. Genau eine, wenn die Staffelnummer des Titels in seiner Reihe (`staffelDesTitels`) bei JustWatch
 * dieselbe Folgenzahl trägt wie der Titel (Goblin Slayer, Chaika, Last Exile); sonst alle: Eine Folgenzahl ohne Gegenstück, ein Cour oder eine Reihe ohne
 * Nummer bestimmen keine Staffel, und eine Lücke der Staffelliste (leere Sonderstaffeln mit 1 bis 6 Folgen) widerlegt keinen Weg (11.11.2026).
 */
export function moeglicheStaffeln(e: MitStaffeln, episodes: number | null | undefined, nummer: number | undefined): Staffel[] {
  const alle = e.staffeln ?? []
  const eigene = nummer && episodes ? alle.find((s) => s.nr === nummer && s.folgen === episodes) : undefined
  return eigene ? [eigene] : alle
}

/** Führt die Staffel das Angebot: dieselbe Adresse oder derselbe Anbieter (die Adresse ist bei Crunchyroll je Staffel eine andere)? */
export function staffelFuehrt(staffel: Staffel, angebot: Angebot): boolean {
  const name = providerName(angebot.anbieter)
  return (staffel.angebote ?? []).some((a) => a.url === angebot.url || (!!name && providerName(a.anbieter) === name))
}
