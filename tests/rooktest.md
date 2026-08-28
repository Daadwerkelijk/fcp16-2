# Rooktest — kernflows fcp16-2

Handmatige checklist om na een grotere wijziging (nieuwe feature,
architectuurwijziging, Supabase-wijziging, deploy) af te vinken in de
echte app. Vervangt geen automatische tests, maar vangt de flows die
het meest pijn doen als ze breken.

Datum: ____________  Wijziging getest: ____________

## Kernflows

- [ ] **Wedstrijd opslaan** — resultaat, cijfers en MOTM invullen en
      opslaan in `wedstrijden.html`; na herladen staat alles nog goed.
- [ ] **Live pushen** — een wijziging in `live.html` komt bij een tweede
      (ingelogde) trainer/toeschouwer live binnen, zonder handmatig
      verversen.
- [ ] **Speler toevoegen** — nieuwe speler aanmaken in `selectie.html`,
      verschijnt correct in `team.html` en in de opstelling.
- [ ] **Opstelling maken** — een formatie kiezen en spelers plaatsen in
      `opstelling.html`; blijft bewaard na herladen.
- [ ] **Training/oefening plannen** — een oefening inplannen en
      aanwezigheid registreren in `schema.html`.

## Aandachtspunten

- [ ] Veld/opstelling volledig zichtbaar zonder scrollen (telefoon,
      portrait én landscape).
- [ ] Geen console-errors tijdens bovenstaande flows.
- [ ] PWA update opgepikt na wijziging aan `sw.js` (versienummer
      opgehoogd, nieuwe versie laadt na herladen).

## Resultaat

Gevonden problemen: ____________
