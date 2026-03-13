import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from '../components/FileUpload'
import StatusBadge from '../components/StatusBadge'
import { Download, RefreshCw, Loader2, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown, Merge, ExternalLink, X } from 'lucide-react'

type SortField = 'patent_no' | 'status' | 'match_score'
type SortDir = 'asc' | 'desc'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [searchParams, setSearchParams] = useSearchParams()

  const statusFilter = searchParams.get('status') || ''
  const sortField = (searchParams.get('sort') as SortField) || null
  const sortDir = (searchParams.get('dir') as SortDir) || 'asc'

  const updateParams = (updates: Record<string, string | null>) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      for (const [k, v] of Object.entries(updates)) {
        if (v) next.set(k, v)
        else next.delete(k)
      }
      return next
    }, { replace: true })
  }

  const setStatusFilter = (v: string) => updateParams({ status: v || null })
  const [selected, setSelected] = useState<Set<number>>(new Set())
  const [mergeModal, setMergeModal] = useState<{ dbRec: any; uniRec: any } | null>(null)
  const [mergePatentNo, setMergePatentNo] = useState('')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      updateParams({ dir: sortDir === 'asc' ? 'desc' : 'asc' })
    } else {
      updateParams({ sort: field, dir: 'asc' })
    }
  }

  const SortIcon = ({ field }: { field: SortField }) => {
    if (sortField !== field) return <ArrowUpDown className="w-3 h-3 ml-1 opacity-40" />
    return sortDir === 'asc'
      ? <ArrowUp className="w-3 h-3 ml-1" />
      : <ArrowDown className="w-3 h-3 ml-1" />
  }

  const { data: project } = useQuery({
    queryKey: ['project', projectId],
    queryFn: () => api.getProject(projectId),
  })

  const { data: reconciliations = [], isLoading: loadingRecs } = useQuery({
    queryKey: ['reconciliations', projectId, statusFilter],
    queryFn: () => api.getReconciliations(projectId, statusFilter || undefined),
  })

  const matchMutation = useMutation({
    mutationFn: () => api.runMatching(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const resolveMutation = useMutation({
    mutationFn: (id: number) => api.resolveReconciliation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  const mergeMutation = useMutation({
    mutationFn: ({ dbId, uniId, patentNo }: { dbId: number; uniId: number; patentNo: string }) =>
      api.mergeCrossrefs(projectId, dbId, uniId, patentNo),
    onSuccess: (data) => {
      setMergeModal(null)
      setSelected(new Set())
      queryClient.invalidateQueries({ queryKey: ['reconciliations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
      navigate(`/reconciliations/${data.new_crossref_id}`)
    },
  })

  const sortedReconciliations = useMemo(() => {
    if (!sortField) return reconciliations
    const statusOrder: Record<string, number> = { 'Flagged': 0, 'Passed Auto Review': 1 }
    return [...reconciliations].sort((a: any, b: any) => {
      let cmp = 0
      if (sortField === 'status') {
        const aResolved = a.resolved ? 2 : (statusOrder[a.status] ?? 1)
        const bResolved = b.resolved ? 2 : (statusOrder[b.status] ?? 1)
        cmp = aResolved - bResolved
      } else if (sortField === 'match_score') {
        cmp = (a.match_score ?? -1) - (b.match_score ?? -1)
      } else if (sortField === 'patent_no') {
        cmp = (a.patent_no || '').localeCompare(b.patent_no || '')
      }
      return sortDir === 'asc' ? cmp : -cmp
    })
  }, [reconciliations, sortField, sortDir])

  const handleDbUpload = useCallback(async (file: File) => {
    return await api.uploadDbSource(projectId, file)
  }, [projectId])

  const handleUniUpload = useCallback(async (file: File) => {
    return await api.uploadUnified(projectId, file)
  }, [projectId])

  const toggleSelect = (id: number) => {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  // Check if two selected rows are mergeable (one db-only, one unified-only)
  const mergeCandidate = useMemo(() => {
    if (selected.size !== 2) return null
    const ids = Array.from(selected)
    const recs = ids.map(id => reconciliations.find((r: any) => r.id === id)).filter(Boolean)
    if (recs.length !== 2) return null

    const dbOnly = recs.find((r: any) => r.db_source_patent_id && !r.unified_patent_id)
    const uniOnly = recs.find((r: any) => r.unified_patent_id && !r.db_source_patent_id)
    if (dbOnly && uniOnly) return { dbRec: dbOnly, uniRec: uniOnly }
    return null
  }, [selected, reconciliations])

  const openMergeModal = () => {
    if (!mergeCandidate) return
    setMergeModal(mergeCandidate)
    setMergePatentNo(mergeCandidate.dbRec.patent_no || '')
  }

  const googlePatentUrl = (patentNo: string) =>
    `https://patents.google.com/patent/${patentNo.replace(/[\s-]/g, '')}`

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-900 m-0">{project?.name || 'Loading...'}</h1>
        {project && (
          <p className="text-sm text-gray-500 mt-1">
            Created {new Date(project.created_at).toLocaleDateString()}
            {project.total > 0 && (
              <span className="ml-3">
                {project.total} records | {project.passed} passed | {project.flagged} flagged | {project.resolved} resolved
              </span>
            )}
          </p>
        )}
      </div>

      {/* File Upload Section */}
      <div className="grid grid-cols-2 gap-4 mb-6">
        <FileUpload
          label="Database Source (CSV)"
          accept=".csv"
          onUpload={handleDbUpload}
        />
        <FileUpload
          label="Unified Report (XLSX)"
          accept=".xlsx"
          onUpload={handleUniUpload}
        />
      </div>

      {/* Match Button */}
      <div className="flex items-center gap-3 mb-6">
        <button
          onClick={() => matchMutation.mutate()}
          disabled={matchMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer border-0"
        >
          {matchMutation.isPending ? (
            <Loader2 className="w-4 h-4 animate-spin" />
          ) : (
            <RefreshCw className="w-4 h-4" />
          )}
          {matchMutation.isPending ? 'Matching...' : 'Run Matching'}
        </button>

        {matchMutation.data && (
          <span className="text-sm text-gray-600">
            {matchMutation.data.total} records: {matchMutation.data.passed} passed, {matchMutation.data.flagged} flagged
          </span>
        )}

        {selected.size > 0 && (
          <button
            onClick={openMergeModal}
            disabled={!mergeCandidate}
            title={mergeCandidate ? 'Merge selected rows' : 'Select one DB-only and one Unified-only row'}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-purple-600 text-white text-sm font-medium rounded-lg hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors cursor-pointer border-0"
          >
            <Merge className="w-4 h-4" />
            Merge ({selected.size} selected)
          </button>
        )}

        {selected.size > 0 && (
          <button
            onClick={() => setSelected(new Set())}
            className="text-xs text-gray-500 hover:text-gray-700 cursor-pointer border-0 bg-transparent"
          >
            Clear selection
          </button>
        )}

        <div className="ml-auto">
          <a
            href={api.exportUrl(projectId)}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-white border border-gray-300 text-sm font-medium text-gray-700 rounded-lg hover:bg-gray-50 no-underline transition-colors"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </a>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex gap-1 mb-4 bg-gray-100 rounded-lg p-1 w-fit">
        {[
          { label: 'All', value: '' },
          { label: 'Flagged', value: 'Flagged' },
          { label: 'Passed', value: 'Passed Auto Review' },
        ].map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors cursor-pointer border-0
              ${statusFilter === tab.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900 bg-transparent'}`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Reconciliation Table */}
      {loadingRecs ? (
        <div className="text-center py-8 text-gray-500">Loading...</div>
      ) : reconciliations.length === 0 ? (
        <div className="text-center py-12 text-gray-400">
          <p>No records yet. Upload both files and run matching.</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="w-10 px-2 py-3"></th>
                <th className="text-left px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('patent_no')}>
                  <span className="inline-flex items-center">Patent No.<SortIcon field="patent_no" /></span>
                </th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Title</th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('status')}>
                  <span className="inline-flex items-center justify-center">Status<SortIcon field="status" /></span>
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600 cursor-pointer select-none" onClick={() => toggleSort('match_score')}>
                  <span className="inline-flex items-center justify-center">Score<SortIcon field="match_score" /></span>
                </th>
                <th className="text-center px-4 py-3 font-medium text-gray-600">Inventors (DB/Uni)</th>
                <th className="text-left px-4 py-3 font-medium text-gray-600">Notes</th>
                <th className="w-10 px-2 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sortedReconciliations.map((rec: any) => {
                const isUnmatched = (!rec.db_source_patent_id || !rec.unified_patent_id)
                const isSelected = selected.has(rec.id)
                return (
                  <tr
                    key={rec.id}
                    onClick={() => navigate(`/reconciliations/${rec.id}`)}
                    className={`cursor-pointer transition-colors ${isSelected ? 'bg-purple-50 hover:bg-purple-100' : 'hover:bg-blue-50'}`}
                  >
                    <td className="px-2 py-3 text-center">
                      {isUnmatched && (
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={(e) => {
                            e.stopPropagation()
                            toggleSelect(rec.id)
                          }}
                          onClick={(e) => e.stopPropagation()}
                          className="w-4 h-4 rounded border-gray-300 text-purple-600 cursor-pointer"
                        />
                      )}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs">
                      {rec.patent_no}
                      {isUnmatched && (
                        <span className={`ml-1.5 text-[10px] font-sans px-1.5 py-0.5 rounded-full ${rec.db_source_patent_id ? 'bg-blue-100 text-blue-700' : 'bg-amber-100 text-amber-700'}`}>
                          {rec.db_source_patent_id ? 'DB' : 'Unified'}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 max-w-xs truncate">{rec.title}</td>
                    <td className="px-4 py-3 text-center">
                      <StatusBadge status={rec.status} resolved={rec.resolved} />
                    </td>
                    <td className="px-4 py-3 text-center">
                      {rec.match_score != null ? `${Math.round(rec.match_score * 100)}%` : '-'}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {rec.inventor_count_db ?? '-'} / {rec.inventor_count_unified ?? '-'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500 max-w-xs truncate">{rec.notes || '-'}</td>
                    <td className="px-2 py-3 text-center">
                      {!rec.resolved && rec.status === 'Passed Auto Review' && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            resolveMutation.mutate(rec.id)
                          }}
                          title="Mark as resolved"
                          className="p-1 text-green-500 hover:text-green-700 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent transition-colors"
                        >
                          <CheckCircle className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Merge Modal */}
      {mergeModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50" onClick={() => setMergeModal(null)}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full mx-4 overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
                <Merge className="w-5 h-5 text-purple-600" />
                Merge Patent Records
              </h3>
              <button onClick={() => setMergeModal(null)} className="p-1 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent">
                <X className="w-5 h-5 text-gray-400" />
              </button>
            </div>

            <div className="p-6">
              {/* Two cards side by side */}
              <div className="grid grid-cols-2 gap-4 mb-6">
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50/50 p-4">
                  <div className="text-xs font-semibold text-blue-600 uppercase tracking-wide mb-2">Database Source</div>
                  <div className="font-mono text-sm font-bold text-gray-900 mb-1">{mergeModal.dbRec.patent_no}</div>
                  <div className="text-sm text-gray-700 mb-2 line-clamp-2">{mergeModal.dbRec.title}</div>
                  <a
                    href={googlePatentUrl(mergeModal.dbRec.patent_no)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 no-underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Google Patents
                  </a>
                </div>

                <div className="rounded-lg border-2 border-amber-200 bg-amber-50/50 p-4">
                  <div className="text-xs font-semibold text-amber-600 uppercase tracking-wide mb-2">Unified</div>
                  <div className="font-mono text-sm font-bold text-gray-900 mb-1">{mergeModal.uniRec.patent_no}</div>
                  <div className="text-sm text-gray-700 mb-2 line-clamp-2">{mergeModal.uniRec.title}</div>
                  <a
                    href={googlePatentUrl(mergeModal.uniRec.patent_no)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs text-amber-600 hover:text-amber-800 no-underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    View on Google Patents
                  </a>
                </div>
              </div>

              {/* Final patent number */}
              <div className="mb-6">
                <label className="block text-sm font-medium text-gray-700 mb-2">Final Patent Number</label>
                <input
                  type="text"
                  value={mergePatentNo}
                  onChange={(e) => setMergePatentNo(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg font-mono text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500 outline-none"
                  placeholder="e.g. US12462420"
                />
                <div className="flex gap-2 mt-2">
                  <button
                    onClick={() => setMergePatentNo(mergeModal.dbRec.patent_no)}
                    className="text-xs px-2 py-1 rounded border border-blue-200 text-blue-700 hover:bg-blue-50 cursor-pointer bg-white"
                  >
                    Use DB: {mergeModal.dbRec.patent_no}
                  </button>
                  <button
                    onClick={() => setMergePatentNo(mergeModal.uniRec.patent_no)}
                    className="text-xs px-2 py-1 rounded border border-amber-200 text-amber-700 hover:bg-amber-50 cursor-pointer bg-white"
                  >
                    Use Unified: {mergeModal.uniRec.patent_no}
                  </button>
                </div>
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setMergeModal(null)}
                  className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  onClick={() => mergeMutation.mutate({
                    dbId: mergeModal.dbRec.id,
                    uniId: mergeModal.uniRec.id,
                    patentNo: mergePatentNo,
                  })}
                  disabled={!mergePatentNo.trim() || mergeMutation.isPending}
                  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-purple-600 rounded-lg hover:bg-purple-700 disabled:opacity-50 cursor-pointer border-0"
                >
                  {mergeMutation.isPending ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Merge className="w-4 h-4" />
                  )}
                  Merge & Match
                </button>
              </div>

              {mergeMutation.isError && (
                <div className="mt-3 text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">
                  {(mergeMutation.error as Error).message}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
