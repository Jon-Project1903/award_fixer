import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import StatusBadge from '../components/StatusBadge'
import FieldPicker from '../components/FieldPicker'
import InventorAligner from '../components/InventorAligner'
import { ArrowLeft, Save, CheckCircle, Loader2, ExternalLink } from 'lucide-react'

export default function ReconciliationDetailPage() {
  const { id } = useParams<{ id: string }>()
  const crossrefId = Number(id)
  const navigate = useNavigate()
  const location = useLocation()
  const returnSearch = (location.state as any)?.returnSearch || ''
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['reconciliation', crossrefId],
    queryFn: () => api.getReconciliationDetail(crossrefId),
  })

  // Track all choices as { [fieldName]: { source, value } }
  const [choices, setChoices] = useState<Record<string, { source: string; value: string }>>({})
  const [initialized, setInitialized] = useState(false)

  // Initialize choices: saved choices first, then compute defaults for anything missing
  useEffect(() => {
    if (!data) return

    const map: Record<string, { source: string; value: string }> = {}

    // Load saved choices
    if (data.choices?.length) {
      for (const c of data.choices) {
        map[c.field_name] = { source: c.chosen_source, value: c.chosen_value }
      }
    }

    const db = data.db_source
    const uni = data.unified

    // Default title: prefer unified, make it ALL CAPS
    if (!map['title']) {
      const val = uni?.title || db?.title || ''
      map['title'] = { source: uni ? 'unified' : 'db_source', value: val.toUpperCase() }
    }

    // Default issue_date
    if (!map['issue_date']) {
      const val = db?.issue_date || uni?.publication_date || ''
      map['issue_date'] = { source: db ? 'db_source' : 'unified', value: val }
    }

    // Default inventor names from alignment
    for (const pair of data.inventor_alignment || []) {
      const fieldName = pair.db_inventor_id
        ? `inventor_${pair.db_inventor_id}_name`
        : `inventor_uni_${pair.unified_inventor_id}_name`
      if (!map[fieldName]) {
        const name = pair.db_inventor_name || pair.unified_inventor_name || ''
        const src = pair.db_inventor_name ? 'db_source' : 'unified'
        map[fieldName] = { source: src, value: name }
      }
      // Default include to yes
      const includeField = pair.db_inventor_id
        ? `inventor_${pair.db_inventor_id}_include`
        : `inventor_uni_${pair.unified_inventor_id}_include`
      if (!map[includeField]) {
        map[includeField] = { source: 'manual', value: 'yes' }
      }
    }

    setChoices(map)
    setInitialized(true)
  }, [data])

  const handleChange = useCallback((fieldName: string, source: string, value: string) => {
    setChoices(prev => ({ ...prev, [fieldName]: { source, value } }))
  }, [])

  const saveMutation = useMutation({
    mutationFn: () => {
      const arr = Object.entries(choices).map(([field_name, { source, value }]) => ({
        field_name,
        chosen_source: source,
        chosen_value: value,
      }))
      return api.saveChoices(crossrefId, arr)
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['reconciliation', crossrefId] }),
  })

  const resolveMutation = useMutation({
    mutationFn: async () => {
      // Save choices first, then mark resolved
      const arr = Object.entries(choices).map(([field_name, { source, value }]) => ({
        field_name,
        chosen_source: source,
        chosen_value: value,
      }))
      await api.saveChoices(crossrefId, arr)
      return api.resolveReconciliation(crossrefId)
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliation', crossrefId] })
      queryClient.invalidateQueries({ queryKey: ['reconciliations'] })
      queryClient.invalidateQueries({ queryKey: ['project'] })
      navigate(`/projects/${data!.project_id}${returnSearch ? `?${returnSearch}` : ''}`)
    },
  })

  if (isLoading || !data || !initialized) {
    return <div className="text-center py-12 text-gray-500">Loading...</div>
  }

  const db = data.db_source
  const uni = data.unified

  return (
    <div>
      {/* Sticky top bar */}
      <div className="sticky top-0 z-10 bg-gray-50/95 backdrop-blur-sm border-b border-gray-200 -mx-6 px-6 py-3 mb-6">
        <div className="flex items-center justify-between">
          <button
            onClick={() => navigate(`/projects/${data.project_id}${returnSearch ? `?${returnSearch}` : ''}`)}
            className="inline-flex items-center gap-1.5 text-sm text-gray-600 hover:text-gray-900 cursor-pointer border-0 bg-transparent"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to Project
          </button>

          <div className="flex items-center gap-3">
            <StatusBadge status={data.status} resolved={data.resolved} />
            {data.match_score != null && (
              <span className="text-sm text-gray-500">
                Score: {Math.round(data.match_score * 100)}%
              </span>
            )}
            <button
              onClick={() => saveMutation.mutate()}
              disabled={saveMutation.isPending}
              className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer border-0"
            >
              {saveMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Save className="w-4 h-4" />
              )}
              Save
            </button>
            {!data.resolved && (
              <button
                onClick={() => resolveMutation.mutate()}
                disabled={resolveMutation.isPending}
                className="inline-flex items-center gap-2 px-4 py-2 bg-green-600 text-white text-sm font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors cursor-pointer border-0"
              >
                {resolveMutation.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CheckCircle className="w-4 h-4" />
                )}
                Mark Resolved
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto">

      {/* Patent Number Header */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
        <div className="flex items-center justify-between">
          <div>
            <span className="text-xs text-gray-500 uppercase tracking-wide font-medium">Patent</span>
            <div className="flex items-center gap-2 mt-0.5">
              <h2 className="text-lg font-bold text-gray-900 font-mono m-0">
                {db?.patent_no || uni?.publication_number}
              </h2>
              {db?.patent_no && (
                <a
                  href={`https://patents.google.com/patent/${db.patent_no.replace(/[\s-]/g, '')}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 no-underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  Google Patents
                </a>
              )}
            </div>
            {db?.asset_name && (
              <div className="text-xs text-gray-500 mt-1">Asset: {db.asset_name}</div>
            )}
          </div>
          {data.notes && (
            <div className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-1.5 max-w-sm">
              {data.notes}
            </div>
          )}
        </div>
      </div>

      {/* Source legend */}
      <div className="flex gap-4 mb-4 text-xs">
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-blue-500" />
          <span className="text-gray-500">Database (Symfony)</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="w-2 h-2 rounded-full bg-amber-500" />
          <span className="text-gray-500">Unified</span>
        </div>
      </div>

      {/* Resolved Fields */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-4 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Patent Fields</h3>
        <FieldPicker
          label="Title"
          fieldName="title"
          dbValue={db?.title || null}
          unifiedValue={uni?.title || null}
          caseInsensitive
          resolvedValue={choices['title']?.value || ''}
          onChange={handleChange}
        />
        <FieldPicker
          label="Issue / Publication Date"
          fieldName="issue_date"
          dbValue={db?.issue_date || null}
          unifiedValue={uni?.publication_date || null}
          semanticMatch={data.date_match}
          resolvedValue={choices['issue_date']?.value || ''}
          onChange={handleChange}
        />
        {uni?.assignee_current && (
          <div className="py-3 border-b border-gray-100">
            <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">Assignee</div>
            <div className="text-sm text-gray-700">{uni.assignee_current}</div>
          </div>
        )}
      </div>

      {/* Inventors */}
      <div className="bg-white rounded-xl border border-gray-200 p-5 mb-6 shadow-sm">
        <h3 className="text-sm font-semibold text-gray-700 mb-3">Inventors</h3>
        <InventorAligner
          alignment={data.inventor_alignment}
          choices={choices}
          onChange={handleChange}
        />
      </div>

      {saveMutation.isSuccess && (
        <div className="fixed bottom-6 right-6 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg text-sm animate-pulse">
          Saved
        </div>
      )}
      </div>
    </div>
  )
}
