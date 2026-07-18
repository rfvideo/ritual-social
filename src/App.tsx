import { useState } from 'react';
import { Routes, Route } from 'react-router-dom';
import { Sidebar } from '@/components/layout/Sidebar';
import { MobileNav } from '@/components/layout/MobileNav';
import { MobileHeader } from '@/components/layout/MobileHeader';
import { RightPanel } from '@/components/layout/RightPanel';
import { PostComposer } from '@/components/post/PostComposer';
import { HomePage } from '@/pages/Home';
import { ExplorePage } from '@/pages/Explore';
import { SearchPage } from '@/pages/Search';
import { NotificationsPage } from '@/pages/Notifications';
import { ProfilePage } from '@/pages/Profile';
import { PostDetailPage } from '@/pages/PostDetail';
import { isChainConfigured } from '@/config/chain';
import { CONTRACTS_DEPLOYED } from '@/config/constants';
import { AlertTriangle } from 'lucide-react';

function ConfigWarningBanner() {
  if (isChainConfigured && CONTRACTS_DEPLOYED) return null;
  return (
    <div className="flex items-center gap-2 border-b border-yellow-900/50 bg-yellow-950/40 px-4 py-2 text-xs text-yellow-300">
      <AlertTriangle size={14} className="shrink-0" />
      {!isChainConfigured
        ? 'Ritual Chain RPC not configured — set VITE_RITUAL_RPC_URL in .env.'
        : 'Contracts not deployed yet — run the forge script in /contracts, then set VITE_RITUAL_SOCIAL_ADDRESS.'}
    </div>
  );
}

export default function App() {
  const [composerOpen, setComposerOpen] = useState(false);

  return (
    <div className="min-h-screen">
      <ConfigWarningBanner />
      <MobileHeader />

      <div className="mx-auto flex max-w-7xl justify-center">
        <Sidebar onPublish={() => setComposerOpen(true)} />

        <main className="min-h-screen w-full max-w-2xl border-x border-ash-200 pb-20 lg:pb-0">
          <Routes>
            <Route path="/" element={<HomePage />} />
            <Route path="/explore" element={<ExplorePage />} />
            <Route path="/search" element={<SearchPage />} />
            <Route path="/notifications" element={<NotificationsPage />} />
            <Route path="/profile/:address" element={<ProfilePage />} />
            <Route path="/post/:postId" element={<PostDetailPage />} />
          </Routes>
        </main>

        <div className="px-4">
          <RightPanel />
        </div>
      </div>

      <MobileNav onPublish={() => setComposerOpen(true)} />
      <PostComposer open={composerOpen} onClose={() => setComposerOpen(false)} />
    </div>
  );
}
