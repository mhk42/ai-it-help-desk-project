import { NextRequest, NextResponse } from 'next/server'
import { createTicket, listTickets, updateTicketStatus } from '@/lib/ticket-db'

export const dynamic = 'force-dynamic'

export async function GET() {
  return NextResponse.json(listTickets())
}

export async function POST(request: NextRequest) {
  const body = await request.json()
  if (!body.title?.trim() || !body.requester?.trim() || !body.category?.trim()) {
    return NextResponse.json({ error: 'Title, requester, and category are required.' }, { status: 400 })
  }

  return NextResponse.json(createTicket({
    title: body.title.trim(),
    requester: body.requester.trim(),
    category: body.category.trim(),
    priority: 'Medium',
    status: 'Open',
    description: 'New support request submitted from the employee portal.',
    device: body.device?.trim(),
    errorText: body.errorText?.trim(),
  }), { status: 201 })
}

export async function PATCH(request: NextRequest) {
  const body = await request.json()
  const allowedStatuses = ['Open', 'In Progress', 'Waiting for User', 'Resolved', 'Closed']
  if (!body.id || !allowedStatuses.includes(body.status)) {
    return NextResponse.json({ error: 'A valid ticket id and status are required.' }, { status: 400 })
  }

  const ticket = updateTicketStatus(body.id, body.status)
  return ticket ? NextResponse.json(ticket) : NextResponse.json({ error: 'Ticket not found.' }, { status: 404 })
}