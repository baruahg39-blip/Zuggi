import { initializeApp, getApps, getApp } from 'firebase/app';
import { 
  getAuth, 
  signOut as fbSignOut,
  onAuthStateChanged,
  signInWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithPopup
} from 'firebase/auth';
import { 
  getFirestore, 
  doc, 
  getDoc, 
  setDoc, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  onSnapshot, 
  orderBy,
  serverTimestamp,
  getDocFromServer,
  deleteDoc,
  runTransaction,
  writeBatch
} from 'firebase/firestore';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Authorized Platform Owner / Super Admin
export const SUPER_ADMIN_EMAIL = 'baruahg39@gmail.com';

const firebaseConfig = {
  apiKey: firebaseConfigJson.apiKey,
  authDomain: firebaseConfigJson.authDomain,
  projectId: firebaseConfigJson.projectId,
  storageBucket: firebaseConfigJson.storageBucket,
  messagingSenderId: firebaseConfigJson.messagingSenderId,
  appId: firebaseConfigJson.appId
};

// Initialize Firebase App singleton
export const app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);

// Initialize Authentication
export const auth = getAuth(app);

// Initialize Firestore (using specific provisioned databaseId if provided)
export const db = firebaseConfigJson.firestoreDatabaseId && firebaseConfigJson.firestoreDatabaseId !== '(default)'
  ? getFirestore(app, firebaseConfigJson.firestoreDatabaseId)
  : getFirestore(app);

// Validate Connection to Firestore per skill constraint
export async function testFirestoreConnection(): Promise<boolean> {
  try {
    await getDocFromServer(doc(db, 'platform_settings', 'config'));
    return true;
  } catch (error) {
    if (error instanceof Error && error.message.includes('the client is offline')) {
      console.warn('Firestore is currently running offline or connecting.');
    }
    return false;
  }
}

// Bootstrap default platform settings if not present
export async function ensurePlatformSettings() {
  try {
    const configRef = doc(db, 'platform_settings', 'config');
    const snap = await getDoc(configRef);
    if (!snap.exists()) {
      await setDoc(configRef, {
        commissionRatePct: 5,
        minBidAdvancePct: 20,
        supportPhone: '+91 94350 88219',
        emergencyEscalation: '+91 98640 12845',
        maintenanceMode: false,
        allowedVehicleTypes: 'Tata Ace, Pickup 407, 14ft Canter, 19ft Container, 10-Wheeler, Trailer',
        createdAt: new Date().toISOString()
      });
    }
  } catch {
    // Graceful fallback if permission rules initialize first
  }
}

// Safe no-op helpers that avoid loading external Google reCAPTCHA scripts
export function initRecaptchaVerifier(_containerId?: string): any {
  return {
    verify: async () => 'verified',
    clear: () => {}
  };
}

export function clearRecaptchaVerifier(_containerId?: string): void {
  // no-op
}

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): never {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
      tenantId: auth.currentUser?.tenantId,
      providerInfo: auth.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

export {
  signInWithEmailAndPassword,
  signInWithPopup,
  GoogleAuthProvider,
  fbSignOut,
  onAuthStateChanged,
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  query,
  where,
  getDocs,
  addDoc,
  onSnapshot,
  orderBy,
  serverTimestamp,
  runTransaction,
  writeBatch
};
