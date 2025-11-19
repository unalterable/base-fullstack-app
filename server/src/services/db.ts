import pg from 'pg'
const { Pool } = pg

type Task = { id: string; title: string; description: string; completed: boolean; createdBy: string; createdAt: string }
type TaskInput = { title: string; description: string; createdBy: string }

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
  await pool.query('CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at)')
  const mapToExternal = (row: any): Task => ({ id: row.id.toString(), title: row.title, description: row.description, completed: row.completed, createdBy: row.created_by, createdAt: row.created_at.toISOString() })
  return {
    getAllTasks: () => pool.query('SELECT * FROM tasks ORDER BY created_at DESC').then(res => res.rows.map(mapToExternal)),
    getTaskById: (id: string) => pool.query('SELECT * FROM tasks WHERE id = $1', [id]).then(res => res.rows.length > 0 ? mapToExternal(res.rows[0]) : undefined),
    createTask: (input: TaskInput) => pool.query('INSERT INTO tasks (title, description, created_by, created_at) VALUES ($1, $2, $3, $4) RETURNING *', [input.title, input.description, input.createdBy, new Date()]).then(res => mapToExternal(res.rows[0])),
    updateTask: (id: string, updates: Partial<{ title: string; description: string; completed: boolean }>) => {
      const fields: string[] = []
      const values: any[] = []
      let idx = 1
      if (updates.title !== undefined) { fields.push(`title = $${idx++}`); values.push(updates.title) }
      if (updates.description !== undefined) { fields.push(`description = $${idx++}`); values.push(updates.description) }
      if (updates.completed !== undefined) { fields.push(`completed = $${idx++}`); values.push(updates.completed) }
      values.push(id)
      return pool.query(`UPDATE tasks SET ${fields.join(', ')} WHERE id = $${idx}`, values).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`)))
    },
    deleteTask: (id: string) => pool.query('DELETE FROM tasks WHERE id = $1', [id]).then(res => res.rowCount && res.rowCount > 0 ? Promise.resolve() : Promise.reject(new Error(`No task found with id ${id}`))),
    close: () => pool.end()
  }
}

export type DbSvc = Awaited<ReturnType<typeof initDbSvc>>
