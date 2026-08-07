# Newsletter-Worker

Cloudflare Worker + D1 + Cron. Der Kalender selbst braucht ihn nicht — er ist ein
Anbauteil, das ausschließlich den Newsletter bedient.

## Einrichten

```bash
cd worker
npm install
npx wrangler login

# Datenbank anlegen — die ausgegebene database_id in wrangler.toml eintragen
npx wrangler d1 create anime-kalender

# Tabellen anlegen
npm run db:init          # lokal
npm run db:init:remote   # live

# Mail-Zugang hinterlegen (Resend- oder Brevo-API-Key)
npx wrangler secret put MAIL_API_KEY

npm run deploy
```

Danach in `wrangler.toml` setzen:

- `FROM_EMAIL` / `FROM_NAME` — Absender. Bei **Resend** muss die Domain dort
  verifiziert sein, sonst gehen Mails nur an die eigene Adresse. **Brevo** kommt
  mit einer verifizierten Einzeladresse aus, deckelt aber bei 300 Mails/Tag.
- `MAIL_PROVIDER` — `resend`, `brevo` oder `console` (schreibt nur ins Log).
- `WORKER_URL` — die öffentliche Adresse des Workers, landet in den Abmeldelinks.
- `ALLOWED_ORIGIN` — die Adresse der Website, für CORS.

Zuletzt im Frontend `VITE_NEWSLETTER_API` auf die Worker-URL setzen (z. B. in
`.env` oder als Repository-Variable in GitHub Actions) und neu bauen.

## Endpunkte

| Route | Zweck |
|---|---|
| `POST /subscribe` | `{ email, frequency: "daily"\|"weekly", platforms: [] }` → Bestätigungsmail |
| `GET /confirm?token=…` | schaltet das Abo scharf |
| `GET /unsubscribe?token=…` | löscht den Datensatz |
| `GET /health` | Anzahl aktiver Abos |

## Versandlogik

Der Cron läuft **stündlich** und prüft selbst, ob es in Berlin gerade
`SEND_HOUR_BERLIN` (Standard 7) ist. So stimmt der Zeitpunkt auch nach der
Sommerzeitumstellung, ohne zwei Cron-Einträge zu verbrauchen.

- **täglich**: Termine des heutigen Tages
- **wöchentlich**: montags, Termine der nächsten sieben Tage

Die `send_log`-Tabelle verhindert Doppelversand, falls ein Cron zweimal feuert.
Wer nur Plattformen abonniert hat, bekommt keine Mail, wenn in seinem Fenster
nichts passendes liegt.

## Datenschutz

Gespeichert werden Adresse, Rhythmus, Plattformwahl sowie Zeitpunkt und IP von
Anmeldung und Bestätigung — Letzteres als Nachweis der Einwilligung. Die
Abmeldung löscht die Zeile vollständig; es bleibt kein Rest zurück.
