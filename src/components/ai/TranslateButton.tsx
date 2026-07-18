import { useState } from 'react';
import { Globe2, Loader2 } from 'lucide-react';
import { useTranslate } from '@/hooks/useAI';

const TARGET_LANGUAGE =
  typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] || 'en' : 'en';

export function TranslateButton({ text }: { text: string }) {
  const { run, loading, result } = useTranslate();
  const [showTranslated, setShowTranslated] = useState(false);

  async function handleClick() {
    if (result) {
      setShowTranslated((v) => !v);
      return;
    }
    const job = await run({ text, targetLanguage: TARGET_LANGUAGE });
    if (job) setShowTranslated(true);
  }

  return (
    <div>
      {showTranslated && result && (
        <p className="mb-1 rounded-xl bg-ritual-900/30 px-3 py-2 text-sm text-mist-light">
          {result.output.translatedText}
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1 text-xs font-medium text-ritual-400 transition hover:text-ritual-300"
      >
        {loading ? <Loader2 size={12} className="animate-spin" /> : <Globe2 size={12} />}
        {showTranslated ? 'Lihat Teks Asli' : 'Terjemahkan'}
      </button>
    </div>
  );
}
