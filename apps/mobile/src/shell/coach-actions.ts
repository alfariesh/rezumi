import { createContext, use } from "react";

export const OpenCoach = createContext<(() => void) | null>(null);
export const useOpenCoach = () => use(OpenCoach);
