// Shared subject/body templating used everywhere a document gets emailed to a client — the
// Send dialog (for already-signed documents) and the signing flow's own "Send to client" step.
// Keeping one definition means a template written in one place renders the same way everywhere.

export interface TemplateVars {
  clientName: string
  documentName: string
  firmName: string
  password?: string
}

export const MESSAGE_VARIABLES: { token: string; label: string }[] = [
  { token: '{{client_name}}', label: 'Client name' },
  { token: '{{document_name}}', label: 'Document name' },
  { token: '{{firm_name}}', label: 'Firm name' },
  { token: '{{password}}', label: 'Password' },
]

export const DEFAULT_SUBJECT_TEMPLATE = '{{document_name}} — signed document from {{firm_name}}'
export const DEFAULT_BODY_TEMPLATE =
  'Hi {{client_name}},\n\nPlease find attached {{document_name}}.\n\nRegards,\n{{firm_name}}'

// Appended to the body (not baked into DEFAULT_BODY_TEMPLATE) only when the sender has chosen
// to include the password in this email — see the "Include password" toggle next to it.
export const PASSWORD_LINE_TEMPLATE = 'PDF password: {{password}}'

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replaceAll('{{client_name}}', vars.clientName.trim() || 'there')
    .replaceAll('{{document_name}}', vars.documentName)
    .replaceAll('{{firm_name}}', vars.firmName)
    .replaceAll('{{password}}', vars.password ?? '')
}
