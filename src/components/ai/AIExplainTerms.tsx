import { useState } from 'react';
import { Sparkles, Loader2 } from 'lucide-react';
import { useExplainTerm } from '@/hooks/useAI';
import { AI_TERMS } from '@/config/constants';

function detectTerms(text: string): string[] {
  return AI_TERMS.filter((term) => new RegExp(`\\b${term}\\b`, 'i').test(text));
}

function TermChip({ term }: { term: string }) {
  const { run, loading, result } = useExplainTerm();
  const [open, setOpen] = useState(false);

  async function handleClick() {
    setOpen((v) => !v);
    if (!result) await run({ term });
  }

  return (
    <div className="inline-block">
      <button
        onClick={handleClick}
        className="flex items-center gap-1 rounded-full border border-ash-300 px-2.5 py-1 text-xs text-mist transition hover:border-ritual-500 hover:text-ritual-300"
      >
        {loading ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
        Explain: {term}
      </button>
      {open && result && (
        <p className="mt-1.5 max-w-xs rounded-xl bg-ash-100 px-3 py-2 text-xs leading-relaxed text-mist-light">
          {result.output.explanation}
        </p>
      )}
    </div>
  );
}

export function AIExplainTerms({ text }: { text: string }) {
  const terms = detectTerms(text);
  if (terms.length === 0) return null;
  return (
    <div className="mt-2 flex flex-wrap gap-2">
      {terms.map((term) => (
        <TermChip key={term} term={term} />
      ))}
    </div>
  );
}
