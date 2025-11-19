import React from 'react'
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { CssBaseline, ThemeProvider, createTheme } from '@mui/material'

const theme = createTheme()

export const Route = createRootRoute({
  component: () => (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Outlet />
    </ThemeProvider>
  )
})
