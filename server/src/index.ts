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
