# Modellwahl für den Agenten-Workflow (Stand 04.10.2026)

Recherche vom 04.10.2026. Jede Zahl trägt ihre Quelle (Nummer, siehe „Quellen"). Wo nur Zweitquellen
vorliegen, steht das dabei. Alle Benchmarks sind jung (Modelle vom 22.–29.09.2026), unabhängige
Messungen noch dünn. „AA" = Artificial Analysis, „Index" = Intelligence Index v4.3.2.

**Vorab: „GPT 6.1" gibt es.** GPT-6.1 Sol, veröffentlicht am 29.09.2026 [Q6, Q7]. Die GPT-6-Reihe:
Astra (Flaggschiff, 03.09.2026), Sol (Mittelklasse), Luna (billigste Stufe), dazu 6.1 Sol als Upgrade
von Sol [Q8]. Claude-Reihe aktuell: Fable 5.1, Opus 5.5 (22.09.2026), Sonnet 5.5 (28.09.2026),
Haiku 4.5 (Oktober 2025). **Haiku 5.5 ist nur angekündigt** („in den kommenden Wochen", kein Datum,
kein Preis) [Q1, Q17].

## 1. Preise je Million Token (Standard-API, USD)

| Modell | Eingabe | Cache lesen | Ausgabe | Quelle / Datum |
|---|---|---|---|---|
| Claude Fable 5.1 | 10 | 0,25 | 50 | Q1, abgerufen 04.10.2026 |
| Claude Opus 5.5 | 4 | 0,20 | 20 | Q1 |
| Claude Sonnet 5.5 | 2 | 0,20 | 10 | Q1 |
| Claude Haiku 4.5 | 1 | 0,10 | 5 | Q1 |
| GPT-6 Astra | 10 | 1,00 | 50 | Q8 (Preisseite OpenAI), über 272K Eingabe 20/2/75 |
| GPT-6.1 Sol | 2 | 0,10 | 10 | Q8, über 272K Eingabe 4/0,20/15 |
| GPT-6 Luna | 0,10 | 0,01 | 0,50 | Q8 |
| Gemini 3.8 Flash | 0,75 | 0,075 | 3,75 | Q9 (Preisseite Google); laut Zweitquelle Q10 nur bis 31.12.2026, danach doppelt (von mir nicht an der Preisseite bestätigt) |
| Gemini 3.1 Pro Preview | 2 | 0,20 | 12 | Q9 |
| Gemini 3.5 Flash-Lite | 0,30 | nicht verfügbar | 2,50 | Q9 |
| GLM-5.3 (Z.ai) | 1,40 | – | 4,40 | Q13 (Zweitquelle, 24.09.2026) |
| GLM-5.3 Flash | 0,15 | – | 0,50 | Q13 (Zweitquelle) |

Zusätze Anthropic [Q1]: Batch halbiert (Opus 5.5 2/10, Sonnet 5.5 1/5, Haiku 4.5 0,50/2,50). Cache-Schreiben
5 min = 1,25-facher Eingabepreis. Neuer Tokenizer ab 4.7 liefert etwa 30 % mehr Token je Text als
Sonnet 4.6 und älter. Managed Agents zusätzlich 0,08 USD je Sitzungsstunde. OpenAI: Batch/Flex halb, Fast doppelt [Q8, Q11].
Opus 5.5 hat den billigsten Cache-Lesepreis (5 % vom Eingabepreis), Sonnet 5.5 liegt bei 10 %, daher gleich
0,20 USD.

## 2. Kosten je Aufgabe (nicht je Token)

**Belastbar vorhanden, aber nur für AA-Benchmarkmix, nicht für Daniels Repo.** AA misst „Kosten je
Index-Aufgabe" (gewichteter Durchschnitt über 10 Evaluierungen inkl. Terminal-Bench 4.0) [Q3, Q4].

| Modell (Effort) | Index | Kosten je Aufgabe | Ausgabetoken gesamt | Quelle |
|---|---|---|---|---|
| Opus 5.5 low | 42 | 0,55 | – | Q5 |
| Opus 5.5 medium | 51 | 1,34 | – | Q5 |
| Opus 5.5 high | 54 | 1,82 | – | Q5 |
| Opus 5.5 xhigh | 56 | 3,46 | – | Q5 |
| Opus 5.5 max | 58 | 5,98 | 260 Mio | Q3, Q5, Q12 |
| Sonnet 5.5 low | 36 | 0,41 | – | Q5 |
| Sonnet 5.5 medium | 41 | 0,59 | – | Q5 |
| Sonnet 5.5 high | 47 | 1,08 | 50 Mio | Q5, Q4 |
| Sonnet 5.5 xhigh | 52 | 2,74 | 104 Mio | Q4 |
| Sonnet 5.5 max | 56 | 7,60 (AA-Modellseite 7,67) | 410–420 Mio (193k je Aufgabe) | Q3, Q4, Q12 |
| Haiku 4.5 (Reasoning) | 17 | 0,28 | – | Q14 |
| GPT-6.1 Sol low | 42 | 0,13 | – | Q15 |
| GPT-6.1 Sol max | 52 | 0,72 | – | Q15 |
| GPT-6 Astra | 53 | 3,26 | rund 27k je Aufgabe | Q16 (Zweitquelle), Q3 |
| Gemini 3.8 Flash | 41 | 1,24 | – | Q10 (Zweitquelle) |
| GLM-5.3 Flash | 41,8 | 0,25 | – | Q13 (Zweitquelle) |
| GLM-5.3 | 44,8 | 2,01 | – | Q13 (Zweitquelle) |

**Befund zu Daniels Beobachtung:** Sie stimmt bei hohem Effort. Sonnet 5.5 braucht bei max rund 60 %
mehr Ausgabetoken als Opus 5.5 und kostet je Aufgabe mehr (7,60 gegen 5,98 USD) [Q3]. Bei gleichem
Index 56 kostet Opus 5.5 auf xhigh 3,46 USD, Sonnet auf max 7,60 USD [Q5]. Bei niedrigem/mittlerem
Effort ist Sonnet je Aufgabe billiger (low 0,41 gegen 0,55; medium 0,59 gegen 1,34), liefert aber
auch weniger Punkte [Q5]. Der Vergleich „gleicher Effort" ist also kein Vergleich „gleiche Leistung".

**Gegenmessung:** Vals misst auf seinem Mix das Gegenteil: Sonnet 5.5 20,80 USD je Test (69,22 %),
Opus 5.5 32,77 USD (69,69 %); Terminal-Bench 4.0 bei Vals: Sonnet 53,03 %, Opus 61,62 % [Q12, Zweitquelle
Kingy AI]. Anthropic selbst: Terminal-Bench 4.0 medium: Sonnet 28,8 % für 0,83 USD je Versuch, Opus 57,6 % für
2,94 USD; Sonnet max 12,54 USD je Versuch, Opus xhigh 7,35 USD [Q12, Anbieterangabe].
**Eine belastbare Zahl für „Kosten je gelöstem PR in Daniels Repo" existiert nicht.** Vals und AA
widersprechen sich, die Kostenrichtung hängt von Effort und Aufgabenmix ab. AA empfiehlt selbst, Sonnet
5.5 bei high einzusetzen (nahe GPT-6 Sol bei gleichen Kosten) [Q3].

## 3. Leistung (agentisches Coden, Review, Reasoning)

| Modell | AA-Index | Terminal-Bench 4.0 | Weitere Coding-Zahlen | Quelle |
|---|---|---|---|---|
| Opus 5.5 | 58 (max) | 66,4 % (Anbieter, xhigh); AA-Messung 60 % | SWE-bench Pro 89,9 %, DeepSWE 74,2 %, CursorBench 57,8 %, FrontierCode 54,4 % (alles Anbieter/Systemkarte) | Q3, Q18 |
| Sonnet 5.5 | 56 (max) | 70,6 % (Anbieter, max); xhigh 61,5 %; AA-Messung 64 % | CursorBench 55,5 %, FrontierCode 52,1 %, DeepSWE 71,0 %; SWE-bench Pro 8,6 Punkte unter Opus | Q3, Q12, Q19 |
| GPT-6 Astra | 53 (nach Zweitquelle; AA-Artikel nennt 60 für Astra auf einer anderen Teilskala) | 57,9 % (OpenAI) | Terminal-Bench-Science 64,6–68,1 % (führt) | Q16, Q18, Q19 |
| GPT-6.1 Sol | 52 (max) | nicht veröffentlicht | DeepSWE 75,2 % (high, OpenAI) | Q15, Q19, Q20 |
| Gemini 3.8 Flash | 41 | – | – | Q10 |
| Haiku 4.5 | 17 | – | – | Q14 |
| GLM-5.3 / Qwen3.8 Max / Kimi K3 | 44,8 / 45,4 / 43,6 | – | – | Q13 (Zweitquelle) |

Vorbehalte: Alle Terminal-Bench/SWE-bench/DeepSWE-Werte sind Herstellerangaben mit eigener Harness
und Effort-Stufe, nicht untereinander vergleichbar. Der einzige gemeinsame unabhängige Maßstab ist
der AA-Index (kein reiner Coding-Index). Für **Review/Reasoning** fand ich keinen eigenen
Review-Benchmark; der Index (inkl. Humanity's Last Exam, GDPval) ist nur Ersatz. Opus 5.5 führt Index
und HLE mit Tools (67,7 % gegen 57,2 % Astra) [Q18, Q19].

## 4. Rangliste Preis-Leistung je Rolle

Das ist meine Einordnung aus den Zahlen oben, keine gemessene Größe.

| Rang | (a) Projektleiter (Review, Abnahme, Aufgaben schneiden) | (b) Fleißarbeit (Auftrag, Code, PR, Review-Kommentare) | (c) Mechanisches (Umbenennen, Kommentare kürzen) |
|---|---|---|---|
| 1 | Opus 5.5, mittlerer bis hoher Effort (Index 51–54 für 1,34–1,82 USD; höchster Index, geringster Tokenverbrauch der Claude-Modelle) | GPT-6.1 Sol high (Index 50, nahe Sonnet-high-Niveau bei rund 0,3 USD je Index-Aufgabe nach AA-Seite; DeepSWE 75,2 %) | GPT-6 Luna (0,10/0,50) oder GPT-6.1 Sol low (0,13 USD je Aufgabe, Index 42) |
| 2 | Opus 5.5 xhigh (Index 56, 3,46 USD) | Sonnet 5.5 high (Index 47, 1,08 USD) oder Opus 5.5 medium (51, 1,34 USD) | Sonnet 5.5 low (0,41 USD) oder Gemini 3.8 Flash |
| 3 | GPT-6.1 Sol max (52, 0,72 USD) als billige Zweitmeinung | Sonnet 5.5 medium (41, 0,59 USD) | GLM-5.3 Flash (0,25 USD, Index 41,8) |
| Nicht empfohlen | Sonnet 5.5 max (7,60 USD, teurer als Opus xhigh bei gleichem Index); Astra ($10/$50) | Astra (5-fach Sol, laut AA nur 1 Punkt mehr als 6.1 Sol); Haiku 4.5 (Index 17) | Opus 5.5 und Astra |

Hinweis zu (b): Die Kosten je Aufgabe von 6.1 Sol stammen aus dem AA-Mix; Opus/Sonnet-Werte bei
vergleichbarem Index liegen höher (Opus high 1,82, Sonnet high 1,08 gegen Sol high ca. 0,32 nach AA-Seite
Q15, Zuordnung der Zahlen zu den Effort-Stufen dort nicht eindeutig lesbar, bitte bei AA gegenprüfen).
Haiku 4.5 ist laut Index nicht mehr konkurrenzfähig, Haiku 5.5 noch nicht verfügbar.

## 5. Einbindung in GitHub Actions / Cloud-Agenten

| Werkzeug | Einbindung | Abo oder API-Schlüssel | Quelle |
|---|---|---|---|
| Claude (claude-code-action) | `anthropics/claude-code-action`, Einrichtung per `claude /install-github-app` (Repo-Admin nötig); Anbieter: Anthropic direkt, Bedrock, Vertex, Foundry | API-Schlüssel (`anthropic_api_key`) **oder** OAuth-Token eines Pro/Max-Abos (`CLAUDE_CODE_OAUTH_TOKEN`, erzeugt mit `claude setup-token`). Die Doku sagt nichts zu Abo-Nutzungsbedingungen im CI, Modellwahl über `claude_args` konnte ich in der Doku nicht bestätigen | Q21, Q22 |
| Claude Managed Agents | Server-gehostete Agenten, Token zu Listenpreisen plus 0,08 USD je Laufstunde | API (Abrechnung nach Token) | Q1 |
| OpenAI Codex (`openai/codex-action@v1`) | Installiert Codex CLI, startet `codex exec`; Beispielworkflow mit `prompt-file` | Offizielle Doku zeigt `openai-api-key`; Anfrage, ChatGPT-Abo-Login zu erlauben, ist ein offenes Issue (#92), CI also API-Schlüssel, Abrechnung nach Token | Q23, Q24 |
| Gemini CLI (`google-github-actions/run-gemini-cli`) | Workflows: Dispatch, Issue-Triage, PR-Review, Assistent; Einrichtung per `/setup-github` | API-Schlüssel aus AI Studio (`GEMINI_API_KEY`, kostenloses Kontingent), alternativ Vertex AI oder Code Assist; interaktiv Google-Login mit 60 Anfragen/Min und 1.000/Tag gratis | Q25, Q26 |

GPT-6.1 Sol ist laut Zweitquelle auch in GitHub Copilot verfügbar [Q7], nicht an der Quelle geprüft.

## 6. Offene Unsicherheiten und was Daniel prüfen müsste

- **Kein Messwert für den eigenen Fall.** Alle Kosten sind Mittelwerte über AA-Aufgaben. Prüfen: 5–10
  echte Repo-Aufgaben (Review-Kommentar abarbeiten, Datenkorrektur, kleiner Umbau) je Modell/Effort,
  mit Eingabe-, Ausgabe-, Cache-Token, Wanduhrzeit, Anzahl Nachbesserungen (Empfehlung auch von Q12).
- **Effort ist der größte Kostenhebel**, nicht das Modell. Standard in Claude Code: medium, auf der
  Plattform high [Q5-Zweitquelle Coursiv]. Der gewählte Effort muss in der Action explizit gesetzt werden.
- **Abo im CI:** Ob die Nutzung des Pro/Max-Tokens in Actions von den Abo-Bedingungen gedeckt ist und
  welche Kontingentgrenzen gelten, steht nicht in der gelesenen Doku; Anthropic-Bedingungen selbst lesen.
- **Sicherheitsfilter-Fallback:** Opus 5.5 und Sonnet 5.5 fallen bei Cyber-/Bio-Aufgaben auf ältere Modelle
  zurück (Sonnet in rund 0,1 % der AA-Aufgaben) [Q3, Q18]; für dieses Repo vermutlich irrelevant.
- **Widersprüche zwischen Quellen:** AA (Sonnet teurer je Aufgabe) gegen Vals (Opus teurer). AA-Astra-Index
  53 (Q16) gegen „60" (Q3-Auszug, andere Teilskala). Kingy nennt Opus 58 bei xhigh, AA/Coursiv bei max.
  Ich habe AA-Seiten bevorzugt.
- **Zweitquellen:** GLM/Qwen/Kimi-Preise und -Werte, Gemini-Preisverdopplung, Astra-Kosten je Aufgabe,
  Copilot-Verfügbarkeit stammen nicht von Anbieterseiten. Open-Weight-Modelle (DeepSeek V4.1 Flash,
  Qwen, Kimi, GLM) habe ich nur über Index/Preis erfasst, keine Agenten-Messung im Claude-Code-/Codex-Umfeld.
- **OpenAI-Preisseite** war direkt nicht abrufbar (403), Preise stammen aus der Suchtreffer-Wiedergabe
  von developers.openai.com [Q8] und stimmen mit drei Zweitquellen überein.
- **Haiku 5.5** erscheint ggf. in Tagen und wäre dann Kandidat für (c); neu bewerten.
- **Preise ändern sich:** Sonnet-5-Aktionspreis wurde Standard [Q1]; Gemini 3.8 Flash und GPT-5.6 Sol
  hatten befristete Aktionspreise [Q10, Q16].

## Empfehlung

1. Projektleiter: Claude Opus 5.5 mit Effort medium bis high (Review, Abnahme, Aufgaben schneiden); xhigh nur für schwere Fälle, max nie.
2. Fleißarbeit: erst Sonnet 5.5 high gegen GPT-6.1 Sol high an 5–10 echten Aufgaben messen; bis dahin Sonnet 5.5 high (gleiche Claude-Toolkette wie der Projektleiter).
3. Sonnet 5.5 nicht auf max laufen lassen: bei gleichem Index teurer als Opus 5.5 xhigh (AA).
4. Mechanisches: Sonnet 5.5 low oder GPT-6 Luna; Haiku 4.5 nicht (Index 17); Haiku 5.5 abwarten.
5. Astra und Fable 5.1 nur bei nachweislich gescheiterten Aufgaben als Eskalation (5-faches bzw. 2,5-faches des Opus-Preises).
6. Einbindung: claude-code-action mit API-Schlüssel; Abo-Token erst nach Lesen der Bedingungen.
7. Vor jeder Festlegung die Messung auf eigenen Aufgaben (Abschnitt 6), nicht auf AA-Mittelwerte stützen.

## Quellen

Alle abgerufen am 04.10.2026, sofern nicht anders vermerkt.

- Q1 Anthropic Preise: https://platform.claude.com/docs/en/about-claude/pricing
- Q3 AA, Sonnet 5.5 Artikel (28.09.2026): https://artificialanalysis.ai/articles/claude-sonnet-5-5
- Q4 AA Vergleich Sonnet 5.5 gegen Gemini 3.8 Flash: https://artificialanalysis.ai/models/releases/comparisons/claude-sonnet-5-5-vs-gemini-3-8-flash
- Q5 Effort-Tabelle (Zweitquelle nach AA, 29.09.2026): https://coursiv.io/blog/claude-sonnet-5-5
- Q6 OpenRouter GPT-6.1 Sol (29.09.2026): https://openrouter.ai/openai/gpt-6.1-sol
- Q7 SitePoint GPT-6.1 Sol: https://www.sitepoint.com/gpt-6-1-sol-developers-pricing-quickstart
- Q8 OpenAI Preise (Suchtreffer): https://developers.openai.com/api/docs/pricing ; Wikipedia ja: https://ja.wikipedia.org/wiki/GPT-6 ; VentureBeat: https://venturebeat.com/technology/openais-gpt-6-1-sol-offers-astra-like-performance-at-1-5th-price-a-new-ultrafast-tier-clocks-at-300-tokens-per-second
- Q9 Google Gemini Preise: https://ai.google.dev/gemini-api/docs/pricing
- Q10 NeuralTrust (29.09.2026): https://neuraltrust.ai/blog/claude-opus-5-5-vs-gemini-benchmark
- Q11 eesel GPT-6.1 Sol Preise: https://www.eesel.ai/blog/gpt-6-1-sol-pricing
- Q12 Kingy AI (Vals, Anthropic-Zahlen): https://kingy.ai/blog/claude-sonnet-5-5-vs-opus-5-5
- Q13 Fello AI GLM-Vergleich (Stand 24.09.2026): https://felloai.com/glm-vs-other-ai
- Q14 AA Sonnet 5.5 gegen Haiku 4.5: https://artificialanalysis.ai/models/releases/comparisons/claude-sonnet-5-5-vs-claude-4-5-haiku
- Q15 AA GPT-6.1 Sol: https://artificialanalysis.ai/models/releases/gpt-6-1-sol
- Q16 Emergent GPT-6.1 Sol Benchmarks: https://emergent.sh/learn/gpt-6-1-sol-benchmarks
- Q17 CellCog Haiku 5.5: https://cellcog.ai/blog/claude-haiku-5-5-release-date
- Q18 Anthropic Opus 5.5 Ankündigung (22.09.2026): https://www.anthropic.com/claude-opus-5-5 ; Systemkartenzahlen über https://llm-stats.com/blog/research/claude-opus-5-5-launch
- Q19 AIToolsReview Benchmarkübersicht: https://aitoolsreview.co.uk/insights/frontier-ai-benchmarks-september-2026 ; DataCamp: https://www.datacamp.com/blog/gpt-6-1-sol-vs-claude-sonnet-5-5
- Q20 Vellum GPT-6.1 Sol: https://www.vellum.ai/blog/gpt-6-1-sol-benchmarks-explained
- Q21 claude-code-action: https://github.com/anthropics/claude-code-action
- Q22 claude-code-action Setup: https://github.com/anthropics/claude-code-action/blob/main/docs/setup.md
- Q23 Codex GitHub Action Doku: https://learn.chatgpt.com/docs/github-action
- Q24 Issue zu ChatGPT-Auth: https://github.com/openai/codex-action/issues/92
- Q25 Gemini CLI: https://github.com/google-gemini/gemini-cli
- Q26 run-gemini-cli: https://github.com/google-github-actions/run-gemini-cli
