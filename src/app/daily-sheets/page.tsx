import { FileSpreadsheet, Clock } from 'lucide-react';

export default function DailySheetsPage() {
  return (
    <div className="mx-auto max-w-4xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white">Daily Sheet Updates</h1>
        <p className="mt-2 text-gray-400">Update daily sheets for each yard automatically.</p>
      </div>

      <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-12 shadow-sm">
        <div className="flex flex-col items-center justify-center text-center">
          <div className="mb-6 rounded-full bg-[#003366]/20 p-6">
            <FileSpreadsheet className="h-16 w-16 text-[#003366]" />
          </div>
          <h2 className="mb-4 text-2xl font-semibold text-white">Coming Soon</h2>
          <p className="mb-6 max-w-md text-gray-400">
            The Daily Sheet Updates feature is currently under development. This will allow you to automatically update daily sheets for each yard location.
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-500">
            <Clock className="h-4 w-4" />
            <span>Check back soon for updates</span>
          </div>
        </div>
      </div>
    </div>
  );
}

