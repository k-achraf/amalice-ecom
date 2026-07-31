<script setup lang="ts">
import { z } from 'zod'

useSeoMeta({
  title: 'اتصل بنا',
  description: 'تواصل مع خدمة زبائن أماليس.'
})

const config = useRuntimeConfig()
const api = useApiClient()

const ContactSchema = z.object({
  name: z.string().min(1).max(200),
  email: z.email(),
  message: z.string().min(1).max(5000)
})

const state = ref({ name: '', email: '', message: '' })
const submitted = ref(false)
const error = ref('')
const sending = ref(false)

async function onSubmit() {
  error.value = ''
  sending.value = true
  try {
    const parsed = ContactSchema.parse(state.value)
    // SF-07 — contact messages route through the same notification queue as
    // order events (ConsoleNotificationProvider in dev logs them). A real
    // support inbox is a binding change, not a new system.
    await api('/notifications/contact', { method: 'POST', body: parsed })
    submitted.value = true
  } catch (err) {
    if (err instanceof z.ZodError) {
      error.value = err.issues[0]?.message ?? 'يرجى التحقق من البيانات المدخلة.'
    } else {
      // The contact endpoint may not exist yet (it's a thin shim) — fall back
      // gracefully rather than blocking the user.
      error.value = 'تعذر الإرسال حالياً. يرجى المحاولة لاحقاً.'
    }
  } finally {
    sending.value = false
  }
}
void config
</script>

<template>
  <main class="mx-auto max-w-xl space-y-8 px-4 py-12">
    <h1 class="text-3xl font-bold">اتصل بنا</h1>
    <p class="text-muted">لديك سؤال حول طلب أو منتج أو طريقة عملنا؟ أرسل لنا رسالة.</p>

    <div v-if="submitted" class="rounded-lg border border-default bg-elevated p-6 text-center">
      <UIcon name="i-lucide-check-circle" class="mx-auto mb-3 size-10 text-success" />
      <h2 class="font-semibold">شكراً لك — تم استلام رسالتك</h2>
      <p class="mt-1 text-sm text-muted">سنتواصل معك عبر البريد الإلكتروني الذي زودتنا به.</p>
    </div>

    <UForm v-else :state="state" class="space-y-4" @submit="onSubmit">
      <UFormField label="الاسم" name="name"><UInput v-model="state.name" class="w-full" /></UFormField>
      <UFormField label="البريد الإلكتروني" name="email"><UInput v-model="state.email" type="email" class="w-full" /></UFormField>
      <UFormField label="الرسالة" name="message"><UTextarea v-model="state.message" :rows="5" class="w-full" /></UFormField>
      <p v-if="error" class="text-sm text-error">{{ error }}</p>
      <UButton type="submit" :loading="sending" color="primary">إرسال الرسالة</UButton>
    </UForm>
  </main>
</template>
