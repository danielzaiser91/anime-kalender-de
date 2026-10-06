> Recherche vom 06.10.2026 (Subagent, Abrufe vom selben Tag; Zahlen und Zitate vor einer Entscheidung am Original gegenprüfen). Auftrag: Daniel, 05.10.2026, „lohnt sich GitHub Pages für produktive Seiten langfristig?". Zusammenfassung und Schwelle stehen in `status.md`, Zeile „Hosting prüfen".

# Hosting-Entscheidungsvorlage: GitHub Pages für anime-kalender.de (Stand 06.10.2026)

Alle Zitate stammen aus Abrufen vom 06.10.2026 (WebFetch fasst Seiten zusammen; wörtlich = so von WebFetch geliefert, Rest ist als "unsicher" markiert).
Eigener Ist-Stand (Repo `C:\code\ai\_wtumbau`, gemessen heute): `public/` = 94 MB, 5.694 Dateien, `public/data/titles.json` = 3,5 MB; Deploy über `.github/workflows/deploy.yml` (`actions/upload-pages-artifact@v3` + `actions/deploy-pages@v4`). Die Datenläufe selbst sind GitHub Actions (refresh-*.yml, bestand-bauen.yml u. a.), Wecker/Newsletter/D1/R2 liegen schon bei Cloudflare.

## 1. GitHub Pages

### Zusagen
- Keine SLA für Pages. https://github.com/customer-terms/github-online-services-sla : SLA gilt für "GitHub Actions", "GitHub Enterprise Cloud" und "GitHub Packages", Pages ist nicht gelistet; Zusage "at least 99.9% Uptime for the applicable GitHub service".
- Limits: https://docs.github.com/en/pages/getting-started-with-github-pages/github-pages-limits
  - "Published GitHub Pages sites may be no larger than 1 GB."
  - "GitHub Pages sites have a *soft* bandwidth limit of 100 GB per month."
  - "GitHub Pages sites have a *soft* limit of 10 builds per hour. This limit does not apply if you build and publish your site with a custom GitHub Actions workflow." (wir nutzen den Actions-Weg)
  - "GitHub Pages deployments will timeout if they take longer than 10 minutes."
  - "Rate limits may apply" (HTTP 429).
- Nutzungsbedingung (Nebenrisiko): "GitHub Pages is not intended for or allowed to be used as a free web-hosting service to run your online business, e-commerce site, or any other website that is primarily directed at either facilitating commercial transactions or providing commercial software as a service (SaaS)." Unser Projekt (kostenloser Kalender, Newsletter) fällt nach meiner Lesart nicht darunter; Einnahmen über Affiliate-Links wären ein Grenzfall. Unsicher, nicht juristisch geprüft.
- Zum Deployment-Weg: https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages : Artefakt "must be under 10GB", Job braucht `pages: write` und `id-token: write`; die Seite enthält nichts zu Rollback.

### Vorfälle der letzten 12 Monate (githubstatus.com)
Quelle: https://www.githubstatus.com/history.json (Seiten 1-8) plus je Vorfall https://www.githubstatus.com/incidents/<code>.json (Felder `affected_components`). Fenster 06.10.2025 bis 06.10.2026, 292 Vorfälle insgesamt (Skript im Scratchpad: `inc2.mjs`, Rohdaten `detail.json`).
- Komponente Pages (ID `vg70hn9s2tyj`, https://www.githubstatus.com/api/v2/components.json: "Pages ... operational") ist in **20** Vorfällen betroffen (Dauer = Vorfallsdauer, nicht gemessene Ausfallzeit der Seite).
- Summe der Vorfallsdauern: ca. 3.730 Minuten (rund 62 Stunden), Überlappungen nicht bereinigt. Drei weitere Treffer sind Fehlzuordnungen im Namen ("Policy pages", "repository pages", "runner ... pages") ohne Pages-Komponente und nicht mitgezählt.
- Nur 5 Vorfälle heißen ausdrücklich "Incident with Pages" bzw. "Pages - Deployment Lag": 13.04.2026 (40 min, major), 26.05.2026 (142 min, critical, zusammen mit Actions), 02.07.2026 (91 min), 06.08.2026 (79 min, Deployment Lag) sowie 05.10.2026 19:11 UTC (218 min, "Incident with Actions", Pages mitbetroffen).
- Die meisten übrigen sind Actions-Vorfälle, bei denen Pages als Komponente mitläuft, u. a.: 09.07.2026 558 min (critical), 06.08.2026 642 min (critical), 17.08.2026 456 min (GitHub.com insgesamt, critical), 19.07.2026 310 min, 02.02.2026 353 min, 26.08.2026 170 min.
- Häufung: von den 20 liegen 11 zwischen 02.07. und 05.10.2026 (letzte 3 Monate).
- **Offen/Unsicher:** Die Statusseite sagt nicht, ob bereits ausgelieferte Seiten in dieser Zeit erreichbar blieben oder nur Deployments/Builds hakten. Bei "Deployment Lag" und Actions-Vorfällen ist das Ausliefern vermutlich meist unberührt, belegt ist es nicht. Eigene Messung ist besser: Uptime-Pings (z. B. der Wächter im Worker) auf https://anime-kalender.de/ über 30 Tage auswerten, bevor entschieden wird.
- Die Datenläufe hängen an Actions: Ein Wechsel des Hosting beseitigt die Actions-Ausfälle (Datenaktualität) nicht. Das ist der größere Teil der Liste oben.

## 2. Alternativen (für unseren Bedarf: ~94 MB / ~5.700 Dateien, einige tausend Besucher/Tag, mehrere Deploys/Tag)

Bandbreite grob geschätzt (Annahme, nicht gemessen): 3.000 Besucher × 3,5 MB titles.json (gzip/brotli evtl. 0,7-1,2 MB) plus Nachladedateien = grob 10-30 GB/Monat komprimiert, bis 100 GB unkomprimiert bei 10 MB je Besucher. Wert belegt nichts, mit Cloudflare-Analytics oder Worker-Logs messen.

### a) Cloudflare Pages / Workers Static Assets
- Preis: "Requests to static assets are free and unlimited." und "There is no additional cost for storing Assets." (https://developers.cloudflare.com/workers/static-assets/billing-and-limitations/). Kosten also 0 EUR bei statischer Auslieferung; Warnung dort: Mit `run_worker_first` zählen Aufrufe gegen das Free-Kontingent, danach "429".
- Limits: https://developers.cloudflare.com/pages/platform/limits/ : "up to 20,000 files on the Free plan" (Pages), "The maximum file size for a single Cloudflare Pages site asset is 25 MiB.", Free: 500 Builds/Monat (bei Push-Build über Cloudflare; Deploy per Wrangler/API aus unserer Action zählt vermutlich nicht dazu, unsicher). Workers-Seite: https://developers.cloudflare.com/workers/platform/limits/ : Free 20.000 / Paid 100.000 Dateien je Version, je Datei 25 MiB. Wir liegen bei 5.694 Dateien, Headroom 3,5-fach.
- Verfügbarkeit: Keine SLA für Free. https://www.cloudflare.com/terms/ : "THE CLOUDFLARE ENTITIES MAKE NO CLAIMS OR PROMISES ABOUT THE QUALITY, ACCURACY, OR RELIABILITY OF THE SERVICES..." und "We will have no liability for any harm or damage arising out of or in connection with any Free Services." Unternehmens-SLA nur Enterprise (https://www.cloudflare.com/enterprise-support-sla/, nicht abgerufen). Auslieferung über Anycast-Netz, statische Assets aus dem Edge-Netz (Architektur aus Cloudflare-Doku bekannt, hier nicht wörtlich belegt).
- Status: cloudflarestatus.com hat laut https://www.cloudflarestatus.com/api/v2/summary.json keine eigene Pages-/Workers-Komponente. Die API-Liste https://www.cloudflarestatus.com/api/v2/incidents.json enthält nur die letzten 50 Vorfälle (ab 17.09.2026), darin ein critical: 02.10.2026 21:46 UTC, 11 min, "Cloudflare CDN experiencing increase in errors." (WebFetch-Zusammenfassung der History-Seite nannte außerdem "Workers Build failing to start" 03.-05.10.2026 und ein Durable-Objects-Problem mit Workers Assets 05.10.2026, nicht gegengeprüft.) Vorfallshistorie über 12 Monate nicht abrufbar, daher kein Vergleich mit GitHub möglich. Bekannt aus meinem Gedächtnis, nicht abgerufen: größere weltweite Cloudflare-Ausfälle im Nov/Dez 2025.
- Pages vs. Workers: https://developers.cloudflare.com/workers/static-assets/migration-guides/migrate-from-pages/ : "Unlike Pages, Workers has a distinctly broader set of features available to it, (including Durable Objects, Cron Triggers, and more comprehensive Observability)."; Preview-URLs bei beiden vorhanden. Neue Projekte also Workers Static Assets, da wir Worker ohnehin nutzen.
- Deploy: `wrangler deploy`/`wrangler pages deploy` aus der bestehenden Action (API-Token vorhanden, `anime-kalender-deploy`) oder Git-Anbindung. Rollback: Versions/Deployments im Dashboard (aus Cloudflare-Wissen, nicht abgerufen).
- Domain: DNS liegt laut `docs/wissen/betrieb.md` (Abschnitt Newsletter-Spam, 04.10.2026) bereits bei Cloudflare ("Umzug von INWX nach Cloudflare"). Umzugsaufwand = Custom Domain am Worker/Pages-Projekt anlegen, CNAME/Route umstellen; wenige Minuten, Zertifikat automatisch. Sehr geringer Aufwand, weil Zone vorhanden.
- Logs/Analytics: Web Analytics gratis, Workers Logs/Observability (siehe Zitat oben); Rate-Limits der Auslieferung: keine für statische Assets genannt.
- Risiko: Cloudflare-Konzentration (DNS, Worker, D1, R2, Hosting alles bei einem Anbieter). Fällt Cloudflare weltweit aus, fällt alles.

### b) Netlify
- https://www.netlify.com/pricing/ : Free "300 credit limit", Personal "$9/month" mit 1.000 Credits, Pro "$20/month with unlimited members" mit 3.000 Credits; "99.99% SLA" nur Enterprise.
- https://docs.netlify.com/manage/accounts-and-billing/billing/billing-for-credit-based-plans/credit-based-pricing-plans/ : "1 deployment = 15 credits", "1 GB transferred = 20 credits", "10,000 requests = 2 credits"; Free hat "credit hard limit", kein Auto-Recharge.
- Rechnung für uns (Annahme 20 Deploys/Tag, 20 GB/Monat): 20×30×15 = 9.000 Credits + 400 für Traffic. Das sprengt Free (300), Personal (1.000) und Pro (3.000) um ein Vielfaches. Das Credit-Modell passt schlecht zu unseren Datenläufen mit Deploy. Mit weniger Deploys (z. B. 4/Tag = 1.800 Credits) erst im Pro-Bereich. Unsicher, weil ob jeder Deploy so gezählt wird, nicht geprüft.
- Fazit Netlify: teurer und ohne SLA unter Enterprise, kein Vorteil gegenüber Cloudflare.

### c) Vercel
- https://vercel.com/docs/plans/hobby : "As stated in the fair use guidelines, the Hobby plan restricts users to non-commercial, personal use only." Hobby: 100 GB Fast Data Transfer, 100 Deployments/Tag (hier steht "Deployments per day | 100"), Dateien "Hobby: Vercel does not support connecting a project on your Hobby team to Git repositories owned by Git organizations." (https://vercel.com/docs/limits). Überschreitung: "you will have to wait until 30 days have passed before you can use the feature again."
- Pro: Developer-Seat "$20 per user / month" (Hobby-Seite); Pro-Details nicht abgerufen. Keine SLA-Aussage für Hobby/Pro gefunden (nicht gesucht, unsicher).
- Fazit: Hobby-Pause bei Limit ist für eine Seite, die erreichbar bleiben soll, ein Betriebsrisiko; sonst gleichwertig, aber dritter Anbieter ohne Synergie.

### d) Eigener Server (Hetzner VPS + Caddy hinter Cloudflare)
- https://www.hetzner.com/cloud/ : "An SLA with 99.9% guaranteed uptime and clearly defined credits in the event of a malfunction" (laut WebFetch-Zusammenfassung, Gültigkeit je Produkt nicht geprüft); Standorte Falkenstein, Nürnberg, Helsinki, Hillsboro, Ashburn. https://www.hetzner.com/cloud/cost-optimized : CX23, 2 vCPU, 4 GB, "20 TB" Traffic, Preis dort nicht ausgewiesen, laut Websuche (nicht Hetzner-Quelle, unsicher) 3,49-5,99 EUR/Monat und aktuell "not available".
- Ein einzelner VPS ist ein einzelner Standort und ein Single Point of Failure; die 99,9 % entsprechen ca. 8,8 h Ausfall im Jahr und gelten für die Maschine, nicht für unsere Konfiguration. Wir bräuchten Betrieb (Updates, TLS, Backups, Monitoring, Deploy per rsync/SSH) und hätten schlechtere Verfügbarkeit als ein CDN, es sei denn zweiter Server plus Cloudflare Load Balancing (kostenpflichtig, nicht abgerufen).
- Sinn nur, wenn man Cloudflare-Konzentration oder Dritt-Bedingungen meiden will; hier nicht zielführend.

## 3. Kriterien "perfekte DevOps-Landschaft" und was GitHub Pages abdeckt

| Kriterium | GitHub Pages | Anmerkung |
|---|---|---|
| Lastverteilung/Failover | Teilweise: Auslieferung über Fastly-CDN (aus meinem Wissen, hier nicht abgerufen), kein eigenes Failover, keine Wahl des Standorts | Kein zweiter Anbieter, kein Umschalten |
| TLS | Ja, automatisch (Let's Encrypt für Custom Domain; aus Doku-Wissen, hier nicht abgerufen) | Erzwingen per Einstellung |
| Zero-Downtime-Deploys mit Rollback | Atomarer Deploy über Actions; Rollback nur durch erneuten Deploy eines alten Commits, die Doku nennt dazu nichts (Abruf oben) | Cloudflare: Versionen/Rollback im Dashboard (nicht abgerufen) |
| Infrastruktur als Code | Workflow-YAML im Repo, Domain/Pages-Einstellung nur in der UI/API | |
| Staging/Vorschau | Nein (eine Site je Repo, Vorschau nur durch Zweit-Repo/Artefakt-Hack) | Cloudflare/Netlify/Vercel: Preview-URLs je Branch |
| Überwachung | Keine eigene, kein Log, keine Analytics; extern nötig (Wächter im Worker prüft schon) | Cloudflare liefert Web Analytics/Logs |
| Backups | Git-Verlauf = Backup der Inhalte | Daten außerhalb (D1/R2) separat |
| Sicherheit | HTTPS, kein WAF, keine Header-Kontrolle (keine eigenen Response-Header), kein Rate-Limit nach Wahl | Cloudflare: `_headers`, WAF, Bot-Schutz |
| Skalierung | Soft-Limits: 100 GB/Monat Bandbreite, 1 GB Site (siehe Abschnitt 1) | Wir: 94 MB, ok |
| Kosten | 0 EUR | Cloudflare ebenfalls 0 EUR |
| Notfallplan | Keiner vorgesehen, keine SLA, Supportanspruch nur nach Plan | Siehe Empfehlung |

## 4. Empfehlung

**Pages als Primärhost behalten, vorerst. Cloudflare (Workers Static Assets) als zweiten Weg vorbereiten und bei Schwellen umschalten.** Begründung:
1. Der Teil der GitHub-Ausfälle, der die Seite selbst trifft, ist nicht belegt; der Teil, der Actions trifft (Mehrheit der Pages-Vorfälle), trifft uns ohnehin über die Datenläufe, egal wo gehostet wird.
2. Cloudflare kostet nichts, passt zum Bestand (DNS, Worker, D1, R2, Wecker), bringt Preview-URLs, Header, Logs, 3,5-fachen Dateien-Spielraum; Umzugsaufwand gering, da Zone schon dort.
3. Keine Alternative hat eine SLA für den Free/Pro-Bedarf; die einzige Zusage ist Hetzner 99,9 % (Einzelmaschine) bzw. Netlify Enterprise. Also kauft ein Wechsel keine Garantie, nur bessere Werkzeuge und ein zweites Standbein.

### Wechsle (oder schalte um), wenn mindestens eines gilt
- Eigene Messung (Wächter-Ping auf anime-kalender.de, 30 Tage) zeigt Verfügbarkeit < 99,9 % oder mehr als 2 Ausfälle über 30 min durch GitHub.
- Ein Vorfall, bei dem bereits ausgelieferte Seiten oder `public/data` nicht erreichbar waren, belegt per Statuskommentar von GitHub.
- Wir brauchen Preview/Staging je Branch, eigene Response-Header (CSP, Caching für JSON), Logs/Analytics oder Rollback per Knopf.
- Bandbreite nähert sich 70 GB/Monat (soft limit 100 GB) oder Dateien/Größe der Grenzen (1 GB Site).
- Newsletter oder Einnahmen machen die Seite zu etwas, das nach den GitHub-Bedingungen ("online business") angreifbar wird.

### Übergangsweg ohne Ausfall (Pages bleibt Rückfall)
1. Zweites Deploy-Ziel: in `deploy.yml` nach dem Pages-Deploy ein Schritt `wrangler deploy` (Workers Static Assets, `assets.directory = public`) mit dem vorhandenen Token; Ziel zuerst nur `*.workers.dev`, Domain unverändert. Deploy-Zeit und Dateizahl (5.694 von 20.000) messen.
2. Parallelbetrieb prüfen: dieselbe Auslieferung von beiden Hosts vergleichen (Stichproben-Hash `titles.json`, Header, 404-Seite, Hash-Routing).
3. Domain umlegen: Custom Domain `anime-kalender.de` auf den Worker (TTL vorher senken); GitHub Pages-Deploy bleibt aktiv, damit `<user>.github.io/anime-kalender-de` als Rückfall läuft. Dabei prüfen, ob die alte CNAME-Datei im Artefakt bleiben darf (unsicher, nicht getestet).
4. Rückweg: DNS/Route zurück auf GitHub Pages (Minuten, wegen Cloudflare-DNS). Automatisches Failover wäre Cloudflare Load Balancing (kostenpflichtig, nicht abgerufen, daher offen).
5. Erst nach 2-4 Wochen ohne Befund Pages als Primär ablösen; Pages-Workflow dauerhaft als Rückfall behalten (kostet nichts).

## Offene Punkte (nicht belegt)
- Reale Erreichbarkeit der Seite bei den 20 Pages-Vorfällen.
- Eigenes Besuchervolumen und Bandbreite (nur Schätzung).
- Cloudflare-Vorfallshistorie über 12 Monate (nur letzte 50 Einträge ab 17.09.2026 abrufbar).
- Zählung von Wrangler-Deploys gegen das Pages-Buildlimit; Cloudflare-Rollback-Details; Vercel-Pro- und Cloudflare-Load-Balancing-Preise; Hetzner-Preis aus Hetzner-Quelle.
