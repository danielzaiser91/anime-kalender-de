/**
 * Eigener, winziger Worker nur für die ADN-Durchreiche (`wrangler deploy -c adn-gw.wrangler.toml` im Ordner `worker`).
 *
 * Eigener Worker, damit die Platzierung nach Frankfurt nur ihn trifft und nicht Newsletter, D1 und den Crunchyroll-Zugang.
 * Geheimnis `LAUF_TOKEN` dort mit `wrangler secret put LAUF_TOKEN -c adn-gw.wrangler.toml` setzen (derselbe Wert wie am Newsletter-Worker).
 */
import { handleAdnGw } from './adn-gw.ts'
import { type Env } from './env.ts'

export default {
  fetch: (request: Request, env: Env): Promise<Response> => handleAdnGw(request, env),
}
