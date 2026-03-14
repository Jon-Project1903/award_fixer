import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { Loader2, RefreshCw, Plus, Trash2, Check, X, ChevronDown, ChevronRight, DollarSign } from 'lucide-react'

const fmt = (n: number) => n.toLocaleString('en-US', { style: 'currency', currency: 'USD' })

export default function CostsTab({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient()
  const [showTaxDetail, setShowTaxDetail] = useState(false)

  const { data: awards = [] } = useQuery({
    queryKey: ['physical-awards', projectId],
    queryFn: () => api.getPhysicalAwards(projectId),
  })

  const { data: summary } = useQuery({
    queryKey: ['cost-summary', projectId],
    queryFn: () => api.getCostSummary(projectId),
    enabled: awards.length > 0,
  })

  const generateMut = useMutation({
    mutationFn: () => api.generateAwards(projectId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-awards', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
    },
  })

  const deleteMut = useMutation({
    mutationFn: (id: number) => api.deletePhysicalAward(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-awards', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
    },
  })

  // PM Fee CRUD
  const { data: pmFees = [] } = useQuery({
    queryKey: ['pm-fees', projectId],
    queryFn: () => api.getPmFees(projectId),
  })
  const [addingFee, setAddingFee] = useState(false)
  const [newFee, setNewFee] = useState({ description: '', quantity: 1, cost: 0 })
  const createFeeMut = useMutation({
    mutationFn: (data: any) => api.createPmFee(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-fees', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
      setAddingFee(false)
      setNewFee({ description: '', quantity: 1, cost: 0 })
    },
  })
  const deleteFeeMut = useMutation({
    mutationFn: (id: number) => api.deletePmFee(projectId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['pm-fees', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
    },
  })

  // Inline add for physical awards
  const [addingAward, setAddingAward] = useState(false)
  const [newAward, setNewAward] = useState({ employee_id: '', patent_number: '', award_type: '', inventor_name: '', work_state: '' })
  const createAwardMut = useMutation({
    mutationFn: (data: any) => api.createPhysicalAward(projectId, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['physical-awards', projectId] })
      queryClient.invalidateQueries({ queryKey: ['cost-summary', projectId] })
      setAddingAward(false)
      setNewAward({ employee_id: '', patent_number: '', award_type: '', inventor_name: '', work_state: '' })
    },
  })

  return (
    <div className="space-y-8">
      {/* Generate Awards */}
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
            <span className="text-sm text-gray-600">{generateMut.data.generated} awards generated</span>
          )}
        </div>

        {awards.length > 0 ? (
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden max-h-96 overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0">
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Employee ID</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Name</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Patent No.</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">Award Type</th>
                  <th className="text-left px-4 py-2.5 font-medium text-gray-600">State</th>
                  <th className="w-10 px-2 py-2.5"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {awards.map((a: any) => (
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
                    <td className="px-4 py-2"><input type="text" value={newAward.employee_id} onChange={e => setNewAward(d => ({ ...d, employee_id: e.target.value }))} placeholder="Employee ID" className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.inventor_name} onChange={e => setNewAward(d => ({ ...d, inventor_name: e.target.value }))} placeholder="Name" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.patent_number} onChange={e => setNewAward(d => ({ ...d, patent_number: e.target.value }))} placeholder="Patent No." className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.award_type} onChange={e => setNewAward(d => ({ ...d, award_type: e.target.value }))} placeholder="Award Type" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                    <td className="px-4 py-2"><input type="text" value={newAward.work_state} onChange={e => setNewAward(d => ({ ...d, work_state: e.target.value }))} placeholder="State" className="w-full px-2 py-1 border border-gray-300 rounded text-xs focus:ring-2 focus:ring-blue-500 outline-none" /></td>
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
            <DollarSign className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm">No physical awards yet. Complete reconciliation then click "Generate Awards".</p>
          </div>
        )}
      </div>

      {/* PM Fees Editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Program Management Fees</h2>
          <button
            onClick={() => { setAddingFee(true); setNewFee({ description: '', quantity: 1, cost: 0 }) }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-50 rounded-lg hover:bg-blue-100 cursor-pointer border-0 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" /> Add Fee
          </button>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="bg-gray-50 border-b border-gray-200">
                <th className="text-left px-4 py-2.5 font-medium text-gray-600">Description</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Qty</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Unit Cost</th>
                <th className="text-right px-4 py-2.5 font-medium text-gray-600">Total</th>
                <th className="w-10 px-2 py-2.5"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {pmFees.map((f: any) => (
                <tr key={f.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2.5">{f.description}</td>
                  <td className="px-4 py-2.5 text-right">{f.quantity}</td>
                  <td className="px-4 py-2.5 text-right">{fmt(f.cost)}</td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(f.quantity * f.cost)}</td>
                  <td className="px-2 py-2.5">
                    <button onClick={() => deleteFeeMut.mutate(f.id)} className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded cursor-pointer border-0 bg-transparent">
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
              {addingFee && (
                <tr className="bg-blue-50/50">
                  <td className="px-4 py-2.5"><input type="text" value={newFee.description} onChange={e => setNewFee(d => ({ ...d, description: e.target.value }))} placeholder="Description" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                  <td className="px-4 py-2.5"><input type="number" value={newFee.quantity} onChange={e => setNewFee(d => ({ ...d, quantity: parseInt(e.target.value) || 1 }))} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                  <td className="px-4 py-2.5"><input type="number" step="any" value={newFee.cost} onChange={e => setNewFee(d => ({ ...d, cost: parseFloat(e.target.value) || 0 }))} className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                  <td className="px-4 py-2.5 text-right text-gray-400">{fmt(newFee.quantity * newFee.cost)}</td>
                  <td className="px-2 py-2.5">
                    <span className="inline-flex gap-1">
                      <button onClick={() => createFeeMut.mutate(newFee)} className="p-1 text-green-600 hover:bg-green-50 rounded cursor-pointer border-0 bg-transparent"><Check className="w-4 h-4" /></button>
                      <button onClick={() => setAddingFee(false)} className="p-1 text-gray-400 hover:bg-gray-100 rounded cursor-pointer border-0 bg-transparent"><X className="w-4 h-4" /></button>
                    </span>
                  </td>
                </tr>
              )}
              {pmFees.length === 0 && !addingFee && (
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No PM fees added yet.</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Cost Summary */}
      {summary && (
        <div>
          <h2 className="text-lg font-semibold text-gray-900 mb-3">Cost Summary</h2>
          <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 border-b border-gray-200">
                  <th className="text-left px-4 py-3 font-medium text-gray-600"></th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Qty</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Price Each</th>
                  <th className="text-right px-4 py-3 font-medium text-gray-600">Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {summary.line_items.map((item: any) => (
                  <tr key={item.award_type} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 font-medium">{item.award_type}</td>
                    <td className="px-4 py-2.5 text-right">{item.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(item.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-right font-medium">{fmt(item.total)}</td>
                  </tr>
                ))}
                {/* Subtotal */}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-2.5" colSpan={3}>Subtotal</td>
                  <td className="px-4 py-2.5 text-right">{fmt(summary.subtotal)}</td>
                </tr>
                {/* Taxes */}
                <tr
                  className="hover:bg-gray-50 cursor-pointer"
                  onClick={() => setShowTaxDetail(!showTaxDetail)}
                >
                  <td className="px-4 py-2.5 inline-flex items-center gap-1">
                    {showTaxDetail ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                    TAXES estimated
                  </td>
                  <td className="px-4 py-2.5" colSpan={2}></td>
                  <td className="px-4 py-2.5 text-right font-medium">{fmt(summary.total_tax)}</td>
                </tr>
                {showTaxDetail && summary.tax_breakdown.map((tb: any) => (
                  <tr key={tb.jurisdiction} className="bg-amber-50/50 text-xs">
                    <td className="px-8 py-1.5 text-gray-600">{tb.jurisdiction}</td>
                    <td className="px-4 py-1.5 text-right text-gray-500">{tb.rate}%</td>
                    <td className="px-4 py-1.5 text-right text-gray-500">on {fmt(tb.taxable_amount)}</td>
                    <td className="px-4 py-1.5 text-right text-gray-600">{fmt(tb.tax)}</td>
                  </tr>
                ))}
                {/* Subtotal incl tax */}
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-2.5" colSpan={3}>Subtotal incl. tax</td>
                  <td className="px-4 py-2.5 text-right">{fmt(summary.subtotal_with_tax)}</td>
                </tr>
                {/* PM Fees */}
                {summary.pm_fees.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">{f.description}</td>
                    <td className="px-4 py-2.5 text-right">{f.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(f.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(f.total)}</td>
                  </tr>
                ))}
                {/* Grand Total */}
                <tr className="bg-blue-50 font-bold text-blue-900">
                  <td className="px-4 py-3" colSpan={3}>GRAND TOTAL</td>
                  <td className="px-4 py-3 text-right text-lg">{fmt(summary.grand_total)}</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
