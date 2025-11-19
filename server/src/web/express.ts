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
