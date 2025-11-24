import { DbSvc } from '../services/db.js'
import { AuthSvc } from '../services/auth.js'

export const initBookmarksDomain = (authSvc: AuthSvc, dbSvc: DbSvc) => ({
  getAllBookmarks: async (token: string, tag?: string, query?: string) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.getAllBookmarks(user.username, tag, query)
  },
  getBookmarkById: async (token: string, id: string) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.getBookmarkById(id, user.username)
  },
  createBookmark: async (token: string, title: string, url: string, tags: string[]) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.createBookmark(title, url, tags, user.username)
  },
  updateBookmark: async (token: string, id: string, title: string, url: string, tags: string[]) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.updateBookmark(id, title, url, tags, user.username)
  },
  deleteBookmark: async (token: string, id: string) => {
    const user = await authSvc.authenticateUserToken(token)
    return dbSvc.deleteBookmark(id, user.username)
  },
})

export type BookmarksDomain = ReturnType<typeof initBookmarksDomain>