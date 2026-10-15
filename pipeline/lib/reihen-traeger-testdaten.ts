import type { Title } from '../../shared/types.ts'
import type { Anker } from '../bau/anisearch-reihen-katalog.ts'
import { ANISEARCH_ID_BASIS } from '../bau/anisearch-titel.ts'
import type { KatalogEintrag } from './anilist.ts'

/** Erfundene Titel für die Prüfungen zu den Reihen nach der Einzelauflistung (`check-reihen-traeger*.ts`): ein Sammeltitel mit Kind, Waise und zwei Kontrollfällen. */
export const SAMMEL = 21727
export const KIND = 182545
export const WAISE = 303
export const MIT_KENNUNG = 304
export const EINZEL = 900
export const [PAAR_A, PAAR_B] = [901, 902]
export const ZEILE = ANISEARCH_ID_BASIS + 99_990_001
export const ERSTE = ANISEARCH_ID_BASIS + 99_990_003

const eintrag = (id: number, rel: number[], eltern: number[] = []): KatalogEintrag => ({ id, t: [`Titel ${id}`, null, null], format: 'OVA', jahr: 2000, folgen: 1, rel, eltern }) as KatalogEintrag
export const eintraege: KatalogEintrag[] = [
  eintrag(SAMMEL, [KIND, WAISE]), // der Sammeltitel kennt WAISE, WAISE kennt ihn nicht
  eintrag(KIND, [SAMMEL], [SAMMEL]),
  eintrag(WAISE, []),
  eintrag(MIT_KENNUNG, [SAMMEL]),
  eintrag(EINZEL, []),
  eintrag(PAAR_A, [PAAR_B]),
  eintrag(PAAR_B, [PAAR_A]),
]
export const kennung = new Map([[SAMMEL, 99_990_001], [MIT_KENNUNG, 99_990_002]])
export const anker: Anker[] = [
  { id: ERSTE, name: 'Seite 1', anisearchId: 99_990_003, reihe: ERSTE },
  { id: ZEILE, name: 'Seite 2', anisearchId: 99_990_001, reihe: ERSTE },
]
export const katalogWeg = new Map([[SAMMEL, ZEILE]])
/** Die beiden Seitenzeilen als ausgelieferte Titel hinter dem Schalter (das sind die Anker des Katalogs). */
export const verschoben = [
  { id: ERSTE, anisearchId: 99_990_003, franchiseId: ERSTE, titleRomaji: 'Seite 1' },
  { id: ZEILE, anisearchId: 99_990_001, franchiseId: ERSTE, titleRomaji: 'Seite 2' },
] as Title[]
export const weg = { katalogWeg, zeilenWeg: new Set<number>() }
