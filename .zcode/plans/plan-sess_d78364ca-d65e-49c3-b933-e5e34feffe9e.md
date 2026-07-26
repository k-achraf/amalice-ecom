# Dynamic, admin-configurable lead form

## What
The admin defines lead-form fields (name, type, label, placeholder, required, validation) in a visual builder on the Storefront settings page. The storefront renders them dynamically. The API accepts arbitrary field values via a flexible JSON payload.

## Data model

**`leadFormConfig` JSON column on `StoreSettings`** (nullable — null = use default 4 fields). The JSON shape:

```ts
interface LeadFormField {
  id: string              // stable key (uuid), used as the form-data key
  key: string             // 'name' | 'phone' | 'wilaya' | 'commune' | custom key
  label: string           // "Full name", "Phone", "Wilaya", etc.
  type: 'text' | 'tel' | 'email' | 'number' | 'select' | 'textarea'
  placeholder?: string
  required: boolean
  options?: string[]      // for select type
  // The 4 core fields have special server-side meaning — the API maps them
  // to customer/address columns. Custom fields are stored in the order's
  // address.line2 or a notes field as JSON.
  isCore?: boolean        // true for name/phone/wilaya/commune (not editable key/type, only label/required)
  halfWidth?: boolean     // UI hint: render at half width (paired in a 2-col grid)
}
```

Default config (when null): the current 4 fields (name, phone, wilaya, commune).

**Shared type** (`packages/shared`): `LeadFormFieldSchema`, `LeadFormConfigSchema` (array of fields), add `leadFormConfig` to `StoreSettingsSchema`.

## Backend

**API changes:**
- `StoreSettings` model: add `leadFormConfig Json? @map("lead_form_config")` + migration
- `StoreSettingsService`: thread `leadFormConfig` through `getPublic`/`update` (same pattern as `displayCart`)
- `LeadOrderSchema`: change from hardcoded `{ name, phone, wilaya, commune, items }` to `{ fields: Record<string, string>, items }` — accepts arbitrary field key/value pairs. The service maps known core keys (name/phone/wilaya/commune) to customer/address; extras go into address.line2 as JSON.
- `orders.service.createLeadOrder`: read the incoming `fields` object, map core keys, store extras.

## Admin — visual field builder

New section in the Storefront settings page: **"Lead form fields"** (shown only when `displayCart` is false).

- A drag-to-reorder list of field cards. Each card shows: label, type badge, required toggle, enable/disable toggle.
- **Add field** button → opens a modal: key, label, type (text/tel/email/number/select/textarea), placeholder, required, halfWidth.
- **Edit field** → same modal, pre-filled.
- **Delete field** (except core fields — name and phone are always present and can't be deleted; their label/required can be edited but not key/type).
- **Enable/disable** toggle per field — a disabled field is not rendered on the storefront and not required.
- The config is saved as part of the StoreSettings PUT (alongside template/storeName/displayCart).

## Storefront — dynamic rendering

**PDP page shell** (`[slug].vue`):
- Read `leadFormConfig` from `useStoreSettings()`
- Build a dynamic `leadFormData: Record<string, string>` reactive object from the enabled fields
- `onSubmitLead` sends `{ fields: leadFormData, items: [...] }` to `POST /orders/lead`
- Pass `fields` (the config array) + `leadFormData` + handlers to all 4 template components

**Shared component: `<LeadFormFields>`** — a new component that iterates over the field config and renders the right input per type. All 4 PDP template components use this instead of hardcoded markup. The component wraps the fields in each template's styling (the wrapper card is per-template; the fields inside are shared). This eliminates 4× field markup duplication.

## File-level build order

1. Schema migration + shared types (LeadFormField, LeadFormConfig, StoreSettingsSchema) + rebuild shared
2. API: thread leadFormConfig through settings; update LeadOrderSchema + createLeadOrder to accept dynamic fields
3. Shared `<LeadFormFields>` component for the storefront
4. Storefront PDP shell: dynamic leadFormData + fields prop + onSubmitLead
5. All 4 PDP template components: replace hardcoded fields with `<LeadFormFields>`
6. Admin: visual field builder section in storefront settings
7. Verify: build all