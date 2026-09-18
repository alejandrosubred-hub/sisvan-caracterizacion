import { initializeApp, type FirebaseApp } from 'firebase/app';
import { getFirestore, type Firestore } from 'firebase/firestore';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithEmailAndPassword, sendPasswordResetEmail,
  signOut, onAuthStateChanged, type Auth, type User
} from 'firebase/auth';

const cfg = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID
};

/** true cuando hay configuración de Firebase; si no, la app corre solo local. */
export const remoteEnabled = Boolean(cfg.apiKey && cfg.projectId);

let app: FirebaseApp | null = null;
let firestore: Firestore | null = null;
let auth: Auth | null = null;

export function getRemote() {
  if (!remoteEnabled) return null;
  if (!app) { app = initializeApp(cfg); firestore = getFirestore(app); auth = getAuth(app); }
  return { app: app!, firestore: firestore!, auth: auth! };
}

export function watchUser(cb: (u: User | null) => void): () => void {
  const r = getRemote();
  if (!r) { cb(null); return () => {}; }
  return onAuthStateChanged(r.auth, cb);
}

/**
 * Usuario y contraseña: las cuentas las crea el administrador en la consola de Firebase
 * (Authentication → Users → Add user). La app no tiene registro público.
 */
export async function loginWithPassword(email: string, password: string) {
  const r = getRemote(); if (!r) return;
  await signInWithEmailAndPassword(r.auth, email.trim(), password);
}
export async function loginWithGoogle() {
  const r = getRemote(); if (!r) return;
  await signInWithPopup(r.auth, new GoogleAuthProvider());
}
export async function resetPassword(email: string) {
  const r = getRemote(); if (!r) return;
  await sendPasswordResetEmail(r.auth, email.trim());
}
export async function logout() { const r = getRemote(); if (r) await signOut(r.auth); }

/** Mensajes de error de Firebase Auth en lenguaje claro. */
export function authErrorMessage(e: unknown): string {
  const code = (e as { code?: string }).code ?? '';
  if (code.includes('invalid-credential') || code.includes('wrong-password') || code.includes('user-not-found')) return 'Usuario o contraseña incorrectos.';
  if (code.includes('too-many-requests')) return 'Demasiados intentos. Espera unos minutos.';
  if (code.includes('network-request-failed')) return 'Sin conexión: no se pudo verificar el usuario.';
  if (code.includes('user-disabled')) return 'Esta cuenta está desactivada. Contacta al administrador.';
  if (code.includes('operation-not-allowed')) return 'El método de acceso no está activado en Firebase (Authentication → Método de acceso).';
  if (code.includes('unauthorized-domain')) return `Este dominio no está autorizado en Firebase: agrega "${window.location.hostname}" en Authentication → Configuración → Dominios autorizados.`;
  if (code.includes('invalid-api-key') || code.includes('api-key-not-valid')) return 'La clave VITE_FIREBASE_API_KEY no es válida: revisa los secretos.';
  if (code.includes('popup-blocked') || code.includes('popup-closed')) return 'El navegador bloqueó la ventana de Google. Usa usuario y contraseña o abre la app en una pestaña propia.';
  if (code.includes('invalid-email')) return 'El correo no tiene un formato válido.';
  const msg = (e as { message?: string }).message ?? '';
  return `No se pudo iniciar sesión (${code || msg || 'error desconocido'}).`;
}
