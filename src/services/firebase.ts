import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getAnalytics, isSupported } from 'firebase/analytics';
import { initializeAppCheck, ReCaptchaV3Provider } from 'firebase/app-check';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
export const db = initializeFirestore(
  app,
  {
    experimentalForceLongPolling: true,
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager(),
    }),
  },
  firebaseConfig.firestoreDatabaseId
);
export const auth = getAuth(app);
export const storage = getStorage(app);

// Initialize Firebase App Check with reCAPTCHA v3
if (typeof window !== 'undefined') {
  // Use explicit static references so Vite can replace them
  // @ts-ignore
  const recaptchaKey = import.meta.env.VITE_RECAPTCHA_SITE_KEY || import.meta.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
  
  // Enable debug mode for localhost and AI Studio preview domains
  if (window.location.hostname === 'localhost' || window.location.hostname.includes('run.app')) {
    (self as any).FIREBASE_APPCHECK_DEBUG_TOKEN = "41257785-ef5d-4299-96cd-f4f6c903d2ca";
  }

  if (recaptchaKey) {
    initializeAppCheck(app, {
      provider: new ReCaptchaV3Provider(recaptchaKey),
      isTokenAutoRefreshEnabled: true
    });
  } else {
    console.warn("reCAPTCHA site key is missing. App Check will not be initialized.");
  }
}

// Initialize Analytics conditionally to avoid server-side or unsupported browser issues
export let analytics: any = null;
isSupported().then((supported) => {
  if (supported) {
    analytics = getAnalytics(app);
  }
}).catch(console.error);
