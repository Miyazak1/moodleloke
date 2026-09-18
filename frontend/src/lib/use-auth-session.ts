import { useEffect, useState } from 'react';
import { type User } from './api';
import { AUTH_CHANGE_EVENT, getMe, getStoredToken } from './auth';
import { AUTH_STORAGE_KEYS, ApiError, clearStoredAuthTokens, refreshStoredAccessToken } from './request';
import { readMigratedLocalStorage, removeMigratedLocalStorage, writeMigratedLocalStorage } from './storage-compat';

let pendingAuthProbe: { token: string; promise: Promise<User> } | null = null;
const AUTH_USER_CACHE_KEY = 'moodlelike.currentUser';
const LEGACY_AUTH_USER_CACHE_KEY = 'cscalite.currentUser';
const AUTH_PROBE_RETRY_DELAYS_MS = [1200, 2500];

function readCachedUser() {
  try {
    const raw = readMigratedLocalStorage(AUTH_USER_CACHE_KEY, LEGACY_AUTH_USER_CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<User>;
    if (typeof parsed.id !== 'string' || typeof parsed.email !== 'string' || typeof parsed.role !== 'string') return null;
    return parsed as User;
  } catch {
    return null;
  }
}

function cacheUser(user: User) {
  writeMigratedLocalStorage(AUTH_USER_CACHE_KEY, LEGACY_AUTH_USER_CACHE_KEY, JSON.stringify(user));
}

function clearCachedUser() {
  removeMigratedLocalStorage(AUTH_USER_CACHE_KEY, LEGACY_AUTH_USER_CACHE_KEY);
}

function isUnauthenticatedError(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function getMeOnceForToken(token: string) {
  if (!pendingAuthProbe || pendingAuthProbe.token !== token) {
    pendingAuthProbe = {
      token,
      promise: getMe().finally(() => {
        if (pendingAuthProbe?.token === token) pendingAuthProbe = null;
      })
    };
  }
  return pendingAuthProbe.promise;
}

function consumeGoogleOAuthCallbackMarker() {
  const url = new URL(window.location.href);
  if (url.searchParams.get('auth') !== 'google') return false;
  url.searchParams.delete('auth');
  window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  return true;
}

export function useAuthSession(enabled = true) {
  const [currentUser, setCurrentUser] = useState<User | null>(() => (enabled && getStoredToken() ? readCachedUser() : null));
  const [isResolvingAuth, setIsResolvingAuth] = useState(true);

  useEffect(() => {
    let isCurrent = true;

    if (!enabled) {
      setCurrentUser(null);
      setIsResolvingAuth(false);
      return () => {
        isCurrent = false;
      };
    }

    const resolveUserForToken = (token: string) => {
      void (async () => {
        const retryDelays = [0, ...AUTH_PROBE_RETRY_DELAYS_MS];
        let lastError: unknown = null;
        for (const delayMs of retryDelays) {
          if (delayMs > 0) await wait(delayMs);
          try {
            const user = await getMeOnceForToken(token);
            if (!isCurrent) return;
            cacheUser(user);
            setCurrentUser(user);
            setIsResolvingAuth(false);
            return;
          } catch (error) {
            lastError = error;
            if (isUnauthenticatedError(error)) break;
          }
        }

        if (!isCurrent) return;
        if (isUnauthenticatedError(lastError)) {
          clearStoredAuthTokens();
          clearCachedUser();
          setCurrentUser(null);
        } else {
          const cachedUser = readCachedUser();
          if (cachedUser) setCurrentUser(cachedUser);
        }
        setIsResolvingAuth(false);
      })();
    };

    const syncAuthState = () => {
      const shouldRefreshOAuthSession = consumeGoogleOAuthCallbackMarker();
      if (shouldRefreshOAuthSession) {
        clearStoredAuthTokens();
        clearCachedUser();
      }
      const token = getStoredToken();
      if (!token) {
        setIsResolvingAuth(true);
        void refreshStoredAccessToken()
          .then((refreshedToken) => {
            if (!isCurrent) return;
            if (refreshedToken) {
              resolveUserForToken(refreshedToken);
              return;
            }
            clearCachedUser();
            setCurrentUser(null);
            setIsResolvingAuth(false);
          })
          .catch(() => {
            if (!isCurrent) return;
            const cachedUser = readCachedUser();
            if (cachedUser) setCurrentUser(cachedUser);
            setIsResolvingAuth(false);
          });
        return;
      }

      if (isCurrent) {
        setIsResolvingAuth(true);
      }
      resolveUserForToken(token);
    };

    syncAuthState();

    const handleAuthChange = () => syncAuthState();
    const handleStorage = (event: StorageEvent) => {
      if (!event.key || AUTH_STORAGE_KEYS.includes(event.key as typeof AUTH_STORAGE_KEYS[number])) {
        syncAuthState();
      }
    };

    window.addEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
    window.addEventListener('storage', handleStorage);
    return () => {
      isCurrent = false;
      window.removeEventListener(AUTH_CHANGE_EVENT, handleAuthChange as EventListener);
      window.removeEventListener('storage', handleStorage);
    };
  }, [enabled]);

  return {
    currentUser,
    setCurrentUser,
    isResolvingAuth,
    setIsResolvingAuth
  };
}
