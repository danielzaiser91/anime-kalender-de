import { useSyncExternalStore } from 'react'

/**
 * **Vorschauen: neue Oberflächen live, aber nur auf Zuruf** (Daniel, 07.10.2026: „bau den Mockup direkt in die Seite, sichtbar nur per Konsolenbefehl").
 * Eine Vorschau ist eine Variante, die jeder Besucher geliefert bekommt, aber nur sieht, wer sie in der Konsole einschaltet:
 *
 *     akVorschau('beleg', 'schalter')   // einschalten, mit Variante
 *     akVorschau('beleg', false)        // ausschalten
 *     akVorschau()                      // Liste: Namen, Varianten, was gerade an ist
 *
 * Der Wert liegt im `localStorage` dieses Browsers (`ak-vorschau`) und überlebt das Neuladen. Neue Vorschau = ein Eintrag in `VORSCHAUEN` und ein `useVorschau('name')` an der Stelle.
 */
const SCHLUESSEL = 'ak-vorschau'
const EREIGNIS = 'ak-vorschau-geaendert'

/** Alle Vorschauen mit ihren Varianten und einer Zeile Beschreibung. */
export const VORSCHAUEN: Record<string, { varianten: string[]; text: string }> = {
  beleg: {
    varianten: ['schalter', 'klick', 'karte'],
    text: 'Beleg-Fenster: Ausschnitt zuerst. schalter = Umschalter „Beleg | Ganze Seite", klick = nur Ausschnitt, Klick zeigt die ganze Seite, karte = Ausschnitt mit Übersichtskarte der Seite.',
  },
}

function lesen(): Record<string, string> {
  try {
    return JSON.parse(localStorage.getItem(SCHLUESSEL) ?? '{}') as Record<string, string>
  } catch {
    return {}
  }
}

export function vorschauWert(name: string): string | undefined {
  const w = lesen()[name]
  return w && VORSCHAUEN[name]?.varianten.includes(w) ? w : undefined
}

function setzen(name: string, wert: string | false): void {
  const alle = lesen()
  if (wert === false) delete alle[name]
  else alle[name] = wert
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(alle))
  } catch {
    /* Privates Fenster ohne Speicher: dann gilt die Vorschau nur bis zum Neuladen nicht — es bleibt bei der gewohnten Ansicht. */
  }
  window.dispatchEvent(new Event(EREIGNIS))
}

/** Die gewählte Variante einer Vorschau — `undefined`, wenn sie aus ist. Aktualisiert sich beim Umschalten in der Konsole ohne Neuladen. */
export function useVorschau(name: string): string | undefined {
  return useSyncExternalStore(
    (f) => {
      window.addEventListener(EREIGNIS, f)
      window.addEventListener('storage', f)
      return () => {
        window.removeEventListener(EREIGNIS, f)
        window.removeEventListener('storage', f)
      }
    },
    () => vorschauWert(name),
    () => undefined,
  )
}

/** Der Konsolenbefehl `akVorschau`; ohne Argumente listet er die Vorschauen. */
export function installiereVorschauBefehl(): void {
  ;(window as unknown as { akVorschau: unknown }).akVorschau = (name?: string, wert: string | boolean = true) => {
    if (!name) {
      for (const [n, v] of Object.entries(VORSCHAUEN)) console.log(`${n} [${v.varianten.join(' | ')}] ${vorschauWert(n) ? `AN: ${vorschauWert(n)}` : 'aus'} — ${v.text}`)
      return
    }
    const vorschau = VORSCHAUEN[name]
    if (!vorschau) return console.warn(`Unbekannte Vorschau „${name}". Bekannt: ${Object.keys(VORSCHAUEN).join(', ')}`)
    if (wert === false) return setzen(name, false)
    const variante = wert === true ? vorschau.varianten[0]! : wert
    if (!vorschau.varianten.includes(variante)) return console.warn(`Variante „${variante}" gibt es nicht. Bekannt: ${vorschau.varianten.join(', ')}`)
    setzen(name, variante)
    console.log(`Vorschau „${name}" an (${variante}).`)
  }
}
