export const initAuthSvc = () => ({
  authenticateUserToken: (token: string) => {
    if (!token) return Promise.reject(new Error('No token provided'))
    if (token === 'demo-token') return Promise.resolve({ username: 'demo-user' })
    return Promise.reject(new Error('Invalid token'))
  }
})

export type AuthSvc = ReturnType<typeof initAuthSvc>
