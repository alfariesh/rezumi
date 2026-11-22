// Notes save a moment after typing stops, on blur and when leaving. Saves are serialized per application with the
// latest text winning, and unsaved text is kept on the device (restored on the next visit) until a save succeeds.
import type { Application } from "../types";
import type { NotesStorage } from "./notes-queue";
import { useLingui } from "@lingui/react/macro";
import { useQueryClient } from "@tanstack/react-query";
import Storage from "expo-sqlite/kv-store";
import { useCallback, useEffect, useRef, useState } from "react";
import { View } from "react-native";
import { createNotesQueue } from "./notes-queue";
import { DetailSection } from "./section";
import { client, orpc } from "@/api/client";
import { getServer } from "@/auth/session";
import { getDraftScope } from "@/draft";
import { Button, Text, TextArea, TextField, showToast } from "@/ui";

const NOTES_SAVE_DELAY_MS = 800;
const notesQueue = createNotesQueue(Storage satisfies NotesStorage);
// Partitioned like resume drafts (server + account), so another account never sees or replays them.
const notesKey = async (applicationId: string) =>
	`rezumi:application-notes:${(await getDraftScope()) ?? JSON.stringify([getServer()])}:${applicationId}`;

type NotesProps = { application: Application };

export function Notes({ application }: NotesProps) {
	const { t } = useLingui();
	const queryClient = useQueryClient();
	const id = application.id;
	const [key, setKey] = useState<string | null>(null);
	const [notes, setNotes] = useState(application.notes ?? "");
	const [failed, setFailed] = useState(false);
	// Typed but not handed to the queue yet.
	const unsent = useRef<string | null>(null);

	useEffect(() => {
		let live = true;
		void notesKey(id).then((resolved) => {
			if (!live) return;
			const kept = notesQueue.kept(resolved);
			if (kept !== null && unsent.current === null) {
				unsent.current = kept;
				setNotes(kept);
			} else if (unsent.current !== null) notesQueue.keep(resolved, unsent.current);
			setKey(resolved);
		});
		return () => {
			live = false;
		};
	}, [id]);

	const flush = useCallback(() => {
		const value = unsent.current;
		if (key === null || value === null) return;
		unsent.current = null;
		setFailed(false);
		notesQueue
			.save(key, value, async (text) => {
				await client.applications.update({ id, notes: text.trim() ? text : null });
				void queryClient.invalidateQueries({ queryKey: orpc.applications.key() });
			})
			.catch(() => {
				setFailed(true);
				showToast({ title: t`Couldn't save the notes. Your text is still here.`, variant: "danger" });
			});
	}, [id, key, queryClient, t]);

	useEffect(() => {
		if (unsent.current === null) return;
		const timeout = setTimeout(flush, NOTES_SAVE_DELAY_MS);
		return () => clearTimeout(timeout);
	}, [notes, flush]);
	// Leaving mid-sentence still saves what was typed; the queue outlives this screen.
	useEffect(() => () => flush(), [flush]);

	return (
		<DetailSection title={t`Notes`} testID="notes">
			<TextField>
				<TextArea
					variant="secondary"
					value={notes}
					placeholder={t`Anything to remember about this job`}
					accessibilityLabel={t`Notes`}
					numberOfLines={4}
					onChangeText={(value) => {
						unsent.current = value;
						if (key !== null) notesQueue.keep(key, value);
						setNotes(value);
					}}
					onBlur={flush}
					testID="notes-input"
				/>
			</TextField>
			{failed ? (
				<View className="flex-row items-center gap-2">
					<Text size="xs" tone="danger" className="flex-1">
						{t`Not saved yet. It stays on this device.`}
					</Text>
					<Button
						size="sm"
						variant="secondary"
						onPress={() => {
							unsent.current = notes;
							flush();
						}}
					>
						<Button.Label>{t`Retry`}</Button.Label>
					</Button>
				</View>
			) : null}
		</DetailSection>
	);
}
