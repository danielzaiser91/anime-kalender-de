// Attrappe für globalThis.fetch im Prozesstest pipeline/check-anime2you-router.ts: `anime2you-extraktion.ts --auswahl` gegen einen Feed mit einem Artikel.
// Die Seite trägt die Rubrik so, wie anime2you.de sie schreibt: als Objekt {"1":"Crunchyroll"} (Artikel 1062641).
const feed = '<rss><channel><item><title>Zwei Neuzugänge auf Crunchyroll</title><link>https://www.anime2you.de/news/1063615/zwei-neuzugaenge/</link><pubDate>Sat, 24 Oct 2026 17:54:00 +0200</pubDate><description>x</description></item></channel></rss>'
const leer = '<rss><channel></channel></rss>'
const seite = `<html><head><script type="application/ld+json">{"@graph":[{"@type":"WebPage"},{"@type":"Article","articleSection":{"1":"Crunchyroll"}}]}</script></head><body><article><p>Crunchyroll erweitert sein Programm um zwei Anime mit deutscher Sprachausgabe.</p></article></body></html>`

globalThis.fetch = async (url) => {
  const adresse = String(url)
  if (adresse.includes('/news/1063615/')) return new Response(seite, { status: 200 })
  if (adresse.includes('/feed/') && !adresse.includes('paged=')) return new Response(feed, { status: 200 })
  return new Response(adresse.includes('/feed/') ? leer : 'nicht gefunden', { status: adresse.includes('/feed/') ? 200 : 404 })
}
