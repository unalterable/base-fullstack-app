import pg from 'pg'
const { Pool } = pg

type Task = { id: string; title: string; description: string; completed: boolean; createdBy: string; createdAt: string }
type TaskInput = { title: string; description: string; createdBy: string }
type Bookmark = { id: string; title: string; url: string; tags: string[]; createdAt: string; createdBy: string }

export const initDbSvc = async (connectionString: string) => {
  const pool = new Pool({ connectionString })
  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      title VARCHAR(255) NOT NULL,
      description TEXT,
      completed BOOLEAN DEFAULT FALSE,
      created_by VARCHAR(255) NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    )
    `)
  await pool.query(`
    CREATE TABLE IF NOT EXISTS bookmarks (
    id SERIAL PRIMARY KEY, 
    title TEXT NOT NULL, 
    url TEXT NOT NULL, 
    tags TEXT[] DEFAULT '{}', 
    created_at TIMESTAMPTZ DEFAULT NOW(), 
    created_by TEXT NOT NULL)
    `)
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_created_by ON bookmarks(created_by)')
  await pool.query('CREATE INDEX IF NOT EXISTS idx_bookmarks_tags ON bookmarks USING GIN(tags)')

  const mapToExternal = (row: any): Task => ({ id: row.id.toString(), title: row.title, description: row.description, completed: row.completed, createdBy: row.created_by, createdAt: row.created_at.toISOString() })
  const mapBookmark = (row: any): Bookmark => ({ id: row.id.toString(), title: row.title, url: row.url, tags: row.tags || [], createdAt: row.created_at, createdBy: row.created_by })

  return {
    getAllTasks: () =>
      pool.query('SELECT * FROM tasks ORDER BY created_at DESC')
        .then(res => res.rows.map(mapToExternal)),
    getTaskById: (id: string) =>
      pool.query('SELECT * FROM tasks WHERE id = $1', [id])
        .then(res => res.rows.length > 0 ? mapToExternal(res.rows[0]) : undefined),
    createTask: (input: TaskInput) =>
      pool.query('INSERT INTO tasks (title, description, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [input.title, input.description, input.createdBy, new Date()])
        .then(res => mapToExternal(res.rows[0])),
    updateTask: (id: string, updates: Partial<{ title: string; description: string; completed: boolean }>) => {
      const fields: string[] = []
      const values: any[] = []
      let idx = 1
      if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title) }
      if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description) }
      if (updates.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(updates.completed) }
      values.push(id)
      return pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx}`, values)
        .then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`)))
    },
    deleteTask: (id: string) =>
      pool.query('DELETE FROM tasks WHERE id = $1', [id])
        .then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`))),
    close: () =>
      pool.end(),
    getUserByUsername: (username: string) => pool.query('SELECT * FROM users WHERE username = $1', [username]).then(res => res.rows[0] ? { id: res.rows[0].id.toString(), username: res.rows[0].username, password: res.rows[0].password } : null),
    createUser: (username: string, password: string) => pool.query('INSERT INTO users (username, password) VALUES ($1, $2) RETURNING *', [username, password]).then(res => ({ id: res.rows[0].id.toString(), username: res.rows[0].username })),
    getAllBookmarks: (username: string, tag?: string, query?: string) => {
      let sql = 'SELECT * FROM bookmarks WHERE created_by = $1'
      const params: any[] = [username]
      if (tag) {
        sql += ' AND $2 = ANY(tags)'
        params.push(tag)
      }
      if (query) {
        const paramIndex = params.length + 1
        sql += ` AND (title ILIKE $${paramIndex} OR url ILIKE $${paramIndex})`
        params.push(`%${query}%`)
      }
      sql += ' ORDER BY created_at DESC'
      return pool.query(sql, params).then(res => res.rows.map(mapBookmark))
    },
    getBookmarkById: (id: string, username: string) => pool.query('SELECT * FROM bookmarks WHERE id = $1 AND created_by = $2', [id, username]).then(res => res.rows[0] ? mapBookmark(res.rows[0]) : null),
    createBookmark: (title: string, url: string, tags: string[], username: string) => pool.query('INSERT INTO bookmarks (title, url, tags, created_by) VALUES ($1, $2, $3, $4) RETURNING *', [title, url, tags, username]).then(res => mapBookmark(res.rows[0])),
    updateBookmark: (id: string, title: string, url: string, tags: string[], username: string) => pool.query('UPDATE bookmarks SET title = $1, url = $2, tags = $3 WHERE id = $4 AND created_by = $5 RETURNING *', [title, url, tags, id, username]).then(res => res.rows[0] ? mapBookmark(res.rows[0]) : null),
    deleteBookmark: (id: string, username: string) => pool.query('DELETE FROM bookmarks WHERE id = $1 AND created_by = $2', [id, username]).then(() => undefined),

  }
}

export type DbSvc = Awaited<ReturnType<typeof initDbSvc>>
