import '../styles/globals.css';  // ← ruta relativa desde pages/ a styles/

import type { AppProps } from 'next/app';

function MyApp({ Component, pageProps }: AppProps) {
  return <Component {...pageProps} />;
}

export default MyApp;



