// Shared subject/body templating used everywhere a document gets emailed to a client — the
// Send dialog (for already-signed documents) and the signing flow's own "Send to client" step.
// Keeping one definition means a template written in one place renders the same way everywhere.

export interface TemplateVars {
  clientName: string
  documentName: string
  firmName: string
  /** How the PDF password is formed (e.g. "PAN in lowercase + DOB") — never the password itself. */
  passwordHint?: string
}

export const MESSAGE_VARIABLES: { token: string; label: string }[] = [
  { token: '{{client_name}}', label: 'Client name' },
  { token: '{{document_name}}', label: 'Document name' },
  { token: '{{firm_name}}', label: 'Firm name' },
]

export const DEFAULT_SUBJECT_TEMPLATE = '{{document_name}} — signed document from {{firm_name}}'
export const DEFAULT_BODY_TEMPLATE =
  'Hi {{client_name}},\n\nPlease find attached {{document_name}}.\n\nRegards,\n{{firm_name}}'

// The actual PDF password is never emailed. What goes out is a hint describing how the client
// can construct it themselves (PAN, date of birth and so on), rendered in its own highlighted
// block in the email — see PASSWORD_HINT_PRESETS in the send flow.

export function renderTemplate(template: string, vars: TemplateVars): string {
  return template
    .replaceAll('{{client_name}}', vars.clientName.trim() || 'there')
    .replaceAll('{{document_name}}', vars.documentName)
    .replaceAll('{{firm_name}}', vars.firmName)
}
