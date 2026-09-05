---
name: supabase-wijziging
description: Gebruik dit bij elke wijziging die de Supabase-database raakt
  — een nieuwe tabel, kolom, of aanpassing aan een bestaande schrijfactie.
  Ook van toepassing bij het aanpassen van sw.js of het klaarzetten van
  een levering.
---

Bij elke wijziging die de database raakt:
1. Valideer gewijzigde bestanden op syntaxfouten. Controleer eerst met
   `command -v node` of Node op deze machine staat — neem dat nooit aan
   op basis van een eerdere sessie. Staat het er wel, gebruik `node --check`
   op losse .js-bestanden (dat werkt niet op HTML met inline `<script>`).
   Staat het er niet (op dit moment het geval), valideer dan via de echte
   browser: start een lokaal testservertje (hetzelfde HttpListener-patroon
   als bij de `monkey`-skill, poort 8934, in de projectroot), open het
   gewijzigde bestand met de Chrome-tools, en lees de console
   (`read_console_messages`, `onlyErrors:true`) — een syntaxfout in een
   .js-bestand of een inline `<script>` verschijnt daar meteen bij het
   laden. Sluit het testtabblad en de server weer af zodra dit bevestigd is.
2. Test schrijfacties altijd echt tegen de live database: voeg een rij
   toe of wijzig 'm, controleer het resultaat, en zet bestaande data
   daarna weer exact terug naar de oorspronkelijke waarde.
3. Gebruik nooit een "verwijderen en opnieuw aanmaken"-patroon om een
   rij te verversen als een andere tabel daarnaar verwijst met
   ON DELETE CASCADE — dat veegt gekoppelde data weg. Gebruik dan een
   update.
4. Controleer het totaal aantal rijen vóór en ná de wijziging, zodat
   niets onbedoeld is bijgekomen of verdwenen.
5. Verhoog het versienummer (CACHE-constante) in sw.js.
6. Vraag pas om toestemming voor commit/push nadat dit allemaal is
   bevestigd, en geef daarbij kort aan wat je hebt getest.
