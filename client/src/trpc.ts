import { createTRPCReact } from '@trpc/react-query'
import type { TrpcRouter } from '../../server/src/web/trpcRouter'

export const trpc = createTRPCReact<TrpcRouter>()

export type ExtractTrpcOutput<T> = T extends (...args: any[]) => { error: infer E | null | undefined } ? E extends { data?: { code: string; path?: string; output?: infer O } } ? O | undefined : E extends { shape?: { data?: infer O } } ? O | undefined : never : never
