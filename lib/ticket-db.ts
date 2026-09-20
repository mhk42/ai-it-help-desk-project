import { mkdirSync } from 'node:fs'
import path from 'node:path'
import { DatabaseSync } from 'node:sqlite'

export type TicketRecord = {
  id: string
  title: string
  requester: string
  category: string
  priority: string
  status: string
  updated: string
  description: string
  device?: string
  errorText?: string
}

const seedTickets: TicketRecord[] = [
  { id: '#1042', title: 'Laptop running extremely slowly', requester: 'John Smith', category: 'Hardware', priority: 'Medium', status: 'In Progress', updated: '12 min ago', description: 'My computer has become extremely slow and Chrome keeps freezing.' },
  { id: '#1041', title: 'Unable to connect to office Wi-Fi', requester: 'Maya Patel', category: 'Network', priority: 'High', status: 'Open', updated: '38 min ago', description: 'Laptop connects to Wi-Fi but cannot access any websites.' },
  { id: '#1040', title: 'Outlook inbox not syncing', requester: 'Ethan Brooks', category: 'Email', priority: 'Low', status: 'Waiting for User', updated: '1 hr ago', description: 'New messages are not appearing in Outlook.' },
  { id: '#1039', title: 'Monitor not detected after docking', requester: 'Olivia Chen', category: 'Hardware', priority: 'Medium', status: 'Open', updated: '2 hrs ago', description: 'External monitor is not detected after reconnecting the dock.' },
  { id: '#1038', title: 'VPN connection failure', requester: 'Noah Williams', category: 'VPN', priority: 'Critical', status: 'Open', updated: '3 hrs ago', description: 'VPN fails with a timeout when working remotely.' },
]

let database: DatabaseSync | undefined

function getDatabase() {
  if (database) return database

  const databasePath = path.join(process.cwd(), 'northstar.db')
  mkdirSync(path.dirname(databasePath), { recursive: true })
  database = new DatabaseSync(databasePath)
  database.exec(`
    CREATE TABLE IF NOT EXISTS tickets (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      requester TEXT NOT NULL,
      category TEXT NOT NULL,
      priority TEXT NOT NULL,
      status TEXT NOT NULL,
      updated TEXT NOT NULL,
      description TEXT NOT NULL,
      device TEXT,
      error_text TEXT
    )
  `)

  const insert = database.prepare(`
    INSERT OR IGNORE INTO tickets
      (id, title, requester, category, priority, status, updated, description, device, error_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  for (const ticket of seedTickets) {
    insert.run(ticket.id, ticket.title, ticket.requester, ticket.category, ticket.priority, ticket.status, ticket.updated, ticket.description, ticket.device ?? null, ticket.errorText ?? null)
  }

  return database
}

function toTicket(row: Record<string, unknown>): TicketRecord {
  return {
    id: String(row.id),
    title: String(row.title),
    requester: String(row.requester),
    category: String(row.category),
    priority: String(row.priority),
    status: String(row.status),
    updated: String(row.updated),
    description: String(row.description),
    device: row.device ? String(row.device) : undefined,
    errorText: row.error_text ? String(row.error_text) : undefined,
  }
}

export function listTickets() {
  const rows = getDatabase().prepare('SELECT * FROM tickets ORDER BY CAST(SUBSTR(id, 2) AS INTEGER) DESC').all() as Record<string, unknown>[]
  return rows.map(toTicket)
}

export function createTicket(ticket: Omit<TicketRecord, 'id' | 'updated'>) {
  const db = getDatabase()
  const nextId = Number(db.prepare("SELECT COALESCE(MAX(CAST(SUBSTR(id, 2) AS INTEGER)), 1042) + 1 AS next_id FROM tickets").get()?.next_id ?? 1043)
  const record = { ...ticket, id: `#${nextId}`, updated: 'just now' }
  db.prepare(`
    INSERT INTO tickets (id, title, requester, category, priority, status, updated, description, device, error_text)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(record.id, record.title, record.requester, record.category, record.priority, record.status, record.updated, record.description, record.device ?? null, record.errorText ?? null)
  return record
}

export function updateTicketStatus(id: string, status: string) {
  const db = getDatabase()
  const result = db.prepare("UPDATE tickets SET status = ?, updated = 'just now' WHERE id = ?").run(status, id)
  if (!result.changes) return null
  const row = db.prepare('SELECT * FROM tickets WHERE id = ?').get(id) as Record<string, unknown> | undefined
  return row ? toTicket(row) : null
}