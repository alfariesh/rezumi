import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { AppLayout, Navbar, Sheet, Sidebar, useSidebar } from "@heroui-pro/react";
import { Breadcrumbs, Button, Kbd } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate, useRouterState } from "@tanstack/react-router";
import Cookies from "js-cookie";
import { useEffect } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { useBreakpoint } from "@rezumi/ui/hooks/use-breakpoint";
import { cn } from "@rezumi/utils/style";
import { ShellPendingContext } from "@/components/layout/loading-screen";
import { PAGE_GUTTER } from "@/components/layout/page";
import { useDialogStore } from "@/dialogs/store";
import { applicationDetailQueryOptions } from "@/features/applications/queries";
import { GuestBanner } from "@/features/auth/components/guest-banner";
import { CoachPanelSlot, loadCoachPanel } from "@/features/coach-panel/coach-panel";
import { useCoachPanelStore } from "@/features/coach-panel/store";
import { useCommandPaletteStore } from "@/features/command-palette/store";
import { isEditableElementFocused } from "@/features/resume/builder/draft";
import { UserAvatar } from "@/features/user/avatar";
import { UserDropdownMenu } from "@/features/user/dropdown-menu";
import { orpc } from "@/libs/orpc/client";

type NavItem = {
	/** Where it links. */
	to: "/dashboard" | "/dashboard/applications" | "/dashboard/documents" | "/dashboard/portfolio" | "/dashboard/profile";
	icon: IconName;
	label: string;
	count?: number;
};

/**
 * The destinations, in the order a search runs: Home (what needs you), the jobs (offers live inside them), the
 * documents sent to them (trash inside), the portfolio, then the Profile everything starts from. The coach opens from
 * the top bar on every page. Counts show only what is waiting or open.
 */
function useNavItems() {
	const { data: counts } = useQuery(orpc.documents.counts.queryOptions());
	const { data: applicationStats } = useQuery(orpc.applications.stats.queryOptions({}));
	const { data: notifications } = useQuery(orpc.career.notifications.queryOptions({ input: {} }));
	// Shown only to accounts the switch (`PORTFOLIO_MODE`) lets have one; while it's off nothing changes here. The light
	// status, not the portfolio itself: the menu reads it on every page.
	const { data: portfolio } = useQuery(orpc.portfolio.status.queryOptions());
	// Home counts what's waiting for the user (unread notifications), so nothing shows at zero.
	const unread = notifications?.filter((notification) => !notification.readAt).length ?? 0;

	const items: NavItem[] = [
		{ to: "/dashboard", icon: "house", label: t`Home`, ...(unread ? { count: unread } : {}) },
		{
			to: "/dashboard/applications",
			icon: "briefcase",
			label: t`Applications`,
			...(applicationStats
				? {
						count: applicationStats.byStage
							.filter((row) => row.status !== "closed")
							.reduce((total, row) => total + row.count, 0),
					}
				: {}),
		},
		{
			to: "/dashboard/documents",
			icon: "file-text",
			label: t`Documents`,
			...(counts ? { count: counts.resume + counts.letter } : {}),
		},
		...(portfolio?.enabled
			? [{ to: "/dashboard/portfolio", icon: "globe-hemisphere-west", label: t`Portfolio` } satisfies NavItem]
			: []),
		{ to: "/dashboard/profile", icon: "user-circle", label: t`Profile` },
	];

	return items;
}

/** Whether the item is the current page: Home is exact, the others match their section. */
function useIsCurrent() {
	const matchRoute = useMatchRoute();
	return (item: NavItem) => Boolean(matchRoute({ to: item.to, fuzzy: item.to !== "/dashboard" }));
}

/** The sidebar state HeroUI's AppLayout saves on every toggle; collapsed to icons by default below 1024px. */
function initialSidebarOpen() {
	const saved = Cookies.get("sidebar_state");
	if (saved !== undefined) return saved !== "false";
	return typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches;
}

/** An application's workspace, which has a coach of its own (the `?coach=` sheet) for that job. */
const WORKSPACE_ROUTE = "/dashboard/applications/$applicationId/{-$tab}";

/** The open application workspace's params, or undefined on any other page. */
function useWorkspaceParams() {
	const applicationId = useRouterState({
		select: (state): string | undefined =>
			state.matches.find((match) => match.routeId === WORKSPACE_ROUTE)?.params.applicationId,
	});
	const tab = useRouterState({
		select: (state): string | undefined => state.matches.find((match) => match.routeId === WORKSPACE_ROUTE)?.params.tab,
	});
	return applicationId ? { applicationId, tab } : undefined;
}

/**
 * The app shell for every dashboard page: HeroUI Pro's AppLayout with a 240px sidebar that collapses to icons (⌘B),
 * and a sheet opened from the navbar's menu button on phones. N opens New anywhere outside a field. The coach opens
 * from the navbar into a panel beside the page (a sheet below 1024px) and stays open from page to page; an
 * application's workspace hides it, since that page has a coach for the job.
 */
type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
	const openDialog = useDialogStore((state) => state.openDialog);
	const coachOpen = useCoachPanelStore((state) => state.open);
	const setCoachOpen = useCoachPanelStore((state) => state.setOpen);
	const breakpoint = useBreakpoint();
	const docked = breakpoint === "desktop" || breakpoint === "wide";
	const onWorkspace = useWorkspaceParams() !== undefined;
	const coachVisible = coachOpen && !onWorkspace;
	const location = useRouterState({ select: (state) => state.location });

	// Where `/dashboard/coach/…` returns to after opening the panel: the page the person was on (never that address).
	useEffect(() => {
		if (!/^\/dashboard\/(career\/)?coach(\/|$)/.test(location.pathname))
			useCoachPanelStore.getState().setLastHref(location.href);
	}, [location.pathname, location.href]);

	useHotkey("N", () => {
		if (isEditableElementFocused() || useDialogStore.getState().open) return;
		openDialog("document.new", undefined);
	});

	return (
		<AppLayout
			className="dashboard-shell bg-surface [--app-layout-aside-width:360px] xl:[--app-layout-aside-width:400px]"
			defaultSidebarOpen={initialSidebarOpen()}
			sidebarCollapsible="icon"
			// One coach at a time: the docked panel here, or the sheet below (AppLayout's own sheet would mount it twice).
			aside={docked ? <CoachPanelSlot visible={coachVisible} /> : null}
			asideOpen={docked && coachVisible}
			sidebar={
				<>
					<Sidebar
						aria-label={t`App navigation`}
						className="bg-surface [--sidebar-edge-outline:transparent]! [view-transition-name:app-nav]"
					>
						<NavigationContent />
					</Sidebar>
					<Sidebar.Mobile>
						<NavigationContent />
					</Sidebar.Mobile>
				</>
			}
			navbar={<AppNavbar />}
		>
			<a
				href="#main-content"
				className="sr-only rounded-md bg-overlay px-4 py-2 text-sm focus:not-sr-only focus:absolute focus:inset-s-2 focus:top-2 focus:z-[100]"
			>
				<Trans>Skip to main content</Trans>
			</a>
			<div id="main-content" tabIndex={-1} className="min-w-0 outline-none">
				<GuestBanner />
				<ShellPendingContext value>{children}</ShellPendingContext>
			</div>
			{!docked && (
				<Sheet isOpen={coachVisible} onOpenChange={setCoachOpen} placement="right">
					<Sheet.Backdrop>
						<Sheet.Content className="w-full sm:max-w-none md:max-w-[420px]">
							<Sheet.Dialog aria-label={t`Coach`} className="h-full gap-0 p-0">
								<CoachPanelSlot visible />
							</Sheet.Dialog>
						</Sheet.Content>
					</Sheet.Backdrop>
				</Sheet>
			)}
		</AppLayout>
	);
}

type Crumb = { label: ReactNode; href?: string };

/**
 * Where the page sits: the section, then the page within it (Profile › Stories). Read from the address, so
 * it is right from the first frame; the last crumb is the current page.
 */
function useCrumbs(): Crumb[] {
	const pathname = useRouterState({ select: (state) => state.location.pathname.replace(/\/$/, "") });
	const [section, page, subpage] = pathname.split("/").slice(2);
	const profileTabs: Record<string, string> = {
		facts: t`Facts`,
		stories: t`Stories`,
		preferences: t({
			message: "Preferences",
			context: "Career preferences: the roles, places, pay and ways of working you want",
		}),
	};
	// Settings' menu (routes/dashboard/settings/route.tsx); older addresses redirect to these.
	const settingsPages: Record<string, string> = {
		account: t`Account`,
		billing: t`Plan`,
		app: t`App settings`,
	};

	switch (section) {
		case undefined:
			return [{ label: t`Home` }];
		case "documents":
			return [{ label: t`Documents` }];
		case "trash":
			return [{ label: t`Documents`, href: "/dashboard/documents" }, { label: t`Trash` }];
		case "portfolio":
			return [{ label: t`Portfolio` }];
		case "applications":
			if (page === "offers") return [{ label: t`Applications`, href: "/dashboard/applications" }, { label: t`Offers` }];
			return page
				? [{ label: t`Applications`, href: "/dashboard/applications" }, { label: <ApplicationCrumb id={page} /> }]
				: [{ label: t`Applications` }];
		case "profile": {
			const current = page ? profileTabs[page] : undefined;
			return current
				? [{ label: t`Profile`, href: "/dashboard/profile" }, { label: current }]
				: [{ label: t`Profile` }];
		}
		case "settings": {
			// A payment's return page and its receipt sit under Plan.
			if (page === "billing" && (subpage === "return" || subpage === "receipt"))
				return [
					{ label: t`Settings`, href: "/dashboard/settings" },
					{ label: t`Plan`, href: "/dashboard/settings/billing" },
					{ label: subpage === "return" ? t`Payment` : t`Receipt` },
				];
			const current = page ? settingsPages[page] : undefined;
			return current
				? [{ label: t`Settings`, href: "/dashboard/settings" }, { label: current }]
				: [{ label: t`Settings` }];
		}
		case "admin":
			// Administrators reach these from Settings' menu.
			return [
				{ label: t`Settings`, href: "/dashboard/settings" },
				{ label: page === "portfolios" ? t`Portfolio reports` : t`Billing admin` },
			];
		default:
			return [];
	}
}

type ApplicationCrumbProps = { id: string };

/** The open application's role, from the workspace's own query (already loading or cached). */
function ApplicationCrumb({ id }: ApplicationCrumbProps) {
	const { data } = useQuery(applicationDetailQueryOptions(id));
	return <span className="block max-w-64 truncate">{data ? data.role : <Trans>Application</Trans>}</span>;
}

/**
 * The bar above every page. Phones: the menu button, the brand, then search and New. Wider screens: the sidebar
 * toggle and where you are, then search (⌘K), which has no other visible entry there. Its side margins match the
 * page's (`PAGE_GUTTER`), so the bar's edges line up with the content under it.
 */
function AppNavbar() {
	const openPalette = useCommandPaletteStore((state) => state.setOpen);
	const openDialog = useDialogStore((state) => state.openDialog);
	const crumbs = useCrumbs();

	return (
		<Navbar maxWidth="full" size="sm" aria-label={t`Toolbar`} className="bg-surface [view-transition-name:app-bar]">
			<Navbar.Header className={PAGE_GUTTER}>
				<AppLayout.MenuToggle aria-label={t`Open navigation`} />
				<Sidebar.Trigger aria-label={t`Toggle sidebar`} />
				<Link to="/dashboard" aria-label="Rezumi" className="md:hidden">
					<BrandIcon variant="icon" alt="" className="size-6" />
				</Link>
				{crumbs.length > 0 && (
					<Breadcrumbs className="ms-1 min-w-0 max-md:hidden">
						{crumbs.map((crumb, index) => (
							// Only the last crumb has no link, so the link (or "current") is a unique key.
							<Breadcrumbs.Item
								key={crumb.href ?? "current"}
								{...(crumb.href && index < crumbs.length - 1 ? { href: crumb.href } : {})}
							>
								{crumb.label}
							</Breadcrumbs.Item>
						))}
					</Breadcrumbs>
				)}
				<Navbar.Spacer />
				<Navbar.Content>
					<CoachButton />
					<Button
						variant="tertiary"
						size="sm"
						aria-keyshortcuts="Meta+K Control+K"
						className="gap-2 text-muted max-md:hidden"
						onPress={() => openPalette(true)}
					>
						<Icon name="magnifying-glass" size={16} />
						<Trans>Search</Trans>
						<Kbd>⌘K</Kbd>
					</Button>
					<IconButton
						icon="magnifying-glass"
						label={t`Search…`}
						size="sm"
						className="md:hidden"
						onPress={() => openPalette(true)}
					/>
					<IconButton
						icon="plus"
						label={t`New`}
						size="sm"
						variant="primary"
						className="md:hidden"
						onPress={() => openDialog("document.new", undefined)}
					/>
				</Navbar.Content>
			</Navbar.Header>
		</Navbar>
	);
}

/**
 * Opens the coach panel, or closes it when open. On an application's workspace it opens that job's coach instead
 * (the workspace's `?coach=` sheet). Hovering starts loading the panel.
 */
function CoachButton() {
	const navigate = useNavigate();
	const open = useCoachPanelStore((state) => state.open);
	const toggle = useCoachPanelStore((state) => state.toggle);
	const workspace = useWorkspaceParams();
	const search = useRouterState({ select: (state) => state.location.search });
	const pressed = open && !workspace;
	const onPress = () => {
		if (!workspace) return toggle();
		// Replaced, not pushed: the sheet's own close then leaves no entry that Back would reopen it from.
		void navigate({
			to: WORKSPACE_ROUTE,
			params: workspace,
			search: { ...search, coach: true },
			replace: true,
		});
	};

	return (
		<>
			<Button
				variant="tertiary"
				size="sm"
				aria-pressed={pressed}
				data-coach-button=""
				className={cn("gap-2 max-md:hidden", pressed ? "bg-accent-soft text-accent-soft-foreground" : "text-muted")}
				onHoverStart={() => void loadCoachPanel()}
				onPress={onPress}
			>
				<Icon name="sparkle" size={16} className={pressed ? undefined : "text-accent"} />
				<Trans>Coach</Trans>
			</Button>
			<IconButton
				icon="sparkle"
				label={t`Coach`}
				size="sm"
				aria-pressed={pressed}
				data-coach-button=""
				className={cn("text-accent md:hidden", pressed && "bg-accent-soft")}
				onPress={onPress}
			/>
		</>
	);
}

/** Brand, destinations, New and the account menu; shared by the desktop sidebar and the phone sheet. */
function NavigationContent() {
	const items = useNavItems();
	const isCurrent = useIsCurrent();
	const openDialog = useDialogStore((state) => state.openDialog);
	const { isOpen, isMobile } = useSidebar();
	const expanded = isOpen || isMobile;

	const link = (item: NavItem) => (
		<Sidebar.MenuItem key={item.to} id={item.to} href={item.to} isCurrent={isCurrent(item)} textValue={item.label}>
			<Sidebar.MenuIcon>
				<Icon name={item.icon} size={18} variant={isCurrent(item) ? "duotone" : "stroke"} />
			</Sidebar.MenuIcon>
			<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
			{item.count ? <Sidebar.MenuChip>{item.count}</Sidebar.MenuChip> : null}
		</Sidebar.MenuItem>
	);

	return (
		<>
			<Sidebar.Header>
				<Link to="/dashboard" className="flex h-9 items-center gap-2.5 px-1.5">
					<BrandIcon variant="icon" alt="" className="size-6 shrink-0" />
					<span className="text-sm font-semibold" data-sidebar="label">
						Rezumi
					</span>
				</Link>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.Menu aria-label={t`App`}>{items.map(link)}</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer className="gap-2">
				<Sidebar.Tooltip content={t`New`}>
					<Button
						aria-label={t`New`}
						aria-keyshortcuts="N"
						fullWidth={expanded}
						isIconOnly={!expanded}
						className={expanded ? "justify-between" : ""}
						onPress={() => openDialog("document.new", undefined)}
					>
						<span className="flex items-center gap-1.5">
							<Icon name="plus" size={18} />
							{expanded && <Trans>New</Trans>}
						</span>
						{expanded && <Kbd className="bg-accent-foreground/15 text-accent-foreground">N</Kbd>}
					</Button>
				</Sidebar.Tooltip>
				<UserDropdownMenu>
					{({ session }) => (
						<button
							type="button"
							aria-label={expanded ? undefined : t`Account`}
							className="flex h-11 items-center gap-2.5 rounded-2xl px-1.5 text-start transition-colors hover:bg-default"
						>
							<UserAvatar
								name={session.user.name}
								image={session.user.image}
								size="sm"
								className="size-7 shrink-0"
								fallbackClassName="text-xs"
							/>
							{expanded && (
								<span className="grid min-w-0">
									<span className="truncate text-sm font-medium">{session.user.name}</span>
									<span className="text-body-xs text-muted">
										<Trans>Account</Trans>
									</span>
								</span>
							)}
						</button>
					)}
				</UserDropdownMenu>
			</Sidebar.Footer>
		</>
	);
}
