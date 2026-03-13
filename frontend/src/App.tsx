import { Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import ProjectsPage from './pages/ProjectsPage'
import ProjectDetailPage from './pages/ProjectDetailPage'
import ReconciliationDetailPage from './pages/ReconciliationDetailPage'

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<ProjectsPage />} />
        <Route path="/projects/:id" element={<ProjectDetailPage />} />
        <Route path="/reconciliations/:id" element={<ReconciliationDetailPage />} />
      </Routes>
    </Layout>
  )
}
