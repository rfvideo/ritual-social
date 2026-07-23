import { cn } from '@/lib/utils';

export interface TabItem {
  key: string;
  label: string;
}

export function TabBar({
  tabs,
  active,
  onChange,
}: {
  tabs: TabItem[];
  active: string;
  onChange: (key: string) => void;
}) {
  return (
    <div className="flex border-b border-ash-200">
      {tabs.map((tab) => (
        <button
          key={tab.key}
          onClick={() => onChange(tab.key)}
          className={cn(
            'relative flex-1 px-2 py-3 text-center text-sm font-medium transition-colors sm:text-[15px]',
            active === tab.key ? 'text-mist-light' : 'text-mist-dim hover:bg-ash-100/40 hover:text-mist-light',
          )}
        >
          {tab.label}
          {active === tab.key && (
            <span className="absolute inset-x-0 bottom-0 mx-auto h-[3px] w-12 rounded-full bg-ritual-400 transition-all duration-200 sm:w-14" />
          )}
        </button>
      ))}
    </div>
  );
}
