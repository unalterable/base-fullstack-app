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
    deleteTask: t.procedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => domain.deleteTask(ctx.token, input.id).then(() => 'OK')),
    allBookmarks: t.procedure.input(z.object({ tag: z.string().optional(), query: z.string().optional() })).query(({ ctx, input }) => domain.getAllBookmarks(ctx.token, input.tag, input.query)),
    bookmarkById: t.procedure.input(z.object({ id: z.string() })).query(({ ctx, input }) => domain.getBookmarkById(ctx.token, input.id)),
    createBookmark: t.procedure.input(z.object({ title: z.string(), url: z.string(), tags: z.string().array() })).mutation(({ ctx, input }) => domain.createBookmark(ctx.token, input.title, input.url, input.tags).then(() => 'OK')),
    updateBookmark: t.procedure.input(z.object({ id: z.string(), title: z.string(), url: z.string(), tags: z.string().array() })).mutation(({ ctx, input }) => domain.updateBookmark(ctx.token, input.id, input.title, input.url, input.tags).then(() => 'OK')),
    deleteBookmark: t.procedure.input(z.object({ id: z.string() })).mutation(({ ctx, input }) => domain.deleteBookmark(ctx.token, input.id).then(() => 'OK'))
  })
}

export type TrpcRouter = ReturnType<typeof createTrpcRouter>
