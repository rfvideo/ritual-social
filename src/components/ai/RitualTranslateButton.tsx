import { useState } from 'react';
import { Globe2, Loader2, ShieldCheck } from 'lucide-react';
import { useRitualTranslate } from '@/hooks/useRitualLLM';
import { useAccount } from 'wagmi';
import toast from 'react-hot-toast';

const TARGET_LANGUAGE =
  typeof navigator !== 'undefined' ? navigator.language?.split('-')[0] || 'en' : 'en';

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  id: 'Indonesian',
  es: 'Spanish',
  fr: 'French',
  de: 'German',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  ar: 'Arabic',
  pt: 'Portuguese',
  ru: 'Russian',
  tr: 'Turkish',
  vi: 'Vietnamese',
  th: 'Thai',
  hi: 'Hindi',
};

export function RitualTranslateButton({ text }: { text: string }) {
  const { run, stage, result } = useRitualTranslate();
  const { isConnected } = useAccount();
  const [showTranslated, setShowTranslated] = useState(false);
  const [translatedText, setTranslatedText] = useState('');

  const loading = stage === 'funding' || stage === 'selecting-executor' || stage === 'awaiting-inference';
  const targetName = LANGUAGE_NAMES[TARGET_LANGUAGE] ?? TARGET_LANGUAGE;

  async function handleClick() {
    if (!isConnected) {
      toast.error('Connect your wallet to translate on-chain with Ritual.');
      return;
    }
    if (showTranslated) {
      setShowTranslated(false);
      return;
    }
    if (translatedText) {
      setShowTranslated(true);
      return;
    }
    const prompt = `Translate the following text into ${targetName} (${TARGET_LANGUAGE}). Keep hashtags and mentions unchanged. Text: """${text}"""`;
    const res = await run(prompt);
    if (res && !res.hasError && res.output) {
      setTranslatedText(res.output.translatedText);
      setShowTranslated(true);
    } else if (res?.hasError) {
      toast.error(`Ritual translation failed: ${res.errorMessage}`);
    }
  }

  return (
    <div>
      {showTranslated && translatedText && (
        <p className="mb-1 rounded-xl bg-ritual-900/30 px-3 py-2 text-sm text-mist-light">
          {translatedText}
        </p>
      )}
      <button
        onClick={handleClick}
        disabled={loading}
        className="flex items-center gap-1 text-xs font-medium text-ritual-400 transition hover:text-ritual-300 disabled:opacity-50"
      >
        {loading ? (
          <Loader2 size={12} className="animate-spin" />
        ) : showTranslated ? (
          <ShieldCheck size={12} />
        ) : (
          <Globe2 size={12} />
        )}
        {loading
          ? stage === 'funding'
            ? 'Funding RitualWallet…'
            : stage === 'selecting-executor'
              ? 'Selecting executor…'
              : 'Translating on-chain…'
          : showTranslated
            ? 'Show Original'
            : `Translate (${targetName})`}
      </button>
    </div>
  );
}
