/**
 * **Web-Push für Favoriten** (18.09.2026). Ein Browser abonniert beim Push-Dienst seines
 * Herstellers; der Worker merkt sich nur den Endpunkt und die Favoriten dieses Browsers und
 * schickt stündlich einen Push, wenn eine gemerkte Folge erschienen ist. Kein Konto.
 */
const WORKER = import.meta.env.VITE_NEWSLETTER_API ?? ''
const MERKER = 'pushAbo'

export const pushMoeglich = (): boolean =>
  typeof window !== 'undefined' && 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window && Boolean(WORKER)

function schluesselBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/') + '='.repeat((4 - (b64url.length % 4)) % 4)
  const bin = atob(b64)
  const out = new Uint8Array(new ArrayBuffer(bin.length))
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i)
  return out
}

export function pushAktivGemerkt(): boolean {
  try {
    return localStorage.getItem(MERKER) === '1'
  } catch {
    return false
  }
}

async function senden(abo: PushSubscription, favoriten: number[] | null): Promise<void> {
  const res = await fetch(`${WORKER}/push/abo`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(favoriten ? { subscription: abo.toJSON(), favoriten } : { subscription: abo.toJSON(), abmelden: true }),
  })
  if (!res.ok) throw new Error('Der Dienst hat das Abo nicht angenommen.')
}

export async function pushEinschalten(favoriten: number[]): Promise<void> {
  if ((await Notification.requestPermission()) !== 'granted') throw new Error('Benachrichtigungen sind im Browser nicht erlaubt.')
  const reg = await navigator.serviceWorker.ready
  const { schluessel } = (await (await fetch(`${WORKER}/push/schluessel`)).json()) as { schluessel: string | null }
  if (!schluessel) throw new Error('Der Dienst ist gerade nicht erreichbar.')
  const abo =
    (await reg.pushManager.getSubscription()) ??
    (await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: schluesselBytes(schluessel) }))
  await senden(abo, favoriten)
  try {
    localStorage.setItem(MERKER, '1')
  } catch {
    /* ohne Speicher gilt es nur für diesen Besuch */
  }
}

export async function pushAusschalten(): Promise<void> {
  const reg = await navigator.serviceWorker.ready
  const abo = await reg.pushManager.getSubscription()
  if (abo) {
    await senden(abo, null).catch(() => undefined)
    await abo.unsubscribe()
  }
  try {
    localStorage.removeItem(MERKER)
  } catch {
    /* egal */
  }
}

/** Favoriten nachführen, wenn sie sich ändern — nur bei aktivem Abo. */
export async function pushFavoritenNachfuehren(favoriten: number[]): Promise<void> {
  if (!pushAktivGemerkt() || !pushMoeglich()) return
  const abo = await (await navigator.serviceWorker.ready).pushManager.getSubscription()
  if (abo) await senden(abo, favoriten).catch(() => undefined)
}
