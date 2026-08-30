/**
 * Der Kanal, über den die Statusanzeige sofort erfährt, dass sich etwas
 * geändert hat.
 *
 * Daniel am 30.08.2026: „status app muss automatisch mitbekommen wenn es sich
 * ändert. bau ein eventing system ein, sodass es sofort benachrichtigt wird
 * (websocket oder sonstiges)."
 *
 * Vorher fragte die Anzeige nach: alle fünf Sekunden, solange ein Lauf lief,
 * sonst einmal je Minute — die Prüfliste sogar nur einmal je Minute. Wer
 * meldet und gleich danach hinsieht, sieht deshalb den Stand von vorhin.
 *
 * **Warum ein Durable Object und nicht der Worker selbst.** Ein Worker lebt je
 * Anfrage; er kann keine Verbindung halten, die eine zweite Anfrage
 * benachrichtigt. Ein Durable Object ist genau das: eine Stelle, die es einmal
 * gibt und die weiß, wer gerade zuhört. Auf Cloudflare ist es der einzige Weg
 * zu echtem Push.
 *
 * **Hibernation.** Die Sockets werden über `acceptWebSocket` angenommen, nicht
 * über `accept()`. Damit darf Cloudflare das Objekt aus dem Speicher nehmen,
 * während niemand etwas sendet — die Verbindungen bleiben trotzdem offen. Eine
 * Anzeige, die den ganzen Tag auf dem zweiten Bildschirm steht, kostet so
 * nichts außer den Ereignissen selbst.
 */
export class Ereignisse implements DurableObject {
  constructor(private readonly state: DurableObjectState) {}

  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url)

    /*
      Der Broadcast kommt vom Worker, nicht von außen: Er erreicht dieses
      Objekt nur über den Stub, den allein der Worker hat. Ein Client kann
      diesen Pfad nicht ansprechen — er landet am öffentlichen Endpunkt, und
      der leitet nur den Upgrade-Wunsch hierher.
    */
    if (url.pathname === '/senden') {
      const nachricht = await request.text()
      let erreicht = 0
      for (const socket of this.state.getWebSockets()) {
        try {
          socket.send(nachricht)
          erreicht++
        } catch {
          /* Eine tote Verbindung hält den Rest nicht auf. */
        }
      }
      return new Response(String(erreicht))
    }

    if (request.headers.get('Upgrade') !== 'websocket') {
      return new Response('WebSocket erwartet', { status: 426 })
    }

    const paar = new WebSocketPair()
    const [zumClient, hier] = Object.values(paar)
    this.state.acceptWebSocket(hier!)
    /*
      Ein erstes Lebenszeichen, damit die Anzeige weiß, dass der Kanal steht —
      und nicht erst beim ersten Ereignis, das Stunden später kommen kann.
    */
    try {
      hier!.send(JSON.stringify({ typ: 'verbunden' }))
    } catch {
      /* Sendet sie nicht, merkt es der Client am ausbleibenden Ereignis. */
    }
    return new Response(null, { status: 101, webSocket: zumClient })
  }

  /**
   * Antwortet auf `ping`.
   *
   * Cloudflare schließt eine Verbindung, über die lange nichts läuft. Der
   * Client schickt deshalb regelmäßig ein Lebenszeichen; ohne diese Antwort
   * wüsste er nicht, ob die Leitung noch steht oder nur nichts passiert.
   */
  webSocketMessage(socket: WebSocket, nachricht: string | ArrayBuffer): void {
    if (typeof nachricht === 'string' && nachricht === 'ping') {
      try {
        socket.send('pong')
      } catch {
        /* Dann ist sie zu, und `webSocketClose` räumt gleich auf. */
      }
    }
  }

  webSocketClose(socket: WebSocket, code: number, grund: string): void {
    try {
      socket.close(code === 1006 ? 1000 : code, grund)
    } catch {
      /* Schon zu. */
    }
  }

  webSocketError(): void {
    /* Nichts zu tun — Cloudflare räumt die Verbindung selbst ab. */
  }
}

/**
 * Ein Ereignis an alle offenen Anzeigen schicken.
 *
 * Immer über `ctx.waitUntil` aufrufen: Die Meldung, die das Ereignis auslöst,
 * soll nicht darauf warten. Schlägt der Versand fehl, ist das kein Grund, eine
 * angekommene Meldung als Fehler zu quittieren — die Anzeige fragt ohnehin
 * weiter nach, nur langsamer.
 */
export async function ereignisSenden(
  env: { EREIGNISSE?: DurableObjectNamespace },
  typ: string,
  daten: Record<string, unknown> = {},
): Promise<void> {
  if (!env.EREIGNISSE) return
  /*
    Ein einziges Objekt für alle Zuhörer. `idFromName` mit festem Namen ist der
    Weg dahin; ohne den läge je Aufruf ein anderes Objekt vor, und niemand
    bekäme etwas zu hören.
  */
  const stub = env.EREIGNISSE.get(env.EREIGNISSE.idFromName('status'))
  await stub.fetch('https://ereignisse/senden', {
    method: 'POST',
    body: JSON.stringify({ typ, ...daten, zeit: new Date().toISOString() }),
  })
}
