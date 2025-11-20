import { LucideIcon } from 'lucide-react';

interface DashboardCardProps {
  title: string;
  value: string;
  icon: LucideIcon;
  trend?: string;
  trendUp?: boolean;
  description?: string;
}

export function DashboardCard({ title, value, icon: Icon, trend, trendUp, description }: DashboardCardProps) {
  return (
    <div className="rounded-xl border border-gray-800 bg-[#1e293b] p-6 shadow-sm transition-all hover:shadow-md">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-400">{title}</p>
          <h3 className="mt-2 text-2xl font-bold text-white">{value}</h3>
        </div>
        <div className="rounded-full bg-gray-800 p-3 text-primary">
          <Icon className="h-6 w-6" />
        </div>
      </div>
      {(trend || description) && (
        <div className="mt-4 flex items-center text-sm">
          {trend && (
            <span className={trendUp ? 'text-green-500' : 'text-red-500'}>
              {trend}
            </span>
          )}
          {description && (
            <span className="ml-2 text-gray-500">{description}</span>
          )}
        </div>
      )}
    </div>
  );
}

