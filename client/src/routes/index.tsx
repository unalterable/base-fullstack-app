import React from 'react'
import { createFileRoute } from '@tanstack/react-router'
import { Box, Typography, Button, Table, TableHead, TableRow, TableCell, TableBody, Dialog, DialogTitle, DialogContent, DialogActions, TextField, IconButton, Checkbox } from '@mui/material'
import { Add, Edit, Delete } from '@mui/icons-material'
import { trpc, ExtractTrpcOutput } from '../trpc'
import { State } from '../components/State'

const TaskQueries = ({ children }: { children: (props: { tasks: NonNullable<ExtractTrpcOutput<typeof trpc.allTasks.useQuery>>; refetchTasks: () => void }) => React.ReactNode }) => {
  const tasksQuery = trpc.allTasks.useQuery()
  return <>{children({ tasks: tasksQuery.data || [], refetchTasks: tasksQuery.refetch })}</>
}

const TaskMutations = ({ children }: { children: (props: { createTask: ReturnType<typeof trpc.createTask.useMutation>['mutateAsync']; updateTask: ReturnType<typeof trpc.updateTask.useMutation>['mutateAsync']; deleteTask: ReturnType<typeof trpc.deleteTask.useMutation>['mutateAsync']; isCreating: boolean; isUpdating: boolean; isDeleting: boolean }) => React.ReactNode }) => {
  const createMutation = trpc.createTask.useMutation()
  const updateMutation = trpc.updateTask.useMutation()
  const deleteMutation = trpc.deleteTask.useMutation()
  return <>{children({ createTask: createMutation.mutateAsync, updateTask: updateMutation.mutateAsync, deleteTask: deleteMutation.mutateAsync, isCreating: createMutation.isPending, isUpdating: updateMutation.isPending, isDeleting: deleteMutation.isPending })}</>
}

const TaskManager = () => (
  <TaskQueries>
    {({ tasks, refetchTasks }) => (
      <TaskMutations>
        {({ createTask, updateTask, deleteTask }) => (
          <State initialState={{ modalOpen: false, editingTask: null as NonNullable<ExtractTrpcOutput<typeof trpc.allTasks.useQuery>>[number] | null }}>
            {({ state: mainState, setState: setMainState }) => (
              <Box sx={{ p: 3 }}>
                <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 3 }}>
                  <Typography variant="h4">Task Manager</Typography>
                  <Button onClick={() => setMainState({ modalOpen: true, editingTask: null })} variant="contained" startIcon={<Add />}>Add Task</Button>
                </Box>
                <Table>
                  <TableHead>
                    <TableRow>
                      <TableCell>Completed</TableCell>
                      <TableCell>Title</TableCell>
                      <TableCell>Description</TableCell>
                      <TableCell align="right">Actions</TableCell>
                    </TableRow>
                  </TableHead>
                  <TableBody>
                    {tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell><Checkbox checked={task.completed} onChange={(e) => updateTask({ id: task.id, completed: e.target.checked }).then(() => refetchTasks())} /></TableCell>
                        <TableCell>{task.title}</TableCell>
                        <TableCell>{task.description}</TableCell>
                        <TableCell align="right">
                          <IconButton onClick={() => setMainState({ editingTask: task, modalOpen: true })} size="small"><Edit /></IconButton>
                          <IconButton onClick={() => deleteTask({ id: task.id }).then(() => refetchTasks())} size="small" color="error"><Delete /></IconButton>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                <Dialog open={mainState.modalOpen} onClose={() => setMainState({ modalOpen: false })} maxWidth="sm" fullWidth>
                  <State initialState={{ title: mainState.editingTask?.title || '', description: mainState.editingTask?.description || '' }}>
                    {({ state, setState }) => (
                      <>
                        <DialogTitle>{mainState.editingTask ? 'Edit Task' : 'Add New Task'}</DialogTitle>
                        <DialogContent>
                          <TextField value={state.title} onChange={(e) => setState({ title: e.target.value })} label="Title" fullWidth margin="normal" />
                          <TextField value={state.description} onChange={(e) => setState({ description: e.target.value })} label="Description" fullWidth margin="normal" multiline rows={3} />
                        </DialogContent>
                        <DialogActions>
                          <Button onClick={() => setMainState({ modalOpen: false })}>Cancel</Button>
                          <Button onClick={() => { (mainState.editingTask ? updateTask({ id: mainState.editingTask.id, title: state.title, description: state.description }) : createTask({ title: state.title, description: state.description })).then(() => { refetchTasks(); setMainState({ modalOpen: false }) }) }} variant="contained" disabled={!state.title || !state.description}>{mainState.editingTask ? 'Update' : 'Add'}</Button>
                        </DialogActions>
                      </>
                    )}
                  </State>
                </Dialog>
              </Box>
            )}
          </State>
        )}
      </TaskMutations>
    )}
  </TaskQueries>
)

export const Route = createFileRoute('/')({ component: TaskManager })
