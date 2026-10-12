// Vorlader für pipeline/check-kanal-abgehakt.ts: GET /pruefung liefert eine erfundene Kanal-Meldung ohne Urteil an einer bekannten Adresse.
import { readFileSync } from 'node:fs'
const echt = globalThis.fetch
const titles = JSON.parse(readFileSync('public/data/titles.json', 'utf8'))
const liste = Array.isArray(titles) ? titles : (titles.titles ?? Object.values(titles))
const t = liste.find((x) => (x.streams ?? []).some((s) => s.platform === 'disneyplus' && s.url))
const s = t.streams.find((q) => q.platform === 'disneyplus' && q.url)
globalThis.fetch = async (url, opt) => {
  if (String(url).includes('/pruefung') && !(opt && opt.method === 'POST')) {
    const zeile = {
      id: 99999,
      plattform: 'disneyplus',
      url: s.url,
      sprachen: '[]',
      befund: 'kein_dub',
      titel: 'Test',
      folgen: null,
      folge_nr: null,
      staffel: null,
      staffeln: null,
      serientitel: null,
      notiz: 'Kanal-Titel',
      teil_von: null,
      teil_bis: null,
      gemeldet_am: new Date().toISOString(),
      seiten_kennung: null,
      titel_id: t.id,
      folge: null,
    }
    return new Response(JSON.stringify({ pruefungen: [zeile] }), { status: 200, headers: { 'content-type': 'application/json' } })
  }
  return echt(url, opt)
}
