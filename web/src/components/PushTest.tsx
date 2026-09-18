import { useState } from 'react'

/**
 * **Zustell-PoC für Web-Push** (18.09.2026) — nur sichtbar unter `#/abo?pushtest=1`.
 *
 * Prüft den ganzen Weg auf einem echten Gerät: Erlaubnis, Abo beim Push-Dienst des
 * Browsers, ein leerer Push vom Worker zurück, Anzeige durch den Service Worker. Es wird
 * nichts gespeichert; das Abo bleibt nur im Browser. Auf dem iPhone geht es nur, wenn die
 * Seite auf dem Home-Bildschirm installiert ist.
 */
const WORKER = import.meta.env.VITE_NEWSLETTER_API ?? ''

function schluesselBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function PushTest() {
  const [lage, setLage] = useState('')
  if (!location.hash.includes('pushtest=1')) return null

  const testen = async () => {
    try {
      if (!('serviceWorker' in navigator) || !('PushManager' in window)) throw new Error('Dieser Browser kann keine Push-Nachrichten.')
      setLage('Erlaubnis …')
      if ((await Notification.requestPermission()) !== 'granted') throw new Error('Benachrichtigungen nicht erlaubt.')
      const reg = await navigator.serviceWorker.ready
      const { schluessel } = (await (await fetch(`${WORKER}/push/schluessel`)).json()) as { schluessel: string | null }
      if (!schluessel) throw new Error('Der Worker kennt keinen Schlüssel.')
      setLage('Abo beim Push-Dienst …')
      const abo =
        (await reg.pushManager.getSubscription()) ??
        (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(schluessel) }))
      setLage('Push wird geschickt …')
      const res = await fetch(`${WORKER}/push/test`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription: abo.toJSON() }),
      })
      const antwort = (await res.json()) as { ok?: boolean; status?: number; text?: string; error?: string }
      setLage(
        antwort.ok
          ? `Push-Dienst hat angenommen (${antwort.status}). Kommt gleich eine Benachrichtigung?`
          : `Abgelehnt: ${antwort.status ?? ''} ${antwort.error ?? antwort.text ?? ''} — Dienst: ${new URL(abo.endpoint).hostname}`,
      )
    } catch (e) {
      setLage(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="rounded-xl border border-dashed border-sky-500/50 p-4 text-sm">
      <p className="mb-2 font-semibold">Push-Test</p>
      <button type="button" onClick={() => void testen()} className="cursor-pointer rounded-lg bg-sky-600 px-3 py-1.5 font-medium text-white">
        Test-Benachrichtigung schicken
      </button>
      {lage && <p className="mt-2 text-slate-600 dark:text-slate-300">{lage}</p>}
    </div>
  )
}
