# HelloWorld

A modern full-stack demo project with a React frontend, Express API backend, and a standalone Java 21 greeting app.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Docker Compose                      │
│                                                         │
│  ┌──────────────┐  /api/*   ┌──────────────────────┐   │
│  │   Frontend    │ ───────> │      Backend          │   │
│  │              │           │                      │   │
│  │  React 19    │           │  Express 5           │   │
│  │  Vite        │           │  Node.js 22          │   │
│  │  Tailwind v4 │           │  Helmet + CORS       │   │
│  │              │           │                      │   │
│  │  nginx :80   │           │  :8080               │   │
│  └──────────────┘           └──────────────────────┘   │
│         :3000                                           │
└─────────────────────────────────────────────────────────┘

┌──────────────┐   ┌─────────────────┐   ┌──────────────┐
│  Jest +      │   │  Vitest +       │   │  Newman      │
│  Supertest   │   │  RTL            │   │  (Postman)   │
│  10 tests    │   │  11 tests       │   │  13 asserts  │
│  (backend)   │   │  (frontend)     │   │  (API e2e)   │
└──────────────┘   └─────────────────┘   └──────────────┘
```

```
helloworld/
├── frontend/          React 19 + Vite + Tailwind CSS v4
├── backend/           Express.js REST API
├── api-tests/         Newman (Postman CLI) API tests
├── HelloWorld.java    Standalone Java 21 demo
├── Dockerfile         Multi-stage Docker build (Java)
└── docker-compose.yml Full-stack orchestration
```

## Prerequisites

### On Mac (local development)

```bash
# Install Node.js 22+ (via Homebrew)
brew install node

# Install Java 21+ (optional, for standalone Java demo)
brew install openjdk@21

# Install Docker Desktop (for containerized runs)
# https://www.docker.com/products/docker-desktop/
```

### On Claude Code (cloud session)

Node.js 22, Java 21, and Docker are pre-installed. Just clone and go:

```bash
git clone https://github.com/gskudlarick/helloworld.git
cd helloworld
```

## Setup From Scratch

### 1. Clone the repo

```bash
git clone https://github.com/gskudlarick/helloworld.git
cd helloworld
```

### 2. Install dependencies

```bash
# Backend
cd backend && npm install && cd ..

# Frontend
cd frontend && npm install && cd ..

# API tests (optional)
cd api-tests && npm install && cd ..
```

### 3. Verify everything works

```bash
# Run backend tests
cd backend && npm test && cd ..

# Run frontend tests
cd frontend && npm test && cd ..
```

## Running the App

### Option A: Local development (two terminals)

**Terminal 1 - Backend:**
```bash
cd backend
npm start
# API running at http://localhost:8080
```

**Terminal 2 - Frontend:**
```bash
cd frontend
npm run dev
# App running at http://localhost:3000
# API calls proxy to :8080 automatically
```

Open http://localhost:3000 in your browser.

### Option B: Docker Compose (one command)

```bash
docker compose up --build
# Frontend at http://localhost:3000
# API at http://localhost:8080
```

### Option C: Java standalone

```bash
java HelloWorld.java
```

## Running Tests

```bash
# Backend unit tests (Jest + Supertest)
cd backend && npm test

# Frontend unit tests (Vitest + React Testing Library)
cd frontend && npm test

# API integration tests (Newman - requires backend running)
cd backend && npm start &
cd api-tests && npm test
```

## API Endpoints

| Method | Path             | Description                      |
|--------|------------------|----------------------------------|
| GET    | /api/hello       | Default greeting                 |
| GET    | /api/hello?name= | Personalized greeting            |
| GET    | /api/greetings   | List of greetings in 5 languages |
| GET    | /api/health      | Health check                     |

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Node.js 22, Express 5, Helmet, CORS
- **Java**: Java 21 (records, var, modern APIs)
- **Testing**: Vitest, Jest, Supertest, Newman
- **Containers**: Docker multi-stage builds, Docker Compose, nginx
