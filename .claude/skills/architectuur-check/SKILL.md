---
name: architectuur-check
description: Gebruik dit wanneer om een architectuurcheck of code-review 
  op structuurniveau wordt gevraagd (niet losse bugfixes) — bijvoorbeeld 
  na het toevoegen van een grotere nieuwe feature, of als er expliciet 
  om "architectuur" of "opschonen" wordt gevraagd.
---

Bij een architectuurcheck: alleen rapporteren, nooit ongevraagd 
wijzigen. Loop langs:

1. Centrale datalaag — staan alle Supabase-lees/schrijfacties in app.js 
   als gedeelde functies, of zijn er losse, eigen fetch/sbWrite-aanroepen 
   in losse pagina's bijgekomen die dat patroon doorbreken?
2. Duplicatie — bestaat dezelfde constante, functie, of logica op meer 
   dan één plek (bijv. een vaardighedenlijst, een kleurdefinitie, een 
   validatieregel)?
3. Dode code — bestanden of functies die nergens meer aangeroepen worden.
4. Zwakke identiteit — data die alleen bestaat als positie-in-een-lijst 
   in plaats van een eigen, stabiel ID (kwetsbaar bij herordenen/verwijderen).
5. Consistentie — gebruiken nieuwe schermen dezelfde thema-variabelen 
   (kleuren, lettertype) als de rest van de app, of staan er losse, 
   hardgecodeerde waarden?
6. Documentatie-drift — kloppen CLAUDE.md en README.txt nog met de 
   werkelijke situatie? Controleer met name hosting en deploy-methode, 
   en of de bestandenlijst nog overeenkomt met wat er echt in de repo 
   staat (nieuwe bestanden die niet genoemd worden, of genoemde 
   bestanden die niet meer bestaan). Meld elke afwijking apart, ook 
   kleine.

Rapporteer per punt: wat is gevonden, waar (bestand/functie), en een 
korte inschatting van risico en moeite om op te lossen. Geen code 
aanpassen tenzij daar expliciet apart om gevraagd wordt.
