import type { RouterInput } from "@/api/client";
import { Trans, useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { client } from "@/api/client";
import { getAccountScope, getServer } from "@/auth/session";
import { Button, Label, ListGroup, ListRow, Sheet, Text, TextArea, TextField, showToast } from "@/ui";
import { SheetMenu } from "@/ui/sheet-menu";

type Report = RouterInput["ai"]["reportContent"];
type ReportAiContentProps = { source: Exclude<Report["source"], "public-resume">; text?: string; fromMenu?: boolean };

export function ReportAiContent({ source, text = "", fromMenu = false }: ReportAiContentProps) {
	const { t } = useLingui();
	const [open, setOpen] = useState(false);
	return (
		<>
			{fromMenu ? (
				<SheetMenu
					label={t`Message actions`}
					closeLabel={t`Close`}
					items={[{ label: t`Report AI content`, onPress: () => setOpen(true) }]}
				/>
			) : (
				<Button size="sm" variant="tertiary" onPress={() => setOpen(true)}>
					<Button.Label>
						<Trans>Report AI content</Trans>
					</Button.Label>
				</Button>
			)}
			<Sheet isOpen={open} onOpenChange={setOpen} title={t`Report AI content`} closeLabel={t`Close`}>
				{open ? <AiReportForm source={source} initialContent={text} onSent={() => setOpen(false)} /> : null}
			</Sheet>
		</>
	);
}

type AiReportFormProps = { source: Report["source"]; initialContent?: string; onSent: () => void };

export function AiReportForm({ source, initialContent = "", onSent }: AiReportFormProps) {
	const { t } = useLingui();
	const [content, setContent] = useState(initialContent.slice(0, 20_000));
	const [note, setNote] = useState("");
	const [reason, setReason] = useState<Report["reason"]>("other");
	const [busy, setBusy] = useState(false);
	const reasons = {
		hate: t`Hate or harassment`,
		sexual: t`Sexual content`,
		violence: t`Violence or abuse`,
		dangerous: t`Dangerous or illegal advice`,
		other: t`Other concern`,
	} satisfies Record<Report["reason"], string>;

	const send = async () => {
		const scope = getAccountScope();
		if (!scope || busy || !content.trim()) return;
		setBusy(true);
		try {
			await client.ai.reportContent({ source, content, note, reason }, { context: { scope } });
			onSent();
			showToast({ title: t`Report received by your server operator. Thank you.` });
		} catch {
			showToast({ title: t`Couldn't send the report. Your text is kept; try again.`, variant: "danger" });
		} finally {
			setBusy(false);
		}
	};

	return (
		<View className="gap-3">
			<Text tone="muted">{t`Only the text below and your reason are sent privately to the operator of ${getServer()} for safety review. Remove personal information you don't want to share. Reports are deleted with your account.`}</Text>
			<TextField isDisabled={busy}>
				<Label>{t`Content to report`}</Label>
				<TextArea
					variant="secondary"
					accessibilityLabel={t`Content to report`}
					value={content}
					onChangeText={setContent}
					maxLength={20_000}
				/>
			</TextField>
			<View className="gap-2">
				<Text weight="medium">
					<Trans>Reason</Trans>
				</Text>
				<ListGroup>
					{(Object.keys(reasons) as Report["reason"][]).map((item) => (
						<ListRow
							key={item}
							title={reasons[item]}
							isSelected={reason === item}
							isDisabled={busy}
							onPress={() => setReason(item)}
						/>
					))}
				</ListGroup>
			</View>
			<TextField isDisabled={busy}>
				<Label>{t`Additional details (optional)`}</Label>
				<TextArea
					variant="secondary"
					accessibilityLabel={t`Additional details (optional)`}
					value={note}
					onChangeText={setNote}
					maxLength={1_000}
				/>
			</TextField>
			<Button isDisabled={busy || !content.trim()} onPress={() => void send()}>
				<Button.Label>{busy ? t`Sending…` : t`Send report`}</Button.Label>
			</Button>
		</View>
	);
}
