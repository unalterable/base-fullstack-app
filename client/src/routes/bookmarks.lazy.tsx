import React from 'react'
import { createLazyFileRoute } from '@tanstack/react-router'
import { Box, Button, TextField, Table, TableBody, TableCell, TableHead, TableRow, IconButton, Dialog, DialogTitle, DialogContent, DialogActions, Chip, FormControl, InputLabel, Select, MenuItem } from '@mui/material'
import { Add, Delete, Edit, Search } from '@mui/icons-material'
import { trpc, ExtractTrpcOutput } from '../trpc'
import { State } from '../components/State'

const BookmarkQueries = ({ children }: { children: (props: { bookmarks: NonNullable<ExtractTrpcOutput<typeof trpc.allBookmarks.useQuery>>; refetch: () => void }) => React.ReactNode }) => {
  const query = trpc.allBookmarks.useQuery({})
  return <>{children({ bookmarks: query.data || [], refetch: query.refetch })}</>
}

const BookmarkMutations = ({ children }: { children: (props: { create: ReturnType<typeof trpc.createBookmark.useMutation>['mutateAsync']; update: ReturnType<typeof trpc.updateBookmark.useMutation>['mutateAsync']; delete: ReturnType<typeof trpc.deleteBookmark.useMutation>['mutateAsync'] }) => React.ReactNode }) => {
  const createMut = trpc.createBookmark.useMutation()
  const updateMut = trpc.updateBookmark.useMutation()
  const deleteMut = trpc.deleteBookmark.useMutation()
  return <>{children({ create: createMut.mutateAsync, update: updateMut.mutateAsync, delete: deleteMut.mutateAsync })}</>
}

const Bookmarks = () => (
  <BookmarkQueries>
    {({ bookmarks, refetch }) => (
      <BookmarkMutations>
        {({ create, update, delete: del }) => (
          <State initialState={{ createModalOpen: false, editModalOpen: false, selectedBookmark: null as any, title: '', url: '', tags: '', searchQuery: '', filterTag: '' }}>
            {({ state, setState }) => {
              const filteredBookmarks = bookmarks.filter(bookmark => {
                const matchesSearch = !state.searchQuery || bookmark.title.toLowerCase().includes(state.searchQuery.toLowerCase()) || bookmark.url.toLowerCase().includes(state.searchQuery.toLowerCase())
                const matchesTag = !state.filterTag || bookmark.tags.includes(state.filterTag)
                return matchesSearch && matchesTag
              })

              const allTags = Array.from(new Set(bookmarks.flatMap(b => b.tags))).sort()

              return (
                <Box sx={{ p: 3 }}>
                  <Box sx={{ mb: 3, display: 'flex', gap: 2, alignItems: 'center' }}>
                    <Button onClick={() => setState({ createModalOpen: true, title: '', url: '', tags: '' })} startIcon={<Add />} variant="contained">Add Bookmark</Button>
                    <TextField placeholder="Search bookmarks..." value={state.searchQuery} onChange={(e) => setState({ searchQuery: e.target.value })} sx={{ minWidth: 200 }} InputProps={{ startAdornment: <Search sx={{ mr: 1, color: 'text.secondary' }} /> }} />
                    <FormControl sx={{ minWidth: 120 }}>
                      <InputLabel>Filter by tag</InputLabel>
                      <Select value={state.filterTag} onChange={(e) => setState({ filterTag: e.target.value })} label="Filter by tag">
                        <MenuItem value="">All</MenuItem>
                        {allTags.map(tag => <MenuItem key={tag} value={tag}>{tag}</MenuItem>)}
                      </Select>
                    </FormControl>
                  </Box>

                  <Table>
                    <TableHead>
                      <TableRow>
                        <TableCell>Title</TableCell>
                        <TableCell>URL</TableCell>
                        <TableCell>Tags</TableCell>
                        <TableCell>Created</TableCell>
                        <TableCell align="right">Actions</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {filteredBookmarks.map((bookmark) => (
                        <TableRow key={bookmark.id}>
                          <TableCell>{bookmark.title}</TableCell>
                          <TableCell><a href={bookmark.url} target="_blank" rel="noopener noreferrer" style={{ color: 'inherit', textDecoration: 'none' }}>{bookmark.url}</a></TableCell>
                          <TableCell>
                            <Box sx={{ display: 'flex', gap: 0.5, flexWrap: 'wrap' }}>
                              {bookmark.tags.map(tag => <Chip key={tag} label={tag} size="small" />)}
                            </Box>
                          </TableCell>
                          <TableCell>{new Date(bookmark.createdAt).toLocaleDateString()}</TableCell>
                          <TableCell align="right">
                            <IconButton onClick={() => setState({ editModalOpen: true, selectedBookmark: bookmark, title: bookmark.title, url: bookmark.url, tags: bookmark.tags.join(', ') })} size="small"><Edit /></IconButton>
                            <IconButton onClick={() => del({ id: bookmark.id }).then(() => refetch())} size="small"><Delete /></IconButton>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>

                  <Dialog open={state.createModalOpen} onClose={() => setState({ createModalOpen: false })} maxWidth="sm" fullWidth>
                    <DialogTitle>Add New Bookmark</DialogTitle>
                    <DialogContent>
                      <TextField label="Title" value={state.title} onChange={(e) => setState({ title: e.target.value })} fullWidth margin="normal" />
                      <TextField label="URL" value={state.url} onChange={(e) => setState({ url: e.target.value })} fullWidth margin="normal" />
                      <TextField label="Tags (comma-separated)" value={state.tags} onChange={(e) => setState({ tags: e.target.value })} fullWidth margin="normal" />
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setState({ createModalOpen: false })}>Cancel</Button>
                      <Button onClick={() => create({ title: state.title, url: state.url, tags: state.tags.split(',').map(t => t.trim()).filter(t => t) }).then(() => { refetch(); setState({ createModalOpen: false }) })} variant="contained">Create</Button>
                    </DialogActions>
                  </Dialog>

                  <Dialog open={state.editModalOpen} onClose={() => setState({ editModalOpen: false })} maxWidth="sm" fullWidth>
                    <DialogTitle>Edit Bookmark</DialogTitle>
                    <DialogContent>
                      <TextField label="Title" value={state.title} onChange={(e) => setState({ title: e.target.value })} fullWidth margin="normal" />
                      <TextField label="URL" value={state.url} onChange={(e) => setState({ url: e.target.value })} fullWidth margin="normal" />
                      <TextField label="Tags (comma-separated)" value={state.tags} onChange={(e) => setState({ tags: e.target.value })} fullWidth margin="normal" />
                    </DialogContent>
                    <DialogActions>
                      <Button onClick={() => setState({ editModalOpen: false })}>Cancel</Button>
                      <Button onClick={() => update({ id: state.selectedBookmark.id, title: state.title, url: state.url, tags: state.tags.split(',').map(t => t.trim()).filter(t => t) }).then(() => { refetch(); setState({ editModalOpen: false }) })} variant="contained">Update</Button>
                    </DialogActions>
                  </Dialog>
                </Box>
              )
            }}
          </State>
        )}
      </BookmarkMutations>
    )}
  </BookmarkQueries>
)

export const Route = createLazyFileRoute('/bookmarks')({ component: Bookmarks })