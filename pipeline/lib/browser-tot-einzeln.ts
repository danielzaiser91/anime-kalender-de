/**
 * Eine einzelne Browser-Totmeldung zu Netflix streicht keinen Weg (17.11.2026).
 *
 * Der Netflix-Durchgang meldet „nicht bei Netflix“ aus der Sicht eines Tabs. Ein Takt-Fehler (Tab stand auf /browse) machte
 * daraus 170 Handbelege `available: false`, der Bau strich 170 Wege, und niemand bemerkte es. Eine Seitenansicht im Browser
 * ist keine Widerlegung: Der Eintrag zählt nicht, bis eine zweite Quelle dasselbe sagt (Linkprüfung: 404/region greift
 * unabhängig davon in `09-2-linkpruefung.ts`). Die Übersicht-Meldung („als toter Verweis gemeldet“) ist Daniels bewusster
 * Klick und bleibt gültig.
 */
import { istBelegNachStichtag, istUmleitungsNotiz } from './netflix-umleitung-meldung.ts'

const DURCHGANG = /^Vom Durchgang als nicht bei Netflix gemeldet/

/** Ausnahme (18.11.2026): Eine Umleitungs-Meldung nach dem Stichtag stammt von der behobenen Erweiterung und gilt (PR 4186 stellte nur den Stapel um). */
export function istEinzelneBrowserTotmeldung(b: { platform?: string; available?: boolean; note?: string; checkedAt?: string } | null | undefined): boolean {
  if (b?.platform !== 'netflix' || b.available !== false || !DURCHGANG.test(b.note ?? '')) return false
  return !(istUmleitungsNotiz(b.note) && istBelegNachStichtag(b.checkedAt))
}
