# Fullstack Application

A modern fullstack application with PostgreSQL, tRPC, Vite, React, TanStack Router, and Material-UI.

## Getting Started

Start all services with Docker Compose:

```bash
docker-compose up
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend: http://localhost:3001
- PostgreSQL: localhost:5432

## Configuration

All environment variables are defined directly in `docker-compose.yml`:
- `DATABASE_URL`: PostgreSQL connection string
- `PORT`: Server port
- `VITE_API_URL`: Client API endpoint

To customize, edit the `environment` section in `docker-compose.yml`.

## Project Structure

```
./
├── docker-compose.yml    # Docker services configuration
├── server/               # Backend application
│   ├── package.json      # Server dependencies
│   └── src/
│       ├── index.ts      # Entry point (domain initialization)
│       ├── services/     # Database and auth services
│       ├── domain/       # Business logic layer
│       └── web/          # Express and tRPC setup
└── client/               # Frontend application
    ├── package.json      # Client dependencies
    ├── index.html        # HTML entry point
    └── src/
        ├── app.tsx       # React app setup & render
        ├── trpc.ts       # tRPC client & type utilities
        ├── routeTree.gen.ts
        ├── components/   # Reusable components
        │   └── State.tsx
        └── routes/       # TanStack Router file-based routes
            ├── __root.tsx
            └── index.tsx
```

## Architecture

### Server Layer Separation
- `index.ts` - Only imports domain and web, no Express dependencies
- `services/` - Database (PostgreSQL) and authentication
- `domain/` - Business logic with authentication checks
- `web/` - Express server setup and tRPC router

### Client
- `app.tsx` - Single entry point (merged App + main)
- `trpc.ts` - Core tRPC client configuration at src root
- `components/` - Reusable React components
- `routes/` - File-based routing with TanStack Router

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, TanStack Router, Material-UI, tRPC React Query
- **Backend**: Node.js, Express, tRPC, Zod
- **Database**: PostgreSQL 16
- **Code Style**: Functional programming, immutability, inline expressions

## Docker Commands

```bash
# Start all services
docker-compose up

# Run in detached mode
docker-compose up -d

# View logs
docker-compose logs -f

# Stop all services
docker-compose down

# Stop and remove volumes (deletes database data)
docker-compose down -v

# Rebuild containers after dependency changes
docker-compose up --build

# Install packages in containers
docker-compose exec server npm install <package>
docker-compose exec client npm install <package>

# Access database
docker-compose exec db psql -U postgres -d fullstack_db
```

## Adding New Routes

Create new route files in `client/src/routes/`:
- `client/src/routes/about.tsx` → `/about`
- `client/src/routes/tasks/$id.tsx` → `/tasks/:id`

The TanStack Router plugin will automatically generate the route tree.

## Local Development (without Docker)

If you need to run outside Docker:

1. Install PostgreSQL and create database:
```bash
createdb fullstack_db
```

2. Install dependencies and run:
```bash
cd server && npm install && npm run dev &
cd client && npm install && npm run dev &
```

3. Set environment variables:
```bash
export DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fullstack_db
```
