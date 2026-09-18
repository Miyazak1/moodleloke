export function readMigratedLocalStorage(primaryKey: string, legacyKey: string) {
  const current = window.localStorage.getItem(primaryKey);
  if (current !== null) return current;
  const legacy = window.localStorage.getItem(legacyKey);
  if (legacy === null) return null;
  window.localStorage.setItem(primaryKey, legacy);
  window.localStorage.removeItem(legacyKey);
  return legacy;
}

export function writeMigratedLocalStorage(primaryKey: string, legacyKey: string, value: string) {
  window.localStorage.setItem(primaryKey, value);
  window.localStorage.removeItem(legacyKey);
}

export function removeMigratedLocalStorage(primaryKey: string, legacyKey: string) {
  window.localStorage.removeItem(primaryKey);
  window.localStorage.removeItem(legacyKey);
}
