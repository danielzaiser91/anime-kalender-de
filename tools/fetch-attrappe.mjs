// Gemeinsamer Kern der fetch-Attrappen: `antwort(url, opt)` liefert eine Response oder undefined (nicht vorgesehen).
// Nicht Vorgesehenes geht an `weiter` (nur solange ein Aufrufer es noch ausdrücklich verlangt), sonst Fehler mit Adresse.
export function baueFetchAttrappe(antwort, weiter) {
  return async (url, opt) => {
    const treffer = await antwort(url, opt)
    if (treffer) return treffer
    if (weiter) return weiter(url, opt)
    throw new Error(`Attrappe: unerwarteter Aufruf ${opt?.method ?? 'GET'} ${url}`)
  }
}

// Der Abruf der offenen Meldungen (GET …/pruefung), den die Meldungs-Attrappen beantworten.
export function istMeldungsabruf(url, opt) {
  return String(url).includes('/pruefung') && !(opt && opt.method === 'POST')
}

export function meldungsAntwort(pruefungen) {
  return new Response(JSON.stringify({ pruefungen }), { status: 200, headers: { 'content-type': 'application/json' } })
}
