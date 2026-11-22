/** A light shape check before a request; the server decides whether the address is real. */
export const isEmailAddress = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
