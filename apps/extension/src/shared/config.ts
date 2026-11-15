/** The Rezumi server this build talks to: https://rezumi.app in store builds, http://localhost:3000 in development. */
const REZUMI_URL = __REZUMI_URL__;

/** The server's origin: OAuth `resource`, API calls and the sign-in all go there. */
export const REZUMI_ORIGIN = new URL(REZUMI_URL).origin;

export const EXTENSION_VERSION = __EXTENSION_VERSION__;

/** An address on the Rezumi server, for links that open the web app in a new tab. */
export const rezumiLink = (path: string) => new URL(path, REZUMI_URL).toString();
