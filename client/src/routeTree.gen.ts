import { Route as rootRoute } from './routes/__root'
import { Route as IndexRoute } from './routes/index'

const IndexRouteWithChildren = IndexRoute

const rootRouteWithChildren = rootRoute._addFileChildren({ IndexRoute: IndexRouteWithChildren })

export const routeTree = rootRouteWithChildren
