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
