import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SidebarProvider } from '@/context/SidebarContext';

export default function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SidebarProvider>
      <Component {...pageProps} />
    </SidebarProvider>
  );
}