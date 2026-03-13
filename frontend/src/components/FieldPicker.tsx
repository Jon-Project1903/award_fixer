import { useState } from 'react'
import { Pencil, Check } from 'lucide-react'

interface Props {
  label: string
  fieldName: string
  dbValue: string | null
  unifiedValue: string | null
  semanticMatch?: boolean
  caseInsensitive?: boolean
  resolvedValue: string
  onChange: (fieldName: string, source: string, value: string) => void
}

/** Word-level diff: highlights words that differ between two strings */
function DiffHighlight({ base, compare, color }: { base: string; compare: string; color: 'blue' | 'amber' }) {
  const baseWords = base.split(/(\s+)/)
  const compareWords = compare.split(/(\s+)/)
  const bgClass = color === 'blue' ? 'bg-blue-200/60 text-blue-900' : 'bg-amber-200/60 text-amber-900'

  return (
    <span>
      {baseWords.map((word, i) => {
        if (/^\s+$/.test(word)) return <span key={i}>{word}</span>
        const differs = i >= compareWords.length || word !== compareWords[i]
        return differs ? (
          <span key={i} className={`${bgClass} rounded px-0.5`}>{word}</span>
        ) : (
          <span key={i}>{word}</span>
        )
      })}
    </span>
  )
}

export default function FieldPicker({ label, fieldName, dbValue, unifiedValue, semanticMatch, caseInsensitive, resolvedValue, onChange }: Props) {
  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(resolvedValue)

  const isExactMatch = dbValue != null && unifiedValue != null && dbValue === unifiedValue
  const isCaseMatch = !isExactMatch && caseInsensitive && dbValue != null && unifiedValue != null && dbValue.toLowerCase() === unifiedValue.toLowerCase()
  const isMatch = isExactMatch || isCaseMatch || (dbValue != null && unifiedValue != null && !!semanticMatch)
  const hasBoth = dbValue != null && unifiedValue != null
  const showDiff = hasBoth && !isMatch

  const startEdit = () => {
    setEditText(resolvedValue)
    setEditing(true)
  }

  const confirmEdit = () => {
    onChange(fieldName, 'manual', editText)
    setEditing(false)
  }

  const pickSource = (source: 'db_source' | 'unified', value: string) => {
    onChange(fieldName, source, value)
  }

  // Which source is currently selected?
  const isDbSelected = resolvedValue === dbValue
  const isUniSelected = resolvedValue === unifiedValue
  const isManual = !isDbSelected && !isUniSelected && resolvedValue !== ''

  return (
    <div className="py-3 border-b border-gray-100 last:border-0">
      <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">{label}</div>

      {/* Source rows — clickable to pick */}
      {isMatch ? (
        <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-2 mb-2">
          <span className="font-medium">{dbValue}</span>
          <span className="text-green-500 text-xs ml-auto">
            {isCaseMatch ? 'Match (case differs)' : isExactMatch ? 'Match' : 'Match (equivalent)'}
          </span>
        </div>
      ) : (
        <div className="space-y-1 mb-2">
          {dbValue != null && (
            <button
              onClick={() => pickSource('db_source', dbValue)}
              className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 w-full text-left cursor-pointer border transition-colors
                ${isDbSelected && !isManual ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200 hover:bg-blue-50/50 hover:border-blue-200'}`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span className="flex-1">
                {showDiff ? <DiffHighlight base={dbValue} compare={unifiedValue!} color="blue" /> : dbValue}
              </span>
              <span className="text-xs text-gray-400">Database</span>
            </button>
          )}
          {unifiedValue != null && (
            <button
              onClick={() => pickSource('unified', unifiedValue)}
              className={`flex items-center gap-3 text-sm rounded-lg px-3 py-2 w-full text-left cursor-pointer border transition-colors
                ${isUniSelected && !isDbSelected && !isManual ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-gray-200 hover:bg-amber-50/50 hover:border-amber-200'}`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="flex-1">
                {showDiff ? <DiffHighlight base={unifiedValue} compare={dbValue!} color="amber" /> : unifiedValue}
              </span>
              <span className="text-xs text-gray-400">Unified</span>
            </button>
          )}
        </div>
      )}

      {/* Resolved value — the final output */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 shrink-0">Final:</span>
        {editing ? (
          <div className="flex items-center gap-2 flex-1">
            <input
              type="text"
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
              className="flex-1 px-3 py-1.5 text-sm border border-blue-300 rounded-lg outline-none focus:ring-2 focus:ring-blue-500"
              autoFocus
            />
            <button
              onClick={confirmEdit}
              className="p-1.5 text-green-600 hover:bg-green-50 rounded-md cursor-pointer border-0 bg-transparent"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div className="flex items-center gap-2 flex-1 group">
            <span className={`text-sm font-medium px-3 py-1.5 rounded-lg flex-1 ${isManual ? 'bg-purple-50 text-purple-900 ring-1 ring-purple-200' : 'bg-gray-50 text-gray-900'}`}>
              {resolvedValue || <span className="text-gray-400 italic">No value</span>}
            </span>
            <button
              onClick={startEdit}
              className="p-1.5 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-md cursor-pointer border-0 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              title="Manual override"
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
