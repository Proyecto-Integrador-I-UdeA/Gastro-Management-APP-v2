import '../styles/globals.css';
import type { AppProps } from 'next/app';
import { SidebarProvider } from '@/context/SidebarContext';
import { Toaster } from "react-hot-toast";

function MyApp({ Component, pageProps }: AppProps) {
  return (
    <SidebarProvider>
      <>
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3000,
            style: {
              background: "#001F3F",
              color: "#fff",
              borderRadius: "10px",
              padding: "12px 16px",
            },
          }}
        />
        <Component {...pageProps} />
      </>
    </SidebarProvider>
  );
}
export default MyApp;