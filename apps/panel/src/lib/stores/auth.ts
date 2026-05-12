import { writable } from "svelte/store";

import { api, SESSION_SENTINEL } from "../api";

type SessionState = {
  ready: boolean;
  token: string | null;
  mode: "session" | "mock";
  displayName: string | null;
};

const useMockAuth = import.meta.env.VITE_USE_MOCK_AUTH === "true";

const createSessionStore = () => {
  const { subscribe, set } = writable<SessionState>({
    ready: false,
    token: null,
    mode: useMockAuth ? "mock" : "session",
    displayName: null,
  });

  return {
    subscribe,
    async init() {
      if (useMockAuth) {
        set({
          ready: true,
          token: null,
          mode: "mock",
          displayName: null,
        });
        return;
      }

      try {
        const me = await api.auth.me();
        set({
          ready: true,
          token: SESSION_SENTINEL,
          mode: "session",
          displayName: me.user.displayName,
        });
      } catch {
        set({
          ready: true,
          token: null,
          mode: "session",
          displayName: null,
        });
      }
    },
    async signInLocal(identifier: string, password: string) {
      const me = await api.auth.login(identifier, password);
      set({
        ready: true,
        token: SESSION_SENTINEL,
        mode: "session",
        displayName: me.user.displayName,
      });
    },
    async signOut() {
      if (!useMockAuth) {
        await api.auth.logout();
      }
      set({
        ready: true,
        token: null,
        mode: useMockAuth ? "mock" : "session",
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
