---
name: design-check
description: Gebruik dit bij elke visuele/UI-wijziging of nieuw scherm — 
  nieuwe componenten, kleuren, lay-outs, of aanpassingen aan bestaande 
  schermen.
---

Bij elke visuele wijziging:

1. Kleuren — nooit hardgecodeerde hex-waarden. Altijd de bestaande 
   CSS-variabelen (var(--accent), var(--blauw), var(--goud), etc.) 
   gebruiken, en controleren dat het resultaat in alle 5 kleurthema's 
   van de app (licht, donker, fcp, licht_groen, licht_blauw) nog goed 
   leesbaar en onderscheidend blijft — met name of twee elementen die 
   apart moeten blijven (bijv. twee verschillende betekenissen) niet in 
   een van de thema's toevallig samenvallen.
2. Hergebruik bestaande componenten/patronen (bijv. .bmodal voor 
   pop-ups, bestaande badge-stijlen) in plaats van een nieuw, eigen 
   patroon te verzinnen voor iets dat al bestaat.
3. Unieke class-namen — check dat een nieuwe CSS-klasse niet toevallig 
   dezelfde naam heeft als een bestaande klasse elders in de app met een 
   andere betekenis (dit heeft al eerder een bug veroorzaakt).
4. Responsief op alle apparaten — test portrait én landscape, en 
   minstens telefoon- en desktopformaat. Met name volledige zichtbaarheid 
   van het veld/opstelling zonder scrollen is een bekend aandachtspunt.
5. Test met een echte browsertest en screenshots vóór het als "klaar" 
   wordt gemeld.
