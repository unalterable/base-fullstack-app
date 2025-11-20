import { DbSvc } from '../services/db'
import { AuthSvc } from '../services/auth'

export const initTaskDomain = (authSvc: AuthSvc, dbSvc: DbSvc) => ({
  getAllTasks: async (token: string) =>
    authSvc.authenticateUserToken(token)
      .then(() => dbSvc.getAllTasks()),
  getTaskById: async (token: string, id: string) =>
    authSvc.authenticateUserToken(token)
      .then(() => dbSvc.getTaskById(id)),
  createTask: async (token: string, title: string, description: string) =>
    authSvc.authenticateUserToken(token)
      .then(user => dbSvc.createTask({ title, description, createdBy: user.username })),
  updateTask: async (token: string, id: string, title?: string, description?: string, completed?: boolean) =>
    authSvc.authenticateUserToken(token)
      .then(() => dbSvc.updateTask(id, {
        ...(title !== undefined ? { title } : {}),
        ...(description !== undefined ? { description } : {}),
        ...(completed !== undefined ? { completed } : {})
      })),
  deleteTask: async (token: string, id: string) =>
    authSvc.authenticateUserToken(token)
      .then(() => dbSvc.deleteTask(id)),
})

export type TaskDomain = ReturnType<typeof initTaskDomain>
