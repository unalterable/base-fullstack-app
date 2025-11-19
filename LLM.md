# LLM Development Guidelines

## Project Overview

This is a full-stack TypeScript application using PostgreSQL, tRPC, React, TanStack Router, and Material-UI. The architecture follows a strict layered approach with functional programming principles and consistent formatting standards.

## Architecture Layers

```
server/
├── src/
│   ├── index.ts          # Entry point - initializes and wires domains
│   ├── services/         # Database and infrastructure services
│   │   ├── db.ts         # PostgreSQL CRUD operations
│   │   └── auth.ts       # Authentication service
│   ├── domain/           # Business logic with authentication
│   └── web/              # Express and tRPC routing
│       ├── express.ts    # Express server initialization
│       └── trpcRouter.ts # tRPC endpoint definitions

client/
├── src/
│   ├── app.tsx           # React app setup and rendering
│   ├── trpc.ts           # tRPC client and type utilities
│   ├── components/       # Reusable React components
│   │   └── State.tsx     # State render prop component
│   └── routes/           # TanStack Router file-based routes
│       ├── __root.tsx    # Root layout
│       └── index.tsx     # Route components
```

## Stack Layers

1. **Database Layer** - PostgreSQL with functional CRUD operations
2. **Domain Layer** - Business logic with authentication checks
3. **API Layer** - tRPC endpoints with Zod validation
4. **Frontend Layer** - React components with TanStack Router and MUI

## Adding New Functionality

### 1. Database Layer (services/db.ts)

Define types and add to service return object:

```typescript
type NewEntity = { id: string; field1: string; field2: number; createdBy: string; createdAt: string }

// In initDbSvc function, add table creation:
await pool.query(`
  CREATE TABLE IF NOT EXISTS new_entities (
    id SERIAL PRIMARY KEY,
    field1 VARCHAR(255) NOT NULL,
    field2 INTEGER NOT NULL,
    created_by VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  )
`)
await pool.query('CREATE INDEX IF NOT EXISTS idx_new_entities_created_at ON new_entities(created_at)')

// Add mapper function:
const mapNewEntity = (row: any): NewEntity => ({ id: row.id.toString(), field1: row.field1, field2: row.field2, createdBy: row.created_by, createdAt: row.created_at.toISOString() })

// Add CRUD operations to return object:
getAllNewEntities: () => pool.query('SELECT * FROM new_entities ORDER BY created_at DESC').then(res => res.rows.map(mapNewEntity)),
getNewEntityById: (id: string) => pool.query('SELECT * FROM new_entities WHERE id = $1', [id]).then(res => res.rows.length > 0 ? mapNewEntity(res.rows[0]) : undefined),
createNewEntity: (field1: string, field2: number, createdBy: string) => pool.query('INSERT INTO new_entities (field1, field2, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [field1, field2, createdBy, new Date()]).then(res => mapNewEntity(res.rows[0])),
updateNewEntity: (id: string, updates: Partial<{ field1: string; field2: number }>) => {
  const fields: string[] = []
  const values: any[] = []
  let idx = 1
  if (updates.field1 !== undefined) { fields.push(`field1 = $${idx++}`); values.push(updates.field1) }
  if (updates.field2 !== undefined) { fields.push(`field2 = $${idx++}`); values.push(updates.field2) }
  values.push(id)
  return pool.query(`UPDATE new_entities SET ${fields.join(', ')} WHERE id = $${idx}`, values).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No entity found with id ${id}`)))
},
deleteNewEntity: (id: string) => pool.query('DELETE FROM new_entities WHERE id = $1', [id]).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No entity found with id ${id}`))),
```

**Database Standards:**
- Use parameterized queries ($1, $2) to prevent SQL injection
- Return promises for all operations
- Use functional .then() chains instead of async/await
- Map database rows to clean external types
- Handle errors with descriptive messages
- Create indexes for frequently queried fields

### 2. Domain Layer (domain/newEntityDomain.ts)

Create new domain file:

```typescript
import { DbSvc } from '../services/db.js'
import { AuthSvc } from '../services/auth.js'

export const initNewEntityDomain = (authSvc: AuthSvc, dbSvc: DbSvc) => ({
  getAllNewEntities: async (token: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.getAllNewEntities()
  },
  getNewEntityById: async (token: string, id: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.getNewEntityById(id)
  },
  createNewEntity: async (token: string, field1: string, field2: number) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.createNewEntity(field1, field2, user.username)
  },
  updateNewEntity: async (token: string, id: string, field1?: string, field2?: number) => {
    await authSvc.authenticateUserToken(token)
    const updates = { ...(field1 !== undefined ? { field1 } : {}), ...(field2 !== undefined ? { field2 } : {}) }
    return dbSvc.updateNewEntity(id, updates)
  },
  deleteNewEntity: async (token: string, id: string) => {
    await authSvc.authenticateUserToken(token)
    return dbSvc.deleteNewEntity(id)
  }
})

export type NewEntityDomain = ReturnType<typeof initNewEntityDomain>
```

Wire up in `index.ts`:

```typescript
import { initNewEntityDomain } from './domain/newEntityDomain.js'

const newEntityDomain = initNewEntityDomain(authSvc, dbSvc)
await initExpress(taskDomain, newEntityDomain) // Pass to express
```

**Domain Standards:**
- Always authenticate first before any database operations
- Pass authenticated user info to database layer
- Use simple parameter lists with primitive types
- Return domain objects directly from database layer
- Let errors bubble up to API layer

### 3. tRPC API Layer (web/trpcRouter.ts)

Add endpoints (one line each):

```typescript
allNewEntities: t.procedure.query(({ ctx }) => newEntityDomain.getAllNewEntities(ctx.token)),
newEntityById: t.procedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => newEntityDomain.getNewEntityById(ctx.token, input.id)),
createNewEntity: t.procedure.input(z.object({ field1: z.string(), field2: z.number() })).mutation(({ ctx, input }) => newEntityDomain.createNewEntity(ctx.token, input.field1, input.field2).then(() => 'OK')),
updateNewEntity: t.procedure.input(z.object({ id: z.string(), field1: z.string().optional(), field2: z.number().optional() })).mutation(({ ctx, input }) => newEntityDomain.updateNewEntity(ctx.token, input.id, input.field1, input.field2).then(() => 'OK')),
deleteNewEntity: t.procedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => newEntityDomain.deleteNewEntity(ctx.token, input.id).then(() => 'OK')),
```

**tRPC Standards:**
- One line per endpoint definition
- Use Zod schemas for input validation
- Queries return data directly, mutations return 'OK'
- Let domain layer errors propagate naturally
- Keep endpoint logic minimal - delegate to domain

### 4. Frontend Layer (routes/yourRoute.tsx)

Create route component with render prop patterns:

```typescript
import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton } from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { trpc, ExtractTrpcOutput } from '../trpc'
import { State } from '../components/State'

const NewEntityQueries = ({ children }: { children: (props: { entities: NonNullable<ExtractTrpcOutput<typeof trpc.allNewEntities.useQuery>>; refetchEntities: () => void }) => React.ReactNode }) => {
  const entitiesQuery = trpc.allNewEntities.useQuery()
  return <>{children({ entities: entitiesQuery.data || [], refetchEntities: entitiesQuery.refetch })}</>
}

const NewEntityMutations = ({ children }: { children: (props: { createEntity: ReturnType<typeof trpc.createNewEntity.useMutation>['mutateAsync']; updateEntity: ReturnType<typeof trpc.updateNewEntity.useMutation>['mutateAsync']; deleteEntity: ReturnType<typeof trpc.deleteNewEntity.useMutation>['mutateAsync']; isCreating: boolean; isUpdating: boolean; isDeleting: boolean }) => React.ReactNode }) => {
  const createMutation = trpc.createNewEntity.useMutation()
  const updateMutation = trpc.updateNewEntity.useMutation()
  const deleteMutation = trpc.deleteNewEntity.useMutation()
  return <>{children({ createEntity: createMutation.mutateAsync, updateEntity: updateMutation.mutateAsync, deleteEntity: deleteMutation.mutateAsync, isCreating: createMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending })}</>
}

const EntityManager = () => (
  <NewEntityQueries>
    {({ entities, refetchEntities }) => (
      <NewEntityMutations>
        {({ createEntity, updateEntity, deleteEntity }) => (
          <State initialState={{ modalOpen: false, editingEntity: null as NonNullable<ExtractTrpcOutput<typeof trpc.allNewEntities.useQuery>>[number] | null }}>
            {({ state: mainState, setState: setMainState }) => (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h4">Entity Manager</Typography>
                  <Button onClick={() => setMainState({ modalOpen: true, editingEntity: null })} variant="contained" startIcon={<Add />}>Add Entity</Button>
                </Box>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Field 1</TableCell>
                      <TableCell>Field 2</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {entities.map((entity) => (
                      <TableRow key={entity.id}>
                        <TableCell>{entity.field1}</TableCell>
                        <TableCell>{entity.field2}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => setMainState({ editingEntity: entity, modalOpen: true })} size="small"><Edit /></IconButton>
                          <IconButton onClick={() => deleteEntity({ id: entity.id }).then(() => refetchEntities())} size="small" color="error"><Delete /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Dialog open={mainState.modalOpen} onClose={() => setMainState({ modalOpen: false })} maxWidth="sm" fullWidth>
                  <State initialState={{ field1: mainState.editingEntity?.field1 || '', field2: mainState.editingEntity?.field2?.toString() || '' }}>
                    {({ state, setState }) => (
                      <>
                        <DialogTitle>{mainState.editingEntity ? 'Edit Entity' : 'Add New Entity'}</DialogTitle>
                        <DialogContent>
                          <TextField value={state.field1} onChange={(e) => setState({ field1: e.target.value })} label="Field 1" fullWidth margin="normal" />
                          <TextField value={state.field2} onChange={(e) => setState({ field2: e.target.value })} label="Field 2" type="number" fullWidth margin="normal" />
                        </DialogContent>
                        <DialogActions>
                          <Button onClick={() => setMainState({ modalOpen: false })}>Cancel</Button>
                          <Button onClick={() => { const field2Value = parseFloat(state.field2); (mainState.editingEntity ? updateEntity({ id: mainState.editingEntity.id, field1: state.field1, field2: field2Value }) : createEntity({ field1: state.field1, field2: field2Value })).then(() => { refetchEntities(); setMainState({ modalOpen: false }) }) }} variant="contained" disabled={!state.field1 || !state.field2}>{mainState.editingEntity ? 'Update' : 'Add'}</Button>
                        </DialogActions>
                      </>
                    )}
                  </State>
                </Dialog>
              </Box>
            )}
          </State>
        )}
      </NewEntityMutations>
    )}
  </NewEntityQueries>
)

export const Route = createFileRoute('/entity-manager')({ component: EntityManager })
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

## File Structure Patterns

### Server Files

**index.ts** - Entry point only, no business logic:
```typescript
import { initDbSvc } from './services/db.js'
import { initAuthSvc } from './services/auth.js'
import { initEntityDomain } from './domain/entityDomain.js'
import { initExpress } from './web/express.js'

const start = async () => {
  const dbSvc = await initDbSvc(process.env.DATABASE_URL || 'postgresql://...')
  const authSvc = initAuthSvc()
  const entityDomain = initEntityDomain(authSvc, dbSvc)
  await initExpress(entityDomain)
}

start().catch(console.error)
```

**services/db.ts** - Pure database operations:
- No business logic
- Return promises
- Map database types to external types
- Handle errors with descriptive messages

**domain/*.ts** - Business logic:
- Authentication first
- Call database service
- Simple parameters
- Export domain type

**web/trpcRouter.ts** - API endpoints:
- One line per endpoint
- Zod validation
- Delegate to domain
- No business logic

**web/express.ts** - Server setup:
- Initialize Express
- Setup middleware
- Create tRPC router
- Start server

### Client Files

**app.tsx** - Single entry point:
- React root
- QueryClient setup
- tRPC client setup
- Router provider

**trpc.ts** - tRPC client config:
- Create tRPC React client
- Export `ExtractTrpcOutput` type utility
- No other logic

**components/State.tsx** - State render prop:
- Generic state management
- Prevents unnecessary re-renders
- No modifications needed

**routes/*.tsx** - Route components:
- Query render props at top
- Mutation render props second
- State management third
- Single export with `createFileRoute`

## Common Mistakes to Avoid

### Server Side
- ❌ Business logic in database layer
- ❌ Database calls in tRPC router
- ❌ Express imports in index.ts
- ❌ Missing authentication in domain layer
- ❌ Complex types in function signatures

### Client Side
- ❌ Using `any` type anywhere
- ❌ Direct use of `useState`, `useCallback`, `useMemo`
- ❌ Extracting handlers unnecessarily
- ❌ Multiple line breaks or blank lines
- ❌ Comments in code
- ❌ Mutating state directly
- ❌ Using `onSuccess`/`onError` in render prop components

## Type Safety Checklist

When you see `any`:
1. Query results → `ExtractTrpcOutput<typeof trpc.query.useQuery>`
2. Arrays → Wrap with `NonNullable<...>`
3. Array items → Add `[number]`
4. Optional items → Add `| null`
5. Mutations → `ReturnType<typeof trpc.mutation.useMutation>['mutateAsync']`

## Example: Adding a Notes Feature

**1. Database** (`services/db.ts`):
- Add `Note` type
- Create `notes` table with indexes
- Add CRUD functions to return object

**2. Domain** (`domain/notesDomain.ts`):
- Create `initNotesDomain`
- Add authentication to all functions
- Export `NotesDomain` type

**3. Wire up** (`index.ts`):
- Initialize `notesDomain`
- Pass to `initExpress`

**4. tRPC** (`web/trpcRouter.ts`):
- Add one-line endpoints
- Use Zod validation
- Return 'OK' for mutations

**5. Frontend** (`routes/notes.tsx`):
- Create `NoteQueries` render prop
- Create `NoteMutations` render prop
- Build component with `<State>`
- Export with `createFileRoute`

Each layer follows established patterns, ensuring consistency across the entire stack.