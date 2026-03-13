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
}
