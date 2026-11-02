import type { IconName } from "@rezumi/ui/components/icon";
import type { ReactNode } from "react";
import { AppLayout, Navbar, Sidebar, useSidebar } from "@heroui-pro/react";
import { Avatar, Button, Kbd } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useHotkey } from "@tanstack/react-hotkeys";
import { useQuery } from "@tanstack/react-query";
import { Link, useMatchRoute, useNavigate } from "@tanstack/react-router";
import Cookies from "js-cookie";
import { useState } from "react";
import { BrandIcon } from "@rezumi/ui/components/brand-icon";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { getInitials } from "@rezumi/utils/string";
import { useDialogStore } from "@/dialogs/store";
import { GuestBanner } from "@/features/auth/components/guest-banner";
import { useCommandPaletteStore } from "@/features/command-palette/store";
import { isEditableElementFocused } from "@/features/resume/builder/draft";
import { UserDropdownMenu } from "@/features/user/dropdown-menu";
import { orpc } from "@/libs/orpc/client";

type NavItem = {
	to: "/dashboard" | "/dashboard/applications" | "/dashboard/coach" | "/dashboard/trash";
	icon: IconName;
	label: string;
	count?: number;
};

/** A page under Career: `match` is the route it is current on, `href` where it links. */
const CAREER_KEY = "career";

type CareerPage = { id: string; href: string; match: string; fuzzy: boolean; label: string; count?: number };

function useNavItems() {
	const { data: counts } = useQuery(orpc.documents.counts.queryOptions());
	const { data: applicationStats } = useQuery(orpc.applications.stats.queryOptions({}));
	const { data: notifications } = useQuery(orpc.career.notifications.queryOptions({ input: {} }));

	const items: NavItem[] = [
		{
			to: "/dashboard",
			icon: "file-text",
			label: t`Documents`,
			...(counts ? { count: counts.resume + counts.letter } : {}),
		},
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
		{ to: "/dashboard/coach", icon: "sparkle", label: t`Coach` },
	];
	// Career counts what's waiting for the user (unread notifications), so nothing shows at zero.
	const unread = notifications?.filter((notification) => !notification.readAt).length ?? 0;
	const career: CareerPage[] = [
		{
			id: "today",
			href: "/dashboard/career",
			match: "/dashboard/career/",
			fuzzy: false,
			label: t`Today`,
			...(unread ? { count: unread } : {}),
		},
		{
			id: "knowledge",
			href: "/dashboard/career/knowledge/facts",
			match: "/dashboard/career/knowledge",
			fuzzy: true,
			label: t`Knowledge`,
		},
		{
			id: "offers",
			href: "/dashboard/career/offers",
			match: "/dashboard/career/offers",
			fuzzy: true,
			label: t`Offers`,
		},
	];
	const trash: NavItem | null = counts?.trash
		? { to: "/dashboard/trash", icon: "trash", label: t`Trash`, count: counts.trash }
		: null;

	return { items, career, trash };
}

/** Whether the item is the current page: Documents is exact, the others match their section. */
function useIsCurrent() {
	const matchRoute = useMatchRoute();
	return (to: NavItem["to"]) => Boolean(matchRoute({ to, fuzzy: to !== "/dashboard" }));
}

/** Whether a Career page is the current one. Today is the index route, so it matches exactly. */
function useIsCareerCurrent() {
	const matchRoute = useMatchRoute();
	return (page: CareerPage) => Boolean(matchRoute({ to: page.match, fuzzy: page.fuzzy }));
}

/** The sidebar state HeroUI's AppLayout saves on every toggle; collapsed to icons by default below 1024px. */
function initialSidebarOpen() {
	const saved = Cookies.get("sidebar_state");
	if (saved !== undefined) return saved !== "false";
	return typeof window === "undefined" || window.matchMedia("(min-width: 1024px)").matches;
}

/**
 * The app shell for Documents, Trash, Applications, Career and Settings: HeroUI Pro's AppLayout with a 240px sidebar
 * that collapses to icons (⌘B), and a sheet opened from the navbar's menu button on phones. N opens New anywhere
 * outside a field.
 */
type AppShellProps = { children: ReactNode };

export function AppShell({ children }: AppShellProps) {
	const openDialog = useDialogStore((state) => state.openDialog);

	useHotkey("N", () => {
		if (isEditableElementFocused() || useDialogStore.getState().open) return;
		openDialog("document.new", undefined);
	});

	return (
		<AppLayout
			defaultSidebarOpen={initialSidebarOpen()}
			sidebarCollapsible="icon"
			sidebar={
				<>
					<Sidebar
						aria-label={t`App navigation`}
						className="[--sidebar-edge-outline:transparent]! [view-transition-name:app-nav]"
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
				{children}
			</div>
		</AppLayout>
	);
}

/** The bar above every page: the phone menu button, the sidebar toggle, and on phones search and New. */
function AppNavbar() {
	const openPalette = useCommandPaletteStore((state) => state.setOpen);
	const openDialog = useDialogStore((state) => state.openDialog);

	return (
		<Navbar maxWidth="full" size="sm" aria-label={t`Toolbar`}>
			<Navbar.Header>
				<AppLayout.MenuToggle aria-label={t`Open navigation`} />
				<Sidebar.Trigger aria-label={t`Toggle sidebar`} />
				<Link to="/" aria-label="Rezumi" className="md:hidden">
					<BrandIcon variant="icon" alt="" className="size-6" />
				</Link>
				<Navbar.Spacer />
				<Navbar.Content className="md:hidden">
					<IconButton icon="magnifying-glass" label={t`Search…`} size="sm" onPress={() => openPalette(true)} />
					<IconButton
						icon="plus"
						label={t`New`}
						size="sm"
						variant="primary"
						onPress={() => openDialog("document.new", undefined)}
					/>
				</Navbar.Content>
			</Navbar.Header>
		</Navbar>
	);
}

/** Brand, search, destinations, New and the account menu; shared by the desktop sidebar and the phone sheet. */
function NavigationContent() {
	const { items, career, trash } = useNavItems();
	const isCurrent = useIsCurrent();
	const isCareerCurrent = useIsCareerCurrent();
	const navigate = useNavigate();
	const openPalette = useCommandPaletteStore((state) => state.setOpen);
	const openDialog = useDialogStore((state) => state.openDialog);
	const { isOpen, isMobile } = useSidebar();
	const expanded = isOpen || isMobile;
	const onCareerPage = career.some(isCareerCurrent);
	// Open while on a Career page unless the person closed it; elsewhere it stays as they left it.
	const [careerChoice, setCareerChoice] = useState<boolean | null>(null);
	const careerOpen = careerChoice ?? onCareerPage;
	const setCareerOpen = (next: boolean | ((open: boolean) => boolean)) =>
		setCareerChoice(typeof next === "function" ? next(careerOpen) : next);
	const expandedCareer = expanded && careerOpen;
	const unread = career[0]?.count ?? 0;

	const link = (item: NavItem) => (
		<Sidebar.MenuItem key={item.to} id={item.to} href={item.to} isCurrent={isCurrent(item.to)} textValue={item.label}>
			<Sidebar.MenuIcon>
				<Icon name={item.icon} size={18} variant={isCurrent(item.to) ? "duotone" : "stroke"} />
			</Sidebar.MenuIcon>
			<Sidebar.MenuLabel>{item.label}</Sidebar.MenuLabel>
			{item.count ? <Sidebar.MenuChip>{item.count}</Sidebar.MenuChip> : null}
		</Sidebar.MenuItem>
	);

	return (
		<>
			<Sidebar.Header>
				<Link to="/" className="flex h-9 items-center gap-2.5 px-1.5">
					<BrandIcon variant="icon" alt="" className="size-6 shrink-0" />
					<span className="text-sm font-semibold" data-sidebar="label">
						Rezumi
					</span>
				</Link>
				<Sidebar.Menu aria-label={t`Search`} className="w-full">
					<Sidebar.MenuItem
						id="search"
						className="sidebar-search"
						textValue={t`Search…`}
						onAction={() => openPalette(true)}
					>
						<Sidebar.MenuIcon>
							<Icon name="magnifying-glass" size={18} />
						</Sidebar.MenuIcon>
						<Sidebar.MenuLabel>
							<Trans>Search…</Trans>
						</Sidebar.MenuLabel>
						<Sidebar.MenuChip>
							<Kbd>⌘K</Kbd>
						</Sidebar.MenuChip>
					</Sidebar.MenuItem>
				</Sidebar.Menu>
			</Sidebar.Header>

			<Sidebar.Content>
				<Sidebar.Group>
					<Sidebar.Menu
						aria-label={t`App`}
						expandedKeys={careerOpen ? [CAREER_KEY] : []}
						onExpandedChange={(keys) => setCareerOpen(keys.has(CAREER_KEY))}
					>
						{items.map(link)}
						<Sidebar.MenuItem
							id={CAREER_KEY}
							textValue={t`Career`}
							isCurrent={!expandedCareer && onCareerPage}
							// Collapsed to icons there is no submenu to open, so the icon goes to Today.
							onAction={() => {
								if (!expanded) void navigate({ to: "/dashboard/career" });
								else setCareerOpen((open) => !open);
							}}
						>
							<Sidebar.MenuIcon>
								<Icon name="compass" size={18} variant={onCareerPage ? "duotone" : "stroke"} />
							</Sidebar.MenuIcon>
							<Sidebar.MenuLabel>
								<Trans>Career</Trans>
								<Sidebar.MenuTrigger>
									<Sidebar.MenuIndicator />
								</Sidebar.MenuTrigger>
							</Sidebar.MenuLabel>
							{!expandedCareer && unread ? <Sidebar.MenuChip>{unread}</Sidebar.MenuChip> : null}
							<Sidebar.Submenu>
								{career.map((page) => (
									<Sidebar.MenuItem
										key={page.id}
										id={`${CAREER_KEY}:${page.id}`}
										href={page.href}
										isCurrent={isCareerCurrent(page)}
										textValue={page.label}
									>
										<Sidebar.MenuLabel>{page.label}</Sidebar.MenuLabel>
										{page.count ? <Sidebar.MenuChip>{page.count}</Sidebar.MenuChip> : null}
									</Sidebar.MenuItem>
								))}
							</Sidebar.Submenu>
						</Sidebar.MenuItem>
					</Sidebar.Menu>
				</Sidebar.Group>
			</Sidebar.Content>

			<Sidebar.Footer className="gap-2">
				{trash && <Sidebar.Menu aria-label={t`Trash`}>{link(trash)}</Sidebar.Menu>}
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
							<Avatar size="sm" className="size-7 shrink-0">
								{session.user.image && <Avatar.Image src={session.user.image} alt="" />}
								<Avatar.Fallback className="text-xs">{getInitials(session.user.name)}</Avatar.Fallback>
							</Avatar>
							{expanded && (
								<span className="grid min-w-0">
									<span className="truncate text-sm font-medium">{session.user.name}</span>
									<span className="text-xs text-muted">
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
