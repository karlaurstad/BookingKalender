# Gapahuken – Sparbu Vel booking

En enkel bookingside for gapahuken. Ingen database, ingen egen backend –
Google Kalender er selve systemet, et Google Skjema tar imot
bookingforespørsler, og et lite Apps Script kobler dem sammen. Siden
publiseres statisk via GitHub Pages.

Denne README-en er skrevet slik at noen i styret skal kunne følge den
uten utviklerbakgrunn.

## Hvordan det henger sammen

```
Besøkende → Google Skjema → Apps Script → Google Kalender → vises på nettsiden
                                              ↑
                                admin redigerer/sletter direkte i Kalender-appen
```

- **Google Kalender** er fasiten. Alt som står der er sant.
- **Google Skjema** er inngangsporten for booking-forespørsler.
- **Apps Script** (`apps-script/booking-handler.gs`) sjekker om
  ønsket tid er ledig og innenfor reglene, og oppretter hendelsen i
  kalenderen automatisk – eller sender avslag på e-post.
- **Nettsiden** (`index.html`) viser kalenderen åpent for alle, og har
  en knapp til skjemaet.
- **Administrasjon** (slette bookinger, stenge datoer) gjøres direkte i
  Google Kalender – ikke på nettsiden. Flere personer kan få
  redigeringstilgang, se steg 3 under.

## Oppsett – gjør dette i rekkefølge

### 1. Opprett kalenderen

1. Gå til [calendar.google.com](https://calendar.google.com) med
   Google-kontoen som skal eie kalenderen.
2. Under "Andre kalendere" → **+** → **Opprett ny kalender**.
   Navn: f.eks. «Gapahuken – Sparbu Vel».
3. Åpne kalenderens innstillinger (tre prikker → Innstillinger og
   deling).
4. Under **Tilgang til offentligheten**: kryss av «Gjøre tilgjengelig
   for offentligheten» og velg **«Se alle hendelsesdetaljer»** (viktig
   – dette gir åpenheten dere ønsker: navn, formål og kontaktinfo blir
   synlig for besøkende).
5. Under **Kalender-ID** (lenger ned): kopier ID-en
   (ser ut som `xxxxxxx@group.calendar.google.com`). Denne trengs i
   steg 3 og 4.

### 2. Gi flere personer admin-tilgang (valgfritt)

Under samme innstillingsside, **Del med bestemte personer**:
- Legg til vedkommendes Google-konto (e-postadresse).
- Sett rolle til **«Gjøre endringer i hendelser»** (kan slette/redigere
  bookinger og legge til stengte perioder) – eller **«Gjøre endringer
  og administrere deling»** hvis de også skal kunne legge til flere
  administratorer.

Fra nå av kan alle med denne tilgangen åpne Google Kalender-appen sin
og slette en booking, redigere en, eller legge inn en «stengt»-hendelse
for å blokkere en periode (f.eks. vedlikehold) – helt uten å røre
nettsiden eller koden.

### 3. Opprett skjemaet

1. Gå til [forms.google.com](https://forms.google.com) → nytt skjema.
   Tittel: «Book gapahuken – Sparbu Vel».
2. **Legg inn personvernvarselet i skjemabeskrivelsen.** Bookinger vises
   offentlig med navn, telefon og e-post, og de er maskinlesbare via
   kalenderens ICS-feed. Folk må få vite det *før* de oppgir nummeret
   sitt. Lim inn i beskrivelsesfeltet øverst i skjemaet:

   > Merk: navn, telefon, e-post og formål blir publisert offentlig i
   > bookingkalenderen på nettsiden, slik at naboer kan se hvem som har
   > booket og eventuelt avtale seg imellom. Ikke fyll ut skjemaet
   > dersom du ikke ønsker dette.

3. Legg til **nøyaktig** disse spørsmålene (samme rekkefølge er ikke
   nødvendig, men **titlene må stemme eksakt** – de brukes av
   scriptet):

   | Spørsmål | Type | Påkrevd |
   |---|---|---|
   | Navn | Kort svar | Ja |
   | Telefon | Kort svar | Ja |
   | E-post | Kort svar | Ja |
   | Formål / arrangement | Kort svar | Ja |
   | Dato | Dato | Ja |
   | Starttid | Kort svar (se validering under) | Ja |
   | Sluttid | Kort svar (se validering under) | Ja |

   **Ikke bruk spørsmålstypen «Klokkeslett»** for Starttid/Sluttid — den
   viser klokkeslett i AM/PM-format basert på nettleserens språk, som
   er forvirrende for norske brukere. Bruk i stedet **Kort svar**, og
   legg på svarvalidering:
   - Trykk på **tre prikker** på spørsmålet → **Svarvalidering**.
   - Velg **Vanlig uttrykk (regex)** → **Samsvarer med** → lim inn:
     `^([01][0-9]|2[0-3]):[0-5][0-9]$`
   - Egendefinert feilmelding: «Skriv klokkeslett i 24-timersformat,
     f.eks. 14:00 (ikke AM/PM)».
   - Legg gjerne til en beskrivelse under spørsmålet også, f.eks.
     «24-timersformat, f.eks. 09:00 eller 17:30».

4. **Legg på validering også på disse feltene** (samme meny: tre
   prikker → Svarvalidering). Dette speiler grensene i scriptet, slik
   at brukeren får beskjed med en gang i stedet for å oppdage at
   teksten ble kuttet:

   | Felt | Validering | Feilmelding |
   |---|---|---|
   | Navn | Lengde → Maks antall tegn → `40` | «Maks 40 tegn.» |
   | Formål / arrangement | Lengde → Maks antall tegn → `60` | «Maks 60 tegn.» |
   | Telefon | Regex → Samsvarer med → `^[0-9 +]{8,15}$` | «Skriv et gyldig telefonnummer, f.eks. 90012345.» |

5. **Rett opp bekreftelsesmeldingen.** Google Skjemaer viser samme
   melding uansett om scriptet godtar eller avviser bookingen. Står det
   «Din booking er registrert», får også de som blir avvist (opptatt
   tidspunkt, dato i fortiden) beskjed om at alt er i orden – og
   oppdager først i e-posten at det ikke er det. Gå til
   **Innstillinger → Presentasjon → Bekreftelsesmelding** og bruk en
   nøytral formulering:

   > Forespørselen er mottatt. Du får en e-post som bekrefter om
   > tidspunktet er ledig – bookingen er ikke gyldig før du har fått
   > den bekreftelsen.

6. Noter skjemaets lenke (Send-knappen → lenke-ikon) – denne trengs i
   steg 5.

### 4. Koble på Apps Script

1. I skjema-redigeringen: meny (tre prikker øverst) → **Skript-editor**
   (Apps Script åpnes i en ny fane).
2. Slett eventuelt eksempelkode, og lim inn hele innholdet fra
   [`apps-script/booking-handler.gs`](apps-script/booking-handler.gs)
   i dette repoet.
3. Øverst i scriptet står `CALENDAR_ID` – sjekk at den stemmer med
   ID-en fra steg 1. Grensene under kan justeres ved behov:

   | Konstant | Standard | Hva den styrer |
   |---|---|---|
   | `MIN_DURATION_MINUTES` | 60 | Korteste booking |
   | `MAX_DURATION_MINUTES` | 480 | Lengste booking (8 t) |
   | `MAX_ADVANCE_DAYS` | 180 | Hvor langt fram man kan booke |
   | `MAX_BOOKINGS_PER_DAY` | 10 | Tak på bookinger per døgn totalt |
   | `MAX_EMAILS_PER_ADDRESS_PER_DAY` | 5 | Hindrer spam mot én adresse |
   | `MAX_ADMIN_EMAILS_PER_DAY` | 50 | Sparer Gmail-kvoten ved angrep |
   | `MAX_NAME_CHARS` / `MAX_PURPOSE_CHARS` | 40 / 60 | Lengde på offentlig tekst |

4. **Sett admin-adressen som skriptegenskap** (ikke i koden – da havner
   den ikke i det offentlige GitHub-repoet, og den overlever at du
   limer inn en ny versjon av filen):
   - Tannhjulet i venstre meny → **Prosjektinnstillinger**.
   - Nederst: **Skriptegenskaper** → **Legg til skriptegenskap**.
   - Egenskap: `ADMIN_EMAIL` — Verdi: adressen som skal få kopi av alle
     bookinger og avslag. Lagre.
   - Hopper du over dette, fungerer bookingen fortsatt, men du får
     ingen varsler.
5. Lagre (Ctrl+S).
6. Sett opp trigger: klokkeikonet i venstre meny (**Utløsere**) →
   **Legg til utløser** →
   - Funksjon: `onFormSubmit`
   - Kilde for hendelse: **Fra skjema**
   - Type hendelse: **Ved innsending av skjema**
   - Lagre. Du blir bedt om å godkjenne tilganger (kalender + e-post)
     første gang – dette er normalt for et script du selv eier.
7. Test: send inn skjemaet med et ledig tidspunkt → sjekk at
   hendelsen dukker opp i kalenderen og at du får en bekreftelses-epost.
   Send inn et overlappende tidspunkt → sjekk at du får avslag.

### 5. Fyll inn lenkene på nettsiden

Åpne `index.html` og bytt ut de to placeholderne:

- `FORM_URL_HERE` → skjemaets lenke fra steg 3.
- `CALENDAR_EMBED_SRC_HERE` → kalenderens innbyggingslenke:
  i kalenderinnstillingene (steg 1), finn **«Integrer kalender»** og
  kopier `src`-verdien fra HTML-koden der (eller bruk
  `https://calendar.google.com/calendar/embed?src=DIN_KALENDER_ID`).

### 6. Publiser på GitHub Pages

1. Opprett et GitHub-repo (kan være offentlig, det er bare statiske
   filer – ingen hemmeligheter i koden).
2. Push innholdet i denne mappen til repoet.
3. Repo → **Settings → Pages** → Source: velg branchen (f.eks. `main`)
   og mappen `/root`. Lagre.
4. Etter noen minutter er siden tilgjengelig på
   `https://<brukernavn>.github.io/<repo-navn>/`.

## Endre reglene senere

- **Stenge en dato/periode:** legg inn en vanlig hendelse i kalenderen
  som dekker perioden (f.eks. «Stengt – vedlikehold»). Den blokkerer
  automatisk booking i det tidsrommet, siden scriptet avviser alt som
  overlapper en eksisterende hendelse.
- **Endre min/maks varighet:** rediger `MIN_DURATION_MINUTES` /
  `MAX_DURATION_MINUTES` i Apps Script og lagre.
- **Slette/flytte en booking:** gjøres direkte i Google Kalender.

## Ved misbruk

Skjemaet er bevisst åpent – ingen innlogging – slik at alle i bygda kan
booke. Prisen er at useriøse bookinger kan forekomme. Slik håndteres det:

- **Slett hendelsen i Google Kalender.** Den forsvinner fra nettsiden
  umiddelbart, og slottet blir ledig igjen.
- **Sporet bevares.** Alle innsendinger ligger fortsatt i skjemaets
  regneark (Svar-fanen → grønt regneark-ikon), selv om
  kalenderhendelsen slettes. Der ser du tidspunkt og hva som ble sendt
  inn.
- **Admin får e-post om hver booking**, så oppdagelsestiden er minutter,
  ikke dager. Får du plutselig mange varsler, eller et varsel om at
  «flere varsler undertrykkes», er det et tegn på automatisert misbruk.
- **Ved vedvarende misbruk:** vurder å skru på krav om Google-innlogging
  i skjemaet (Innstillinger → Svar → «Begrens til brukere i …» eller
  samle inn e-postadresser). Det stopper anonym spam nesten helt, men
  utestenger folk uten Google-konto.

### Kjente, aksepterte forhold

- Navn, telefon og e-post er offentlig tilgjengelig – også maskinlesbart
  via kalenderens ICS-feed. Dette er et bevisst valg for åpenhetens
  skyld, og derfor står varselet i skjemaet. Ønsker dere å stramme inn
  senere, er endringen å utelate telefon/e-post fra
  `description` i `booking-handler.gs`; styret har dem fortsatt i
  regnearket.
- Uten innlogging kan noen booke i andres navn. Kontroll skjer ved at
  admin ser varselet og kan slette.
