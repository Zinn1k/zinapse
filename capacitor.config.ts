import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.zinapse.app',
  appName: 'Zinapse',
  webDir: 'public',
  server: {
    url: 'https://zinapse.vercel.app',
    cleartext: true,
  },
  android: {
    allowMixedContent: true,
    backgroundColor: '#09090b',
  },
};

export default config;
