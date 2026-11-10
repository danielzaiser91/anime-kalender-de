// Attrappe für globalThis.fetch im Prozesstest pipeline/check-anime2you-abruf.ts (Modus in AK_A2Y_MODUS).
const modus = process.env.AK_A2Y_MODUS
const leer = '<rss><channel></channel></rss>'
const eintrag = '<rss><channel><item><title>Netflix: Neue Serie</title><link>https://www.anime2you.de/a1/</link><description>Die Serie ist ab sofort bei Netflix zu sehen.</description></item></channel></rss>'
const hinweisAlt = '<rss><channel><item><title>Netflix: Neue Serie</title><link>https://www.anime2you.de/a2/</link><pubDate>Mon, 01 Jun 2020 10:00:00 +0000</pubDate><description>Die Serie ist ab sofort bei Netflix mit deutscher Synchronisation zu sehen.</description></item></channel></rss>'

globalThis.fetch = async (url) => {
  const adresse = String(url)
  const antwort = (status, text) => new Response(text, { status })
  if (!adresse.includes('/feed/')) return antwort(403, 'Artikel gesperrt')
  if (modus === 'netz') throw new Error('Netz weg')
  if (modus === 'alle403') return antwort(403, 'Forbidden')
  if (modus === 'teil403' && adresse.includes('/disc-news/')) return antwort(403, 'Forbidden')
  if (modus === 'artikel403' && adresse.includes('/streaming-news/')) return antwort(200, eintrag)
  // Sprachhinweis ohne Tag, Veröffentlichung weit in der Vergangenheit: der Vorrat muss ihn verwerfen (pipeline/check-anime2you-bleibt.ts).
  if (modus === 'sprachhinweis-alt' && adresse.includes('/streaming-news/')) return antwort(200, hinweisAlt)
  return antwort(200, leer)
}
