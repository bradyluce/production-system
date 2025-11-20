'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import Image from 'next/image';
import { LayoutDashboard, FileText, TrendingUp, FileSpreadsheet } from 'lucide-react';
import clsx from 'clsx';

const navigation = [
  { name: 'Dashboard', href: '/', icon: LayoutDashboard },
  { name: 'Delivery Contracts', href: '/delivery', icon: FileText },
  { name: 'Comex Pricing', href: '/comex', icon: TrendingUp },
  { name: 'Daily Sheet Updates', href: '/daily-sheets', icon: FileSpreadsheet },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <div className="flex h-screen w-64 flex-col bg-sidebar text-white border-r border-gray-800">
      {/* K&L Logo Header */}
      <div className="bg-[#003366] px-6 py-4">
        <div className="flex items-center justify-center">
          <Image 
            src="/kl-logo.png" 
            alt="K&L Recycling" 
            width={140} 
            height={60} 
            className="object-contain"
            priority
          />
        </div>
      </div>
      
      <div className="flex flex-1 flex-col gap-1 px-3 py-4">
        {navigation.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.name}
              href={item.href}
              className={clsx(
                'flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-[#003366] text-white shadow-sm'
                  : 'text-gray-400 hover:bg-sidebar-hover hover:text-white'
              )}
            >
              <item.icon className="h-5 w-5" />
              {item.name}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
