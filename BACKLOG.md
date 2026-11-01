# Backlog fcp16-2

Wat bewust nog niet gebouwd is, plus genomen besluiten zodat ze niet
opnieuw ter discussie komen. Bijgewerkt 2026-10-18.

## Op de backlog

- **Kernprincipes** — stond in de oude startpagina: principe-raster,
  detailvenster en bewerkvenster (naam/beschrijving/voorbeeld), eigen
  `principes`-tabel in Supabase. Ontbreekt sinds Interface V2. Geen
  prioriteit of planning.
- **Speler-ontwikkeling over het seizoen** — grafiek per vaardigheid met
  speler- en trainerlijn door het seizoen. Mockup:
  `mockups/mockup-speler-ontwikkeling.html`. Deels gedekt door wat er al
  is (trendpijlen per vaardigheid en de Geschiedenis-tijdlijn), maar de
  seizoensgrafiek zelf is niet gebouwd.
- **Positie vastleggen bij elke wissel** — een wissel (`wissels`) slaat nu
  geen positie op en de opgeslagen opstelling wordt achteraf
  overschreven, waardoor "wie stond wanneer op welke positie" niet
  betrouwbaar te reconstrueren is. Idee: bij elke wissel en positieruil de
  positie meeschrijven, plus de startopstelling apart bewaren. Nodig voor
  een analyse per minuut/positie na fase 2 (aanleiding: analyse fase 1,
  2026-10-18).

## Besloten

- **Spelersnamen op het publieke live-scorebord** (`live.html`,
  `live_wedstrijden`/`live_updates`) — mogen blijven (2026-10-18).
- **Eigen URL per trainingsblok** (naast de URL van de oefening) —
  vervallen, wordt niet gebouwd (2026-10-18).

## Mockups

Nieuwe mockups komen in `mockups/`. Is een mockup gebouwd, dan gaat hij
weg; staat hij nog op de backlog, dan blijft hij hier.
