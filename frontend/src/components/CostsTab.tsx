import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { api } from '../api'
import { Plus, Trash2, Check, X, ChevronDown, ChevronRight } from 'lucide-react'

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

  return (
    <div className="space-y-8">
      {/* PM Fees Editor */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-lg font-semibold text-gray-900">Other Fees</h2>
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
                  <td className="px-4 py-2.5"><input type="text" value={newFee.description} onChange={e => setNewFee(d => ({ ...d, description: e.target.value }))} onKeyDown={e => { if (e.key === 'Enter') createFeeMut.mutate(newFee) }} placeholder="Description" className="w-full px-2 py-1 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                  <td className="px-4 py-2.5"><input type="number" value={newFee.quantity} onChange={e => setNewFee(d => ({ ...d, quantity: parseInt(e.target.value) || 1 }))} onKeyDown={e => { if (e.key === 'Enter') createFeeMut.mutate(newFee) }} className="w-20 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" /></td>
                  <td className="px-4 py-2.5"><input type="number" step="any" value={newFee.cost} onChange={e => setNewFee(d => ({ ...d, cost: parseFloat(e.target.value) || 0 }))} onKeyDown={e => { if (e.key === 'Enter') createFeeMut.mutate(newFee) }} className="w-28 px-2 py-1 border border-gray-300 rounded text-sm text-right focus:ring-2 focus:ring-blue-500 outline-none" /></td>
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
                <tr><td colSpan={5} className="px-4 py-6 text-center text-gray-400 text-sm">No fees added yet.</td></tr>
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
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-2.5" colSpan={3}>Subtotal</td>
                  <td className="px-4 py-2.5 text-right">{fmt(summary.subtotal)}</td>
                </tr>
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
                <tr className="bg-gray-50 font-medium">
                  <td className="px-4 py-2.5" colSpan={3}>Subtotal incl. tax</td>
                  <td className="px-4 py-2.5 text-right">{fmt(summary.subtotal_with_tax)}</td>
                </tr>
                {summary.pm_fees.map((f: any) => (
                  <tr key={f.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5">{f.description}</td>
                    <td className="px-4 py-2.5 text-right">{f.quantity}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(f.unit_cost)}</td>
                    <td className="px-4 py-2.5 text-right">{fmt(f.total)}</td>
                  </tr>
                ))}
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
