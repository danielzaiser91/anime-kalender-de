/* Sperrt für eine Playwright-Seite oder einen Kontext alles Externe: jede Anfrage wird mit `{}` beantwortet.
 * Tests, die echte Erweiterungs- oder Web-Skripte laden, rufen es gleich nach dem Anlegen auf (Wächter: tools/test-netz-wache.mjs).
 * Später registrierte `route`-Aufrufe der Seite haben Vorrang und dürfen eigene Antworten geben. */
export async function sperreNetz(seiteOderKontext) {
  const abgefangen = []
  await seiteOderKontext.route('**/*', (r) => {
    abgefangen.push(r.request().url())
    return r.fulfill({ status: 200, contentType: 'application/json', body: '{}' })
  })
  return abgefangen
}
