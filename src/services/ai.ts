// ---- AI 服务：直接在渲染进程调用大模型接口（使用用户自己的 Key，仅保存在本机） ----
import { useStore } from '../store/useStore'
import type { Priority, Settings, Tag, TaskList } from '../store/types'
import { dayjs, today, WEEKDAYS_SHORT } from '../utils/date'
import { parseQuickAdd } from '../utils/task'

export type AiSettings = Settings['ai']

export const DEFAULT_ANTHROPIC_URL = 'https://api.anthropic.com'
export const DEFAULT_OPENAI_URL = 'https://api.openai.com/v1'
export const DEFAULT_CLAUDE_MODEL = 'claude-sonnet-5-5'
const ANTHROPIC_VERSION = '2023-06-01'

/** 当前可用的 Claude 模型 id（供设置页快捷选择） */
export const CLAUDE_MODEL_SUGGESTIONS: { id: string; label: string }[] = [
  { id: 'claude-sonnet-5-5', label: 'Sonnet 5.5 · 推荐' },
  { id: 'claude-opus-5-5', label: 'Opus 5.5 · 最强' },
  { id: 'claude-haiku-5-5', label: 'Haiku 5.5 · 最快' },
  { id: 'claude-opus-5', label: 'Opus 5' },
  { id: 'claude-sonnet-5', label: 'Sonnet 5' },
  { id: 'claude-sonnet-4-6', label: 'Sonnet 4.6' },
  { id: 'claude-haiku-4-5', label: 'Haiku 4.5' },
]
/** OpenAI 兼容接口常见模型名（仅作提示） */
export const OPENAI_MODEL_SUGGESTIONS: { id: string; label: string }[] = [
  { id: 'gpt-4o-mini', label: 'gpt-4o-mini' },
  { id: 'gpt-4o', label: 'gpt-4o' },
  { id: 'deepseek-chat', label: 'deepseek-chat' },
  { id: 'qwen-plus', label: 'qwen-plus' },
]

// ---------- 错误类型 ----------

/** 未配置 API Key（或已关闭 AI 功能）：UI 应提示用户前往设置 */
export class AiNotConfigured extends Error {
  readonly code = 'not_configured' as const
  constructor(message = '尚未配置 AI 模型服务，请先在设置中填写 API Key') {
    super(message)
    this.name = 'AiNotConfigured'
  }
}

/** 请求失败（网络 / HTTP / 解析） */
export class AiRequestError extends Error {
  readonly code = 'request' as const
  status?: number
  detail?: string
  constructor(message: string, status?: number, detail?: string) {
    super(message)
    this.name = 'AiRequestError'
    this.status = status
    this.detail = detail
  }
}

export function isAiNotConfigured(e: unknown): e is AiNotConfigured {
  return e instanceof AiNotConfigured || (typeof e === 'object' && !!e && (e as { name?: string }).name === 'AiNotConfigured')
}

/** 把任意错误转成适合提示给用户的中文文案 */
export function aiErrorMessage(e: unknown): string {
  if (e instanceof Error) return e.message || '发生未知错误'
  return String(e)
}

// ---------- 配置 ----------

function getAi(): AiSettings {
  return useStore.getState().settings.ai
}

export function isAiConfigured(ai: AiSettings = getAi()): boolean {
  return !!ai.enabled && !!ai.apiKey.trim()
}

function assertConfigured(ai: AiSettings) {
  if (!ai.enabled) throw new AiNotConfigured('AI 功能已关闭，请在设置中开启')
  if (!ai.apiKey.trim()) throw new AiNotConfigured()
}

function normalizeBase(url: string, fallback: string): string {
  const u = url.trim().replace(/\/+$/, '')
  return u || fallback
}

/** 这些模型支持 output_config.effort，用较低的推理强度加快短 JSON 任务 */
function supportsEffort(model: string): boolean {
  return /^claude-(opus|sonnet|haiku|fable|mythos)-(5(-\d+)?|4-[678])(?:-|$)/.test(model)
}

// ---------- 底层调用 ----------

export interface ChatOpts {
  maxTokens?: number
  /** 仅 OpenAI 兼容接口使用（Claude 新模型不接受非默认采样参数） */
  temperature?: number
  signal?: AbortSignal
  timeoutMs?: number
  /** 覆盖设置（如设置页测试尚未保存的值） */
  settings?: AiSettings
}

export interface ChatResult {
  text: string
  model: string
  /** 毫秒 */
  latency: number
}

async function httpError(res: Response): Promise<AiRequestError> {
  let detail = ''
  try {
    const data = (await res.json()) as { error?: { message?: string } | string; message?: string }
    if (typeof data.error === 'string') detail = data.error
    else detail = data.error?.message ?? data.message ?? ''
  } catch {
    try {
      detail = (await res.text()).slice(0, 300)
    } catch {
      /* ignore */
    }
  }
  const s = res.status
  let msg: string
  if (s === 401) msg = 'API Key 无效或未授权（401）'
  else if (s === 403) msg = '无权访问该接口（403）'
  else if (s === 404) msg = '接口地址不存在（404），请检查 Base URL'
  else if (s === 429) msg = '请求过于频繁或额度不足（429）'
  else if (s === 400) msg = `请求参数错误（400）${detail ? '：' + detail : ''}`
  else if (s >= 500) msg = `模型服务端错误（${s}）`
  else msg = `请求失败（${s}）`
  if (detail && s !== 400) msg += `：${detail}`
  return new AiRequestError(msg, s, detail)
}

async function callAnthropic(ai: AiSettings, system: string, user: string, opts: ChatOpts, signal: AbortSignal): Promise<string> {
  const base = normalizeBase(ai.baseUrl, DEFAULT_ANTHROPIC_URL)
  const url = /\/v1$/.test(base) ? `${base}/messages` : `${base}/v1/messages`
  const model = ai.model.trim() || DEFAULT_CLAUDE_MODEL
  const body: Record<string, unknown> = {
    model,
    max_tokens: opts.maxTokens ?? 4096,
    system,
    messages: [{ role: 'user', content: user }],
  }
  if (supportsEffort(model)) body.output_config = { effort: 'low' }
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers: {
      'content-type': 'application/json',
      'x-api-key': ai.apiKey.trim(),
      'anthropic-version': ANTHROPIC_VERSION,
      // 浏览器 / Electron 渲染进程直连所需（CORS）
      'anthropic-dangerous-direct-browser-access': 'true',
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw await httpError(res)
  const data = (await res.json()) as {
    content?: { type: string; text?: string }[]
    stop_reason?: string
    stop_details?: { explanation?: string } | null
  }
  if (data.stop_reason === 'refusal') {
    throw new AiRequestError(`模型拒绝了此次请求${data.stop_details?.explanation ? '：' + data.stop_details.explanation : ''}`)
  }
  const text = (data.content ?? [])
    .filter((b) => b.type === 'text' && typeof b.text === 'string')
    .map((b) => b.text as string)
    .join('')
  if (!text.trim()) throw new AiRequestError('模型没有返回文本内容')
  return text
}

async function callOpenAI(ai: AiSettings, system: string, user: string, opts: ChatOpts, signal: AbortSignal): Promise<string> {
  const base = normalizeBase(ai.baseUrl, DEFAULT_OPENAI_URL)
  const url = `${base}/chat/completions`
  const headers: Record<string, string> = { 'content-type': 'application/json' }
  if (ai.apiKey.trim()) headers.authorization = `Bearer ${ai.apiKey.trim()}`
  const res = await fetch(url, {
    method: 'POST',
    signal,
    headers,
    body: JSON.stringify({
      model: ai.model.trim() || 'gpt-4o-mini',
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: user },
      ],
      temperature: opts.temperature ?? 0.2,
      max_tokens: opts.maxTokens ?? 4096,
    }),
  })
  if (!res.ok) throw await httpError(res)
  const data = (await res.json()) as {
    choices?: { message?: { content?: string | { type?: string; text?: string }[] } }[]
  }
  const c = data.choices?.[0]?.message?.content
  const text = typeof c === 'string' ? c : Array.isArray(c) ? c.map((p) => p.text ?? '').join('') : ''
  if (!text.trim()) throw new AiRequestError('模型没有返回文本内容')
  return text
}

/** 发送一轮对话，返回纯文本 */
export async function chatText(system: string, user: string, opts: ChatOpts = {}): Promise<ChatResult> {
  const ai = opts.settings ?? getAi()
  assertConfigured(ai)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 60_000)
  const onOuterAbort = () => controller.abort()
  opts.signal?.addEventListener('abort', onOuterAbort)
  const started = performance.now()
  try {
    const text =
      ai.provider === 'openai-compatible'
        ? await callOpenAI(ai, system, user, opts, controller.signal)
        : await callAnthropic(ai, system, user, opts, controller.signal)
    return { text, model: ai.model.trim() || (ai.provider === 'anthropic' ? DEFAULT_CLAUDE_MODEL : ''), latency: Math.round(performance.now() - started) }
  } catch (e) {
    if (e instanceof AiRequestError || e instanceof AiNotConfigured) throw e
    if ((e as { name?: string })?.name === 'AbortError') {
      throw new AiRequestError(opts.signal?.aborted ? '请求已取消' : '请求超时，请稍后重试')
    }
    throw new AiRequestError('网络错误：无法连接到模型服务，请检查 Base URL 与网络连接', undefined, String(e))
  } finally {
    clearTimeout(timer)
    opts.signal?.removeEventListener('abort', onOuterAbort)
  }
}

/** 从模型输出中稳健地提取 JSON（去掉代码块围栏、从第一个 { 或 [ 开始截取） */
export function extractJSON(text: string): unknown {
  const candidates: string[] = []
  const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/i)
  if (fence) candidates.push(fence[1].trim())
  candidates.push(text.trim())
  const firstObj = text.indexOf('{')
  const firstArr = text.indexOf('[')
  const starts = [firstObj, firstArr].filter((i) => i >= 0).sort((a, b) => a - b)
  for (const s of starts) {
    const close = text[s] === '{' ? '}' : ']'
    const e = text.lastIndexOf(close)
    if (e > s) candidates.push(text.slice(s, e + 1))
  }
  for (const c of candidates) {
    try {
      return JSON.parse(c)
    } catch {
      /* 继续尝试下一个候选 */
    }
  }
  throw new AiRequestError('无法解析模型返回的 JSON，请重试', undefined, text.slice(0, 300))
}

/** 发送一轮对话并把回复解析为 JSON */
export async function chatJSON<T>(system: string, user: string, opts: ChatOpts = {}): Promise<T> {
  const sys = `${system}\n\n输出要求：只输出一个合法的 JSON，不要任何解释、前后缀或 Markdown 代码块。`
  const r = await chatText(sys, user, opts)
  return extractJSON(r.text) as T
}

// ---------- 任务拆解 ----------

export interface BreakdownInput {
  title: string
  content?: string
  dueDate?: string | null
  /** 用户补充的上下文（例如语音口述） */
  extra?: string
}
export interface BreakdownStep {
  title: string
  minutes?: number
}
export interface BreakdownResult {
  steps: BreakdownStep[]
  summary?: string
}

const BREAKDOWN_SYSTEM = `你是一个任务规划助手。用户会给你一个待办任务，请把它拆解为 3 到 8 个可执行的具体步骤。
要求：
- 按先后顺序排列，每个步骤一句话、以动词开头、不超过 30 个字，使用简体中文；
- 步骤要具体可操作，避免空泛（如"做准备"）；
- 可为每个步骤估算所需分钟数（整数），不确定可省略；
- 可用一句话 summary 概括完成思路。
只输出 JSON，格式：{"steps":[{"title":"步骤内容","minutes":30}],"summary":"一句话"}`

export async function breakdownTask(input: BreakdownInput, opts: ChatOpts = {}): Promise<BreakdownResult> {
  const lines = [`任务标题：${input.title.trim() || '（无标题）'}`]
  if (input.content?.trim()) lines.push(`任务描述：${input.content.trim()}`)
  if (input.dueDate) lines.push(`截止日期：${input.dueDate}（今天是 ${today()}）`)
  if (input.extra?.trim()) lines.push(`补充说明：${input.extra.trim()}`)
  const raw = await chatJSON<{ steps?: unknown; summary?: unknown }>(BREAKDOWN_SYSTEM, lines.join('\n'), { maxTokens: 2048, ...opts })
  const stepsRaw = Array.isArray(raw?.steps) ? raw.steps : Array.isArray(raw) ? (raw as unknown[]) : []
  const steps: BreakdownStep[] = []
  for (const s of stepsRaw) {
    if (typeof s === 'string') {
      if (s.trim()) steps.push({ title: s.trim() })
      continue
    }
    if (s && typeof s === 'object') {
      const o = s as { title?: unknown; step?: unknown; minutes?: unknown; duration?: unknown }
      const title = String(o.title ?? o.step ?? '').trim()
      if (!title) continue
      const m = Number(o.minutes ?? o.duration)
      steps.push(Number.isFinite(m) && m > 0 ? { title, minutes: Math.round(m) } : { title })
    }
  }
  if (!steps.length) throw new AiRequestError('模型没有返回有效的步骤，请重试')
  const summary = typeof raw?.summary === 'string' && raw.summary.trim() ? raw.summary.trim() : undefined
  return { steps, summary }
}

// ---------- 语音转任务 ----------

export interface SpokenTask {
  title: string
  dueDate?: string // YYYY-MM-DD
  dueTime?: string // HH:mm
  priority?: Priority
  tags?: string[]
  listName?: string
  subtasks?: string[]
}
export interface SpokenParseContext {
  lists: TaskList[]
  tags: Tag[]
  today?: string
}
export interface SpokenParseResult {
  tasks: SpokenTask[]
  /** 'ai' 为模型解析，'local' 为本地规则解析 */
  source: 'ai' | 'local'
}

function normalizePriority(v: unknown): Priority | undefined {
  if (v === null || v === undefined || v === '') return undefined
  if (typeof v === 'string') {
    if (/高|紧急|high/i.test(v)) return 5
    if (/中|medium/i.test(v)) return 3
    if (/低|low/i.test(v)) return 1
  }
  const n = Number(v)
  if (!Number.isFinite(n) || n <= 0) return undefined
  if (n >= 5) return 5
  if (n >= 3) return 3
  return 1
}
function normalizeDate(v: unknown): string | undefined {
  if (typeof v !== 'string' || !v.trim()) return undefined
  const s = v.trim().replace(/\//g, '-')
  const m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (!m) return undefined
  const d = dayjs(`${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}`, 'YYYY-MM-DD', true)
  return d.isValid() ? d.format('YYYY-MM-DD') : undefined
}
function normalizeTime(v: unknown): string | undefined {
  if (typeof v !== 'string') return undefined
  const m = v.trim().match(/^(\d{1,2}):(\d{2})/)
  if (!m) return undefined
  const h = Number(m[1])
  const mi = Number(m[2])
  if (h > 23 || mi > 59) return undefined
  return `${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
}
function normalizeStrings(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? '').trim().replace(/^#/, '')).filter(Boolean)
}

function normalizeSpokenTasks(raw: unknown, ctx: SpokenParseContext): SpokenTask[] {
  const arr = Array.isArray(raw) ? raw : Array.isArray((raw as { tasks?: unknown })?.tasks) ? ((raw as { tasks: unknown[] }).tasks) : []
  const out: SpokenTask[] = []
  for (const item of arr) {
    if (typeof item === 'string') {
      if (item.trim()) out.push({ title: item.trim() })
      continue
    }
    if (!item || typeof item !== 'object') continue
    const o = item as Record<string, unknown>
    const title = String(o.title ?? o.name ?? '').trim()
    if (!title) continue
    const t: SpokenTask = { title }
    const d = normalizeDate(o.dueDate ?? o.date)
    if (d) t.dueDate = d
    const tm = normalizeTime(o.dueTime ?? o.time)
    if (tm) {
      t.dueTime = tm
      if (!t.dueDate) t.dueDate = ctx.today ?? today()
    }
    const p = normalizePriority(o.priority)
    if (p) t.priority = p
    const tags = normalizeStrings(o.tags)
    if (tags.length) t.tags = tags
    const listName = typeof o.listName === 'string' ? o.listName.trim() : typeof o.list === 'string' ? o.list.trim() : ''
    if (listName && (listName === '收集箱' || ctx.lists.some((l) => l.name === listName))) t.listName = listName
    const subs = normalizeStrings(o.subtasks)
    if (subs.length) t.subtasks = subs
    out.push(t)
  }
  return out
}

/** 中文数字（零到九十九）→ 数字；非法返回 null */
function cnNumber(s: string): number | null {
  const d: Record<string, number> = { 零: 0, 一: 1, 二: 2, 两: 2, 三: 3, 四: 4, 五: 5, 六: 6, 七: 7, 八: 8, 九: 9 }
  if (!s) return null
  if (/^\d+$/.test(s)) return Number(s)
  if (s === '十') return 10
  const m = s.match(/^([一二两三四五六七八九])?十([一二三四五六七八九])?$/)
  if (m) return (m[1] ? d[m[1]] : 1) * 10 + (m[2] ? d[m[2]] : 0)
  if (s.length === 1 && s in d) return d[s]
  return null
}

/** 本地规则解析：按顿号 / 逗号 / 然后 / 还有 等拆分，再逐段用 parseQuickAdd */
export function parseSpokenTasksLocal(transcript: string, ctx: SpokenParseContext): SpokenParseResult {
  // 只按明确的分隔词拆分；“和 / 再”太容易切碎短语（如“和老王开会”），不作为分隔
  const pieces = transcript
    .split(/\s*(?:[、，,；;。！!？?\n]+|然后|接着|还有|以及|另外|其次|最后)\s*/)
    .map((s) => s.trim())
    .filter(Boolean)
  const tasks: SpokenTask[] = []
  for (const piece of pieces) {
    let text = piece.replace(/^(嗯|那个|帮我|记一下|记录|提醒我|记得|要|我要|我得|我需要)+/, '').trim()
    if (!text) continue
    let priority: Priority | undefined
    if (/紧急|非常重要|务必|一定要/.test(text)) priority = 5
    else if (/重要|尽快/.test(text)) priority = 3
    else if (/不急|有空|顺便/.test(text)) priority = 1
    // 中文数字的钟点：十点 / 十一点半 / 三点二十 → 阿拉伯数字
    text = text.replace(/([零一二两三四五六七八九十]{1,3})点(半|[零一二三四五六七八九十]{1,3}分?)?/g, (_m, h: string, rest: string | undefined) => {
      const hour = cnNumber(h)
      if (hour == null) return _m
      const min = rest === '半' ? '半' : rest ? String(cnNumber(rest.replace('分', '')) ?? '') : ''
      return `${hour}点${min}`
    })
    // 让 parseQuickAdd 能识别夹在句子里的日期词：前后补空格，去掉紧随其后的“前 / 之前”
    text = text
      .replace(/(今天|明天|后天|大后天|下?(?:周|星期)[一二三四五六日天]|\d{1,2}月\d{1,2}[日号]?)(之前|前|以前)?/g, ' $1 ')
      .replace(/\s{2,}/g, ' ')
      .trim()
    text = text.replace(/(上午|早上|中午|下午|晚上)?\s*(\d{1,2})点(半|\d{1,2}分?)?/, (_m, period: string | undefined, h: string, rest: string | undefined) => {
      let hour = Number(h)
      if ((period === '下午' || period === '晚上') && hour < 12) hour += 12
      if (period === '中午' && hour < 11) hour += 12
      const min = rest === '半' ? 30 : rest ? Number(rest.replace('分', '')) : 0
      return ` ${String(hour).padStart(2, '0')}:${String(min).padStart(2, '0')} `
    })
    const p = parseQuickAdd(text, ctx.lists)
    const title = p.title.trim()
    if (!title) continue
    const t: SpokenTask = { title }
    if (p.dueDate) t.dueDate = p.dueDate
    if (p.dueTime) t.dueTime = p.dueTime
    const pri = p.priority ?? priority
    if (pri) t.priority = pri
    if (p.tags.length) t.tags = p.tags
    if (p.listId) {
      const l = ctx.lists.find((x) => x.id === p.listId)
      if (l) t.listName = l.name
    }
    tasks.push(t)
  }
  return { tasks, source: 'local' }
}

function spokenSystemPrompt(ctx: SpokenParseContext): string {
  const t = ctx.today ?? today()
  const weekday = WEEKDAYS_SHORT[dayjs(t).day()]
  const listNames = ['收集箱', ...ctx.lists.map((l) => l.name)]
  const tagNames = ctx.tags.map((x) => x.name)
  return `你是待办清单应用的语音录入助手。用户口述的内容可能包含一个或多个任务，请提取为结构化 JSON。
今天是 ${t}（${weekday}）。
规则：
- 相对日期（今天、明天、后天、下周三、这周五、月底、3 天后、下个月 5 号等）必须换算为绝对日期 YYYY-MM-DD；"周三"指最近的一个未来的周三；
- 时间统一为 24 小时制 HH:mm（如"下午三点"→"15:00"）；只说了时间没说日期时，dueDate 取今天；
- 没有提到的字段直接省略，不要编造；
- priority：紧急/务必/非常重要 → 5，重要/尽快 → 3，不急/有空 → 1，否则省略；
- listName 只能从可用清单中选择：${JSON.stringify(listNames)}；匹配不到就省略；
- tags 优先沿用已有标签：${JSON.stringify(tagNames)}；也可以从内容中提炼 1 到 2 个简短的新标签，不带 # 号；没有合适的就省略；
- 如果某个任务里明显包含多个子步骤，放到 subtasks 数组；
- title 要简洁，去掉口语词（嗯、那个、帮我记一下、提醒我），保留核心动作与对象；
- 多个任务按口述顺序输出。
只输出 JSON，格式：{"tasks":[{"title":"...","dueDate":"YYYY-MM-DD","dueTime":"HH:mm","priority":5,"tags":["..."],"listName":"...","subtasks":["..."]}]}`
}

export interface SpokenParseOpts extends ChatOpts {
  /** 强制使用本地规则解析 */
  forceLocal?: boolean
  /** 未配置 AI 时自动退回本地解析（默认 true） */
  fallbackLocal?: boolean
}

/** 把口述文本解析为多个任务；未配置 AI 时退回本地规则解析（source = 'local'） */
export async function parseSpokenTasks(transcript: string, ctx: SpokenParseContext, opts: SpokenParseOpts = {}): Promise<SpokenParseResult> {
  const text = transcript.trim()
  if (!text) return { tasks: [], source: opts.forceLocal ? 'local' : 'ai' }
  const { forceLocal, fallbackLocal = true, ...chat } = opts
  const ai = chat.settings ?? getAi()
  if (forceLocal) return parseSpokenTasksLocal(text, ctx)
  if (!isAiConfigured(ai)) {
    if (fallbackLocal) return parseSpokenTasksLocal(text, ctx)
    assertConfigured(ai)
  }
  const raw = await chatJSON<unknown>(spokenSystemPrompt(ctx), `口述内容：${text}`, { maxTokens: 2048, ...chat })
  const tasks = normalizeSpokenTasks(raw, ctx)
  if (!tasks.length) throw new AiRequestError('没有识别出任务，请换个说法或手动编辑')
  return { tasks, source: 'ai' }
}

// ---------- 连接测试 ----------

export interface ConnectionTestResult {
  model: string
  latency: number
  reply: string
}

export async function testConnection(settings?: AiSettings): Promise<ConnectionTestResult> {
  const r = await chatText('你是连接测试助手。', '请只回复两个字：成功', { settings, maxTokens: 256, timeoutMs: 30_000 })
  return { model: r.model, latency: r.latency, reply: r.text.trim().slice(0, 40) }
}
