> **Archiviert am 31.08.2026 — hier ist nichts mehr zu tun.**
>
> Ausdrücklich erledigt am 23.08.2026, **bevor** die Bitte an Daniel ging: Die YouTube Data API führt für Audiosprachen ein einziges Feld (`snippet.defaultAudioLanguage`), und das steht ohnehin in der Videoseite. An drei offenen Verweisen nachgesehen — es fehlt dort vollständig, der Uploader hat es nie gesetzt. Der Schlüssel hätte Zeit gekostet und nichts geliefert.
>
> Die Datei bleibt als Beleg stehen: Was einmal Arbeit war, gehört nachlesbar, nicht
> gelöscht.

# 4 — YouTube-Data-API-Schlüssel anlegen

**Fünf Minuten, einmalig. Löst 23 Verweise.**

## Was zu tun ist

1. https://console.cloud.google.com/apis/credentials aufrufen
2. Falls noch kein Projekt da ist: **Projekt erstellen**, Name egal
3. **Anmeldedaten erstellen → API-Schlüssel** → kopieren
4. In der Bibliothek die **YouTube Data API v3** aktivieren:
   https://console.cloud.google.com/apis/library/youtube.googleapis.com
5. Den Schlüssel als GitHub-Secret hinterlegen:

```bash
gh secret set YOUTUBE_API_KEY --repo danielzaiser91/anime-kalender-de
```

Der Befehl fragt den Schlüssel interaktiv ab — er landet nicht im Verlauf.

**Kosten:** keine. Das Kontingent liegt bei 10.000 Einheiten am Tag; ein Abruf über 23 Videos
verbraucht etwa 25.

## Warum es das braucht

Für 23 YouTube-Verweise steht im Kalender „🇩🇪 ?". Die offene oEmbed-Auskunft, die wir heute
nutzen, nennt Titel und Kanal — aber **keine Tonspur**. Die Data API nennt sie.

Was die bisherige Prüfung schon geleistet hat (Stand 23.08.2026): Von 93 Verweisen sagen 41
ihre Fassung selbst, 40 davon deutsch. Neun sind kostenpflichtig, keiner ist tot. Die
verbleibenden 46 schweigen — dort hilft nur der Schlüssel.

**Nebenbei gefunden und schon behoben:** 40 Titel standen als „kostenlos", obwohl sie auf
„YouTube Movies" liegen und gekauft werden müssen. Der Kanalname lag seit dem 22.08. im Repo
und wurde nie ausgewertet.
