import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import FileUpload from './FileUpload'
import { RefreshCw, Loader2, Plus, Trash2, Pencil, Check, X } from 'lucide-react'

export default function DataInputTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()

  const matchMutation = useMutation({
    mutationFn: () => api.runMatching(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reconciliations', projectId] })
      queryClient.invalidateQueries({ queryKey: ['project', projectId] })
    },
  })

  return (
    <div className="space-y-8">
      {/* File Uploads */}
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Imports</h2>
        <div className="grid grid-cols-2 gap-4">
          <FileUpload
            label="Database Source (CSV)"
            accept=".csv"
            onUpload={(file) => api.uploadDbSource(projectId, file).then(res => {
              queryClient.invalidateQueries({ queryKey: ['award-costs', projectId] })
              queryClient.invalidateQueries({ queryKey: ['tax-rates', projectId] })
              return res
            })}
          />
          <FileUpload
            label="Unified Report (XLSX)"
            accept=".xlsx"
            onUpload={(file) => api.uploadUnified(projectId, file)}
          />
        </div>
        <div className="mt-4">
          <button
            onClick={() => matchMutation.mutate()}
            disabled={matchMutation.isPending}
            className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors cursor-pointer border-0"
          >
            {matchMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            {matchMutation.isPending ? 'Matching...' : 'Run Matching'}
          </button>
          {matchMutation.data && (
            <span className="ml-3 text-sm text-gray-600">
              {matchMutation.data.total} records: {matchMutation.data.passed} passed, {matchMutation.data.flagged} flagged
            </span>
          )}
        </div>
      </div>

      {/* Award Costs Editor */}
      <CrudTable
        projectId={projectId}
        title="Award Costs"
        queryKey="award-costs"
        fetchFn={() => api.getAwardCosts(projectId)}
        createFn={(data) => api.createAwardCost(projectId, data)}
        updateFn={(id, data) => api.updateAwardCost(projectId, id, data)}
        deleteFn={(id) => api.deleteAwardCost(projectId, id)}
        columns={[
          { key: 'award_type', label: 'Award Type', type: 'text' },
          { key: 'cost', label: 'Unit Cost ($)', type: 'number' },
        ]}
        emptyRow={{ award_type: '', cost: 0 }}
      />

      {/* Tax Rates Editor */}
      <CrudTable
        projectId={projectId}
        title="Tax Rates"
        queryKey="tax-rates"
        fetchFn={() => api.getTaxRates(projectId)}
        createFn={(data) => api.createTaxRate(projectId, data)}
        updateFn={(id, data) => api.updateTaxRate(projectId, id, data)}
        deleteFn={(id) => api.deleteTaxRate(projectId, id)}
        columns={[
          { key: 'jurisdiction', label: 'City', type: 'text' },
          { key: 'lookup_key', label: 'State', type: 'text' },
          { key: 'tax_percent', label: 'Tax %', type: 'number' },
        ]}
        emptyRow={{ jurisdiction: '', lookup_key: '', tax_percent: 0 }}
      />
    </div>
  )
}


// ── Reusable CRUD Table Component ───────────────────────────

type Column = { key: string; label: string; type: 'text' | 'number' }

function CrudTable({
  projectId,
  title,
  queryKey,
  fetchFn,
  createFn,
  updateFn,
  deleteFn,
  columns,
  emptyRow,
}: {
  projectId: number
  title: string
  queryKey: string
  fetchFn: () => Promise<any[]>
  createFn: (data: any) => Promise<any>
  updateFn: (id: number, data: any) => Promise<any>
  deleteFn: (id: number) => Promise<any>
  columns: Column[]
  emptyRow: Record<string, any>
}) {
  const queryClient = useQueryClient()
  const { data: rows = [] } = useQuery({ queryKey: [queryKey, projectId], queryFn: fetchFn })
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editData, setEditData] = useState<Record<string, any>>({})
  const [adding, setAdding] = useState(false)
  const [newData, setNewData] = useState<Record<string, any>>(emptyRow)

  const invalidate = () => queryClient.invalidateQueries({ queryKey: [queryKey, projectId] })

  const createMut = useMutation({ mutationFn: createFn, onSuccess: () => { invalidate(); setAdding(false); setNewData(emptyRow) } })
  const updateMut = useMutation({ mutationFn: ({ id, data }: any) => updateFn(id, data), onSuccess: () => { invalidate(); setEditingId(null) } })
  const deleteMut = useMutation({ mutationFn: deleteFn, onSuccess: invalidate })

  const startEdit = (row: any) => {
    setEditingId(row.id)
    const data: Record<string, any> = {}
    columns.forEach(c => { data[c.key] = row[c.key] })
    setEditData(data)
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{title}</h2>
        <button
          onClick={() => { setAdding(true); setNewData({ ...emptyRow }) }}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer border-0 transition-colors"
        >
          <Plus className="w-3.5 h-3.5" /> Add Row
        </button>
      </div>
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-200">
              {columns.map(c => (
                <th key={c.key} className="text-left px-4 py-2.5 font-medium text-gray-600">{c.label}</th>
              ))}
              <th className="w-24 px-4 py-2.5"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map((row: any) => (
              <tr key={row.id} className="hover:bg-gray-50">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-2.5">
                    {editingId === row.id ? (
                      <input
                        type={c.type}
                        step={c.type === 'number' ? 'any' : undefined}
                        value={editData[c.key] ?? ''}
                        onChange={e => setEditData(d => ({ ...d, [c.key]: c.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                        className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                      />
                    ) : (
                      <span>{c.type === 'number' && c.key === 'cost' ? `$${Number(row[c.key]).toFixed(2)}` : c.type === 'number' && c.key === 'tax_percent' ? `${row[c.key]}%` : row[c.key]}</span>
                    )}
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  {editingId === row.id ? (
                    <span className="inline-flex gap-1">
                      <button onClick={() => updateMut.mutate({ id: row.id, data: editData })} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setEditingId(null)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
                    </span>
                  ) : (
                    <span className="inline-flex gap-1">
                      <button onClick={() => startEdit(row)} className="p-1 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded cursor-pointer border-0 bg-transparent"><Pencil className="w-3.5 h-3.5" /></button>
                      <button onClick={() => deleteMut.mutate(row.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer border-0 bg-transparent"><Trash2 className="w-3.5 h-3.5" /></button>
                    </span>
                  )}
                </td>
              </tr>
            ))}
            {adding && (
              <tr className="bg-blue-50/50">
                {columns.map(c => (
                  <td key={c.key} className="px-4 py-2.5">
                    <input
                      type={c.type}
                      step={c.type === 'number' ? 'any' : undefined}
                      value={newData[c.key] ?? ''}
                      onChange={e => setNewData(d => ({ ...d, [c.key]: c.type === 'number' ? parseFloat(e.target.value) || 0 : e.target.value }))}
                      placeholder={c.label}
                      className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
                    />
                  </td>
                ))}
                <td className="px-4 py-2.5 text-right">
                  <span className="inline-flex gap-1">
                    <button onClick={() => createMut.mutate(newData)} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
                    <button onClick={() => setAdding(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
                  </span>
                </td>
              </tr>
            )}
            {rows.length === 0 && !adding && (
              <tr><td colSpan={columns.length + 1} className="px-4 py-6 text-center text-gray-400 text-sm">No rows yet. Click "Add Row" to get started.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
