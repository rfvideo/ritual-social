import { ImagePlus, X } from 'lucide-react';
import { useRef, useState, useEffect, type DragEvent, type ClipboardEvent } from 'react';
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
  const [dragActive, setDragActive] = useState(false);

  useEffect(() => {
    const urls = files.map((f) => URL.createObjectURL(f));
    setPreviews(urls);
    return () => urls.forEach((u) => URL.revokeObjectURL(u));
  }, [files]);

  async function handleSelect(incoming: File[]) {
    if (incoming.length === 0) return;
    setError(null);

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

  function handleDrop(e: DragEvent<HTMLDivElement>) {
    e.preventDefault();
    setDragActive(false);
    if (files.length >= MAX_IMAGES) return;
    handleSelect(Array.from(e.dataTransfer.files));
  }

  function handlePaste(e: ClipboardEvent<HTMLDivElement>) {
    if (files.length >= MAX_IMAGES) return;
    const items = Array.from(e.clipboardData.items).filter((item) => item.type.startsWith('image/'));
    if (items.length === 0) return;
    const pasted = items.map((item) => item.getAsFile()).filter((f): f is File => f !== null);
    if (pasted.length > 0) handleSelect(pasted);
  }

  const gridCols = previews.length === 1 ? 'grid-cols-1' : 'grid-cols-2';

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        if (files.length < MAX_IMAGES) setDragActive(true);
      }}
      onDragLeave={() => setDragActive(false)}
      onDrop={handleDrop}
      onPaste={handlePaste}
      tabIndex={-1}
      className={`rounded-2xl transition ${dragActive ? 'bg-ritual-900/20 ring-2 ring-ritual-500/60' : ''}`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED.join(',')}
        multiple
        hidden
        onChange={(e) => handleSelect(Array.from(e.target.files ?? []))}
      />

      {previews.length > 0 && (
        <div className={`mt-3 grid ${gridCols} gap-2`}>
          {previews.map((src, i) => (
            <div
              key={src}
              className="relative overflow-hidden rounded-xl border border-ash-200"
              style={{ aspectRatio: previews.length === 1 ? '16/10' : '1/1' }}
            >
              <img src={src} alt="" className="h-full w-full object-cover" />
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                aria-label="Remove image"
                className="absolute right-2 top-2 flex h-7 w-7 items-center justify-center rounded-full bg-black/70 text-white transition hover:bg-black/90"
              >
                <X size={14} />
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
        {files.length < MAX_IMAGES && (
          <span className="hidden text-xs text-mist-dim sm:inline">or drag & drop, or paste an image</span>
        )}
      </div>
      {error && <p className="mt-1 text-xs text-red-400">{error}</p>}
    </div>
  );
        }
