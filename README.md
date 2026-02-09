# HelloWorld

A modern full-stack demo project with a React frontend, Express API backend, and a standalone Java 21 greeting app.

## Architecture

```
helloworld/
├── frontend/         React 19 + Vite + Tailwind CSS v4
├── backend/          Express.js REST API
├── api-tests/        Newman (Postman CLI) API tests
├── HelloWorld.java   Standalone Java 21 demo
├── Dockerfile        Multi-stage Docker build (Java)
└── docker-compose.yml
```

## Quick Start

### Backend
```bash
cd backend
npm install
npm start          # Runs on :8080
npm test           # Jest + Supertest
```

### Frontend
```bash
cd frontend
npm install
npm run dev        # Runs on :3000, proxies /api to :8080
npm test           # Vitest + React Testing Library
npm run build      # Production build
```

### Java (standalone)
```bash
java HelloWorld.java
```

### Docker Compose
```bash
docker compose up --build
```

### API Tests
```bash
cd api-tests
npm test           # Newman against running backend
```

## API Endpoints

| Method | Path             | Description                     |
|--------|------------------|---------------------------------|
| GET    | /api/hello       | Default greeting                |
| GET    | /api/hello?name= | Personalized greeting           |
| GET    | /api/greetings   | List of greetings in 5 languages|
| GET    | /api/health      | Health check                    |

## Tech Stack

- **Frontend**: React 19, Vite, Tailwind CSS v4
- **Backend**: Node.js, Express 5, Helmet, CORS
- **Java**: Java 21 (records, var, modern APIs)
- **Testing**: Vitest, Jest, Supertest, Newman
- **Containers**: Docker multi-stage builds, Docker Compose
