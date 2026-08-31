---
name: cc-instructie-schrijver
description: Gebruik dit wanneer gevraagd wordt om een instructie, 
  opdracht, of prompt te schrijven die later (door Claude Code, of in 
  een andere sessie) uitgevoerd moet worden — niet voor het direct zelf 
  uitvoeren van een taak.
---

Bij het schrijven van een uitvoeringsinstructie voor later/elders:

1. Baken de scope expliciet af: benoem niet alleen wat er moet 
   veranderen, maar ook expliciet wat NIET moet veranderen (bijv. "GEEN 
   wijziging aan positielogica/x-y-coördinaten").
2. Beschrijf altijd "huidige situatie" en "gewenste situatie" apart en 
   concreet, niet alleen het eindresultaat.
3. Noem expliciet welke bestanden/plekken worden geraakt, als dat op 
   meerdere plekken in de code speelt.
4. Sluit altijd af met een expliciete testeis: een echte browsertest, 
   Supabase-lees/schrijf-test, en/of screenshot ter bevestiging — nooit 
   alleen "pas dit aan" zonder bewijs van werking te vragen.
5. Geef de instructie als kant-en-klare, kopieerbare tekst — niet als 
   losse opsomming van aandachtspunten die de lezer zelf nog moet 
   herformuleren tot een opdracht.
