import { Bell, Search } from 'lucide-react';

export function Header() {
  return (
    <header className="flex h-16 items-center justify-between border-b border-gray-800 bg-[#0f172a] px-6">
      <div className="flex items-center gap-4">
        {/* Breadcrumbs or Page Title placeholder */}
        <h2 className="text-lg font-semibold text-white">Overview</h2>
      </div>
      <div className="flex items-center gap-6">
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search..."
            className="h-9 w-64 rounded-md border border-gray-700 bg-gray-800 pl-9 pr-4 text-sm text-white placeholder-gray-400 focus:border-[#003366] focus:outline-none focus:ring-1 focus:ring-[#003366]"
          />
        </div>
        <button className="relative text-gray-400 hover:text-white transition-colors">
          <Bell className="h-5 w-5" />
          <span className="absolute -right-1 -top-1 h-2 w-2 rounded-full bg-red-500"></span>
        </button>
      </div>
    </header>
  );
}
