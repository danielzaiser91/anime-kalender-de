/**
 * **Disney+: „nichts da?" gilt sofort als beantwortet** (4.31.9, 21.10.2026).
 *
 * Daniel am 21.10.2026: Nach „nichts da?" blieben die Zeilen in „zu prüfen". Der Briefkasten kennt
 * die Meldung zwar, aber `?gemeldet=` liefert nur Meldungen mit Folgennummer; ein „nein" hat keine,
 * und eine Wiedervorlage (`seit`) zählt ausschließlich diese Paare. Darum merkt sich die Seite die
 * eigene Antwort lokal (Adresse → Zeitpunkt) und rechnet sie gegen `seit`: nur eine Antwort nach
 * der Wiedervorlage beantwortet sie. Nach 30 Tagen fragt die Liste wieder (Disney+ kann den Titel aufnehmen).
 */
{
  const SCHLUESSEL = 'ak-disney-weg'
  const FRIST_MS = 30 * 24 * 60 * 60 * 1000

  function weg({ dauer, jetzt }) {
    const lesen = () => {
      try {
        return JSON.parse(dauer.getItem(SCHLUESSEL) ?? '{}')
      } catch {
        return {}
      }
    }
    /** `seit` wie in der Liste ('2026-08-26'); ohne Wiedervorlage genügt jede frische Antwort. */
    const gilt = (url, seit) => {
      const am = lesen()[url]
      if (!am || jetzt() - Date.parse(am) >= FRIST_MS) return false
      return am >= String(seit ?? '')
    }
    return {
      gilt,
      /** Gibt `ok` unverändert zurück, damit der Aufrufer es durchreichen kann. */
      merke(url, ok) {
        if (!ok) return ok
        try {
          dauer.setItem(SCHLUESSEL, JSON.stringify({ ...lesen(), [url]: new Date(jetzt()).toISOString() }))
        } catch {
          /* Ohne Speicher bleibt es bei der Antwort des Briefkastens. */
        }
        return ok
      },
      /** Die Rechnung der Liste: Briefkasten-Antwort oder eigene Antwort. */
      erledigt: (url, seit, vomBriefkasten) => vomBriefkasten || gilt(url, seit),
    }
  }

  globalThis.akDisneyWeg = weg
  /* Ohne localStorage (Ladeprobe, gesperrter Speicher) gilt die Antwort nur bis zum Neuladen. */
  const ram = new Map()
  const imRam = { getItem: (k) => ram.get(k) ?? null, setItem: (k, v) => ram.set(k, v) }
  const dauer = typeof localStorage === 'undefined' ? imRam : localStorage
  globalThis.AK_DISNEY_WEG = weg({ dauer, jetzt: () => Date.now() })
}
