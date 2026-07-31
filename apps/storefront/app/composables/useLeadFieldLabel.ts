import type { LeadFormField } from '@amalice/shared'

// Arabic/RTL storefront conversion — DEFAULT_LEAD_FORM_FIELDS (packages/
// shared/src/store-settings.ts) stays in English on purpose: it's also read
// by the ADMIN field editor (settings/storefront.vue), which stays English/
// LTR per the "storefront only" scope decision. Translating the shared
// default would leak Arabic into admin. Instead, the storefront maps the 4
// core field keys (present on every store regardless of admin config) to
// Arabic for display only — the underlying key/label stored and submitted
// is untouched, so admin's editor and the API's field-mapping logic (which
// key off `key`, not `label`) are unaffected. Any CUSTOM field an admin adds
// beyond the 4 core ones falls back to whatever the admin typed — not
// something this can safely auto-translate.
const CORE_LABELS_AR: Record<string, string> = {
  name: 'الاسم الكامل',
  phone: 'رقم الهاتف',
  wilaya: 'الولاية',
  commune: 'البلدية'
}

const CORE_PLACEHOLDERS_AR: Record<string, string> = {
  name: 'اسمك',
  phone: '+213...',
  wilaya: 'اختر الولاية',
  commune: 'اختر البلدية'
}

export function leadFieldLabel(field: Pick<LeadFormField, 'key' | 'label'>): string {
  return CORE_LABELS_AR[field.key] ?? field.label
}

export function leadFieldPlaceholder(field: Pick<LeadFormField, 'key' | 'placeholder'>): string | undefined {
  return CORE_PLACEHOLDERS_AR[field.key] ?? field.placeholder
}
