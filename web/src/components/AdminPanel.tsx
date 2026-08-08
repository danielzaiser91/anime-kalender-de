import { useState } from 'react'
import { Button, SectionTitle } from './ui.tsx'

const WORKER_URL = import.meta.env.VITE_NEWSLETTER_API ?? ''
const STORAGE_KEY = 'adminToken'

/**
 * Liest den Schlüssel aus `#/newsletter?admin=<token>` und merkt ihn für die
 * Sitzung. Danach genügt der Aufruf ohne Parameter — nach dem Schließen des
 * Browsers ist er wieder weg.
 *
 * Der Schutz liegt beim Worker, nicht hier: Ohne den richtigen Schlüssel lehnt
 * er jeden Aufruf mit 403 ab. Die Oberfläche ist nur die Fernbedienung.
 */
export function readAdminToken(): string | undefined {
  const fromUrl = new URLSearchParams(window.location.hash.split('?')[1] ?? '').get('admin')
  if (fromUrl) sessionStorage.setItem(STORAGE_KEY, fromUrl)
  return sessionStorage.getItem(STORAGE_KEY) ?? undefined
}

interface Action {
  label: string
  path: string
  hint: string
  danger?: boolean
}

const ACTIONS: Action[] = [
  {
    label: 'Tagesdigest jetzt senden',
    path: '/debug/digest?frequency=daily',
    hint: 'Geht an alle mit täglichem Rhythmus. Umgeht die Tagessperre.',
    danger: true,
  },
  {
    label: 'Wochendigest jetzt senden',
    path: '/debug/digest?frequency=weekly',
    hint: 'Geht an alle mit wöchentlichem Rhythmus.',
    danger: true,
  },
  {
    label: 'Seiten prüfen',
    path: '/debug/monitor',
    hint: 'Prüft alle Seiten. Mail nur, wenn etwas gestört ist.',
  },
  {
    label: 'Störungsmail erzwingen',
    path: '/debug/monitor?mail=alert',
    hint: 'Schickt die Störungsmail, auch wenn alles läuft.',
    danger: true,
  },
  {
    label: 'Wochenübersicht erzwingen',
    path: '/debug/monitor?mail=weekly',
    hint: 'Schickt die Wochenübersicht sofort.',
    danger: true,
  },
  { label: 'Status abrufen', path: '/status', hint: 'Letzter Stand aller Seiten, ohne Mail.' },
]

export function AdminPanel({ token }: { token: string }) {
  const [busy, setBusy] = useState<string>()
  const [output, setOutput] = useState<string>()

  const run = async (action: Action) => {
    if (action.danger && !window.confirm(`${action.label}?\n\n${action.hint}`)) return
    setBusy(action.path)
    setOutput(undefined)
    try {
      const sep = action.path.includes('?') ? '&' : '?'
      const url = `${WORKER_URL}${action.path}${
        action.path.startsWith('/debug') ? `${sep}token=${encodeURIComponent(token)}` : ''
      }`
      const res = await fetch(url)
      setOutput(JSON.stringify(await res.json(), null, 2))
    } catch (err) {
      setOutput(`Fehlgeschlagen: ${(err as Error).message}`)
    } finally {
      setBusy(undefined)
    }
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/[0.06] p-5">
      <SectionTitle>Nur für den Betreiber</SectionTitle>
      <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">
        Sichtbar, weil die Adresse einen gültigen Schlüssel enthält. Der Schlüssel gilt für diese
        Browsersitzung und ist danach wieder weg. Nicht weitergeben — wer ihn hat, kann Mails an
        alle Abonnenten auslösen.
      </p>

      <div className="flex flex-wrap gap-2">
        {ACTIONS.map((action) => (
          <Button key={action.path} size="sm" title={action.hint} onClick={() => run(action)}>
            {busy === action.path ? '…' : action.label}
          </Button>
        ))}
      </div>

      {output && (
        <pre className="mt-3 max-h-72 overflow-auto rounded-lg bg-black/40 p-3 text-[11px] leading-relaxed text-slate-200">
          {output}
        </pre>
      )}
    </div>
  )
}
