import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, darkTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App';
import { wagmiConfig } from './config/wagmi';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const ritualRainbowTheme = darkTheme({
  accentColor: '#3AF075',
  accentColorForeground: '#050706',
  borderRadius: 'large',
  fontStack: 'system',
  overlayBlur: 'small',
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={ritualRainbowTheme}>
          <BrowserRouter>
            <App />
            <Toaster
              position="bottom-center"
              toastOptions={{
                style: {
                  background: '#141917',
                  color: '#C8D2CB',
                  border: '1px solid #2a312c',
                  fontSize: '13px',
                },
              }}
            />
          </BrowserRouter>
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  </React.StrictMode>,
);
