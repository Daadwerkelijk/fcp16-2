---
name: tdd
description: Gebruik dit wanneer expliciet om Test Driven Development of TDD
  wordt gevraagd, of bij het bouwen/wijzigen van bereken- of validatielogica
  waar eerst een test voor moet komen — de woorden "tdd" of
  "test driven development".
---

# Test Driven Development

Bron: Kent Beck, *Test-Driven Development: By Example* (2002) — de
Red-Green-Refactor-cyclus — aangevuld met Robert C. Martins "drie wetten
van TDD", die de cyclus tot een harde regel maken i.p.v. een suggestie.

## De drie wetten (niet onderhandelbaar tijdens een TDD-sessie)
1. Schrijf geen regel productiecode voordat er een falende test voor bestaat.
2. Schrijf niet meer van een test dan nodig is om 'm te laten falen (of niet
   te laten compileren/parsen).
3. Schrijf niet meer productiecode dan nodig is om de op dit moment falende
   test te laten slagen.

In de praktijk: als je merkt dat je code schrijft die geen enkele test
vereist (een extra parameter "voor later", een edge-case die niemand
gevraagd heeft), stop en vraag je af welke test die code zou afdwingen. Geen
test die 'm afdwingt? Dan hoort de code er nu niet.

## De cyclus
1. **RED** — schrijf de kleinst mogelijke test die het volgende stukje
   gewenst gedrag beschrijft. Draai 'm en bevestig dat hij faalt — én dat hij
   faalt om de juiste reden (een test die "per ongeluk" al slaagt door een
   fout in de test zelf, of die faalt op een typo i.p.v. op ontbrekend
   gedrag, is een valkuil die TDD juist moet voorkomen).
2. **GREEN** — schrijf de minimale code om 'm te laten slagen. Kent Beck
   noemt drie technieken, gebruik de simpelste die past:
   - *Fake it*: geef letterlijk de verwachte waarde terug, generaliseer pas
     als een volgende test dat afdwingt.
   - *Obvious implementation*: als de echte oplossing net zo snel te typen
     is als de nep-versie, schrijf 'm meteen.
   - *Triangulation*: pas veralgemeniseren zodra twee of meer tests dat
     specifiek vereisen — niet eerder.
   Geen extra afhandeling, geen opruimwerk, geen "dit is toch handig" — dat
   komt in de refactor-stap, niet hier.
3. **REFACTOR** — nu de test groen is, mag de code opgeschoond worden
   (duplicatie weg, betere namen) zónder het gedrag te veranderen. Draai de
   test(s) na elke stap opnieuw; blijft alles groen, dan is de refactor
   veilig.

## Wat een goede test hier maakt (FIRST)
Fast (seconden, niet minuten), Independent (geen volgorde-afhankelijkheid
tussen tests), Repeatable (zelfde uitkomst elke run, geen afhankelijkheid
van de systeemklok/willekeur tenzij die zelf gemockt is), Self-validating
(de test zegt zelf pass/fail, niemand hoeft output te interpreteren),
Timely (vóór de productiecode, niet erna).

## Waar dit wel en niet op van toepassing is in dit project
Dit is een vanilla HTML/CSS/JS-app zonder build-stap en zonder testrunner
(geen Node beschikbaar op deze machine — controleer dat aan het begin van
een sessie met `command -v node`, ga niet uit van eerdere sessies).
Klassieke TDD leunt op een snelle, geautomatiseerde testrunner; die is er
hier niet, dus:

- **Wel TDD-geschikt**: pure, geïsoleerde bereken-/transformatielogica
  zonder DOM- of Supabase-afhankelijkheid — datum-/weeknummerwiskunde,
  speeltijd-/gemiddelde-berekeningen, label- en rolbepaling voor een
  formatie, validatieregels, sorteer-/filterlogica. Dit soort functies kun
  je isoleren en met échte Red-Green-Refactor-discipline bouwen.
- **Niet TDD-geschikt**: DOM-rendering, event-bedrading, Supabase-I/O,
  visuele/UI-schermen. Daar geldt de bestaande werkwijze van dit project
  (`mockup-eerst`, `design-check`, en testen in de echte browser) — probeer
  dat niet te vervangen door TDD, dat past niet bij een bewust build-loze
  app en zou meer overhead kosten dan het oplevert.

### Hoe een test hier concreet draait
Geen Node, dus een test is een klein, expliciet assertion-scriptje dat in
de echte browser loopt (via de Chrome-automatiseringstools die toch al
gebruikt worden om dit project te testen) — geen `assert`-library nodig,
een simpele vergelijking + duidelijke pass/fail-melding volstaat:
```js
function testGelijk(naam, verwacht, werkelijk) {
  const ok = JSON.stringify(verwacht) === JSON.stringify(werkelijk);
  console.log((ok ? '✅ ' : '❌ ') + naam + (ok ? '' : ' — verwacht ' + JSON.stringify(verwacht) + ', kreeg ' + JSON.stringify(werkelijk)));
  return ok;
}
```
Laad de pagina (de functie moet dus al bestaan om aan te roepen — dat is
precies waarom je 'm eerst met een duidelijke, nog-niet-bestaande naam in
de test aanroept: dat IS de rode fase, een `ReferenceError` telt als falen)
en draai de test via `javascript_exec`. Rapporteer welke tests rood/groen
zijn voordat je verder gaat naar de volgende regel gedrag.

## Bugfix-gedreven TDD
Bij het oplossen van een gevonden bug (bijvoorbeeld via de `monkey`-skill):
schrijf eerst een test die het kapotte gedrag exact reproduceert en
bevestig dat hij rood is, fix dan de code tot 'ie groen wordt. Dat
voorkomt dat dezelfde bug later terugsluipt, en bewijst dat de fix het
echte probleem raakt i.p.v. toevallig het symptoom weg te halen.

## Werkwijze in deze sessie
1. Vraag, als het niet vanzelf duidelijk is, welk stukje logica het gaat
   worden — TDD werkt per klein gedragsstukje, niet per hele feature.
2. Schrijf de test, laat 'm zien, bevestig rood.
3. Schrijf de minimale implementatie, bevestig groen.
4. Refactor indien nodig, bevestig dat het nog steeds groen is.
5. Herhaal voor het volgende stukje gedrag. Meld elke rode→groene stap
   kort, in plaats van in stilte door te werken en pas aan het eind te
   melden dat "het werkt".
