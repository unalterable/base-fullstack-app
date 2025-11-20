import { initExpress } from './web/express'
import { initDomain } from './domain/index'

const start = async () => {
  const domain = await initDomain()
  await initExpress(domain)
}

start().catch(console.error)
