import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { WagmiProvider } from 'wagmi';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { RainbowKitProvider, lightTheme } from '@rainbow-me/rainbowkit';
import { Toaster } from 'react-hot-toast';
import '@rainbow-me/rainbowkit/styles.css';
import App from './App';
import { wagmiConfig } from './config/wagmi';
import './index.css';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 1, refetchOnWindowFocus: false } },
});

const ritualRainbowTheme = lightTheme({
  accentColor: '#0B3D28',
  accentColorForeground: '#C9A868',
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
                  background: '#F6F1E7',
                  color: '#1C1710',
                  border: '1px solid #D8CBA6',
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
