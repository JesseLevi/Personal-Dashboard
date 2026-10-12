# Visie: Atlas

## 1. Kernvisie

Atlas brengt de persoonlijke informatie van het dagelijks leven samen op één plek. Daarmee doet het twee dingen:

1. **Verbanden zichtbaar maken.** Taken, notities, recepten, boodschappen en afspraken staan niet los van elkaar. Doordat ze centraal en doorzoekbaar zijn, kan Atlas (en later een LLM) verbanden leggen die je in losse apps nooit ziet.
2. **Kleine beslissingen verminderen en makkelijker maken.** Wat eten we, wat moet er gekocht worden, wat speelt er deze week? Atlas neemt waar mogelijk werk uit handen: goede standaarden, slim invullen, en suggesties in plaats van lege schermen.

Het doel is een rustiger hoofd, geen productiviteitssysteem om het systeem.

**Voor wie**: een kleine kring van vrienden en familie. Ieder heeft een eigen account met eigen data. **Delen is een vaste richting**: gedeelde borden, receptenverzamelingen en boodschappenlijsten, en één recept delen met een ander lid. Het deelmodel ligt vast in ADR-0035: je deelt een container (een mand, later een bord of verzameling) met een ander lid, en delen wordt pas actief na diens toestemming. Elke nieuwe module houdt een duidelijke container, zodat delen later alleen een uitbreiding is.

## 2. Fundamenten (vast)

- **Eén centrale database die een LLM goed kan doorzoeken**: voorspelbare structuur, canonieke tekstkolommen, later embeddings.
- **Multi-user vanaf de basis**: elke rij heeft een eigenaar, en toegang wordt bepaald door Row Level Security.
- **Veilig vanaf de grond af**: de browser praat alleen met Atlas zelf, nooit direct met de database of met derden.
- **Meertalig**: NL en EN nu; een taal toevoegen is een catalogusbestand.
- **Door één persoon te onderhouden, met AI als vaste ontwikkelpartner.**
- **Eén designsysteem**: componenten en semantische tokens op de Tailwind-schaal. Claude ontwerpt nieuwe UI in code vanuit dat systeem; een Figma-ontwerp is leidend wanneer het genoemd wordt (ADR-0034).
- **Goedkoop in beheer**: Vercel + Supabase Cloud + Cloudflare R2. AI via gehoste API's, alleen waar gewone code tekortschiet, met een bestedingslimiet (ADR-0018).
- **Open source waar het kan.**

## 3. Modules

Status: ✅ in gebruik · 🔜 volgende fase · 💭 later.

### Account ✅
Inloggen met e-mail + wachtwoord of een magic link. Op het inlogscherm een begroeting met de voornaam (ADR-0031). Instellingen: voornaam, achternaam, taal.
*Buiten scope*: social login, 2FA.

### Te doen (Kanban) ✅
Borden, kolommen en kaarten met prioriteit, grootte, deadline en labels. Kaarten versleep je tussen kolommen, en één bord is je favoriet.
*Buiten scope*: Gantt/tijdlijn, koppelingen met externe taakbeheerders, terugkerende taken.

### Notities ✅
Een rijke editor met slash-menu, tabellen, taken, code, afbeeldingen en inklapbare secties (ADR-0021/0022). Notities linken naar elkaar met `[[` en tonen hun backlinks (ADR-0023). Indelen in categorieën en tekstueel zoeken. Notities zijn de belangrijkste bron voor verbanden.
*Buiten scope*: samen tegelijk bewerken, versiegeschiedenis.

### Recepten ✅
- Recepten maken en beheren, of importeren via een URL (ADR-0019).
- Overzicht per categorie.
- Ingrediënten gekoppeld aan een bibliotheek (NEVO) voor voedingswaarde per persoon (ADR-0011/0013).
- Portie-schaling, en omrekenen tussen metrisch en Amerikaanse maten (ADR-0014).
- Stappen tonen welke ingrediënten ze gebruiken.
- Ingrediënten naar de winkelmand sturen.

*Buiten scope*: prijzen, supermarkt-API's.

### Winkelmand ✅
Lopende boodschappenlijsten in één of meer manden, handmatig of vanuit recepten gevuld (je kiest de mand), gegroepeerd en af te vinken. Een mand deel je met een ander lid 🔜 (#420).
*Buiten scope*: prijsvergelijking, voorraadbeheer.

### Agenda 🔜
Eigen afspraken in dag-, week- en maandweergave, met deadlines uit Te doen erin. Externe agenda's alleen lezend importeren: eerst ICS, dan CalDAV, dan Google (ADR-0008).
*Buiten scope voor nu*: tweerichtingssync, uitnodigingen versturen.

### Assistent 💭
Het AI-gedeelte. Signalen uit je eigen data (vastgelopen taken, terugkerende thema's) worden kort en in gewone taal gemeld. Later komt daar een gesprek bij over je eigen informatie, gebaseerd op semantisch zoeken over notities en recepten. De agent heeft geen tools en geen schrijfrechten buiten zijn eigen meldingen.

### Later 💭
- **Delen** van borden, receptenverzamelingen en losse recepten, op hetzelfde model als de mand (ADR-0035).
- **Weekmenu**: recepten plannen in de agenda en de winkelmand automatisch vullen. Het duidelijkste voorbeeld van "kleine beslissingen verminderen".
- **Mail-integratie**: actiepunten en uitnodigingen uit mail naar Te doen en Agenda. Het `source`-veld op kaarten en afspraken is er al voor (ADR-0005).

### Niet in Atlas
Kleding (ADR-0016), een native app (de PWA volstaat), en diepe Home Assistant-integratie.
