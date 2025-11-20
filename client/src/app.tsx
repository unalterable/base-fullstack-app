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
  const [trpcClient] = React.useState(() => trpc.createClient({
    links: [httpBatchLink({
      url: 'http://localhost:3001/trpc',
      headers: () => ({ authorization: 'Bearer demo-token' })
    })]
  }))
  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>
        <RouterProvider router={router} />
      </QueryClientProvider>
    </trpc.Provider>
  )
}

ReactDOM.createRoot(document.getElementById('root')!).render(<React.StrictMode><App /></React.StrictMode>)
