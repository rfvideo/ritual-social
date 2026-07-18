import { resolveIpfsUri } from '@/lib/ipfs';
import { cn } from '@/lib/utils';

interface AvatarProps {
  address: string;
  uri?: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  ring?: boolean;
  className?: string;
}

const SIZES = {
  sm: 'h-8 w-8',
  md: 'h-10 w-10',
  lg: 'h-14 w-14',
  xl: 'h-24 w-24',
};

function addressToGradient(address: string) {
  const hash = address.toLowerCase().slice(2, 10);
  const hue1 = parseInt(hash.slice(0, 3), 16) % 360;
  const hue2 = (hue1 + 60) % 360;
  return `linear-gradient(135deg, hsl(${hue1}, 70%, 45%), hsl(${hue2}, 70%, 30%))`;
}

export function Avatar({ address, uri, size = 'md', ring = false, className }: AvatarProps) {
  const src = uri ? resolveIpfsUri(uri) : undefined;
  return (
    <div
      className={cn(
        'shrink-0 overflow-hidden rounded-full bg-ash-200',
        SIZES[size],
        ring && 'ring-2 ring-ritual-500/60 ring-offset-2 ring-offset-void',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        <div className="h-full w-full" style={{ background: addressToGradient(address) }} />
      )}
    </div>
  );
}
