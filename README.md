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
2. Legg til **nøyaktig** disse spørsmålene (samme rekkefølge er ikke
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

3. Noter skjemaets lenke (Send-knappen → lenke-ikon) – denne trengs i
   steg 5.

### 4. Koble på Apps Script

1. I skjema-redigeringen: meny (tre prikker øverst) → **Skript-editor**
   (Apps Script åpnes i en ny fane).
2. Slett eventuelt eksempelkode, og lim inn hele innholdet fra
   [`apps-script/booking-handler.gs`](apps-script/booking-handler.gs)
   i dette repoet.
3. Øverst i scriptet, fyll inn:
   - `CALENDAR_ID` – ID-en fra steg 1.
   - `ADMIN_EMAIL` – e-post som skal få kopi av alle bookinger/avslag
     (kan stå tom `''` om det ikke er ønskelig).
   - Juster ev. `MIN_DURATION_MINUTES` / `MAX_DURATION_MINUTES`.
4. Lagre (Ctrl+S).
5. Sett opp trigger: klokkeikonet i venstre meny (**Utløsere**) →
   **Legg til utløser** →
   - Funksjon: `onFormSubmit`
   - Kilde for hendelse: **Fra skjema**
   - Type hendelse: **Ved innsending av skjema**
   - Lagre. Du blir bedt om å godkjenne tilganger (kalender + e-post)
     første gang – dette er normalt for et script du selv eier.
6. Test: send inn skjemaet med et ledig tidspunkt → sjekk at
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
