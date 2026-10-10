import { CONTACT_EMAIL } from './Datenschutz.tsx'

export function ImpressumAnbieter() {
  return (
      <div>
        <h2 className="font-semibold text-slate-800 dark:text-slate-100">Anbieter</h2>
        <p>
          Daniel Zaiser
          <br />
          c/o IP-Management #12369
          <br />
          Ludwig-Erhard-Str. 18
          <br />
          20459 Hamburg
          <br />
          E-Mail:{' '}
          <a className="underline hover:text-sky-400" href={`mailto:${CONTACT_EMAIL}`}>
            {CONTACT_EMAIL}
          </a>
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
          Dieses Angebot ist ein privates, nicht kommerzielles Fan-Projekt ohne Werbung, ohne
          Affiliate-Links und ohne kostenpflichtige Leistungen.
        </p>
      </div>
  )
}
