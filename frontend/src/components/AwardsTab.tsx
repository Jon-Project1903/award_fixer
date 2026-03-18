import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { Loader2, RefreshCw, Plus, Trash2, Check, X, AlertTriangle } from 'lucide-react'
import { useSortFilter } from '../hooks/useSortFilter'
import type { ColumnDef } from '../hooks/useSortFilter'
import SortFilterHeader from './SortFilterHeader'

const PHYSICAL_COLS: ColumnDef[] = [
  { key: 'employee_id', label: 'Employee ID', sortable: true },
  { key: 'inventor_name', label: 'Name', sortable: true, filterable: true },
  { key: 'patent_number', label: 'Patent No.', sortable: true, filterable: true },
  { key: 'award_type', label: 'Award Type', sortable: true, filterable: true },
  { key: 'work_state', label: 'State', sortable: true },
]

const SIMPLE_COLS: ColumnDef[] = [
  { key: 'employee_id', label: 'Employee ID', sortable: true },
  { key: 'inventor_name', label: 'Name', sortable: true },
  { key: 'patent_number', label: 'Patent No.', sortable: true },
  { key: 'work_state', label: 'State', sortable: true },
]

export default function AwardsTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()

  const { data: awards = [] } = useQuery({
    queryKey: ['physical-awards', projectId],
    queryFn: () => api.getPhysicalAwards(projectId),
  })
  const { data: optOuts = [] } = useQuery({
    queryKey: ['opt-out-awards', projectId],
    queryFn: () => api.getOptOutAwards(projectId),
  })
  const { data: termed = [] } = useQuery({
    queryKey: ['termed-awards', projectId],
    queryFn: () => api.getTermedAwards(projectId),
  })
  const { data: stats } = useQuery({
    queryKey: ['award-stats', projectId],
    queryFn: () => api.getAwardStats(projectId),
  })

  const physicalSF = useSortFilter(awards, PHYSICAL_COLS)
  const optOutSF = useSortFilter(optOuts, SIMPLE_COLS)
  const termedSF = useSortFilter(termed, SIMPLE_COLS)

  const invalidateAll = () => {
    queryClient.invalidateQueries({ queryKey: ['physical-awards', projectId] })
    queryClient.invalidateQueries({ queryKey: ['opt-out-awards', projectId] })
    queryClient.invalidateQueries({ queryKey: ['termed-awards', projectId] })
    queryClient.invalidateQueries({ queryKey: ['award-stats', projectId] })
    queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
  }

  const generateMut = useMutation({
    mutationFn: () => api.generateAwards(projectId),
    onSuccess: invalidateAll,
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deletePhysicalAward(projectId, id),
    onSuccess: invalidateAll,
  })

  const [addingAward, setAddingAward] = useState(false)
  const [newAward, setNewAward] = useState({ employee_id: '', patent_number: '', award_type: '', inventor_name: '', work_state: '' })
  const createAwardMut = useMutation({
    mutationFn: (data: any) => api.createPhysicalAward(projectId, data),
    onSuccess: () => {
      invalidateAll()
      setAddingAward(false)
      setNewAward({ employee_id: '', patent_number: '', award_type: '', inventor_name: '', work_state: '' })
    },
  })

  return (
    <div className="space-y-8">
      {/* Stats Dashboard */}
      {stats && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Award Summary</h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {Object.entries(stats.by_type as Record<string, number>).map(([type, count]) => (
              <div key={type} className="bg-white rounded-xl border border-gray-200 p-4">
                <div className="text-2xl font-bold text-gray-900">{count}</div>
                <div className="text-sm text-gray-500">{type}</div>
              </div>
            ))}
            <div className="bg-orange-50 rounded-xl border border-orange-200 p-4">
              <div className="text-2xl font-bold text-orange-700">{stats.opt_outs}</div>
              <div className="text-sm text-orange-600">Opt-Outs</div>
            </div>
            <div className="bg-red-50 rounded-xl border border-red-200 p-4">
              <div className="text-2xl font-bold text-red-700">{stats.termed}</div>
              <div className="text-sm text-red-600">Termed</div>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
            <div className="grid grid-cols-3 gap-4 text-center">
              <div>
                <div className="text-lg font-bold text-blue-700">{stats.total_db_inventors}</div>
                <div className="text-xs text-gray-500">DB Inventors</div>
              </div>
              <div>
                <div className="text-lg font-bold text-amber-700">{stats.total_uni_inventors}</div>
                <div className="text-xs text-gray-500">Unified Inventors</div>
              </div>
              <div>
                <div className="text-lg font-bold text-green-700">{stats.total_reconciled}</div>
                <div className="text-xs text-gray-500">Reconciled (Awards + Opt-Outs + Termed)</div>
              </div>
            </div>
          </div>

          {stats.discrepancies.length > 0 && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
              <div className="flex items-center gap-2 text-sm font-semibold text-amber-800 mb-1">
                <AlertTriangle className="w-4 h-4" />
                Discrepancies
              </div>
              <ul className="text-sm text-amber-700 space-y-1 list-disc list-inside">
                {stats.discrepancies.map((d: string, i: number) => (
                  <li key={i}>{d}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}

      {/* Physical Awards */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Physical Awards</h2>
          <button
            onClick={() => generateMut.mutate()}
            disabled={generateMut.isPending}
            className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer border-0"
          >
            {generateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            Generate Awards
          </button>
          <button
            onClick={() => { setAddingAward(true); setNewAward({ employee_id: '', patent_number: '', award_type: '', inventor_name: '', work_state: '' }) }}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer border-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Row
          </button>
          {generateMut.data && (
            <span className="text-sm text-gray-600">
              {generateMut.data.generated} awards, {generateMut.data.opt_outs} opt-outs, {generateMut.data.termed} termed
            </span>
          )}
          {awards.length > 0 && physicalSF.processed.length !== awards.length && (
            <span className="text-xs text-gray-400">Showing {physicalSF.processed.length} of {awards.length}</span>
          )}
        </div>

        {awards.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-128 overflow-y-auto">
            <table className="w-full text-sm">
              <SortFilterHeader
                columns={PHYSICAL_COLS}
                sortKey={physicalSF.sortKey}
                sortDir={physicalSF.sortDir}
                toggleSort={physicalSF.toggleSort}
                filters={physicalSF.filters}
                setFilter={physicalSF.setFilter}
                extraTh={<th className="w-10 px-2 py-2.5"></th>}
              />
              <tbody className="divide-y divide-gray-100">
                {physicalSF.processed.map((a: any) => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 font-mono text-xs">{a.employee_id}</td>
                    <td className="px-4 py-2">{a.inventor_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{a.patent_number}</td>
                    <td className="px-4 py-2">{a.award_type}</td>
                    <td className="px-4 py-2 text-xs">{a.work_state || '-'}</td>
                    <td className="px-2 py-2">
                      <button onClick={() => deleteMut.mutate(a.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer border-0 bg-transparent">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
                {addingAward && (
                  <tr className="bg-blue-50/50">
                    <td className="px-4 py-2"><input type="text" value={newAward.employee_id} onChange={e => setNewAward(d => ({ ...d, employee_id: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createAwardMut.mutate(newAward) }} placeholder="Employee ID" className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.inventor_name} onChange={e => setNewAward(d => ({ ...d, inventor_name: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createAwardMut.mutate(newAward) }} placeholder="Name" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.patent_number} onChange={e => setNewAward(d => ({ ...d, patent_number: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createAwardMut.mutate(newAward) }} placeholder="Patent No." className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.award_type} onChange={e => setNewAward(d => ({ ...d, award_type: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createAwardMut.mutate(newAward) }} placeholder="Award Type" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.work_state} onChange={e => setNewAward(d => ({ ...d, work_state: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createAwardMut.mutate(newAward) }} placeholder="State" className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-2 py-2">
                      <span className="inline-flex gap-1">
                        <button onClick={() => createAwardMut.mutate(newAward)} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
                        <button onClick={() => setAddingAward(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
                      </span>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-400 bg-white rounded-xl border border-gray-200">
            <p className="text-sm">No physical awards yet. Complete reconciliation then click "Generate Awards".</p>
          </div>
        )}
      </div>

      {/* Opt-Outs */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Opt-Outs</h2>
        {optOuts.length > 0 ? (
          <div className="bg-white rounded-xl border border-orange-200 overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <SortFilterHeader
                columns={SIMPLE_COLS}
                sortKey={optOutSF.sortKey}
                sortDir={optOutSF.sortDir}
                toggleSort={optOutSF.toggleSort}
                filters={optOutSF.filters}
                setFilter={optOutSF.setFilter}
                headerClass="bg-orange-50"
              />
              <tbody className="divide-y divide-orange-100">
                {optOutSF.processed.map((a: any) => (
                  <tr key={a.id} className="hover:bg-orange-50/50">
                    <td className="px-4 py-2 font-mono text-xs">{a.employee_id}</td>
                    <td className="px-4 py-2">{a.inventor_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{a.patent_number}</td>
                    <td className="px-4 py-2 text-xs">{a.work_state || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 bg-white rounded-xl border border-gray-200 text-sm">
            No opt-out records.
          </div>
        )}
      </div>

      {/* Termed */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Termed Employees</h2>
        {termed.length > 0 ? (
          <div className="bg-white rounded-xl border border-red-200 overflow-hidden max-h-64 overflow-y-auto">
            <table className="w-full text-sm">
              <SortFilterHeader
                columns={SIMPLE_COLS}
                sortKey={termedSF.sortKey}
                sortDir={termedSF.sortDir}
                toggleSort={termedSF.toggleSort}
                filters={termedSF.filters}
                setFilter={termedSF.setFilter}
                headerClass="bg-red-50"
              />
              <tbody className="divide-y divide-red-100">
                {termedSF.processed.map((a: any) => (
                  <tr key={a.id} className="hover:bg-red-50/50">
                    <td className="px-4 py-2 font-mono text-xs">{a.employee_id}</td>
                    <td className="px-4 py-2">{a.inventor_name}</td>
                    <td className="px-4 py-2 font-mono text-xs">{a.patent_number}</td>
                    <td className="px-4 py-2 text-xs">{a.work_state || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-6 text-gray-400 bg-white rounded-xl border border-gray-200 text-sm">
            No termed employee records.
          </div>
        )}
      </div>
    </div>
  )
}
