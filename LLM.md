# LLM Development Guidelines

## ⚠️ CRITICAL: Working with Existing Projects

**YOU ARE NOT CREATING A NEW PROJECT. YOU ARE WORKING WITH AN EXISTING CODEBASE.**

**NEVER suggest complete file replacements for existing files.** The project already has:
- `server/src/index.ts` (minimal, rarely needs changes)
- `server/src/services/db.ts` (contains existing tables and operations)
- `server/src/services/auth.ts` (authentication logic)
- `server/src/domain/index.ts` (contains existing domain wiring)
- `server/src/web/express.ts` (server setup)
- `server/src/web/trpcRouter.ts` (contains existing endpoints)
- Other domain files, services, and routes

**When editing existing files:**
- Request **specific additions** using `str_replace` or similar edit operations
- Show exactly what to add and where to add it
- Never output the entire file contents
- Assume the file has content you haven't seen

**When creating new features:**
- ✅ Create NEW domain files (e.g., `domain/notesDomain.ts`)
- ✅ Create NEW route files (e.g., `routes/notes.tsx`)
- ✅ Create NEW service files if needed (e.g., `services/emailSvc.ts`)
- ✅ Request EDITS to `domain/index.ts` to wire your new domain
- ✅ Request EDITS to `services/db.ts` to add tables/operations
- ✅ Request EDITS to `web/trpcRouter.ts` to add endpoints

**Example - WRONG approach:**
```typescript
// ❌ DON'T DO THIS - Complete file replacement
// domain/index.ts
import { initAuthSvc } from '../services/auth'
import { initDbSvc } from '../services/db'
import { initTaskDomain } from './taskDomain'
import { initNewDomain } from './newDomain'

export const initDomain = async () => {
  const dbSvc = await initDbSvc(...)
  const authSvc = initAuthSvc()
  const taskDomain = initTaskDomain(authSvc, dbSvc)
  const newDomain = initNewDomain(authSvc, dbSvc)
  return { ...taskDomain, ...newDomain }
}
```

**Example - CORRECT approach:**
```typescript
// ✅ DO THIS - Request specific edits
// Add to domain/index.ts:

// 1. Add import after existing imports:
import { initNewDomain } from './newDomain'

// 2. Add initialization after existing domain initializations:
const newDomain = initNewDomain(authSvc, dbSvc)

// 3. Add to return statement spread (after existing domains):
...newDomain,
```

## Project Overview

Full-stack TypeScript: PostgreSQL, tRPC, React, TanStack Router, Material-UI. Layered architecture with functional programming.

## Architecture

```
server/src/
├── index.ts              # Entry point (minimal)
├── services/             # Infrastructure
│   ├── db.ts             # Database (edit to add tables/CRUD)
│   ├── auth.ts           # Authentication
│   └── *.ts              # New services (APIs, integrations)
├── domain/
│   ├── index.ts          # Central wiring (ADD service inits, domain imports)
│   └── *Domain.ts        # Feature domains (NEW files)
└── web/
    ├── express.ts        # Server setup
    └── trpcRouter.ts     # API endpoints (ADD here)

client/src/
├── components/State.tsx  # State helper
└── routes/*.tsx          # Pages (NEW files, auto-detected)
```

**Key principle**: New features = new files. Edit existing files only for wiring.

## Stack Flow

Services (Database, External APIs, etc.) → Domain → tRPC → Frontend

**Services** provide infrastructure - database access, external APIs, third-party integrations, or specialized functionality. Create new service files as needed.

## Adding Functionality

### 0. Service Layer (Optional - services/newService.ts)

**Create new service file when you need:**
- External API integrations (Stripe, SendGrid, OpenAI)
- Specialized functionality (email, file storage, caching)
- Third-party services
- Additional infrastructure beyond database

**Example service structure:**

```typescript
import { SomeExternalLibrary } from 'some-library'

export const initNewSvc = (config?: { apiKey?: string }) => {
  const client = new SomeExternalLibrary({ apiKey: config?.apiKey || process.env.API_KEY })
  
  return {
    doSomething: (param: string) => client.method(param).then(result => ({ data: result })),
    doSomethingElse: async (param: number) => {
      const result = await client.otherMethod(param)
      return { success: true, result }
    },
  }
}

export type NewSvc = ReturnType<typeof initNewSvc>
```

**Wire in domain/index.ts:**

```typescript
import { initNewSvc } from '../services/newService'

export const initDomain = async () => {
  const dbSvc = await initDbSvc(...)
  const authSvc = initAuthSvc()
  const newSvc = initNewSvc() // Initialize your new service
  
  const taskDomain = initTaskDomain(authSvc, dbSvc)
  const entityDomain = initEntityDomain(authSvc, dbSvc, newSvc) // Pass to domains that need it
  
  return { ...taskDomain, ...entityDomain }
}
```

**Service standards:**
- Initialize with config or environment variables
- Return object with methods
- Handle external errors gracefully
- Return clean, typed objects
- Export service type

### 1. Database (services/db.ts)

**⚠️ This file EXISTS and contains other tables. Request EDITS to ADD your new operations.**

**Request edits to add to the EXISTING file:**

```typescript
// 1. ADD type definition (at top with other types)
type Entity = { id: string; field: string; createdBy: string; createdAt: string }

// 2. ADD table creation in initDbSvc (after existing table creations)
await pool.query(`CREATE TABLE IF NOT EXISTS entities (...)`)
await pool.query('CREATE INDEX IF NOT EXISTS idx_entities_created_at ON entities(created_at)')

// 3. ADD mapper function (with other mappers)
const mapEntity = (row: any): Entity => ({ id: row.id.toString(), field: row.field, ... })

// 4. ADD operations to the return object (alongside existing operations)
getAllEntities: () => pool.query('SELECT * FROM entities').then(res => res.rows.map(mapEntity)),
createEntity: (field: string, createdBy: string) => pool.query('INSERT INTO entities...').then(res => mapEntity(res.rows[0])),
```

**You are ADDING these to an existing file. Do not replace the entire file.**

**Standards**: Parameterized queries, promise chains, mappers, descriptive errors.

### 2. Domain (domain/entityDomain.ts)

**Create new file:**

```typescript
import { DbSvc } from '../services/db.js'
import { AuthSvc } from '../services/auth.js'

export const initEntityDomain = (authSvc: AuthSvc, dbSvc: DbSvc) => ({
  getAllEntities: async (token: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.getAllEntities()
  },
  createEntity: async (token: string, field: string) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.createEntity(field, user.username)
  },
})

export type EntityDomain = ReturnType<typeof initEntityDomain>
```

**Standards**: Auth first, simple params, import only needed services.

### 3. Wire Domain (domain/index.ts)

**⚠️ This file EXISTS and contains other domains. Request EDITS to ADD your new domain. NEVER replace the entire file.**

**Request three specific edits:**

**Edit 1 - Add import at the top:**
```typescript
import { initEntityDomain } from './entityDomain'
```

**Edit 2 - Add initialization in initDomain function (after existing domain initializations):**
```typescript
const entityDomain = initEntityDomain(authSvc, dbSvc)
```

**Edit 3 - Add to return object (after existing domain spreads):**
```typescript
...entityDomain,
```

**CRITICAL**: You're making three small edits, not replacing the file. Other services and domains already exist in this file.

### 4. tRPC (web/trpcRouter.ts)

**⚠️ This file EXISTS with other endpoints. Request EDITS to ADD your endpoints to the existing router.**

**Request edits to add to the router object (alongside existing endpoints):**

```typescript
allEntities: t.procedure.query(({ ctx }) => domain.getAllEntities(ctx.token)),
createEntity: t.procedure.input(z.object({ field: z.string() })).mutation(({ ctx, input }) => domain.createEntity(ctx.token, input.field).then(() => 'OK')),
```

**These are ADDITIONS to the existing t.router({ ... }) object. Do not replace the entire file.**

**Standards**: One line each, `domain.functionName()`, Zod validation, mutations return 'OK'.

### 5. Frontend (routes/entities.tsx)

**Create new file:**

```typescript
import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Box, Button, Table, TableBody, TableCell, TableHead, TableRow, IconButton } from '@mui/material'
import { Add, Delete } from '@mui/icons-material'
import { trpc, ExtractTrpcOutput } from '../trpc'
import { State } from '../components/State'

const EntityQueries = ({ children }: { children: (props: { entities: NonNullable<ExtractTrpcOutput<typeof trpc.allEntities.useQuery>>; refetch: () => void }) => React.ReactNode }) => {
  const query = trpc.allEntities.useQuery()
  return <>{children({ entities: query.data || [], refetch: query.refetch })}</>
}

const EntityMutations = ({ children }: { children: (props: { create: ReturnType<typeof trpc.createEntity.useMutation>['mutateAsync']; delete: ReturnType<typeof trpc.deleteEntity.useMutation>['mutateAsync'] }) => React.ReactNode }) => {
  const createMut = trpc.createEntity.useMutation()
  const deleteMut = trpc.deleteEntity.useMutation()
  return <>{children({ create: createMut.mutateAsync, delete: deleteMut.mutateAsync })}</>
}

const Entities = () => (
  <EntityQueries>
    {({ entities, refetch }) => (
      <EntityMutations>
        {({ create, delete: del }) => (
          <State initialState={{ modalOpen: false }}>
            {({ state, setState }) => (
              <Box sx={{ p: 3 }}>
                <Button onClick={() => setState({ modalOpen: true })} startIcon={<Add />}>Add</Button>
                <Table>
                  <TableHead><TableRow><TableCell>Field</TableCell><TableCell align="right">Actions</TableCell></TableRow></TableHead>
                  <TableBody>
                    {entities.map((e) => (
                      <TableRow key={e.id}>
                        <TableCell>{e.field}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => del({ id: e.id }).then(() => refetch())} size="small"><Delete /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </Box>
            )}
          </State>
        )}
      </EntityMutations>
    )}
  </EntityQueries>
)

export const Route = createFileRoute('/entities')({ component: Entities })
```

## Formatting Standards

### Functional Programming Principles

- **Use `const` not `let`**: `const data = transform(input)`
- **Prefer map/reduce**: `items.map(item => transform(item))`
- **Immutability**: `setState({ ...state, ...updates })`
- **Arrow functions**: `const fn = (param) => result`
- **No mutations**: Use spread operators and array methods
- **Promise chains**: `.then().catch()` over async/await where appropriate
- **No blank lines**: Keep code compact
- **No comments**: Code should be self-documenting
- **Simple types**: Prefer primitive types in function signatures
- **Prefer types over interfaces**

### React Component Formatting

**One-line tags** (under 300 characters):
```typescript
<Button onClick={() => setEditingEntity(selected)} variant="outlined">Edit Entity</Button>
```

**Style props last**:
```typescript
<TextField value={x} onChange={y} label="Name" fullWidth margin="normal" sx={{ mt: 2 }} />
```

**Inline handlers**: Write handlers directly in JSX
```typescript
<IconButton onClick={() => deleteEntity({ id: entity.id }).then(() => refetch())} size="small">
```

**State scoping**: Use `<State>` render prop components to prevent unnecessary re-renders
```typescript
<State initialState={{ open: false }}>
  {({ state, setState }) => <Dialog open={state.open} />}
</State>
```

### Ternary Expression Rules

**Single-line components** (no brackets):
```typescript
condition ? <Component /> : <OtherComponent />
```

**Multi-line components** (brackets on same line as ? or :):
```typescript
condition ? (
  <Component>
    <Child />
  </Component>
) : <Alternative />
```

### tRPC Render Props Pattern

**NEVER use `any` type**. Always use proper type inference.

**Query component** (3 lines):
```typescript
const EntityQueries = ({ children }: { children: (props: { entities: NonNullable<ExtractTrpcOutput<typeof trpc.allEntities.useQuery>>; refetchEntities: () => void }) => React.ReactNode }) => {
  const entitiesQuery = trpc.allEntities.useQuery()
  return <>{children({ entities: entitiesQuery.data || [], refetchEntities: entitiesQuery.refetch })}</>
}
```

**Mutation component** (4 lines):
```typescript
const EntityMutations = ({ children }: { children: (props: { createEntity: ReturnType<typeof trpc.createEntity.useMutation>['mutateAsync']; updateEntity: ReturnType<typeof trpc.updateEntity.useMutation>['mutateAsync']; deleteEntity: ReturnType<typeof trpc.deleteEntity.useMutation>['mutateAsync']; isCreating: boolean; isUpdating: boolean; isDeleting: boolean }) => React.ReactNode }) => {
  const createMutation = trpc.createEntity.useMutation()
  const updateMutation = trpc.updateEntity.useMutation()
  const deleteMutation = trpc.deleteEntity.useMutation()
  return <>{children({ createEntity: createMutation.mutateAsync, updateEntity: updateMutation.mutateAsync, deleteEntity: deleteMutation.mutateAsync, isCreating: createMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending })}</>
}
```

**Type utilities**:
- Query arrays: `NonNullable<ExtractTrpcOutput<typeof trpc.allItems.useQuery>>`
- Array item: `NonNullable<ExtractTrpcOutput<typeof trpc.allItems.useQuery>>[number]`
- Optional item: `NonNullable<ExtractTrpcOutput<typeof trpc.allItems.useQuery>>[number] | null`
- Mutations: `ReturnType<typeof trpc.mutationName.useMutation>['mutateAsync']`

**Usage pattern**:
```typescript
<Queries>
  {({ data, refetch }) => (
    <Mutations>
      {({ mutate }) => (
        <State initialState={{}}>
          {({ state, setState }) => (
            // Component JSX
          )}
        </State>
      )}
    </Mutations>
  )}
</Queries>
```

### State Management

**Never use**:
- `React.useState` (use `<State>` component)
- `React.useCallback` (inline handlers)
- `React.useMemo` (not needed with render props)
- Local state for loading/error (use tRPC's built-in state)

**State component usage**:
```typescript
import { State } from '../components/State'

<State initialState={{ field: 'value' }}>
  {({ state, setState }) => (
    <TextField value={state.field} onChange={(e) => setState({ field: e.target.value })} />
  )}
</State>
```

## Common Mistakes

**Server:**
- ❌ **CRITICAL: Replacing entire files instead of requesting specific edits**
- ❌ Overwriting domain/index.ts instead of adding import + init + spread
- ❌ Overwriting services/db.ts instead of adding types + tables + operations
- ❌ Overwriting web/trpcRouter.ts instead of adding endpoints
- ❌ Missing auth in domain functions
- ❌ Business logic in DB layer
- ❌ Not understanding that files already exist with other content

**Client:**
- ❌ `any` type
- ❌ `useState`, `useCallback`, `useMemo`
- ❌ Blank lines, comments
- ❌ State mutation

**The #1 mistake: Suggesting complete file replacements when you should request incremental edits.**

## Understanding Wiring

**Flow:**
1. services/*.ts - Edit existing (db) or create new (APIs, integrations)
2. domain/newDomain.ts - New file for business logic
3. domain/index.ts - Edit to wire (init services, import domains, init domains with needed services, spread)
4. web/trpcRouter.ts - Edit to add endpoints
5. routes/page.tsx - New file (auto-detected by Vite)

**Key**: `domain/index.ts` initializes all services and combines all domains into single `domain` object for tRPC.

**Service patterns:**
- Database access (db.ts) - Usually edited, rarely need multiple
- External APIs (stripe.ts, sendgrid.ts) - Create new files as needed
- Infrastructure (cache.ts, storage.ts) - Create when needed
- Pass only needed services to each domain

## Workflow Summary

**When adding a new feature:**

1. **Create new files** for new functionality:
   - Domain file: `domain/yourFeatureDomain.ts` (NEW FILE)
   - Route file: `routes/yourFeature.tsx` (NEW FILE)
   - Service file: `services/yourService.ts` (NEW FILE - if needed)

2. **Request edits** to existing files for wiring:
   - `services/db.ts` - ADD types, tables, operations
   - `domain/index.ts` - ADD import, init, spread (3 separate edits)
   - `web/trpcRouter.ts` - ADD endpoints to router

3. **NEVER suggest replacing** these existing files:
   - `server/src/index.ts`
   - `server/src/services/db.ts`
   - `server/src/services/auth.ts`
   - `server/src/domain/index.ts`
   - `server/src/web/express.ts`
   - `server/src/web/trpcRouter.ts`

**Remember**: The project exists. You're extending it, not creating it.

## Quick Example

**Add notes feature with email notifications:**

1. **(Optional) CREATE** `services/emailSvc.ts` - New email integration service
2. **EDIT** `services/db.ts` - ADD Note type, table creation, CRUD operations
3. **CREATE** `domain/notesDomain.ts` - New domain file with auth + business logic
4. **EDIT** `domain/index.ts` - Three edits: ADD import, ADD init, ADD spread
5. **EDIT** `web/trpcRouter.ts` - ADD note endpoints to existing router
6. **CREATE** `routes/notes.tsx` - New UI file

**Notice**: Steps 1, 3, 6 are NEW files. Steps 2, 4, 5 are EDITS to existing files.

**Never:**
- Use `any`
- Use React hooks directly
- Add unneeded blank lines
- Write comments
- Suggest an overwrite to an existing files
