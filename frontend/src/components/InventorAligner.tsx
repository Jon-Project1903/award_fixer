import { useState } from 'react'
import { Pencil, Check, X, UserPlus, Trash2, RotateCcw } from 'lucide-react'

interface AlignedInventor {
  db_inventor_id: number | null
  db_inventor_name: string | null
  db_inventor_award_type: string | null
  db_inventor_country: string | null
  db_inventor_employment_status: string | null
  unified_inventor_id: number | null
  unified_inventor_name: string | null
  score: number
}

interface Props {
  alignment: AlignedInventor[]
  choices: Record<string, { source: string; value: string }>
  onChange: (fieldName: string, source: string, value: string) => void
}

/** Word-level diff highlight for names */
function NameDiff({ base, compare, color }: { base: string; compare: string; color: 'blue' | 'amber' }) {
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

function InventorRow({ pair, index, choices, onChange }: {
  pair: AlignedInventor
  index: number
  choices: Record<string, { source: string; value: string }>
  onChange: (fieldName: string, source: string, value: string) => void
}) {
  const fieldName = pair.db_inventor_id
    ? `inventor_${pair.db_inventor_id}_name`
    : `inventor_uni_${pair.unified_inventor_id}_name`
  const includeField = pair.db_inventor_id
    ? `inventor_${pair.db_inventor_id}_include`
    : `inventor_uni_${pair.unified_inventor_id}_include`

  const isMatch = pair.score >= 0.95
  const hasBoth = !!(pair.db_inventor_name && pair.unified_inventor_name)
  const showDiff = hasBoth && !isMatch

  // Resolved name
  const nameChoice = choices[fieldName]
  const defaultName = pair.db_inventor_name || pair.unified_inventor_name || ''
  const resolvedName = nameChoice?.value || defaultName

  // Include/exclude
  const includeChoice = choices[includeField]
  const isExcluded = includeChoice?.value === 'no'

  const [editing, setEditing] = useState(false)
  const [editText, setEditText] = useState(resolvedName)

  const startEdit = () => { setEditText(resolvedName); setEditing(true) }
  const confirmEdit = () => { onChange(fieldName, 'manual', editText); setEditing(false) }
  const toggleExclude = () => {
    const newVal = isExcluded ? 'yes' : 'no'
    const src = pair.db_inventor_name ? 'db_source' : (pair.unified_inventor_name ? 'unified' : 'manual')
    onChange(includeField, src, newVal)
  }

  const isDbSelected = resolvedName === pair.db_inventor_name
  const isUniSelected = resolvedName === pair.unified_inventor_name
  const isManual = !isDbSelected && !isUniSelected && resolvedName !== ''

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-opacity ${isExcluded ? 'border-gray-200 opacity-50' : 'border-gray-200'}`}>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <span className="text-xs font-semibold text-gray-500">Inventor {index + 1}</span>
        <div className="flex items-center gap-2">
          {pair.score > 0 && (
            <span className={`text-xs font-medium ${pair.score >= 0.95 ? 'text-green-600' : pair.score >= 0.7 ? 'text-amber-600' : 'text-red-600'}`}>
              {Math.round(pair.score * 100)}% match
            </span>
          )}
          <button
            onClick={toggleExclude}
            title={isExcluded ? 'Include in output' : 'Exclude from output'}
            className={`p-1 rounded cursor-pointer border-0 transition-colors ${isExcluded ? 'text-red-500 hover:bg-red-50 bg-transparent' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent'}`}
          >
            {isExcluded ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      <div className={`px-4 py-3 space-y-2 ${isExcluded ? 'line-through' : ''}`}>
        {/* Source rows — clickable to pick */}
        {hasBoth && isMatch && (
          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 rounded-lg px-3 py-1.5">
            <span>{pair.db_inventor_name}</span>
            <span className="text-green-500 text-xs ml-auto">Names match</span>
          </div>
        )}
        {hasBoth && !isMatch && (
          <div className="space-y-1">
            <button
              onClick={() => onChange(fieldName, 'db_source', pair.db_inventor_name!)}
              className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 w-full text-left cursor-pointer border transition-colors
                ${isDbSelected && !isManual ? 'bg-blue-50 border-blue-300 ring-1 ring-blue-200' : 'bg-white border-gray-200 hover:bg-blue-50/50 hover:border-blue-200'}`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
              <span className="flex-1">
                {showDiff ? <NameDiff base={pair.db_inventor_name!} compare={pair.unified_inventor_name!} color="blue" /> : pair.db_inventor_name}
              </span>
              <span className="text-xs text-gray-400">Database</span>
            </button>
            <button
              onClick={() => onChange(fieldName, 'unified', pair.unified_inventor_name!)}
              className={`flex items-center gap-2 text-sm rounded-lg px-3 py-1.5 w-full text-left cursor-pointer border transition-colors
                ${isUniSelected && !isDbSelected && !isManual ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-200' : 'bg-white border-gray-200 hover:bg-amber-50/50 hover:border-amber-200'}`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
              <span className="flex-1">
                {showDiff ? <NameDiff base={pair.unified_inventor_name!} compare={pair.db_inventor_name!} color="amber" /> : pair.unified_inventor_name}
              </span>
              <span className="text-xs text-gray-400">Unified</span>
            </button>
          </div>
        )}
        {!hasBoth && (
          <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-1.5">
            <span>{pair.db_inventor_name || pair.unified_inventor_name}</span>
            <span className="text-amber-500 text-xs ml-auto">{pair.db_inventor_name ? 'Database only' : 'Unified only'}</span>
          </div>
        )}

        {/* Resolved value — final output */}
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
              <button onClick={confirmEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md cursor-pointer border-0 bg-transparent">
                <Check className="w-4 h-4" />
              </button>
              <button onClick={() => setEditing(false)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-md cursor-pointer border-0 bg-transparent">
                <X className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 group">
              <span className={`text-sm font-medium px-3 py-1.5 rounded-lg flex-1 ${isManual ? 'bg-purple-50 text-purple-900 ring-1 ring-purple-200' : 'bg-gray-50 text-gray-900'}`}>
                {resolvedName}
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

        {/* Extra info from db_source */}
        {pair.db_inventor_country && (
          <div className="text-xs text-gray-500">Country: {pair.db_inventor_country}</div>
        )}
        {pair.db_inventor_award_type && (
          <div className={`text-xs ${pair.db_inventor_award_type === 'Opt-Out' ? 'text-orange-600 font-medium' : 'text-gray-500'}`}>
            Award: {pair.db_inventor_award_type}
          </div>
        )}
        {pair.db_inventor_employment_status && (
          <div className={`text-xs ${pair.db_inventor_employment_status.toLowerCase() === 'termed' ? 'text-red-600 font-medium' : 'text-gray-500'}`}>
            Employment: {pair.db_inventor_employment_status}
          </div>
        )}
      </div>
    </div>
  )
}

function AddedInventorRow({ index, globalIndex, choices, onChange }: {
  index: number
  globalIndex: number
  choices: Record<string, { source: string; value: string }>
  onChange: (fieldName: string, source: string, value: string) => void
}) {
  const nameField = `inventor_new_${index}_name`
  const includeField = `inventor_new_${index}_include`
  const nameChoice = choices[nameField]
  const includeChoice = choices[includeField]
  const resolvedName = nameChoice?.value || ''
  const isExcluded = includeChoice?.value === 'no'

  const [editing, setEditing] = useState(!resolvedName)
  const [editText, setEditText] = useState(resolvedName)

  const confirmEdit = () => {
    onChange(nameField, 'manual', editText)
    onChange(includeField, 'manual', 'yes')
    setEditing(false)
  }
  const toggleExclude = () => {
    onChange(includeField, 'manual', isExcluded ? 'yes' : 'no')
  }

  return (
    <div className={`bg-white rounded-xl border overflow-hidden transition-opacity ${isExcluded ? 'border-gray-200 opacity-50' : 'border-purple-200'}`}>
      <div className="flex items-center justify-between px-4 py-2 bg-purple-50 border-b border-purple-100">
        <span className="text-xs font-semibold text-purple-600">Inventor {globalIndex + 1} (added manually)</span>
        <button
          onClick={toggleExclude}
          title={isExcluded ? 'Include in output' : 'Exclude from output'}
          className={`p-1 rounded cursor-pointer border-0 transition-colors ${isExcluded ? 'text-red-500 hover:bg-red-50 bg-transparent' : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100 bg-transparent'}`}
        >
          {isExcluded ? <RotateCcw className="w-3.5 h-3.5" /> : <Trash2 className="w-3.5 h-3.5" />}
        </button>
      </div>
      <div className={`px-4 py-3 ${isExcluded ? 'line-through' : ''}`}>
        <div className="flex items-center gap-2">
          <span className="text-xs text-gray-400 shrink-0">Final:</span>
          {editing ? (
            <div className="flex items-center gap-2 flex-1">
              <input
                type="text"
                value={editText}
                onChange={(e) => setEditText(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && confirmEdit()}
                placeholder="Enter inventor name..."
                className="flex-1 px-3 py-1.5 text-sm border border-purple-300 rounded-lg outline-none focus:ring-2 focus:ring-purple-500"
                autoFocus
              />
              <button onClick={confirmEdit} className="p-1.5 text-green-600 hover:bg-green-50 rounded-md cursor-pointer border-0 bg-transparent">
                <Check className="w-4 h-4" />
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2 flex-1 group">
              <span className="text-sm font-medium bg-purple-50 text-purple-900 ring-1 ring-purple-200 px-3 py-1.5 rounded-lg flex-1">
                {resolvedName}
              </span>
              <button
                onClick={() => { setEditText(resolvedName); setEditing(true) }}
                className="p-1.5 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-md cursor-pointer border-0 bg-transparent opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <Pencil className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default function InventorAligner({ alignment, choices, onChange }: Props) {
  const addedCount = Object.keys(choices).filter(k => k.startsWith('inventor_new_') && k.endsWith('_name')).length

  const addInventor = () => {
    const nextIndex = addedCount
    onChange(`inventor_new_${nextIndex}_name`, 'manual', '')
    onChange(`inventor_new_${nextIndex}_include`, 'manual', 'yes')
  }

  const totalFromAlignment = alignment.length

  return (
    <div className="space-y-3">
      {alignment.length === 0 && addedCount === 0 && (
        <p className="text-sm text-gray-500 italic">No inventor data available</p>
      )}

      {alignment.map((pair, i) => (
        <InventorRow key={i} pair={pair} index={i} choices={choices} onChange={onChange} />
      ))}

      {Array.from({ length: addedCount }).map((_, i) => (
        <AddedInventorRow
          key={`new-${i}`}
          index={i}
          globalIndex={totalFromAlignment + i}
          choices={choices}
          onChange={onChange}
        />
      ))}

      <button
        onClick={addInventor}
        className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-50 hover:bg-purple-100 rounded-lg cursor-pointer border border-purple-200 transition-colors"
      >
        <UserPlus className="w-4 h-4" />
        Add Inventor
      </button>
    </div>
  )
}
