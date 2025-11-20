import express from 'express'
import cors from 'cors'
import { createExpressMiddleware } from '@trpc/server/adapters/express'
import { createTrpcRouter } from './trpcRouter'
import { Domain } from '../domain'

export const initExpress = (domain: Domain) => {
  const trpcRouter = createTrpcRouter(domain)
  const app = express()
  app.use(cors())
  app.use('/trpc', createExpressMiddleware({ router: trpcRouter, createContext: ({ req }) => ({ token: req.headers.authorization?.replace('Bearer ', '') || '' }) }))
  const port = process.env.PORT || 3001
  app.listen(port, () => console.log(`Server running on port ${port}`))
}
