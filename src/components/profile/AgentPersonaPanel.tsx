import { useState } from 'react';
import { Bot, Loader2, Sparkles, Wand2 } from 'lucide-react';
import { useAccount } from 'wagmi';
import { useAgentPersona } from '@/hooks/useAgentPersona';
import type { UserProfile } from '@/types';

export function AgentPersonaPanel({ profile }: { profile: UserProfile }) {
  const { address: viewer } = useAccount();
  const isOwn = viewer?.toLowerCase() === profile.address.toLowerCase();
  const { generate, draft, stage, reset } = useAgentPersona(profile.address);
  const [context, setContext] = useState('');

  const busy = stage === 'funding' || stage === 'inference';

  return (
    <div className="rounded-2xl border border-ash-200 bg-ash-100/20 p-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm font-medium text-mist-light">
          <Bot size={16} className="text-ritual-400" /> Ritual Agent Persona
        </div>
        {profile.agentPersona && (
          <span className="text-[10px] text-mist-dim">{isOwn ? 'Your persona set' : 'Persona active'}</span>
        )}
      </div>

      {profile.agentPersona && (
        <p className="mt-2 line-clamp-2 text-xs text-mist-dim italic">“{profile.agentPersona}”</p>
      )}

      {!isOwn && profile.agentPersona && (
        <div className="mt-3">
          <button
            onClick={async () => {
              const text = await generate({ postCaption: context });
              if (text) setContext('');
            }}
            disabled={busy}
            className="ritual-btn flex w-full items-center justify-center gap-2 text-xs"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <Wand2 size={14} />}
            {busy ? (stage === 'funding' ? 'Funding RitualWallet…' : 'Agent is drafting…') : 'Generate reply with Ritual AI'}
          </button>

          {draft && (
            <div className="mt-2 rounded-xl border border-ritual-500/30 bg-ritual-900/20 p-3 text-sm text-mist-light">
              <div className="mb-1 flex items-center gap-1 text-xs text-ritual-400">
                <Sparkles size={10} /> AI draft
              </div>
              {draft}
              <div className="mt-2 flex gap-2">
                <button onClick={reset} className="text-xs text-mist-dim hover:text-white">Dismiss</button>
              </div>
            </div>
          )}
        </div>
      )}

      {!profile.agentPersona && !isOwn && (
        <p className="mt-2 text-xs text-mist-dim">This user hasn’t set an AI persona yet.</p>
      )}
    </div>
  );
}
