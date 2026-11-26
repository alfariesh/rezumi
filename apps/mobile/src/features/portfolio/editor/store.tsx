import type { Portfolio } from "../queries";
import type { EditOptions } from "@rezumi/portfolio/editing";
import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import type { ReactNode } from "react";
import { t } from "@lingui/core/macro";
import { onlineManager, useQueryClient } from "@tanstack/react-query";
import { createContext, useContext, useEffect, useState } from "react";
import { createPortfolioAssistant } from "@rezumi/portfolio/assistant";
import { createPortfolioEditor } from "@rezumi/portfolio/editing";
import { client, orpc } from "@/api/client";
import { getAccountScope } from "@/auth/session";
import { showToast } from "@/ui";

function openEditor(portfolio: Portfolio, scope: string, queryClient: ReturnType<typeof useQueryClient>) {
	const options = { context: { scope } };
	const editor = createPortfolioEditor<Portfolio>({
		read: () => client.portfolio.get(undefined, options),
		update: async (input, signal) => {
			const saved = await client.portfolio.update(input, { ...options, signal });
			if (getAccountScope() === scope) {
				queryClient.setQueryData(orpc.portfolio.get.queryOptions().queryKey, (previous) =>
					previous?.portfolio?.id === saved.id && previous.portfolio.updatedAt <= saved.updatedAt
						? { ...previous, portfolio: saved, usage: { ...previous.usage, works: saved.data.works.items.length } }
						: previous,
				);
			}
			return saved;
		},
		onOnline: (retry) =>
			onlineManager.subscribe((online) => {
				if (online) retry();
			}),
	});
	const assistant = createPortfolioAssistant({
		getState: editor.store.getState,
		record: (call, edits) => client.agent.messages.setEditStatus({ ...call, edits }, options),
	});
	return { ...editor, assistant, initial: portfolio, scope };
}

const EditorContext = createContext<ReturnType<typeof openEditor> | null>(null);

type EditorProviderProps = { portfolio: Portfolio; scope: string; children: ReactNode };

export function EditorProvider({ portfolio, scope, children }: EditorProviderProps) {
	const queryClient = useQueryClient();
	const [editor] = useState(() => openEditor(portfolio, scope, queryClient));
	useEffect(() => {
		editor.store.getState().load(editor.initial);
		return () => editor.store.getState().reset();
	}, [editor]);
	return <EditorContext.Provider value={editor}>{children}</EditorContext.Provider>;
}

export function useEditor() {
	const context = useContext(EditorContext);
	if (!context) throw new Error("No portfolio is open in the editor.");
	return context;
}

export function useEdit() {
	return useEditor().store((state) => state.edit);
}

export function useWorkEdit(id: string) {
	const edit = useEdit();
	return (
		change: (work: Draft<PortfolioData["works"]["items"][number]>, data: Draft<PortfolioData>) => void,
		options?: EditOptions,
	) =>
		edit((data) => {
			const work = data.works.items.find((item) => item.id === id);
			if (work) change(work, data);
		}, options);
}

export function offerUndo(
	store: ReturnType<typeof openEditor>["store"],
	previous: PortfolioData | undefined,
	title: string,
) {
	const applied = store.getState().portfolio?.data;
	if (!applied || applied === previous) return;
	showToast({
		title,
		undo: {
			label: t`Undo`,
			onUndo: () => {
				const current = store.getState();
				if (applied === current.portfolio?.data) current.undo();
				else showToast({ title: t`Use Undo at the top of the editor to step back through your changes.` });
			},
		},
	});
}
