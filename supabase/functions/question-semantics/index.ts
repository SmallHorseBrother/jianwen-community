import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type Question = {
  id: string
  content: string | null
  tags: string[] | null
  topic: string | null
  need_type: string | null
  audience_value: string | null
  source_count: number | null
  same_question_count: number | null
  answer: string | null
  is_featured: boolean | null
  embedding_model: string | null
  embedding_input_hash: string | null
  embedding_updated_at: string | null
  status: string | null
}

type MatchCandidate = {
  id: string
  tags: string[] | null
  topic: string | null
  need_type: string | null
  audience_value: string | null
  source_count: number | null
  same_question_count: number | null
  answer: string | null
  is_featured: boolean | null
  similarity: number | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const responseHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Content-Type': 'application/json',
}

const jsonResponse = (body: unknown, statusCode = 200) => {
  return new Response(JSON.stringify(body), {
    status: statusCode,
    headers: responseHeaders,
  })
}

const getEnv = (key: string, fallback = '') => Deno.env.get(key) || fallback

const embeddingModel = () => getEnv('EMBEDDING_MODEL', 'openai/text-embedding-3-large')

const embeddingDimensions = () => Number(getEnv('EMBEDDING_DIMENSIONS', '1536'))

const embeddingBaseUrl = () =>
  (getEnv('OPENAI_BASE_URL') || getEnv('OFOX_BASE_URL') || 'https://api.openai.com/v1').replace(/\/$/, '')

const embeddingApiKey = () => {
  const baseUrl = embeddingBaseUrl()
  if (baseUrl.includes('ofox.ai')) return getEnv('OFOX_API_KEY') || getEnv('OPENAI_API_KEY')
  return getEnv('OPENAI_API_KEY') || getEnv('OFOX_API_KEY')
}

const embeddingInputFor = (question: Question) => [
  `问题：${question.content || ''}`,
  `分类：${question.topic || '其他'}`,
  `标签：${(question.tags || []).join('，')}`,
  `需求类型：${question.need_type || '未标注'}`,
  `受众价值：${question.audience_value || 'medium'}`,
].join('\n')

const sha1Hex = async (input: string) => {
  const bytes = new TextEncoder().encode(input)
  const digest = await crypto.subtle.digest('SHA-1', bytes)
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

const vectorLiteral = (embedding: number[]) => `[${embedding.join(',')}]`

const overlap = (left: string[] | null = [], right: string[] | null = []) => {
  if (!left?.length || !right?.length) return 0
  const rightSet = new Set(right)
  const shared = left.filter((item) => rightSet.has(item)).length
  return shared / Math.min(left.length, right.length)
}

const finalScoreFor = (source: Question, candidate: MatchCandidate) => {
  const embeddingSimilarity = Number(candidate.similarity || 0)
  const tagOverlap = overlap(source.tags || [], candidate.tags || [])
  const sameTopic = source.topic && source.topic === candidate.topic ? 1 : 0
  const sameNeedType = source.need_type && source.need_type === candidate.need_type ? 1 : 0
  const valueBoost =
    (candidate.answer ? 0.5 : 0) +
    (candidate.is_featured ? 0.5 : 0) +
    (Number(candidate.source_count || 1) > 1 ? 0.25 : 0)

  return Math.min(
    1,
    embeddingSimilarity * 0.72 +
      tagOverlap * 0.14 +
      sameTopic * 0.08 +
      sameNeedType * 0.04 +
      Math.min(valueBoost, 1) * 0.02,
  )
}

const reasonFor = (source: Question, candidate: MatchCandidate, score: number) => {
  const reasons = [`embedding ${Math.round(Number(candidate.similarity || 0) * 100)}%`]
  if (source.topic && source.topic === candidate.topic) reasons.push('同分类')
  const sharedTags = (source.tags || []).filter((tag) => (candidate.tags || []).includes(tag))
  if (sharedTags.length) reasons.push(`标签: ${sharedTags.slice(0, 3).join('/')}`)
  if (source.need_type && source.need_type === candidate.need_type) reasons.push('需求类型相同')
  if (candidate.answer) reasons.push('候选已回答')
  reasons.push(`final ${Math.round(score * 100)}%`)
  return reasons.join(' · ')
}

const embedQuestion = async (input: string) => {
  const apiKey = embeddingApiKey()
  if (!apiKey) throw new Error('Missing OFOX_API_KEY or OPENAI_API_KEY')

  const body: Record<string, unknown> = {
    model: embeddingModel(),
    input,
  }
  const dimensions = embeddingDimensions()
  if (Number.isFinite(dimensions) && dimensions > 0) body.dimensions = dimensions

  const response = await fetch(`${embeddingBaseUrl()}/embeddings`, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok) {
    throw new Error(`Embedding request failed ${response.status}: ${JSON.stringify(payload)}`)
  }
  const embedding = payload?.data?.[0]?.embedding
  if (!Array.isArray(embedding)) throw new Error('Embedding response missing data[0].embedding')
  return embedding as number[]
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })
  if (req.method !== 'POST') return jsonResponse({ error: 'Method not allowed' }, 405)

  try {
    const { questionId, force } = await req.json().catch(() => ({}))
    if (typeof questionId !== 'string' || !questionId) {
      return jsonResponse({ error: 'Missing questionId' }, 400)
    }

    const supabaseUrl = getEnv('SUPABASE_URL')
    const serviceRoleKey = getEnv('SUPABASE_SERVICE_ROLE_KEY')
    if (!supabaseUrl || !serviceRoleKey) {
      throw new Error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY')
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    })
    const model = embeddingModel()

    const { data: question, error: questionError } = await supabase
      .from('questions')
      .select('id,content,tags,topic,need_type,audience_value,source_count,same_question_count,answer,is_featured,embedding_model,embedding_input_hash,embedding_updated_at,status')
      .eq('id', questionId)
      .single()

    if (questionError) throw questionError
    if (!question || question.status === 'ignored') return jsonResponse({ skipped: true })

    const input = embeddingInputFor(question)
    const inputHash = await sha1Hex(input)
    const needsEmbedding =
      question.embedding_model !== model ||
      question.embedding_input_hash !== inputHash ||
      !question.embedding_updated_at

    if (!force && !needsEmbedding) {
      const { count, error: edgeCountError } = await supabase
        .from('question_edges')
        .select('id', { count: 'exact', head: true })
        .eq('question_id', question.id)
        .eq('edge_type', 'semantic')
        .eq('model', model)
      if (edgeCountError) throw edgeCountError
      if (count && count > 0) {
        return jsonResponse({
          ok: true,
          questionId: question.id,
          skipped: 'fresh',
          edges: count,
        })
      }
    }

    let embedding: number[]
    if (needsEmbedding) {
      embedding = await embedQuestion(input)
      const { error: updateError } = await supabase
        .from('questions')
        .update({
          embedding,
          embedding_model: model,
          embedding_input_hash: inputHash,
          embedding_updated_at: new Date().toISOString(),
        })
        .eq('id', question.id)
      if (updateError) throw updateError
    } else {
      const { data: refreshed, error: refreshedError } = await supabase
        .from('questions')
        .select('embedding')
        .eq('id', question.id)
        .single()
      if (refreshedError) throw refreshedError
      const rawEmbedding = refreshed?.embedding
      embedding = Array.isArray(rawEmbedding)
        ? rawEmbedding
        : String(rawEmbedding || '')
            .replace(/^\[/, '')
            .replace(/\]$/, '')
            .split(',')
            .map((item) => Number(item.trim()))
            .filter((item) => Number.isFinite(item))
    }

    const candidateCalls = [
      supabase.rpc('match_question_embeddings', {
        query_embedding: vectorLiteral(embedding),
        match_count: 24,
        exclude_question_id: question.id,
        match_topic: question.topic || null,
      }),
      supabase.rpc('match_question_embeddings', {
        query_embedding: vectorLiteral(embedding),
        match_count: 10,
        exclude_question_id: question.id,
        match_topic: null,
      }),
    ]
    const candidateResults = await Promise.all(candidateCalls)
    const candidatesById = new Map<string, MatchCandidate>()
    for (const { data, error } of candidateResults) {
      if (error) throw error
      for (const candidate of data || []) {
        const existing = candidatesById.get(candidate.id)
        if (!existing || Number(candidate.similarity || 0) > Number(existing.similarity || 0)) {
          candidatesById.set(candidate.id, candidate)
        }
      }
    }

    const edges = Array.from(candidatesById.values())
      .map((candidate) => {
        const similarity = finalScoreFor(question, candidate)
        const sameTopic = question.topic && question.topic === candidate.topic
        return {
          question_id: question.id,
          related_question_id: candidate.id,
          similarity,
          embedding_similarity: Number(candidate.similarity || 0),
          edge_type: 'semantic',
          reason: reasonFor(question, candidate, similarity),
          model,
          origin_batch: `edge_function_${new Date().toISOString().slice(0, 10)}`,
          _sameTopic: sameTopic,
        }
      })
      .filter((edge) =>
        edge._sameTopic
          ? edge.similarity >= 0.66
          : edge.similarity >= 0.78 && edge.embedding_similarity >= 0.82,
      )
      .sort((left, right) => right.similarity - left.similarity)
      .slice(0, 5)
      .map(({ _sameTopic, ...edge }) => edge)

    await supabase
      .from('question_edges')
      .delete()
      .eq('question_id', question.id)
      .eq('edge_type', 'semantic')
      .eq('model', model)

    if (edges.length) {
      const { error: edgeError } = await supabase.from('question_edges').upsert(edges, {
        onConflict: 'question_id,related_question_id,edge_type',
      })
      if (edgeError) throw edgeError
    }

    return jsonResponse({
      ok: true,
      questionId: question.id,
      embedded: needsEmbedding,
      edges: edges.length,
    })
  } catch (error) {
    console.error(error)
    const message = error instanceof Error ? error.message : String(error)
    return jsonResponse({ error: message }, 500)
  }
})
