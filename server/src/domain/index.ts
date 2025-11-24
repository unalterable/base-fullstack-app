
import { initAuthSvc } from '../services/auth'
import { initDbSvc } from '../services/db'
import { initTaskDomain } from './taskDomain'
import { initBookmarksDomain } from './bookmarksDomain'

export const initDomain = async () => {
  const dbSvc = await initDbSvc(process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/fullstack_db')
  const authSvc = initAuthSvc()
  const taskDomain = initTaskDomain(authSvc, dbSvc)
  const bookmarksDomain = initBookmarksDomain(authSvc, dbSvc)
  return {
    ...taskDomain,
    ...bookmarksDomain,
  }
}
export type Domain = Awaited<ReturnType<typeof initDomain>>