// The search typed into Applications, shared by List, Board and Calendar, cleared when the account changes.
import { create } from "zustand";
import { subscribeIdentity } from "@/auth/session";

export const useApplicationSearch = create<{ search: string; setSearch: (search: string) => void }>((set) => ({
	search: "",
	setSearch: (search) => set({ search }),
}));
subscribeIdentity(() => useApplicationSearch.setState({ search: "" }));
