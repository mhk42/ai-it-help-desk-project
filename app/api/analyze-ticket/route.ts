import { NextRequest, NextResponse } from 'next/server'

type TicketInput = {
  title?: string
  description?: string
  device?: string
  errorText?: string
}

const responseSchema = {
  type: 'OBJECT',
  properties: {
    summary: { type: 'STRING' },
    likelyCauses: { type: 'ARRAY', items: { type: 'STRING' } },
    recommendedSteps: { type: 'ARRAY', items: { type: 'STRING' } },
    severity: { type: 'STRING', enum: ['Low', 'Medium', 'High', 'Critical'] },
    confidence: { type: 'NUMBER' },
  },
  required: ['summary', 'likelyCauses', 'recommendedSteps', 'severity', 'confidence'],
}

export async function POST(request: NextRequest) {
  const apiKey = process.env.GEMINI_API_KEY

  if (!apiKey) {
    return NextResponse.json({ error: 'GEMINI_API_KEY is not configured on the server.' }, { status: 500 })
  }

  let ticket: TicketInput
  try {
    ticket = await request.json()
  } catch {
    return NextResponse.json({ error: 'Request body must be valid JSON.' }, { status: 400 })
  }

  if (!ticket.title?.trim() || !ticket.description?.trim()) {
    return NextResponse.json({ error: 'Ticket title and description are required.' }, { status: 400 })
  }

  const prompt = [
    'You are an IT help desk triage assistant. Analyze this support ticket for a technician.',
    'Only recommend safe, reversible, read-only or standard troubleshooting steps. Do not invent facts.',
    'Return concise, practical guidance in the requested JSON format. Set confidence to a number from 0 to 1.',
    '',
    `Title: ${ticket.title}`,
    `Description: ${ticket.description}`,
    `Device: ${ticket.device?.trim() || 'Not provided'}`,
    `Error text: ${ticket.errorText?.trim() || 'Not provided'}`,
  ].join('\n')

  let response: Response
  try {
    response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${encodeURIComponent(apiKey)}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ role: 'user', parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.2,
            responseMimeType: 'application/json',
            responseSchema,
          },
        }),
      },
    )
  } catch (error) {
    console.error('Gemini request failed before receiving a response:', error)
    return NextResponse.json({ error: 'Could not reach Gemini. Check the server connection.' }, { status: 502 })
  }

  const responseBody = await response.text()
  if (!response.ok) {
    let upstreamMessage = ''
    try {
      upstreamMessage = JSON.parse(responseBody).error?.message || ''
    } catch {
      upstreamMessage = responseBody.slice(0, 160)
    }
    console.error(`Gemini API returned ${response.status}: ${upstreamMessage}`)
    return NextResponse.json(
      { error: upstreamMessage || `Gemini request failed with status ${response.status}.` },
      { status: 502 },
    )
  }

  let data: { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> }
  try {
    data = JSON.parse(responseBody)
  } catch {
    return NextResponse.json({ error: 'Gemini returned an invalid response.' }, { status: 502 })
  }
  const text = data.candidates?.[0]?.content?.parts?.[0]?.text

  if (!text) {
    return NextResponse.json({ error: 'Gemini returned an empty analysis.' }, { status: 502 })
  }

  try {
    return NextResponse.json(JSON.parse(text))
  } catch {
    return NextResponse.json({ error: 'Gemini returned an invalid analysis.' }, { status: 502 })
  }
}