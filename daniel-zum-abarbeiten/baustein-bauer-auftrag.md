# Baustein für Bauer-Aufträge

Diesen Absatz in jeden Auftrag an einen Bauer kopieren, dessen Ergebnis auf der Live-Seite sichtbar werden soll
(Anlass 08.10.2026: PR 444 war grün, die Cover fehlten live, weil der Bau einen Cache brauchte, den nur der Wochenlauf
schreibt; siehe `docs/wissen/projektregeln-im-detail.md`, „Eine Datenkorrektur gehört ins Repo").

```
Pflichtschritt: Wirkung nach Bau und Deploy live messen (Datei/Seite, erwarteter Wert). Vorher im PR nennen, was
live zu messen ist, zum Beispiel: "Nach Deploy: <Live-Adresse der Datei>, Titel <ID> trägt <Feld> = <Wert>". Grüne PR-Prüfungen zählen nicht als Beleg, sie laufen mit dem lokalen Cache. Eine Datenkorrektur liegt
unter data/ im Repo, nie unter data/cache/ (data/cache-register.json). Der PR ist erst fertig gemeldet, wenn der
gemessene Wert im Bericht steht; ist der Deploy noch nicht durch, steht dort "Messung offen: <was, wann>".
```
