import { warn } from './util.ts'

/** Lädt eine Datei in die private Ablage; ohne Token oder bei einem Fehler bleibt die Lesung ohne Bild. */
export async function ablegen(key: string, inhalt: Buffer, typ: string): Promise<string | undefined> {
  const token = process.env.LAUF_TOKEN
  if (!token) return undefined
  const worker = process.env.LAUF_WORKER ?? 'https://newsletter.animekalender.workers.dev'
  try {
    const r = await fetch(`${worker}/beleg?key=${encodeURIComponent(key)}`, {
      method: 'POST',
      headers: { 'X-Lauf-Token': token, 'Content-Type': typ },
      body: new Uint8Array(inhalt),
    })
    if (!r.ok) throw new Error(`HTTP ${r.status}`)
    return key
  } catch (e) {
    warn(`Beleg nicht abgelegt (${key}): ${(e as Error).message}`)
    return undefined
  }
}
