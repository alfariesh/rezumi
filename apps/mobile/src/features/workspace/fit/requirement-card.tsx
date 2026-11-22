// One requirement of the posting, how well the Profile backs it, and Add evidence (W2): what the person did, saved to
// the Profile as a shared Experience fact (it's about them, not this job).
import type { SavedData } from "../queries";
import { useLingui } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { randomUUID } from "expo-crypto";
import { useState } from "react";
import { View } from "react-native";
import { ActionButton, Actions, Block, Pill } from "../blocks";
import { workspaceError } from "../queries";
import { orpc } from "@/api/client";
import { FieldError, Icon, Label, Text, TextArea, TextField, Typography, cx, showToast } from "@/ui";

type Requirement = SavedData<"fit">["requirements"][number];
export type EvidenceStatus = "supported" | "partial" | "missing" | "added";

export function StatusPill({ status }: { status: EvidenceStatus }) {
	const { t } = useLingui();
	const pills = {
		supported: { tone: "success", icon: "check-circle", label: t`Supported` },
		added: { tone: "success", icon: "check-circle", label: t`Added by you` },
		partial: { tone: "warning", icon: "circle-half", label: t`Partly supported` },
		missing: { tone: "default", icon: "question", label: t`No evidence yet` },
	} as const;
	return <Pill {...pills[status]} />;
}

type CheckLineProps = { met: boolean | null; label: string; text: string };

/** One of the person's own requirements (salary, place, hours) against the posting. */
export function CheckLine({ met, label, text }: CheckLineProps) {
	return (
		<View className="flex-row gap-2">
			<Icon
				name={met === true ? "check-circle" : met === false ? "x-circle" : "question"}
				size={18}
				tone={met === true ? "success" : met === false ? "danger" : "warning"}
			/>
			<Typography type="body-sm" className="flex-1">{`${label}. ${text}`}</Typography>
		</View>
	);
}

type RequirementCardProps = {
	requirement: Requirement;
	status: EvidenceStatus;
	evidence: string;
	readOnly: boolean;
	onSaved: (factId: string) => void;
};

export function RequirementCard({ requirement, status, evidence, readOnly, onSaved }: RequirementCardProps) {
	const { t } = useLingui();
	const [editing, setEditing] = useState(false);
	const canAdd = !readOnly && (status === "missing" || status === "partial");
	return (
		<Block title={requirement.text}>
			<Actions>
				<StatusPill status={status} />
				<Text size="xs" tone="muted">
					{requirement.origin === "posting" ? t`Posting` : t`Inferred`}
				</Text>
			</Actions>
			<Typography type="body-sm" className={cx(status === "missing" && "text-muted")}>
				{evidence}
			</Typography>
			{canAdd ? (
				editing ? (
					<EvidenceEditor requirement={requirement} onCancel={() => setEditing(false)} onSaved={onSaved} />
				) : (
					<ActionButton
						icon="plus"
						label={status === "missing" ? t`Add evidence` : t`Clarify`}
						onPress={() => setEditing(true)}
					/>
				)
			) : null}
		</Block>
	);
}

type EvidenceEditorProps = { requirement: Requirement; onCancel: () => void; onSaved: (factId: string) => void };

function EvidenceEditor({ requirement, onCancel, onSaved }: EvidenceEditorProps) {
	const { t } = useLingui();
	const [text, setText] = useState("");
	const [touched, setTouched] = useState(false);
	const saveFact = useMutation(orpc.career.saveFact.mutationOptions());
	const empty = !text.trim();
	const name = requirement.text;
	const label = t`What you did: ${name}`;

	const save = async () => {
		if (empty) return setTouched(true);
		try {
			const fact = await saveFact.mutateAsync({
				applicationId: null,
				category: "experience",
				text: text.trim(),
				source: { kind: "manual", id: randomUUID(), quote: text.trim() },
			});
			if (!fact) throw new Error("not saved");
			onSaved(fact.id);
		} catch (error) {
			showToast({ title: workspaceError(error, t`Couldn't save that to your Profile. Try again.`), variant: "danger" });
		}
	};

	return (
		<View className="gap-2">
			<TextField isInvalid={touched && empty}>
				<Label>{label}</Label>
				<TextArea
					variant="secondary"
					value={text}
					maxLength={2000}
					autoFocus
					accessibilityLabel={label}
					placeholder={t`For example: “${name}: I did … at … in 2024, and it led to …”`}
					onChangeText={setText}
				/>
				<FieldError>{t`Write what you did.`}</FieldError>
			</TextField>
			<Actions>
				<ActionButton label={t`Save to Profile`} busy={saveFact.isPending} onPress={() => void save()} />
				<ActionButton variant="ghost" label={t`Cancel`} onPress={onCancel} />
			</Actions>
		</View>
	);
}
