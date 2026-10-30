import type { RouterOutput } from "@/libs/orpc/client";
import { Command } from "@heroui-pro/react";
import { Kbd } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useQuery } from "@tanstack/react-query";
import { useNavigate, useRouteContext } from "@tanstack/react-router";
import { Icon } from "@rezumi/ui/components/icon";
import { useCommandPaletteStore } from "../store";
import { BaseCommandGroup, PaletteItem, searchText } from "./base";
import { useDialogStore } from "@/dialogs/store";
import { applicationsListQueryOptions } from "@/features/applications/queries";
import { orpc } from "@/libs/orpc/client";

type Application = RouterOutput["applications"]["listSummary"][number];
type Thread = RouterOutput["agent"]["threads"]["list"][number];
type SearchPage = "resumes" | "applications" | "threads";
type SearchPageProps = { page: SearchPage };

const isSearchPage = (page: string | undefined): page is SearchPage =>
	page === "resumes" || page === "applications" || page === "threads";

const matchesSearch = (search: string, values: Array<string | null | undefined>) => {
	const query = search.trim().toLowerCase();
	return !query || values.some((value) => value?.toLowerCase().includes(query));
};

export function ResumesCommandGroup() {
	const { session } = useRouteContext({ strict: false });
	const peekPage = useCommandPaletteStore((state) => state.peekPage);
	const pushPage = useCommandPaletteStore((state) => state.pushPage);

	const commandPage = peekPage();
	const searchPage = isSearchPage(commandPage) ? commandPage : undefined;

	if (!session) return null;

	return (
		<>
			<BaseCommandGroup heading={<Trans>Search for…</Trans>}>
				<PaletteItem id="search.resumes" textValue={searchText(t`Resumes`)} onAction={() => pushPage("resumes")}>
					<Icon name="file-text" size={16} />
					<Trans>Resumes</Trans>
				</PaletteItem>

				<PaletteItem
					id="search.applications"
					textValue={searchText(t`Applications`)}
					onAction={() => pushPage("applications")}
				>
					<Icon name="briefcase" size={16} />
					<Trans>Applications</Trans>
				</PaletteItem>

				<PaletteItem
					id="search.threads"
					textValue={searchText(t`Assistant conversations`, [t`Conversations`, t`Assistant`, t`Threads`])}
					onAction={() => pushPage("threads")}
				>
					<Icon name="chat-text" size={16} />
					<Trans>Assistant conversations</Trans>
				</PaletteItem>
			</BaseCommandGroup>

			{searchPage === "resumes" ? <ResumesPage page={searchPage} /> : null}
			{searchPage === "applications" ? <ApplicationsPage page={searchPage} /> : null}
			{searchPage === "threads" ? <ThreadsPage page={searchPage} /> : null}
		</>
	);
}

function ResumesPage({ page }: SearchPageProps) {
	const navigate = useNavigate();
	const { openDialog } = useDialogStore();
	const reset = useCommandPaletteStore((state) => state.reset);
	const search = useCommandPaletteStore((state) => state.search);
	const { data: resumes, isLoading } = useQuery(
		orpc.resume.list.queryOptions({ input: { sort: "lastUpdatedAt", tags: [] } }),
	);
	const filteredResumes = (resumes ?? []).filter((resume) => matchesSearch(search, [resume.name, resume.slug]));

	const onCreate = () => {
		reset();
		openDialog("document.new", undefined);
	};

	const onNavigate = async (path: string) => {
		await navigate({ to: path });
		reset();
	};

	return (
		<BaseCommandGroup page={page} heading={<Trans>Resumes</Trans>}>
			<PaletteItem id="resumes.create" textValue={t`Create a new resume`} onAction={onCreate}>
				<Icon name="plus" size={16} />
				<Trans>Create a new resume</Trans>
			</PaletteItem>

			{isLoading ? (
				<LoadingItem>
					<Trans>Loading resumes…</Trans>
				</LoadingItem>
			) : (
				filteredResumes.map((resume) => (
					<PaletteItem
						key={resume.id}
						id={`resume.${resume.id}`}
						textValue={searchText(resume.name, [resume.slug])}
						onAction={() => onNavigate(`/builder/${resume.id}`)}
					>
						<Icon name="file-text" size={16} />
						{resume.name}

						<span className="ms-auto font-mono text-xs text-ink-3 opacity-0 group-data-[focused=true]:opacity-100">
							<Trans comment="Command palette hint that pressing Enter opens the selected resume">
								Press <Kbd>Enter</Kbd> to open
							</Trans>
						</span>
					</PaletteItem>
				))
			)}
		</BaseCommandGroup>
	);
}

function ApplicationsPage({ page }: SearchPageProps) {
	const navigate = useNavigate();
	const reset = useCommandPaletteStore((state) => state.reset);
	const search = useCommandPaletteStore((state) => state.search);
	const { data: applications, isLoading } = useQuery(applicationsListQueryOptions());
	const filteredApplications = (applications ?? []).filter((application) =>
		matchesSearch(search, [application.company, application.role]),
	);

	const onCreateApplication = async () => {
		await navigate({ to: "/dashboard/applications", search: { create: true } });
		reset();
	};

	const onOpenApplication = async (application: Application) => {
		await navigate({
			to: "/dashboard/applications",
			search: { applicationId: application.id },
		});
		reset();
	};

	return (
		<BaseCommandGroup page={page} heading={<Trans>Applications</Trans>}>
			<PaletteItem id="applications.create" textValue={t`New application`} onAction={onCreateApplication}>
				<Icon name="plus" size={16} />
				<Trans>New application</Trans>
			</PaletteItem>

			{isLoading ? (
				<LoadingItem>
					<Trans>Loading applications…</Trans>
				</LoadingItem>
			) : (
				filteredApplications.map((application) => (
					<PaletteItem
						key={application.id}
						id={`application.${application.id}`}
						textValue={searchText(application.company, [application.role])}
						onAction={() => onOpenApplication(application)}
					>
						<Icon name="briefcase" size={16} />
						<span className="min-w-0 truncate">{application.company}</span>
						<span className="truncate text-xs text-ink-3">{application.role}</span>
					</PaletteItem>
				))
			)}
		</BaseCommandGroup>
	);
}

function ThreadsPage({ page }: SearchPageProps) {
	const navigate = useNavigate();
	const reset = useCommandPaletteStore((state) => state.reset);
	const search = useCommandPaletteStore((state) => state.search);
	const { data: threads, isLoading } = useQuery(orpc.agent.threads.list.queryOptions());
	const filteredThreads = (threads ?? [])
		.filter((thread) => thread.scope === "document")
		.filter((thread) => matchesSearch(search, [thread.title, thread.resumeName, thread.coverLetterName]));

	// A conversation opens its document with the assistant showing it.
	const onOpenThread = async (thread: Thread) => {
		if (thread.coverLetterId)
			await navigate({
				to: "/builder/letter/$coverLetterId",
				params: { coverLetterId: thread.coverLetterId },
				search: { assistant: thread.id },
			});
		else if (thread.workingResumeId)
			await navigate({
				to: "/builder/$resumeId",
				params: { resumeId: thread.workingResumeId },
				search: { assistant: thread.id },
			});
		reset();
	};

	return (
		<BaseCommandGroup page={page} heading={<Trans>Assistant conversations</Trans>}>
			{isLoading ? (
				<LoadingItem>
					<Trans>Loading conversations…</Trans>
				</LoadingItem>
			) : (
				filteredThreads.map((thread) => {
					const documentName = thread.coverLetterName ?? thread.resumeName ?? "";

					return (
						<PaletteItem
							key={thread.id}
							id={`thread.${thread.id}`}
							textValue={searchText(thread.title, [documentName])}
							onAction={() => onOpenThread(thread)}
						>
							<Icon name="chat-text" size={16} />
							<span className="min-w-0 truncate">{thread.title}</span>
							<span className="truncate text-xs text-ink-3">{documentName}</span>
						</PaletteItem>
					);
				})
			)}
		</BaseCommandGroup>
	);
}

/** A disabled row shown while data loads; its text always contains the query so the filter keeps it visible. */
function LoadingItem({ children }: { children: React.ReactNode }) {
	const search = useCommandPaletteStore((state) => state.search);

	return (
		<Command.Item id="loading" isDisabled textValue={`${search.trim()} ${t`Loading…`}`} className="px-2 py-3">
			{children}
		</Command.Item>
	);
}
