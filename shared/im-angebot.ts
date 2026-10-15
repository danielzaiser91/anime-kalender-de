/**
 * Die Marke „im Angebot“ am Termin. Als Erweiterung von `ReleaseEvent` hier statt in `types.ts`, weil diese Datei schon über der Dateigrenze liegt.
 * Gesetzt wird sie in `expandEvents` aus `Release.dateMeaning: 'available-from'` — Worker und Kalenderdatei haben die Releases nicht.
 */
declare module './types.ts' {
  interface ReleaseEvent {
    /** Das Datum sagt, seit wann der Anbieter den Titel führt, nicht wann die deutsche Fassung erschien. */
    imAngebot?: boolean
    /** Das Datum ist laut aniSearch der erste Tag der deutschen Fassung überhaupt (F9, 14.10.2026): statt „Neu bei …“ die Erstveröffentlichung. */
    erstausgabe?: boolean
  }

  interface Release {
    /** Ein Katalogdatum (`available-from`), das mit der aniSearch-Erstausgabe zusammenfällt, ohne dass ein Anbieter früher war (`markiereErstausgabe`). */
    erstausgabe?: true
  }
}

export {}
