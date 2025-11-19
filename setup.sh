#!/bin/bash
set -e

echo "Setting up fullstack application in current directory..."

echo "Creating docker-compose.yml..."
cat > docker-compose.yml << 'EOF'
services:
  client:
    image: node:22-alpine
    command: sh -c "npm install && npm run dev -- --host"
    working_dir: /app/client
    volumes:
      - .:/app
    depends_on:
      - server
    ports:
      - "3000:3000"
    environment:
      - VITE_API_URL=http://localhost:3001/trpc

  server:
    image: node:22-alpine
    command: sh -c "npm install && npm run dev"
    working_dir: /app/server
    user: root
    volumes:
      - .:/app
    depends_on:
      db:
        condition: service_healthy
    ports:
      - "3001:3001"
    environment:
      - DATABASE_URL=postgresql://postgres:postgres@db:5432/fullstack_db
      - PORT=3001

  db:
    image: postgres:16-alpine
    volumes:
      - db_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"
    environment:
      - POSTGRES_USER=postgres
      - POSTGRES_PASSWORD=postgres
      - POSTGRES_DB=fullstack_db
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U postgres"]
      interval: 5s
      timeout: 5s
      retries: 5
    restart: unless-stopped

volumes:
  db_data:
EOF

cat > .dockerignore << 'EOF'
node_modules
dist
.tanstack
*.log
.DS_Store
EOF

cat > .gitignore << 'EOF'
node_modules
dist
.tanstack
*.log
.DS_Store
EOF

echo "Setting up server..."
mkdir -p server/src/{web,domain,services}

cat > server/package.json << 'EOF'
{
  "name": "server",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc"
  },
  "dependencies": {
    "@trpc/server": "^11.0.0-rc.682",
    "cors": "^2.8.5",
    "express": "^4.21.1",
    "pg": "^8.13.1",
    "zod": "^3.23.8"
  },
  "devDependencies": {
    "@types/cors": "^2.8.17",
    "@types/express": "^5.0.0",
    "@types/pg": "^8.11.10",
    "tsx": "^4.19.2",
    "typescript": "^5.7.2"
  }
}
EOF

cat > server/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "bundler",
    "esModuleInterop": true,
    "strict": true,
    "skipLibCheck": true,
    "outDir": "./dist",
    "rootDir": "./src"
  },
  "include": ["src/**/*"]
}
EOF

cat > server/src/services/db.ts << 'EOF'
import pg from 'pg'
const { Pool } = pg

type Task = { id: string; title: string; description: string; completed: boolean; createdBy: string; createdAt: string }
type TaskInput = { title: string; description: string; createdBy: string }

export const initDbSvc = async (connectionString: string) => {
  const pool = new Pool({ connectionString })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT FALSE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
  `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)')
  const mapToExternal = (row: any): Task => ({ id: row.id.toString(), title: row.title, description: row.description, completed: row.completed, createdBy: row.created_by, createdAt: row.created_at.toISOString() })
  return {
    getAllTasks: () => pool.query('SELECT * FROM tasks ORDER BY created_at DESC').then(res => res.rows.map(mapToExternal)),
    getTaskById: (id: string) => pool.query('SELECT * FROM tasks WHERE id = $1', [id]).then(res => res.rows.length > 0 ? mapToExternal(res.rows[0]) : undefined),
    createTask: (input: TaskInput) => pool.query('INSERT INTO tasks (title, description, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [input.title, input.description, input.createdBy, new Date()]).then(res => mapToExternal(res.rows[0])),
    updateTask: (id: string, updates: Partial<{ title: string; description: string; completed: boolean }>) => {
      const fields: string[] = []
      const values: any[] = []
      let idx = 1
      if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title) }
      if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description) }
      if (updates.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(updates.completed) }
      values.push(id)
      return pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx}`, values).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`)))
    },
    deleteTask: (id: string) => pool.query('DELETE FROM tasks WHERE id = $1', [id]).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`))),
    close: () => pool.end()
  }
}

export type DbSvc = Awaited<ReturnType<typeof initDbSvc>>
EOF

cat > server/src/services/auth.ts << 'EOF'
export const initAuthSvc = () => ({
  authenticateUserToken: (token: string) => {
    if (!token) return Promise.reject(new Error('No token provided'))
    if (token === 'demo-token') return Promise.resolve({ username: 'demo-user' })
    return Promise.reject(new Error('Invalid token'))
  }
})

export type AuthSvc = ReturnType<typeof initAuthSvc>
EOF

cat > server/src/domain/taskDomain.ts << 'EOF'
import { DbSvc } from '../services/db.js'
import { AuthSvc } from '../services/auth.js'

export const initTaskDomain = (authSvc: AuthSvc, dbSvc: DbSvc) => ({
  getAllTasks: async (token: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.getAllTasks()
  },
  getTaskById: async (token: string, id: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.getTaskById(id)
  },
  createTask: async (token: string, title: string, description: string) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.createTask({ title, description, createdBy: user.username })
  },
  updateTask: async (token: string, id: string, title?: string, description?: string, completed?: boolean) => {
    await authSvc.authenticateUserToken(token)
    const updates = { ...(title !== undefined ? { title } : {}), ...(description !== undefined ? { description } : {}), ...(completed !== undefined ? { completed } : {}) }
    return dbSvc.updateTask(id, updates)
  },
  deleteTask: async (token: string, id: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.deleteTask(id)
  }
})

export type TaskDomain = ReturnType<typeof initTaskDomain>
EOF

cat > server/src/web/trpcRouter.ts << 'EOF'
import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { TaskDomain } from '../domain/taskDomain.js'

type Context = { token: string }

export const createTrpcRouter = (taskDomain: TaskDomain) => {
  const t = initTRPC.context<Context>().create()
  return t.router({
    allTasks: t.procedure.query(({ ctx }) => taskDomain.getAllTasks(ctx.token)),
    taskById: t.procedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => taskDomain.getTaskById(ctx.token, input.id)),
    createTask: t.procedure.input(z.object({ title: z.string(), description: z.string() })).mutation(({ ctx, input }) => taskDomain.createTask(ctx.token, input.title, input.description).then(() => 'OK')),
    updateTask: t.procedure.input(z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), completed: z.boolean().optional() })).mutation(({ ctx, input }) => taskDomain.updateTask(ctx.token, input.id, input.title, input.description, input.completed).then(() => 'OK')),
    deleteTask: t.procedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => taskDomain.deleteTask(ctx.token, input.id).then(() => 'OK'))
  })
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
EOF

cat > server/src/web/express.ts << 'EOF'
import express from 'express'
import cors from 'cors'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { createTrpcRouter } from './trpcRouter.js'
import { TaskDomain } from '../domain/taskDomain.js'

export const initExpress = (taskDomain: TaskDomain) => {
  const trpcRouter = createTrpcRouter(taskDomain)
  const app = express()
  app.use(cors())
  app.use('/trpc', createExpressMiddleware({ router: trpcRouter, createContext: ({ req }) => ({ token: req.headers.authorization?.replace('Bearer ', '') || '' }) }))
  const port = process.env.PORT || 3001
  app.listen(port, () => console.log(`Server running on port ${port}`))
}
EOF

cat > server/src/index.ts << 'EOF'
import { initDbSvc } from './services/db.js'
import { initAuthSvc } from './services/auth.js'
import { initTaskDomain } from './domain/taskDomain.js'
import { initExpress } from './web/express.js'

const start = async () => {
  const dbSvc = await initDbSvc(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fullstack_db')
  const authSvc = initAuthSvc()
  const taskDomain = initTaskDomain(authSvc, dbSvc)
  await initExpress(taskDomain)
}

start().catch(console.error)
EOF

echo "Setting up client..."
mkdir -p client/src/{routes,components}

cat > client/package.json << 'EOF'
{
  "name": "client",
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "@emotion/react": "^11.13.5",
    "@emotion/styled": "^11.13.5",
    "@mui/icons-material": "^6.1.9",
    "@mui/material": "^6.1.9",
    "@tanstack/react-query": "^5.90.10",
    "@tanstack/react-router": "^1.136.8",
    "@trpc/client": "^11.0.0-rc.682",
    "@trpc/react-query": "^11.0.0-rc.682",
    "react": "^18.3.1",
    "react-dom": "^18.3.1"
  },
  "devDependencies": {
    "@tanstack/router-plugin": "^1.136.8",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.7.2",
    "vite": "^6.4.1"
  }
}
EOF

cat > client/tsconfig.json << 'EOF'
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"]
}
EOF

cat > client/vite.config.ts << 'EOF'
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { TanStackRouterVite } from '@tanstack/router-plugin/vite'

export default defineConfig({
  plugins: [TanStackRouterVite(), react()],
  server: { port: 3000 }
})
EOF

cat > client/src/trpc.ts << 'EOF'
import { createTRPCReact } from '@trpc/react-query'
import type { TrpcRouter } from '../../server/src/web/trpcRouter'

export const trpc = createTRPCReact<TrpcRouter>()

export type ExtractTrpcOutput<T> = T extends (...args: any[]) => { error: infer E | null | undefined } ? E extends { data?: { code: string; path?: string; output?: infer O } } ? O | undefined : E extends { shape?: { data?: infer O } } ? O | undefined : never : never
EOF

cat > client/src/components/State.tsx << 'EOF'
import React from 'react'

export const State = <T,>({ children, initialState }: { children: (props: { state: T; setState: (vals: Partial<T>) => void }) => React.ReactNode; initialState: T }) => {
  const [state, setState] = React.useState(initialState)
  return <>{children({ state, setState: (vals) => setState({ ...state, ...vals }) })}</>
}
EOF

cat > client/src/routes/__root.tsx << 'EOF'
import React from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

const theme = createTheme()

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  )
})
EOF

cat > client/src/routes/index.tsx << 'EOF'
import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Checkbox } from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { trpc, ExtractTrpcOutput } from '../trpc'
import { State } from '../components/State'

const TaskQueries = ({ children }: { children: (props: { tasks: NonNullable<ExtractTrpcOutput<typeof trpc.allTasks.useQuery>>; refetchTasks: () => void }) => React.ReactNode }) => {
  const tasksQuery = trpc.allTasks.useQuery()
  return <>{children({ tasks: tasksQuery.data || [], refetchTasks: tasksQuery.refetch })}</>
}

const TaskMutations = ({ children }: { children: (props: { createTask: ReturnType<typeof trpc.createTask.useMutation>['mutateAsync']; updateTask: ReturnType<typeof trpc.updateTask.useMutation>['mutateAsync']; deleteTask: ReturnType<typeof trpc.deleteTask.useMutation>['mutateAsync']; isCreating: boolean; isUpdating: boolean; isDeleting: boolean }) => React.ReactNode }) => {
  const createMutation = trpc.createTask.useMutation()
  const updateMutation = trpc.updateTask.useMutation()
  const deleteMutation = trpc.deleteTask.useMutation()
  return <>{children({ createTask: createMutation.mutateAsync, updateTask: updateMutation.mutateAsync, deleteTask: deleteMutation.mutateAsync, isCreating: createMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending })}</>
}

const TaskManager = () => (
  <TaskQueries>
    {({ tasks, refetchTasks }) => (
      <TaskMutations>
        {({ createTask, updateTask, deleteTask }) => (
          <State initialState={{ modalOpen: false, editingTask: null as NonNullable<ExtractTrpcOutput<typeof trpc.allTasks.useQuery>>[number] | null }}>
            {({ state: mainState, setState: setMainState }) => (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h4">Task Manager</Typography>
                  <Button onClick={() => setMainState({ modalOpen: true, editingTask: null })} variant="contained" startIcon={<Add />}>Add Task</Button>
                </Box>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Completed</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell><Checkbox checked={task.completed} onChange={(e) => updateTask({ id: task.id, completed: e.target.checked }).then(() => refetchTasks())} /></TableCell>
                        <TableCell>{task.title}</TableCell>
                        <TableCell>{task.description}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => setMainState({ editingTask: task, modalOpen: true })} size="small"><Edit /></IconButton>
                          <IconButton onClick={() => deleteTask({ id: task.id }).then(() => refetchTasks())} size="small" color="error"><Delete /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Dialog open={mainState.modalOpen} onClose={() => setMainState({ modalOpen: false })} maxWidth="sm" fullWidth>
                  <State initialState={{ title: mainState.editingTask?.title || '', description: mainState.editingTask?.description || '' }}>
                    {({ state, setState }) => (
                      <>
                        <DialogTitle>{mainState.editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                        <DialogContent>
                          <TextField value={state.title} onChange={(e) => setState({ title: e.target.value })} label="Title" fullWidth margin="normal" />
                          <TextField value={state.description} onChange={(e) => setState({ description: e.target.value })} label="Description" fullWidth margin="normal" multiline rows={3} />
                        </DialogContent>
                        <DialogActions>
                          <Button onClick={() => setMainState({ modalOpen: false })}>Cancel</Button>
                          <Button onClick={() => { (mainState.editingTask ? updateTask({ id: mainState.editingTask.id, title: state.title, description: state.description }) : createTask({ title: state.title, description: state.description })).then(() => { refetchTasks(); setMainState({ modalOpen: false }) }) }} variant="contained" disabled={!state.title || !state.description}>{mainState.editingTask ? 'Update' : 'Add'}</Button>
                        </DialogActions>
                      </>
                    )}
                  </State>
                </Dialog>
              </Box>
            )}
          </State>
        )}
      </TaskMutations>
    )}
  </TaskQueries>
)

export const Route = createFileRoute('/')({ component: TaskManager })
EOF

cat > client/src/app.tsx << 'EOF'
import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider, createRouter } from '@tanstack/react-router'
import { httpBatchLink } from '@trpc/client'
import { trpc } from './trpc'
import { routeTree } from './routeTree.gen'

const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}

const App = () => {
  const [queryClient] = React.useState(() => new QueryClient())
  const [trpcClient] = React.useState(() => trpc.createClient({ links: [httpBatchLink({ url: import.meta.env.VITE_API_URL || 'http://localhost:3001/trpc', headers: () => ({ authorization: 'Bearer demo-token' }) })] }))
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
EOF

cat > client/src/routeTree.gen.ts << 'EOF'
import { Route as rootRoute } from './routes/__root'
import { Route as IndexRoute } from './routes/index'

const IndexRouteWithChildren = IndexRoute

const rootRouteWithChildren = rootRoute._addFileChildren({ IndexRoute: IndexRouteWithChildren })

export const routeTree = rootRouteWithChildren
EOF

cat > client/index.html << 'EOF'
<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Fullstack App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/app.tsx"></script>
  </body>
</html>
EOF

cat > README.md << 'EOF'
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
EOF

echo ""
echo "✅ Project setup complete!"
echo ""
echo "To start the application:"
echo "  docker-compose up"
echo ""
echo "The app will be available at:"
echo "  Frontend: http://localhost:3000"
echo "  Backend:  http://localhost:3001"
echo "  Database: localhost:5432"