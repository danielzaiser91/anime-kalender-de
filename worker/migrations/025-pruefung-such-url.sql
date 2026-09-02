-- Die Adresse des Suchauftrags, unter dem gemeldet wurde.
--
-- Ein Suchauftrag wird auf der **Titelseite** gemeldet, nicht auf der Suchseite:
-- Wer den Treffer findet, springt hin und meldet dort. Der Worker erfuhr deshalb
-- nie, dass die Suche erledigt ist — für „schon gemeldet?" blieb bei
-- Suchadressen nur der lokale Vermerk im Browser.
--
-- Der ist nicht abgeglichen. Wird eine Meldung im Briefkasten verworfen, bleibt
-- er stehen und sperrt den Auftrag: Am 02.09.2026 sagte die Suchseite für „Is
-- This a Zombie?" „gemeldet ✓", der Briefkasten wusste nichts, und der Auftrag
-- ließ sich nur mit einem Konsolenbefehl wieder öffnen. Daniels Regel vom
-- 28.08.2026 schließt genau das aus: „gemeldet/nicht gemeldet sollte ebenfalls
-- synchron remote abgeglichen werden … single source of truth."
--
-- Mit dieser Spalte weiß der Briefkasten, welche Suchadressen erledigt sind, und
-- gibt sie bei `?zaehlen=1` zurück.
ALTER TABLE pruefung ADD COLUMN such_url TEXT;
CREATE INDEX IF NOT EXISTS pruefung_such_url ON pruefung (such_url);
