import { useRef, type ReactNode } from 'react'
import { Download, FileSpreadsheet, Upload } from 'lucide-react'

import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

type TemplateColumn = 'clientName' | 'email' | 'password'

interface RecipientTemplateCardProps {
  fileNames: string[]
  helperText: string
  onDownload: () => void
  onUpload: (file: File) => void
  uploadedFileName?: string
  status?: ReactNode
  disabled?: boolean
  /** Which columns (besides File, always first) this template carries. Defaults to all three —
   * pass a subset (e.g. just ['password']) when the rest genuinely don't apply. */
  columns?: TemplateColumn[]
}

const COLUMN_META: Record<TemplateColumn, { header: string; example: string[] }> = {
  clientName: { header: 'Name', example: ['Rahul Verma', 'Nexora Industries'] },
  email: { header: 'Email', example: ['client@company.com', 'accounts@company.com'] },
  password: { header: 'Password', example: ['••••••••', '••••••••'] },
}

/** Shows the recipient CSV's real structure — actual file names, example values for the rest —
 * before the user ever downloads it, so "what am I supposed to fill in" is answered on screen
 * instead of only inside a file they have to open first. */
export function RecipientTemplateCard({
  fileNames,
  helperText,
  onDownload,
  onUpload,
  uploadedFileName,
  status,
  disabled,
  columns = ['clientName', 'email', 'password'],
}: RecipientTemplateCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const previewRows = fileNames.slice(0, 2)
  const remaining = fileNames.length - previewRows.length
  const fileColWidth = columns.length === 1 ? 60 : 30
  const restColWidth = (100 - fileColWidth) / columns.length

  return (
    <div className="flex flex-col gap-3">
      <span className="text-[11px] text-muted-foreground">{helperText}</span>

      <div className="overflow-hidden rounded-[10px] border border-border">
        <div className="flex items-center gap-1.5 border-b border-border bg-secondary/50 px-3 py-1.5">
          <FileSpreadsheet className="size-3 shrink-0 text-muted-foreground" />
          <span className="truncate text-[10px] font-semibold tracking-wide text-muted-foreground uppercase">
            {uploadedFileName ?? 'template.csv'}
          </span>
        </div>
        <table className="w-full table-fixed border-collapse">
          <colgroup>
            <col style={{ width: `${fileColWidth}%` }} />
            {columns.map((col) => (
              <col key={col} style={{ width: `${restColWidth}%` }} />
            ))}
          </colgroup>
          <thead>
            <tr>
              <th className="h-8 truncate px-2 pl-3 text-left text-[9.5px] font-semibold text-muted-foreground/80">
                File
              </th>
              {columns.map((col) => (
                <th key={col} className="h-8 truncate px-2 text-left text-[9.5px] font-semibold text-muted-foreground/80">
                  {COLUMN_META[col].header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {previewRows.map((name, i) => (
              <tr key={name} className="border-t border-border">
                <td className="truncate py-1.5 pl-3 font-mono text-[10px]" title={name}>
                  {name}
                </td>
                {columns.map((col) => (
                  <td
                    key={col}
                    className="truncate px-2 py-1.5 font-mono text-[10px] text-muted-foreground/55 italic"
                  >
                    {COLUMN_META[col].example[i % COLUMN_META[col].example.length]}
                  </td>
                ))}
              </tr>
            ))}
            {previewRows.length === 0 && (
              <tr className="border-t border-border">
                <td colSpan={columns.length + 1} className="py-3 text-center text-[10.5px] text-muted-foreground">
                  Add files to see them listed here
                </td>
              </tr>
            )}
          </tbody>
        </table>
        {remaining > 0 && (
          <div className="border-t border-border px-3 py-1.5 text-[10.5px] text-muted-foreground">
            + {remaining} more row{remaining === 1 ? '' : 's'} — one per file
          </div>
        )}
      </div>

      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          disabled={disabled}
          onClick={onDownload}
          className="h-9 flex-1 gap-1.5 rounded-[9px] bg-secondary text-[11.5px] font-semibold hover:bg-secondary/70"
        >
          <Download className="size-3.5" />
          Download this template
        </Button>
      </div>

      <label
        className={cn(
          'flex h-9 cursor-pointer items-center justify-center gap-1.5 rounded-[9px] border border-dashed border-border text-[11.5px] font-medium text-muted-foreground hover:border-primary/40',
          disabled && 'pointer-events-none opacity-50',
        )}
      >
        <Upload className="size-3.5" />
        {uploadedFileName ? 'Replace filled-in file' : 'Upload filled-in file'}
        <input
          ref={inputRef}
          type="file"
          accept=".csv"
          className="hidden"
          disabled={disabled}
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) onUpload(file)
            e.target.value = ''
          }}
        />
      </label>

      {uploadedFileName && (
        <div className="flex flex-col gap-0.5 rounded-[9px] bg-secondary/50 px-3 py-2 text-[11.5px]">
          <span className="truncate font-semibold">{uploadedFileName}</span>
          {status}
        </div>
      )}
    </div>
  )
}
