import type { Application } from "../../types";
import type { InterviewTimelineEntry } from "@rezumi/schema/applications/data";
import { Button, Card, Dropdown, Input, Label, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { useLingui } from "@lingui/react";
import { Trans } from "@lingui/react/macro";
import { useMutation } from "@tanstack/react-query";
import { useId, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { toast } from "@rezumi/ui/components/toast";
import { downloadWithAnchor } from "@rezumi/utils/file";
import { cn } from "@rezumi/utils/style";
import { buildIcs } from "../../ics";
import { dayKey } from "../../interviews";
import { describeNextStep, getNextStep } from "../../next-step";
import { useInvalidateApplications } from "../../use-application-actions";
import { orpc } from "@/libs/orpc/client";

type NextStepCardProps = {
	application: Application;
	onScheduleInterview: (interview: InterviewTimelineEntry | null) => void;
};

/**
 * NEXT STEP: what the application needs, with Edit (schedule an interview or set the follow-up). Dated steps can go
 * to a calendar as an .ics file. Overdue steps are in warn.
 */
export function NextStepCard({ application, onScheduleInterview }: NextStepCardProps) {
	const { i18n } = useLingui();
	const [followUpOpen, setFollowUpOpen] = useState(false);
	const step = getNextStep(application);
	const text = describeNextStep(step, application, i18n.locale);

	const addToCalendar = () => {
		if (step.kind !== "interview" && step.kind !== "follow-up") return;
		const start = step.at;
		const minutes = step.kind === "interview" ? step.interview.durationMinutes : 30;
		const ics = buildIcs({
			uid: step.kind === "interview" ? step.interview.id : `follow-up-${application.id}`,
			title: `${text.title} · ${application.role}, ${application.company}`,
			start,
			end: new Date(start.getTime() + minutes * 60_000),
			...(step.kind === "interview" && step.interview.location ? { location: step.interview.location } : {}),
			...(step.kind === "interview" && step.interview.notes ? { description: step.interview.notes } : {}),
		});
		const blob = new Blob([ics], { type: "text/calendar" });
		downloadWithAnchor(blob, `${application.company}-${dayKey(start)}.ics`.replace(/[^\w.-]+/g, "-"));
	};

	return (
		<section aria-labelledby="application-next-step" className="grid gap-2">
			<h3 id="application-next-step" className="text-xs font-semibold text-muted">
				<Trans>Next step</Trans>
			</h3>
			<Card
				variant={text.tone === "warn" ? "transparent" : "secondary"}
				className={cn("gap-2 rounded-2xl p-3", text.tone === "warn" && "border border-warning bg-warning-soft")}
			>
				<div className="flex items-start gap-2.5">
					<Icon
						name={text.icon}
						className={cn("mt-0.5 shrink-0", text.tone === "warn" ? "text-warning-soft-foreground" : "text-muted")}
					/>
					<div className="grid min-w-0 flex-1">
						<strong className="text-sm font-semibold">{text.title}</strong>
						{text.sub && <span className="text-xs leading-[17px] text-muted">{text.sub}</span>}
					</div>
					{step.kind !== "closed" && (
						<Dropdown>
							<Button variant="secondary" size="sm">
								<Trans>Edit</Trans>
							</Button>
							<Dropdown.Popover placement="bottom end">
								<Dropdown.Menu>
									{step.kind === "interview" ? (
										<Dropdown.Item
											id="edit-interview"
											textValue={t`Edit this interview…`}
											onAction={() => onScheduleInterview(step.interview)}
										>
											<Label>
												<Trans>Edit this interview…</Trans>
											</Label>
										</Dropdown.Item>
									) : null}
									<Dropdown.Item
										id="schedule"
										textValue={t`Schedule an interview…`}
										onAction={() => onScheduleInterview(null)}
									>
										<Label>
											<Trans>Schedule an interview…</Trans>
										</Label>
									</Dropdown.Item>
									<Dropdown.Item
										id="follow-up"
										textValue={application.followUpAt ? t`Change the follow-up…` : t`Set a follow-up…`}
										onAction={() => setFollowUpOpen(true)}
									>
										<Label>
											{application.followUpAt ? <Trans>Change the follow-up…</Trans> : <Trans>Set a follow-up…</Trans>}
										</Label>
									</Dropdown.Item>
								</Dropdown.Menu>
							</Dropdown.Popover>
						</Dropdown>
					)}
				</div>
				{(step.kind === "interview" || step.kind === "follow-up") && (
					<Button size="sm" variant="ghost" className="ms-7 w-fit" onPress={addToCalendar}>
						<Icon name="calendar-dots" size={16} />
						<Trans>Add to calendar</Trans>
					</Button>
				)}
			</Card>

			<FollowUpDialog application={application} open={followUpOpen} onOpenChange={setFollowUpOpen} />
		</section>
	);
}

type FollowUpDialogProps = { application: Application; open: boolean; onOpenChange: (open: boolean) => void };

/** The follow-up: a date and a note, or cleared. */
function FollowUpDialog({ application, open, onOpenChange }: FollowUpDialogProps) {
	const id = useId();
	const invalidate = useInvalidateApplications();
	const [date, setDate] = useState("");
	const [note, setNote] = useState("");
	const [wasOpen, setWasOpen] = useState(false);
	if (open !== wasOpen) {
		setWasOpen(open);
		if (open) {
			setDate(application.followUpAt ? dayKey(new Date(application.followUpAt)) : "");
			setNote(application.followUpNote ?? "");
		}
	}
	const update = useMutation({
		...orpc.applications.update.mutationOptions(),
		onSuccess: () => {
			invalidate(application.id);
			onOpenChange(false);
		},
		onError: () => toast.add({ type: "error", description: t`Couldn't save the follow-up. Try again.` }),
	});

	return (
		<Modal.Backdrop isOpen={open} onOpenChange={onOpenChange}>
			<Modal.Container size="sm">
				<Modal.Dialog aria-describedby={`${id}-description`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading>
							<Trans>Follow-up</Trans>
						</Modal.Heading>
						<p id={`${id}-description`} className="text-sm text-muted">
							<Trans>A reminder to check in, shown as the next step until you do.</Trans>
						</p>
					</Modal.Header>
					<Modal.Body className="p-1">
						<form
							id={`${id}-form`}
							className="grid gap-3"
							onSubmit={(event) => {
								event.preventDefault();
								// A date at 9:00 local time, so it reads as that day everywhere.
								const at = date ? new Date(`${date}T09:00`) : null;
								update.mutate({ id: application.id, followUpAt: at, followUpNote: note.trim() || null });
							}}
						>
							<div className="grid gap-1.5">
								<Label htmlFor={`${id}-date`}>
									<Trans>Date</Trans>
								</Label>
								<Input
									fullWidth
									id={`${id}-date`}
									type="date"
									value={date}
									onChange={(event) => setDate(event.target.value)}
								/>
							</div>
							<div className="grid gap-1.5">
								<Label htmlFor={`${id}-note`}>
									<Trans>What to do</Trans>
								</Label>
								<Input
									fullWidth
									id={`${id}-note`}
									value={note}
									placeholder={t`Email the recruiter`}
									onChange={(event) => setNote(event.target.value)}
								/>
							</div>
						</form>
					</Modal.Body>
					<Modal.Footer>
						{application.followUpAt && (
							<Button
								variant="ghost"
								className="me-auto"
								onPress={() => update.mutate({ id: application.id, followUpAt: null, followUpNote: null })}
							>
								<Trans>Clear</Trans>
							</Button>
						)}
						<Button type="submit" form={`${id}-form`} isDisabled={!date || update.isPending}>
							<Trans>Save</Trans>
						</Button>
					</Modal.Footer>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}
