import { useQuery } from "@tanstack/react-query";
import { getFlags, getSignInOptions } from "@/auth/oauth";
import { DEFAULT_SERVER, useSession } from "@/auth/session";

/**
 * The server the sign-in screens talk to (the current one; development builds can change it on the Server screen) and
 * what it allows: sign-ups, email, guests (`flags`), and which providers and native client ids it offers (`options`).
 */
export function useAuthServer() {
	const { server } = useSession();
	const flags = useQuery({ queryKey: ["auth", "flags", server], queryFn: () => getFlags(server), staleTime: 60_000 });
	const options = useQuery({
		queryKey: ["auth", "options", server],
		queryFn: async () => {
			const options = await getSignInOptions(server);
			// Apple and Google ID tokens are not bound to a server: offer them only on Rezumi's own, never to a server
			// that could collect them and replay them elsewhere (development builds can point at any server).
			return server === DEFAULT_SERVER ? options : { ...options, native: null };
		},
		staleTime: 60_000,
	});
	return { server, flags, options };
}
