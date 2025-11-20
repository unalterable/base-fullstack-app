import { createTRPCReact, TRPCClientErrorLike } from '@trpc/react-query'
import type { TrpcRouter } from '../../server/src/web/trpcRouter'

export const trpc = createTRPCReact<TrpcRouter>()

export type ExtractTrpcOutput<T> = T extends (
  ...args: any[]
) => {
  error: infer E | null | undefined
} ? E extends { data?: { code: string; path?: string; output?: infer O } }
  ? O | undefined
  : E extends TRPCClientErrorLike<infer Router>
  ? Router extends { output: infer O }
  ? O | undefined
  : never
  : never
  : never