---
name: supabase-wijziging
description: Gebruik dit bij elke wijziging die de Supabase-database raakt
  — een nieuwe tabel, kolom, of aanpassing aan een bestaande schrijfactie.
  Ook van toepassing bij het aanpassen van sw.js of het klaarzetten van
  een levering.
---

Bij elke wijziging die de database raakt:
1. Valideer gewijzigde bestanden op syntaxfouten (node --check op .js-
   en HTML-bestanden met inline scripts).
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
