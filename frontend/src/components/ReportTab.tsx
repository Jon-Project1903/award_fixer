import { api } from '../api'
import { Download, FileSpreadsheet } from 'lucide-react'

export default function ReportTab({ projectId }: { projectId: number }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900 mb-3">Generate Report</h2>
        <div className="bg-white rounded-xl border border-gray-200 p-6">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-blue-50 rounded-lg">
              <FileSpreadsheet className="w-8 h-8 text-blue-600" />
            </div>
            <div className="flex-1">
              <h3 className="font-medium text-gray-900 mb-1">Award Report (Excel)</h3>
              <p className="text-sm text-gray-500 mb-4">
                Download a comprehensive Excel report with the following sheets:
              </p>
              <ul className="text-sm text-gray-500 space-y-1 mb-5 list-disc list-inside">
                <li><span className="font-medium text-gray-700">Budget Estimates</span> — cost summary with subtotals, taxes, fees, and grand total</li>
                <li><span className="font-medium text-gray-700">Shipping Addresses</span> — all configured shipping locations</li>
                <li><span className="font-medium text-gray-700">Tax Rates</span> — tax rates by city</li>
                <li><span className="font-medium text-gray-700">All Awards</span> — every award with cost, tax, and delivery address</li>
                <li><span className="font-medium text-gray-700">Per Award Type</span> — separate sheet for each award type</li>
              </ul>
              <a
                href={api.getReportUrl(projectId)}
                download
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors no-underline"
              >
                <Download className="w-4 h-4" />
                Download Report
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
