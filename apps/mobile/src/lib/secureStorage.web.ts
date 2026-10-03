// The web build is a development preview only: browsers have no equivalent of the
// phone's secure keystore, so keys live in sessionStorage and vanish with the tab.
export const secureStorage = {
  get: async (key: string) => sessionStorage.getItem(key),
  set: async (key: string, value: string) => sessionStorage.setItem(key, value),
  remove: async (key: string) => sessionStorage.removeItem(key),
};
