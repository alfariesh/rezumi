// Messages (web workspace/messages.tsx, W15–W17): paste what the employer wrote, read it, reply yourself, and apply
// the changes it implies only if you choose.
import type { WorkspacePartProps } from "../part";
import type { ReplyItem } from "./reply-card";
import { View } from "react-native";
import { latest, useSavedItems, useWorkspace } from "../queries";
import { PasteBox } from "./paste-box";
import { ProposalCard } from "./proposal-card";
import { ReplyCard } from "./reply-card";
import { Skeleton } from "@/ui";

export function MessagesPart({ application, version, now }: WorkspacePartProps) {
	const saved = useSavedItems(application.id);
	const workspace = useWorkspace(application.id);
	const readOnly = version?.data.kind === "reply";
	const reply = (readOnly ? version : latest(saved.data, "reply")) as ReplyItem | undefined;

	if (workspace.isPending || saved.isPending) return <Skeleton variant="none" className="h-40 rounded-2xl" />;

	return (
		<View className="gap-4">
			<PasteBox
				key={`paste-${version?.id ?? "live"}`}
				application={application}
				initial={readOnly ? (reply?.data.message ?? "") : workspace.data.message || (reply?.data.message ?? "")}
				readOnly={readOnly}
				onSave={(message) => workspace.save({ message })}
				fetchServer={() => workspace.fetchConfirmed().then((data) => data.message)}
			/>
			{reply ? <ReplyCard key={reply.id} reply={reply} readOnly={readOnly} /> : null}
			{reply && reply.data.changes.length > 0 ? (
				<ProposalCard
					key={`changes-${reply.id}`}
					reply={reply}
					application={application}
					now={now}
					readOnly={readOnly}
				/>
			) : null}
		</View>
	);
}
