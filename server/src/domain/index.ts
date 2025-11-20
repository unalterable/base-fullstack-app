
import { initAuthSvc } from '../services/auth'
import { initDbSvc } from '../services/db'
import { initTaskDomain } from './taskDomain'

export const initDomain = async () => {
  const dbSvc = await initDbSvc(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fullstack_db')
  const authSvc = initAuthSvc()
  const taskDomain = initTaskDomain(authSvc, dbSvc)
  return {
    ...taskDomain,
  }
}
export type Domain = Awaited<ReturnType<typeof initDomain>>