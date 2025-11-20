import { initTRPC } from '@trpc/server'
import { z } from 'zod'
import { Domain } from '../domain'

type Context = { token: string }

export const createTrpcRouter = (domain: Domain) => {
  const t = initTRPC.context<Context>().create()
  return t.router({
    allTasks: t.procedure.query(({ ctx }) => domain.getAllTasks(ctx.token)),
    taskById: t.procedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => domain.getTaskById(ctx.token, input.id)),
    createTask: t.procedure.input(z.object({ title: z.string(), description: z.string() })).mutation(({ ctx, input }) => domain.createTask(ctx.token, input.title, input.description).then(() => 'OK')),
    updateTask: t.procedure.input(z.object({ id: z.string(), title: z.string().optional(), description: z.string().optional(), completed: z.boolean().optional() })).mutation(({ ctx, input }) => domain.updateTask(ctx.token, input.id, input.title, input.description, input.completed).then(() => 'OK')),
    deleteTask: t.procedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => domain.deleteTask(ctx.token, input.id).then(() => 'OK'))
  })
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
