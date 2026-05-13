import { writable } from "svelte/store";

import { api, SESSION_SENTINEL } from "../api";

type SessionState = {
  ready: boolean;
  token: string | null;
  displayName: string | null;
};

const createSessionStore = () => {
  const { subscribe, set } = writable<SessionState>({
    ready: false,
    token: null,
    displayName: null,
  });

  return {
    subscribe,
    async init() {
      try {
        const me = await api.auth.me();
        set({
          ready: true,
          token: SESSION_SENTINEL,
          displayName: me.user.displayName,
        });
      } catch {
        set({
          ready: true,
          token: null,
          displayName: null,
        });
      }
    },
    async signInLocal(identifier: string, password: string) {
      const me = await api.auth.login(identifier, password);
      set({
        ready: true,
        token: SESSION_SENTINEL,
        displayName: me.user.displayName,
      });
    },
    async signOut() {
      await api.auth.logout();
      set({
        ready: true,
        token: null,
        displayName: null,
      });
    },
  };
};

export const session = createSessionStore();
