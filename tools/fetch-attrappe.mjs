// Gemeinsamer Kern der fetch-Attrappen: `antwort(url, opt)` liefert eine Response oder undefined (nicht vorgesehen).
// Nicht Vorgesehenes wirft mit Adresse, statt still ans echte Netz zu gehen.
export function baueFetchAttrappe(antwort) {
  return async (url, opt) => {
    const treffer = await antwort(url, opt)
    if (treffer) return treffer
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
