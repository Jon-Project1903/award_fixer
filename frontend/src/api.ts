const BASE = '/api'

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`API error ${res.status}: ${text}`)
  }
  return res.json()
}

export const api = {
  // Projects
  getProjects: () =>
    fetch(`${BASE}/projects`).then(r => json<any[]>(r)),

  createProject: (name: string) =>
    fetch(`${BASE}/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name }),
    }).then(r => json<any>(r)),

  getProject: (id: number) =>
    fetch(`${BASE}/projects/${id}`).then(r => json<any>(r)),

  deleteProject: (id: number) =>
    fetch(`${BASE}/projects/${id}`, { method: 'DELETE' }).then(r => json<any>(r)),

  // Imports
  uploadDbSource: (projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/projects/${projectId}/import/db-source`, {
      method: 'POST',
      body: fd,
    }).then(r => json<any>(r))
  },

  uploadUnified: (projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/projects/${projectId}/import/unified`, {
      method: 'POST',
      body: fd,
    }).then(r => json<any>(r))
  },

  // Matching
  runMatching: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/match`, { method: 'POST' }).then(r => json<any>(r)),

  // Reconciliation
  getReconciliations: (projectId: number, status?: string) =>
    fetch(`${BASE}/projects/${projectId}/reconciliations${status ? `?status=${status}` : ''}`).then(r => json<any[]>(r)),

  getReconciliationDetail: (id: number) =>
    fetch(`${BASE}/reconciliations/${id}`).then(r => json<any>(r)),

  saveChoices: (id: number, choices: any[]) =>
    fetch(`${BASE}/reconciliations/${id}/choices`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(choices),
    }).then(r => json<any>(r)),

  resolveReconciliation: (id: number) =>
    fetch(`${BASE}/reconciliations/${id}/resolve`, { method: 'PUT' }).then(r => json<any>(r)),

  mergeCrossrefs: (projectId: number, dbCrossrefId: number, uniCrossrefId: number, finalPatentNo: string) =>
    fetch(`${BASE}/projects/${projectId}/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ db_crossref_id: dbCrossrefId, uni_crossref_id: uniCrossrefId, final_patent_no: finalPatentNo }),
    }).then(r => json<any>(r)),

  // Export
  exportUrl: (projectId: number) => `${BASE}/projects/${projectId}/export`,

  // Award Costs
  getAwardCosts: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/costs`).then(r => json<any[]>(r)),
  createAwardCost: (projectId: number, data: { award_type: string; cost: number }) =>
    fetch(`${BASE}/projects/${projectId}/costs`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  updateAwardCost: (projectId: number, costId: number, data: any) =>
    fetch(`${BASE}/projects/${projectId}/costs/${costId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  deleteAwardCost: (projectId: number, costId: number) =>
    fetch(`${BASE}/projects/${projectId}/costs/${costId}`, { method: 'DELETE' }).then(r => json<any>(r)),

  // Tax Rates
  getTaxRates: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/tax-rates`).then(r => json<any[]>(r)),
  createTaxRate: (projectId: number, data: { jurisdiction: string; lookup_key: string; tax_percent: number }) =>
    fetch(`${BASE}/projects/${projectId}/tax-rates`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  updateTaxRate: (projectId: number, rateId: number, data: any) =>
    fetch(`${BASE}/projects/${projectId}/tax-rates/${rateId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  deleteTaxRate: (projectId: number, rateId: number) =>
    fetch(`${BASE}/projects/${projectId}/tax-rates/${rateId}`, { method: 'DELETE' }).then(r => json<any>(r)),

  // PM Fees
  getPmFees: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/pm-fees`).then(r => json<any[]>(r)),
  createPmFee: (projectId: number, data: { description: string; quantity: number; cost: number }) =>
    fetch(`${BASE}/projects/${projectId}/pm-fees`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  updatePmFee: (projectId: number, feeId: number, data: any) =>
    fetch(`${BASE}/projects/${projectId}/pm-fees/${feeId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  deletePmFee: (projectId: number, feeId: number) =>
    fetch(`${BASE}/projects/${projectId}/pm-fees/${feeId}`, { method: 'DELETE' }).then(r => json<any>(r)),

  // Attendance
  uploadAttendance: (projectId: number, file: File) => {
    const fd = new FormData()
    fd.append('file', file)
    return fetch(`${BASE}/projects/${projectId}/import/attendance`, {
      method: 'POST', body: fd,
    }).then(r => json<any>(r))
  },
  getAttendance: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/attendance`).then(r => json<any[]>(r)),
  updateAttendance: (projectId: number, attId: number, data: { attendance_status: string }) =>
    fetch(`${BASE}/projects/${projectId}/attendance/${attId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),

  // Physical Awards
  generateAwards: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/generate-awards`, { method: 'POST' }).then(r => json<any>(r)),
  getPhysicalAwards: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/physical-awards`).then(r => json<any[]>(r)),
  createPhysicalAward: (projectId: number, data: any) =>
    fetch(`${BASE}/projects/${projectId}/physical-awards`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  updatePhysicalAward: (projectId: number, awardId: number, data: any) =>
    fetch(`${BASE}/projects/${projectId}/physical-awards/${awardId}`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data),
    }).then(r => json<any>(r)),
  deletePhysicalAward: (projectId: number, awardId: number) =>
    fetch(`${BASE}/projects/${projectId}/physical-awards/${awardId}`, { method: 'DELETE' }).then(r => json<any>(r)),

  // Cost Summary
  getCostSummary: (projectId: number) =>
    fetch(`${BASE}/projects/${projectId}/cost-summary`).then(r => json<any>(r)),
}
