/** The Rezumi server this build talks to: https://rezumi.app in store builds, http://localhost:3000 in development. */
const REZUMI_URL = __REZUMI_URL__;

export const EXTENSION_VERSION = __EXTENSION_VERSION__;

/** An address on the Rezumi server, for links that open the web app in a new tab. */
export const rezumiLink = (path: string) => new URL(path, REZUMI_URL).toString();
