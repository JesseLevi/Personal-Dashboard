Visiedocument: Personal dashboard

1. Kernvisie
Een persoonlijk levensmanagement-platform, primair voor mezelf als solo-gebruiker, dat alle informatie voor mijn dagelijks leven op één centrale, LLM-doorzoekbare plek samenbrengt. Het probleem dat het oplost is decision fatigue: te veel losse apps en losse beslismomenten, te weinig overzicht over wat er speelt en wat er moet gebeuren. Geen productiviteitssysteem om het systeem — het doel is een rustiger hoofd en meer grip op de dag.

2. Vaststaande fundamenten (niet ter discussie)
Alles hier is al besloten. Fable mag dit gebruiken als gegeven, niet heroverwegen of bevragen.
	•	Centrale database die makkelijk door een LLM te doorzoeken is.
	•	Multi-user architectuur vanaf de basis, ook al is het gebruik nu solo/huishouden — houdt de deur open voor gedeeld gebruik zonder latere migratie.
	•	Setup waardoor het toevoegen van extra talen in de toekomst makkelijk mogelijk is; NL/EN nu, embeddingmodel is expliciet meertalig gekozen.
	•	Eenvoudig door één persoon te onderhouden, met AI als vaste development-partner (zie CLAUDE.md-workflow).
	•	Design systeem volgens Atomic Design (Atoms → Molecules → Organisms → Pages), al zo opgezet in Figma met tokens die 1-op-1 op de Tailwind-schaal aansluiten. Code-structuur en componentnamen volgen deze indeling (zie CLAUDE.md).
	•	Platform moet van de grond af veilig zijn ontworpen, zodat kwaadwillenden niet bij informatie kunnen komen.
	•	Zoveel mogelijk gebruikmaken van open source software.
2.5 Voorgestelde tech stack
Fable mag dit bekritiseren en met betere suggesties komen.
	•	Techstack: Next.js (App Router), Supabase (Cloud), Tailwind CSS, TipTap, Schedule-X (oorspronkelijk CalendarKit, maar dat bleek React Native-only — zie ADR-0008).
	•	Data-laag: Supabase
	•	Deploy: Vercel (Next.js) + Supabase Cloud, GitHub Actions (ADR-0012). De Mac mini als homeserver is geparkeerd en wordt waarschijnlijk niet meer gebouwd (ADR-0018).
	•	Design tokens: Figma: primitive tokens (gebaseerd op Tailwind)→ semantic tokens → Tailwind, via Figma MCP (zie CLAUDE.md voor de Code Syntax-conventie).
	•	AI: gehoste inference-API's, betalen per gebruik, achter één provider-neutrale laag (lib/ai/). Eerst gewone code, dan pas een LLM-call, met een bestedingslimiet (ADR-0018). Embeddings moeten meertalig zijn (niet Supabase's alleen-Engelse gte-small); welk gehost model, wordt in fase 8 gekozen.
3. Modules / pagina's
Login pagina
	•	Doel: toegang tot het platform, sessie- en accountbeheer.
	•	Kernacties:
	•	Inloggen (Supabase Auth — e-mail/wachtwoord of magic link)
	•	Sessie onthouden/verlengen
	•	Basisprofiel beheren (naam, taalvoorkeur)
	•	Raakt deze modules: alle modules — elke tabel hangt aan user_id/RLS die hier ontstaat.
	•	Uitdrukkelijk buiten scope (voor nu): social login providers, 2FA, rol-/rechtenbeheer voorbij eenvoudige huishouden-sharing.
Kanban
	•	Doel: taken en projecten overzichtelijk beheren in bordvorm.
	•	Kernacties:
	•	Kaart aanmaken/bewerken
	•	Kolommen/borden beheren
	•	Kaarten verslepen tussen statussen
	•	Labels/tags toewijzen en filteren
	•	Data die het aanraakt/produceert: boards, columns, cards, labels (elk met user_id).
	•	Raakt deze modules: AI-agent (cross-cutting) — cards zijn een primaire bron van signalen over openstaande taken en patronen.
	•	Uitdrukkelijk buiten scope (voor nu): Gantt/tijdlijnweergave, integraties met externe taakbeheerders (Todoist, Asana e.d.), terugkerende taken/automatisering.
Notities
	•	Doel: vrije, ongestructureerde notities vastleggen zonder dat je moet nadenken waar ze "horen".
	•	Kernacties:
	•	Notitie aanmaken/bewerken met TipTap
	•	Taggen
	•	Doorzoeken: tekstueel én semantisch (vector search)
	•	Data die het aanraakt/produceert: notes via TipTap, embeddings in pgvector — dit is de belangrijkste databron voor de AI-agent,
	•	Raakt deze modules: AI-agent (cross-cutting), optioneel Kanban (notitie aan kaart linken).
	•	Uitdrukkelijk buiten scope (voor nu): gedeelde/collaboratieve notities, versiegeschiedenis, bi-directioneel linken tussen notities (Roam/Obsidian-achtig).
Agenda
	•	Doel: overzicht van afspraken en deadlines, gebouwd op Schedule-X (zie ADR-0008).
	•	Kernacties:
	•	Afspraak/gebeurtenis aanmaken
	•	Dag/week/maandweergave
	•	Deadlines vanuit Kanban-kaarten tonen
	•	externe agenda-sync (Google/Outlook/CalDAV)
	•	Raakt deze modules: Kanban (deadlines zichtbaar in agenda), Mail-integratie (toekomstig — uitnodigingen uit mail), toekomstig ook een niet-gebouwde Weekmenu-module (logische plek voor maaltijdplanning later, nu niet gebouwd).
Recepten
	•	Doel: recepten toevoegen en terugvinden in eenvoudige stappen, zonder overhead.
	•	Kernacties:
	•	Recept aanmaken/bewerken (ingrediënten + bereiding)
	•	Kanban overzicht met aanpasbare categorieën (bv. ontbijt, lunch, avondeten, snack)
	•	Zoeken/filteren op categorie of ingrediënt
	•	Eén of meerdere ingrediënten naar de boodschappenlijst sturen
	•	Automatische portie-schaling
	•	Data die het aanraakt/produceert: recipes (titel, categorie, ingrediënten, tags)
	•	Raakt deze modules: Boodschappenlijst (ingrediënten worden hieraan toegevoegd).
	•	Uitdrukkelijk buiten scope (voor nu): weekmenu-planning/kalenderkoppeling, voedingswaarde-informatie, importeren/scrapen van externe recepten.
Boodschappenlijst
	•	Doel: een lopende boodschappenlijst bijhouden, handmatig of vanuit recepten gevuld.
	•	Kernacties:
	•	Item toevoegen/afvinken
	•	Automatisch aanvullen vanuit recept-ingrediënten
	•	Items groeperen (bv. per supermarktsectie)
	•	Raakt deze modules: Recepten (bron van items), Kanban (optioneel: een taak "boodschappen doen" als losse kaart — geen harde koppeling nodig).
	•	Uitdrukkelijk buiten scope (voor nu): prijsvergelijking, supermarkt-API-integratie, thuisvoorraadbeheer/inventaris.
Mail-integratie
	•	Status: toekomstig, geen tickets deze ronde. Hier opgenomen zodat de architectuur er nu al rekening mee kan houden — niet om nu te bouwen.
	•	Doel: mail triagen en actiepunten/afspraken automatisch naar de rest van het platform laten doorstromen.
	•	Kernacties (toekomstig):
	•	Mailbox koppelen (IMAP of Gmail API)
	•	AI-samenvatting/triage van binnenkomende mail
	•	Actiepunt uit mail naar een Kanban-kaart
	•	Agenda-uitnodiging uit mail naar de Agenda-module
	•	Data die het (later) aanraakt/produceert: geen eigen tabellen deze ronde; later mogelijk email_threads/email_summaries, plus per-account versleutelde mail-credentials volgens hetzelfde Vault-patroon als de AI API-keys.
	•	Raakt deze modules: Kanban (actiepunten), Agenda (uitnodigingen), AI-agent (hergebruikt dezelfde LLM-call-pipeline voor samenvatting/triage).
	•	Uitdrukkelijk buiten scope (voor nu): de hele module zelf — mailbox-koppeling, credential-opslag en triage-logica komen pas in een latere ronde. Enige impact nu: overweeg bij Kanban/Agenda of een simpel source-veld (bv. "handmatig" vs. "mail") de moeite waard is, of dat dit over-engineering is (zie §5).

4. Cross-cutting concerns
	•	Multi-user data-isolatie: user_id-foreign keys per tabel + Row Level Security in Supabase. Per-account versleutelde API-keys voor AI-features, opslag via Supabase Vault. Openstaande vraag: hoe modelleer je gedeelde data (bv. één boodschappenlijst voor een huishouden) zonder de per-user RLS-aanpak te breken?
	•	AI-agent: krijgt signalen primair uit Kanban (taken/patronen) en uit vrije tekst in notities/recepten (thematische herkenning via vector search). Pipeline: scheduled SQL-detectors voor structurele/temporele patronen → pgvector similarity search voor semantische herkenning → één LLM-call (gehoste API, ADR-0018) die relevantie beoordeelt en de output in natuurlijke taal formuleert. Bewust simpel gehouden, zodat een klein en goedkoop model het aankan.
	•	Vector-backend: content uit notities en recepten wordt ge-embed via een gehoste embedding-API (ADR-0018). Gequeried door de AI-agent voor relevantie-detectie, en op termijn voor cross-module search/RAG vanuit een chat-achtige interface.
5. Open architectuurvragen — HIER is Fable voor nodig
	•	Encrypted per-account API-keys: volledig via Supabase Vault, of met een extra applicatielaag ertussen — en welke RLS-policy-implicaties heeft elke keuze?
	⁃	Bouwvolgorde: Login, Kanban, Notities en Agenda zijn relatief onafhankelijk, maar Recepten → Boodschappenlijst heeft een echte dependency. Wat is de verstandigste bouwvolgorde gegeven die ene harde koppeling?
	⁃	Is het de moeite waard om nu al een source-veld (bv. "handmatig" vs. "mail") in Kanban en Agenda op te nemen met het oog op de toekomstige Mail-integratie, of is dat premature abstractie die beter kan wachten tot die module er echt komt?
6. Niet-doelen voor déze planningsronde
	•	Native mobiele app.
	•	Weekmenu-planning (pas zodra Recepten en Boodschappenlijst stabiel draaien).
	•	Diepe Home Assistant-integratie in het platform zelf (blijft voorlopig los op de homeserver).
