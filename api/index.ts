import { Hono } from 'hono'
import { handle } from 'hono/vercel'
import { cors } from 'hono/cors'
import { supabaseForToken } from '../lib/supabase.js'

type Variables = {
  supabase: ReturnType<typeof supabaseForToken>
  userId: string
}

const app = new Hono<{ Variables: Variables }>().basePath('/api')

// Unity WebGL is served from a different origin than this API, so it needs CORS.
// Tighten `origin` to your actual WebGL host once you know it.
app.use('*', cors({ origin: '*', allowHeaders: ['Content-Type', 'Authorization'] }))

app.use('*', async (c, next) => {
  const header = c.req.header('Authorization') ?? ''
  const token = header.replace(/^Bearer\s+/i, '')
  if (!token) return c.json({ error: 'missing bearer token' }, 401)

  const supabase = supabaseForToken(token)
  const { data, error } = await supabase.auth.getUser(token)
  if (error || !data.user) return c.json({ error: 'invalid session' }, 401)

  c.set('supabase', supabase)
  c.set('userId', data.user.id)
  await next()
})

type PositionInput = { x: number; y: number; z: number }
type NodeInput = { title?: string; content?: string; position?: PositionInput; space_id?: string }

// A user's list of spaces (shown right after login, before any space loads).
app.get('/spaces', async (c) => {
  const { data, error } = await c
    .get('supabase')
    .from('spaces')
    .select('*')
    .order('created_at')
  if (error) return c.json({ error: error.message }, 500)
  // Wrapped in an object (not a bare array) - Unity's JsonUtility can't
  // parse a top-level JSON array.
  return c.json({ spaces: data })
})

app.post('/spaces', async (c) => {
  const body = await c.req.json<{ name?: string }>()
  const { data, error } = await c
    .get('supabase')
    .from('spaces')
    .insert({ user_id: c.get('userId'), name: body.name?.trim() || '無題のスペース' })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

// Cascades to that space's nodes and connections (schema.sql has them as
// `on delete cascade`), so this one call is enough to remove everything in it.
app.delete('/spaces/:id', async (c) => {
  const { error } = await c.get('supabase').from('spaces').delete().eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

// Combined snapshot used to restore one space's nodes/connections in one
// round trip once the player has picked (or created) a space.
app.get('/space', async (c) => {
  const spaceId = c.req.query('space_id')
  if (!spaceId) return c.json({ error: 'missing space_id' }, 400)

  const supabase = c.get('supabase')
  const [nodes, connections] = await Promise.all([
    supabase.from('nodes').select('*').eq('space_id', spaceId).order('created_at'),
    supabase.from('connections').select('*').eq('space_id', spaceId),
  ])
  if (nodes.error) return c.json({ error: nodes.error.message }, 500)
  if (connections.error) return c.json({ error: connections.error.message }, 500)
  return c.json({ nodes: nodes.data, connections: connections.data })
})

app.post('/nodes', async (c) => {
  const body = await c.req.json<NodeInput>()
  if (!body.space_id) return c.json({ error: 'missing space_id' }, 400)
  const { data, error } = await c
    .get('supabase')
    .from('nodes')
    .insert({
      user_id: c.get('userId'),
      space_id: body.space_id,
      title: body.title ?? '',
      content: body.content ?? '',
      position_x: body.position?.x ?? 0,
      position_y: body.position?.y ?? 0,
      position_z: body.position?.z ?? 0,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.put('/nodes/:id', async (c) => {
  const body = await c.req.json<NodeInput>()
  const { data, error } = await c
    .get('supabase')
    .from('nodes')
    .update({
      title: body.title ?? '',
      content: body.content ?? '',
      position_x: body.position?.x ?? 0,
      position_y: body.position?.y ?? 0,
      position_z: body.position?.z ?? 0,
    })
    .eq('id', c.req.param('id'))
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data)
})

app.delete('/nodes/:id', async (c) => {
  const { error } = await c.get('supabase').from('nodes').delete().eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

app.post('/connections', async (c) => {
  const body = await c.req.json<{ from_node: string; to_node: string; space_id?: string }>()
  if (!body.space_id) return c.json({ error: 'missing space_id' }, 400)
  const { data, error } = await c
    .get('supabase')
    .from('connections')
    .insert({
      user_id: c.get('userId'),
      space_id: body.space_id,
      from_node: body.from_node,
      to_node: body.to_node,
    })
    .select()
    .single()
  if (error) return c.json({ error: error.message }, 500)
  return c.json(data, 201)
})

app.delete('/connections/:id', async (c) => {
  const { error } = await c.get('supabase').from('connections').delete().eq('id', c.req.param('id'))
  if (error) return c.json({ error: error.message }, 500)
  return c.body(null, 204)
})

// Vercel's Functions runtime dispatches by named HTTP-method export (Web
// fetch-style), not a default (req, res) export - hono/vercel's handle()
// returns a fetch-style handler, so it must be exported per method.
export const GET = handle(app)
export const POST = handle(app)
export const PUT = handle(app)
export const DELETE = handle(app)
export const OPTIONS = handle(app)
