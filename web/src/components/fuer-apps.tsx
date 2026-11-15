import { CONTACT_EMAIL } from './Datenschutz.tsx'
import { Card } from './static-bausteine.tsx'

const LIZENZ = 'https://creativecommons.org/licenses/by/4.0/deed.de'
const link = 'underline hover:text-ak-text'

/**
 * **Hinweis für Seiten und Apps, die unsere Feeds einbinden** (15.11.2026): beantwortet vorab, was ein Betreiber
 * per Mail fragte. Die Kennzeichen-Sätze geben wieder, was `shared/ics.ts` in die Feeds schreibt.
 */
export function FuerApps() {
  return (
    <Card>
      <details>
        <summary className="min-h-10 cursor-pointer py-2.5 text-sm font-bold text-ak-text">Für Webseiten und Apps</summary>
        <ul className="mt-2 ml-4 list-disc space-y-1.5 text-sm text-ak-leise">
          <li>
            Du darfst die Termine unter <a className={link} href={LIZENZ}>CC BY 4.0</a> nutzen, mit Quellenangabe wie „Termine: anime-kalender.de (CC BY 4.0)“.
          </li>
          <li>Ruf den Feed höchstens einmal pro Stunde ab.</li>
          <li>„(Synchro offen)“ und „(OmU)“ im Titel: Eine deutsche Synchro ist nicht bestätigt, bitte nie als Synchro anzeigen.</li>
          <li>„(neu bei …)“ im Titel: neu bei diesem Anbieter, nicht der erste Tag der deutschen Fassung.</li>
          <li>Fehlt bei einem TV-Termin „Erstmals im TV auf Deutsch.“ in der Beschreibung, ist es eine Wiederholung oder nicht geklärt.</li>
          <li>
            Cover und Staffel: In <a className={link} href="https://anime-kalender.de/data/titles.json">titles.json</a> steht bei jedem Anime unter seiner Titel-ID (der Zahl im Details-Link) im Feld <code>al</code> die AniList-ID. Die Datei ist gepackt knapp 1 MB groß, einmal am Tag abrufen reicht.
          </li>
          <li>
            Fragen an <a className={link} href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>.
          </li>
        </ul>
      </details>
    </Card>
  )
}
