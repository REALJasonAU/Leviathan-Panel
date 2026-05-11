import { writable } from "svelte/store";
import { onAuthStateChanged, signInWithPopup, signOut } from "firebase/auth";

import {
  firebaseAuth,
  firebaseClientEnabled,
  googleProvider,
} from "../firebase";

type SessionState = {
  ready: boolean;
  token: string | null;
  mode: "firebase" | "mock";
  displayName: string | null;
};

const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true";

const createSessionStore = () => {
  const { subscribe, set } = writable<SessionState>({
    ready: false,
    token: null,
    mode: useMockAuth || !firebaseClientEnabled ? "mock" : "firebase",
    displayName: null,
  });

  return {
    subscribe,
    init() {
      if (useMockAuth || !firebaseClientEnabled || !firebaseAuth) {
        set({
          ready: true,
          token: null,
          mode: "mock",
          displayName: null,
        });
        return;
      }

      onAuthStateChanged(firebaseAuth, async (user) => {
        if (!user) {
          set({
            ready: true,
            token: null,
            mode: "firebase",
            displayName: null,
          });
          return;
        }

        set({
          ready: true,
          token: await user.getIdToken(),
          mode: "firebase",
          displayName: user.displayName,
        });
      });
    },
    async signInGoogle() {
      if (!firebaseAuth || !googleProvider) {
        return;
      }
      await signInWithPopup(firebaseAuth, googleProvider);
    },
    async signOut() {
      if (firebaseAuth) {
        await signOut(firebaseAuth);
      }
      set({
        ready: true,
        token: null,
        mode: useMockAuth || !firebaseClientEnabled ? "mock" : "firebase",
        displayName: null,
      });
    },
    useMockAdmin() {
      set({
        ready: true,
        token: "dev-admin",
        mode: "mock",
        displayName: "Dev Admin",
      });
    },
    useMockUser() {
      set({
        ready: true,
        token: "dev-user",
        mode: "mock",
        displayName: "Dev User",
      });
    },
  };
};

export const session = createSessionStore();
