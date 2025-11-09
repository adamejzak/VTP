<div align="center">

# VTP — Discord Bot + Admin Panel

Potężny, nowoczesny ekosystem do zarządzania botem Discord i operacjami zespołu: panel administracyjny (Next.js + Clerk), REST API (Express), bot Discord (discord.js), baza i ORM (Prisma). Zbudowany w Node.js/TypeScript, gotowy do uruchomienia lokalnie i w Dockerze.  

🚀 Production-ready • 🔐 Auth by Clerk • 🧭 Dashboard • 🤖 Slash Commands • 🧩 Modular Services

</div>

---

### 🏗 Opis projektu / Project Overview
VTP to pełny zestaw narzędzi do zarządzania społecznością i operacjami na Discordzie:
- Webowy panel administracyjny z autoryzacją (Clerk) do zarządzania botem, użytkownikami, harmonogramami, powiadomieniami i zasobami.
- Backend z REST API, integracją z Discordem i usługami domenowymi (pracownicy, sklepy, harmonogramy, powiadomienia).
- Bot Discord oparty o `discord.js` z komendami slash, integracją z panelem i logami.

Projekt jest przygotowany do portfolio: czytelna architektura, nowoczesny stack, konteneryzacja, jasne ścieżki rozwoju.

---

### ✨ Funkcjonalności / Features
- 🔐 Logowanie i autoryzacja przez Clerk (role: Admin/Employee/None)
- 🗂 Panel admina (Next.js + Tailwind + shadcn/ui) z ciemnym motywem
- 🤖 Bot Discord (slash commands, DM, status, logi)
- 🧾 Harmonogramy i eksport (Excel), “AI Schedule Service” (moduł rozszerzeń)
- 👥 Zarządzanie użytkownikami, pracownikami i sklepami
- 🔔 Powiadomienia (lista, oznaczanie jako przeczytane, batch)
- 🧠 Czytelne API klienckie (`frontend/src/lib/api.ts`)
- 🧰 Gotowe obrazy Docker + docker-compose (dev i prod)

---

### ⚙️ Technologie / Tech Stack
- **Frontend**: Next.js 15, React 18, TypeScript, Tailwind CSS, shadcn/ui, Clerk
- **Backend**: Node.js (ESM), Express, discord.js, Prisma, Winston, ExcelJS
- **Auth**: Clerk (Next.js middleware + backend SDK)
- **Baza**: Prisma ORM (PostgreSQL)
- **Infra**: Docker, docker-compose, opcjonalnie Nginx reverse proxy

Struktura repo:
- `backend/` — API, bot, serwisy, Prisma
- `frontend/` — panel Next.js
- `docker-compose.dev.yml` i `docker-compose.yml` — środowiska dev/production

---

### 🚀 Uruchomienie / Installation

#### Wymagania
- Node.js 18+ (zalecane 20+)
- npm lub pnpm
- Opcjonalnie Docker Desktop (dla uruchomienia w kontenerach)

#### 1) Klucze środowiskowe
Skonfiguruj zmienne środowiskowe (przykłady poniżej).

Backend (`backend/.env.development` dla DEV lub `.env.production` dla PROD):

```bash
NODE_ENV=development
PORT=8080
DATABASE_URL="postgresql://user:password@localhost:5432/vtp?schema=public"  # wymagany PostgreSQL

# Discord
DISCORD_BOT_TOKEN=your-discord-bot-token
DISCORD_CLIENT_ID=your-discord-client-id
DISCORD_CLIENT_SECRET=your-discord-client-secret

# Clerk
CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
CLERK_JWT_KEY=your-clerk-jwt-key

# CORS (opcjonalnie, CSV)
# CORS_ORIGINS=http://localhost:3000

# Sesja
SESSION_SECRET=change-me
```

> Uwaga: Projekt jest skonfigurowany pod PostgreSQL (`provider = "postgresql"` w `backend/prisma/schema.prisma`). Ustaw prawidłowy `DATABASE_URL` do Postgresa — SQLite nie zadziała z aktualnym schematem.

Frontend (`frontend/.env.local` dla DEV lub `.env.production.local` dla PROD):

```bash
# URL API backendu (dev domyślnie: http://localhost:8080)
NEXT_PUBLIC_API_URL=http://localhost:8080

# Clerk (frontend)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
# (opcjonalnie jeśli używasz funkcji serwerowych wymagających sekretu)
CLERK_SECRET_KEY=sk_test_...
```

---

#### 2A) Uruchomienie lokalne (bez Dockera)

Wszystko razem:
```
# w głównym folderze projektu
npm run run:dev
```

Frontend:
```bash
cd frontend
npm install
npm run dev
# -> http://localhost:3000
```

Backend:
```bash
cd backend
npm install
npx prisma generate
# migracje (zalecane w dev, wymagane przy zmianach schematu):
npx prisma migrate dev --name init
npm run dev
# -> API: http://localhost:8080
```

Rejestracja/aktualizacja komend Discord (mozna zmieniac z ktorego .env bierze discord id):
```bash
node backend/deploy-discord-commands.js
```

---

#### 2B) Uruchomienie w Dockerze (Dev)
Jednym poleceniem:
```bash
docker-compose -f docker-compose.dev.yml up --build
# Frontend: http://localhost:3000
# Backend:  http://localhost:8080
```

> Ten compose nie uruchamia Postgresa — zapewnij działającą instancję (lokalny Postgres, Docker obok, lub zewnętrzny dostawca). Ustaw `DATABASE_URL` w plikach `.env`.

#### 2C) Uruchomienie w Dockerze (Prod)
```bash
docker-compose up -d --build                 # backend:8080, frontend:3003
# Opcjonalnie Nginx reverse proxy:
docker-compose --profile production up -d nginx
```

> Pliki env produkcyjne: `backend/.env.production`, `frontend/.env.production.local` (patrz docker-compose.yml).  
> Migracje w produkcji: uruchom `npx prisma migrate deploy` w kontenerze backendu po wdrożeniu obrazu.

---

### 🧩 Jak korzystać / Usage
- Zaloguj się do panelu: `http://localhost:3000` (w prod: własna domena) — auth via Clerk.
- Przejdź do sekcji:
  - `Dashboard → Bot` — podgląd statusu bota, ustawienia presence, wysyłka wiadomości/DM.
  - `Users` — synchronizacja i zarządzanie rolami użytkowników (ADMIN/EMPLOYEE/NONE).
  - `Schedule` — tworzenie/edycja harmonogramów, eksport do Excel.
  - `Notifications` — lista powiadomień, oznaczanie jako przeczytane, batch.
  - `Server`/`Logs` — informacje o serwerze Discord i logi bota/API.
- Na Discordzie używaj komend slash (np. `/schedule`) po zainstalowaniu bota i rejestracji komend.

Zrzuty ekranu:

![Panel — desktop](readme/panelwww.png)

![Panel — mobile](readme/panelmobile.png)

---

### 🧱 Architektura (skrót)
- `frontend/` — Next.js App Router, Clerk middleware, komponenty shadcn/ui, klient API (`src/lib/api.ts`)
- `backend/`
  - `src/api` — kontrolery i trasy REST
  - `src/bot` — bot discord.js (komendy, eventy, UI helpery)
  - `src/services` — logika domenowa (Auth, BotStatus, EnhancedSchedule, Store, Employee, Notifications)
  - `src/config` — zarządzanie konfiguracją/env/CORS
  - `prisma/` — schema i generacja klienta

---

### 🔧 Typowe skrypty
- Frontend:
  - `npm run dev` — tryb deweloperski
  - `npm run build` / `npm start` — build i start prod
- Backend:
  - `npm run dev` — API + bot w trybie watch
  - `npm run start` — start prod
  - `npm run build` — `prisma generate`
  - `node deploy-discord-commands.js` — rejestracja komend slash

---

### 🤝 Współpraca / Contributing
Chętnie przyjmuję pomysły, zgłoszenia błędów i pull requesty.  
Zasady w skrócie:
- Utwórz issue z opisem propozycji/buga
- Fork → feature branch → PR z krótkim opisem zmian
- Staraj się utrzymać spójność stylu (TypeScript, czysty kod, brak “magicznych” wartości)

---

### 📄 Licencja / License
Szczegóły i pełna treść: patrz plik `LICENSE`.  
© 2025 Adam Ejzak (ajzak).


