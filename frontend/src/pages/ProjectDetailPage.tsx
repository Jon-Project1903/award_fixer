import { useState, useCallback, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from '../components/FileUpload'
import StatusBadge from '../components/StatusBadge'
import { Download, RefreshCw, Loader2, CheckCircle, ArrowUpDown, ArrowUp, ArrowDown } from 'lucide-react'

type SortField = 'patent_no' | 'status' | 'match_score'
type SortDir = 'asc' | 'desc'

export default function ProjectDetailPage() {
  const { id } = useParams<{ id: string }>()
  const projectId = Number(id)
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const [statusFilter, setStatusFilter] = useState<string>('')
  const [sortField, setSortField] = useState<SortField | null>(null)
  const [sortDir, setSortDir] = useState<SortDir>('asc')

  const toggleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDir(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortDir('asc')
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
              {sortedReconciliations.map((rec: any) => (
                <tr
                  key={rec.id}
                  onClick={() => navigate(`/reconciliations/${rec.id}`)}
                  className="hover:bg-blue-50 cursor-pointer transition-colors"
                >
                  <td className="px-4 py-3 font-mono text-xs">{rec.patent_no}</td>
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
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
