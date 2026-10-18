<script setup lang="ts">
import type { AssistantAnswer, AssistantMessage } from '@amalice/shared'

definePageMeta({ requiredRole: ['SuperAdmin', 'OpsManager', 'Finance'] })
useHead({ title: 'AI assistant' })

const api = useAdminApi()
const { run } = useApiAction()

interface ChatTurn extends AssistantMessage {
  toolsUsed?: string[]
}

const TOOL_LABELS: Record<string, string> = {
  sales_overview: 'Sales overview',
  top_products: 'Top products',
  wilaya_performance: 'Wilaya performance',
  call_center_performance: 'Call center',
  low_stock: 'Low stock'
}

const SUGGESTIONS = [
  'ما هي الولايات التي ترتفع فيها نسبة المرتجعات؟',
  'لخّص أداء آخر 7 أيام',
  'ما المنتجات الأكثر مبيعا وهل ترتفع مرتجعاتها؟',
  'أي موظف في مركز الاتصال لديه أفضل نسبة تأكيد؟'
]

const turns = ref<ChatTurn[]>([])
const question = ref('')
const asking = ref(false)
const scroller = ref<HTMLElement | null>(null)

// The model answers with light markdown (**bold**, *italic*, "* " / "- "
// bullets). The text is HTML-escaped FIRST and only then are those markers
// turned into tags/bullets, so nothing the model (or a data value it quotes)
// emits can inject markup.
function formatAnswer(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/^[ \t]*[*-][ \t]+/gm, '• ')
    .replace(/\*\*(.+?)\*\*/gs, '<strong>$1</strong>')
    .replace(/(?<!\*)\*(?!\s)(.+?)(?<!\s)\*(?!\*)/gs, '<em>$1</em>')
}

async function scrollDown() {
  await nextTick()
  scroller.value?.scrollTo({ top: scroller.value.scrollHeight, behavior: 'smooth' })
}

async function ask(text?: string) {
  const q = (text ?? question.value).trim()
  if (!q || asking.value) return
  // Only the last turns are sent as context; tool names are UI-only.
  const history = turns.value.slice(-10).map(({ role, text: t }) => ({ role, text: t }))
  turns.value.push({ role: 'user', text: q })
  question.value = ''
  asking.value = true
  scrollDown()
  const result = await run(() => api<AssistantAnswer>('/admin/ai/assistant', { method: 'POST', body: { question: q, history } }), {
    errorFallback: 'The assistant could not answer'
  })
  asking.value = false
  if (result === undefined) {
    // Put the question back so it can be retried.
    turns.value.pop()
    question.value = q
    return
  }
  turns.value.push({ role: 'assistant', text: result.answer, toolsUsed: result.toolsUsed })
  scrollDown()
}

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault()
    ask()
  }
}
</script>

<template>
  <AdsPage title="AI assistant" description="Ask about your sales, returns, products, wilayas and call center. Answers come from your live data.">
    <section class="card" style="display: flex; flex-direction: column; min-height: 60vh">
      <div ref="scroller" style="flex: 1; overflow-y: auto; max-height: 60vh; padding: 4px 2px" dir="auto">
        <div v-if="turns.length === 0" style="padding: 12px 0">
          <p class="card-sub">Try one of these:</p>
          <div style="display: flex; flex-wrap: wrap; gap: 8px; margin-top: 8px">
            <button v-for="s in SUGGESTIONS" :key="s" class="btn btn-sm" type="button" dir="auto" @click="ask(s)">{{ s }}</button>
          </div>
        </div>

        <div v-for="(t, i) in turns" :key="i" style="margin: 12px 0; display: flex" :style="{ justifyContent: t.role === 'user' ? 'flex-end' : 'flex-start' }">
          <div
            dir="auto"
            style="max-width: 85%; padding: 10px 14px; border-radius: 8px; white-space: pre-wrap; line-height: 1.6"
            :style="t.role === 'user' ? { background: 'var(--teal)', color: '#fff' } : { background: 'var(--ivory)', border: '1px solid var(--line, #e5e2d8)' }"
          >
            <span v-if="t.role === 'assistant'" v-html="formatAnswer(t.text)" />
            <template v-else>{{ t.text }}</template>
            <div v-if="t.toolsUsed?.length" class="muted" style="margin-top: 8px; font-size: 12px" dir="ltr">
              Based on: {{ t.toolsUsed.map((n) => TOOL_LABELS[n] ?? n).join(' · ') }}
            </div>
          </div>
        </div>

        <p v-if="asking" class="muted" style="margin: 12px 0">Analyzing your data…</p>
      </div>

      <form style="display: flex; gap: 8px; margin-top: 12px; align-items: flex-end" @submit.prevent="ask()">
        <textarea
          v-model="question"
          class="input"
          dir="auto"
          rows="2"
          maxlength="1000"
          placeholder="اكتب سؤالك… / Ask a question…"
          style="flex: 1; resize: vertical"
          :disabled="asking"
          @keydown="onKeydown"
        />
        <button class="btn btn-primary" type="submit" :disabled="asking || !question.trim()"><AdsIcon name="i-lucide-sparkles" />Ask</button>
      </form>
      <p class="muted" style="margin-top: 8px; font-size: 12px">Read-only: the assistant cannot change orders, prices or settings. Check important figures before acting on them.</p>
    </section>
  </AdsPage>
</template>
