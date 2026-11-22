// Start blank, try a sample, or a new letter: each creates the document at once and opens it, as the web's
// `use-start-document.ts`. From New (a sheet over the app) the editor replaces the sheet; elsewhere it is pushed.
import type { DocumentSummary } from "./filter";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import { getNetworkStateAsync } from "expo-network";
import { useRouter } from "expo-router";
import { useRef, useState } from "react";
import { useNewDocuments } from "./new-documents";
import { documentError } from "./queries";
import { client, orpc } from "@/api/client";
import { getServer, useSession } from "@/auth/session";
import { routes } from "@/routes";
import { showToast } from "@/ui";

type Created = Pick<DocumentSummary, "id" | "type">;

type StartOptions = {
	/** Links the new document to this application (New from an application). */
	applicationId?: string | undefined;
	/** `replace` from the New sheet, so Back from the editor doesn't reopen it. */
	navigation?: "push" | "replace" | undefined;
};

export function useStartDocument({ applicationId, navigation = "push" }: StartOptions = {}) {
	const { t } = useLingui();
	const router = useRouter();
	const queryClient = useQueryClient();
	const session = useSession();
	const running = useRef(false);
	const [creating, setCreating] = useState(false);

	const start = async (create: () => Promise<Created>, done?: string) => {
		if (running.current) return;
		running.current = true;
		setCreating(true);
		try {
			if (session.status !== "signed-in" || getServer() !== session.server) {
				showToast({ title: t`Sign in to continue.`, variant: "danger" });
				return;
			}
			const network = await getNetworkStateAsync();
			if (network.isConnected === false || network.isInternetReachable === false) {
				showToast({ title: t`You're offline. Try again when you reconnect.`, variant: "danger" });
				return;
			}
			const document = await create();
			if (getServer() !== session.server) return;
			if (applicationId) await client.documents.linkApplication({ ...document, applicationId });
			useNewDocuments.getState().markNew(document);
			void queryClient.invalidateQueries({ queryKey: orpc.documents.key() });
			if (applicationId) void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
			if (done) showToast({ title: done });
			const href = document.type === "resume" ? routes.builder(document.id) : routes.letter(document.id);
			if (navigation === "replace") router.replace(href);
			else router.push(href);
		} catch (error) {
			showToast({ title: documentError(error), variant: "danger" });
		} finally {
			running.current = false;
			setCreating(false);
		}
	};

	return {
		creating,
		startBlank: () =>
			start(async () => {
				const id = await client.resume.create({
					name: t`Untitled resume`,
					tags: [],
					autoName: true,
					withSampleData: false,
				});
				return { id, type: "resume" };
			}),
		trySample: () =>
			start(
				async () => {
					const id = await client.resume.create({ name: t`Sample resume`, tags: [], withSampleData: true });
					return { id, type: "resume" };
				},
				t`Sample resume added. Delete it anytime.`,
			),
		/**
		 * A new letter goes with the resume edited most recently: its sender details and design, so the two look alike.
		 * Without a resume, the Profile is the sender.
		 */
		newLetter: () =>
			start(async () => {
				const documents = queryClient
					.getQueriesData<DocumentSummary[]>({ queryKey: orpc.documents.list.key() })
					.flatMap(([, rows]) => rows ?? []);
				const resume = documents
					.filter((document) => document.type === "resume" && !document.trashedAt)
					.toSorted((a, b) => b.updatedAt.getTime() - a.updatedAt.getTime())[0];
				const letter = await client.coverLetters.create({
					name: t`Untitled letter`,
					recipient: "",
					content: "",
					...(resume ? { resumeId: resume.id } : {}),
				});
				return { id: letter.id, type: "letter" };
			}),
	};
}
