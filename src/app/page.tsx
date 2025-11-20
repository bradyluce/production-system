import { FileText, TrendingUp, ArrowRight, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-3xl font-bold text-white">Dashboard Overview</h1>
        <p className="mt-2 text-gray-400">Welcome back to K&L Recycling Automation System.</p>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {/* Delivery Contracts */}
        <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-6 shadow-sm transition-all hover:shadow-md hover:border-[#003366]">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Delivery Contracts</h3>
              <FileText className="h-5 w-5 text-[#003366]" />
           </div>
           <p className="text-gray-400 mb-6 text-sm">
              Upload and process delivery contracts automatically. Extract key data points and generate reports.
           </p>
           <Link href="/delivery" className="inline-flex items-center text-sm font-medium text-[#003366] hover:text-[#004080] transition-colors">
              Go to Contracts <ArrowRight className="ml-1 h-4 w-4" />
           </Link>
        </div>

        {/* Comex Pricing */}
        <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-6 shadow-sm transition-all hover:shadow-md hover:border-[#003366]">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Comex Pricing</h3>
              <TrendingUp className="h-5 w-5 text-[#003366]" />
           </div>
           <p className="text-gray-400 mb-6 text-sm">
              Track live Comex pricing, upload rate sheets, and analyze pricing trends for materials.
           </p>
           <Link href="/comex" className="inline-flex items-center text-sm font-medium text-[#003366] hover:text-[#004080] transition-colors">
              Go to Pricing <ArrowRight className="ml-1 h-4 w-4" />
           </Link>
        </div>

        {/* Daily Sheet Updates */}
        <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-6 shadow-sm transition-all hover:shadow-md hover:border-[#003366]">
           <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-white">Daily Sheet Updates</h3>
              <FileSpreadsheet className="h-5 w-5 text-[#003366]" />
           </div>
           <p className="text-gray-400 mb-6 text-sm">
              Update daily sheets for each yard automatically. Process and sync yard data efficiently.
           </p>
           <Link href="/daily-sheets" className="inline-flex items-center text-sm font-medium text-[#003366] hover:text-[#004080] transition-colors">
              Go to Daily Sheets <ArrowRight className="ml-1 h-4 w-4" />
           </Link>
        </div>
      </div>
    </div>
  );
}
