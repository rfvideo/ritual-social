import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, useEffect } from 'react';
import { resizeImage } from '@/lib/image';

const MAX_IMAGES = 4;
const MAX_SIZE_MB = 8;
const ACCEPTED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];

interface ImageUploaderProps {
  files: File[];
  onChange: (files: File[]) => void;
}

export function ImageUploader({ files, onChange }: ImageUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [previews, setPreviews] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [processing, setProcessing] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  async function handleSelect(selected: FileList | null) {
    if (!selected) return;
    setError(null);
    const incoming = Array.from(selected);

    for (const file of incoming) {
      if (!ACCEPTED.includes(file.type)) {
        setError('Unsupported format — use JPG, PNG, WEBP, or GIF.');
        return;
      }
      if (file.size > MAX_SIZE_MB * 1024 * 1024) {
        setError(`Max file size is ${MAX_SIZE_MB}MB.`);
        return;
      }
    }

    setProcessing(true);
    try {
      const resized = await Promise.all(incoming.map((f) => resizeImage(f, 1600)));
      const next = [...files, ...resized].slice(0, MAX_IMAGES);
      onChange(next);
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        hidden
        onChange={(e) => handleSelect(e.target.files)}
      />

      {previews.length > 0 && (
        <div className="mt-3 grid grid-cols-2 gap-2">
          {previews.map((src, i) => (
            <div key={src} className="group relative aspect-video overflow-hidden rounded-xl border border-ash-200">
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-black/70 text-white opacity-0 transition group-hover:opacity-100"
              >
                <X size={13} />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="mt-2 flex items-center gap-2">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={files.length >= MAX_IMAGES || processing}
          className="flex items-center gap-1.5 rounded-full px-3 py-1.5 text-sm text-ritual-400 transition hover:bg-ritual-900/40 disabled:opacity-40"
        >
          <ImagePlus size={16} /> {processing ? 'Processing…' : `Photo (${files.length}/${MAX_IMAGES})`}
        </button>
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
                              }
