# Kodo metrikų matavimas

Visos komandos leidžiamos projekto šakniniame aplanke. Įrankiai įdiegiami su `npm install`.

## 3 užduotis: ciklomatinis ir kognityvinis sudėtingumas

Įrankis: ESLint 9.39.5 + eslint-plugin-sonarjs 4.2.2, konfigūracija `metrics/complexity.config.js`
(riba 0, kad būtų parodyta kiekvienos funkcijos reikšmė).

```bash
npm run complexity                     # originali ESLint išvestis
npm run complexity:table -- --min 10   # tos pačios reikšmės surikiuotos lentelėje
```

`has a complexity of N` – ciklomatinis, `Cognitive Complexity from N` – kognityvinis.
Funkcijos, kurių kognityvinis sudėtingumas 0, kognityvinio pranešimo neturi.

## 4 užduotis: prižiūrimumas

Įrankis: SonarQube Community Build 26.10 (Docker), SonarScanner CLI 8.1, kokybės profilis Sonar way comprehensive.

Reikia įjungto Docker Desktop.

```bash
npm run sonar:start      # paleidžia SonarQube http://localhost:9000 (pirmą kartą ~1–2 min.)
```

1. Naršyklėje atidaryti http://localhost:9000 ir prisijungti.
2. Jei projekto dar nėra: sukurti projektą rankiniu būdu su raktu `hungrybear`
   ir jam priskirti kokybės profilį **Sonar way comprehensive** (Project Settings → Quality Profiles).
3. Sugeneruoti raktą: My Account → Security → Generate Token (tipas Global Analysis Token).
4. Paleisti analizę:

```bash
SONAR_TOKEN=<raktas> npm run sonar
```

Rezultatai: projekto puslapis → Overview → Maintainability, failų sąrašas – Measures → Maintainability.
Analizės nustatymai – `sonar-project.properties`.
