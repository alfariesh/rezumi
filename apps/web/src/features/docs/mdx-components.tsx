import type { DocsComponents } from "./types";
/**
 * How the docs draw what the MDX pages contain: Markdown's elements, and the components the pages use (Mintlify's
 * names: Card, Steps, Frame, Note, Accordion, Tabs…), built from HeroUI so a page reads like the rest of the app.
 * Text sizes come from the container: the article sets 16px reading text, callouts and cards 14px.
 */
import type { IconName } from "@rezumi/ui/components/icon";
import type { ComponentProps, ReactElement, ReactNode } from "react";
import { Accordion, Alert, Card, Kbd, Separator, Tabs } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Children, createContext, isValidElement, use, useId, useRef, useState } from "react";
import { Icon } from "@rezumi/ui/components/icon";
import { IconButton } from "@rezumi/ui/components/icon-button";
import { cn } from "@rezumi/utils/style";
import { DocsLink } from "./link";

const linkClass =
	"font-medium text-accent underline decoration-accent/30 underline-offset-4 transition-colors hover:decoration-accent";

type HeadingProps = ComponentProps<"h2">;

/** A section heading with a link to itself, shown on hover and focus. */
function heading(Tag: "h2" | "h3" | "h4", className: string) {
	return function DocsHeading({ id, children, className: extra, ...props }: HeadingProps) {
		return (
			<Tag
				id={id}
				className={cn("group/heading scroll-mt-24 font-semibold text-foreground", className, extra)}
				{...props}
			>
				{children}
				{id && (
					<a
						href={`#${id}`}
						aria-label={t`Link to this section`}
						className="ms-2 inline-flex translate-y-0.5 text-muted opacity-0 transition-opacity group-hover/heading:opacity-100 hover:text-foreground focus-visible:opacity-100"
					>
						<Icon name="link-simple-horizontal" size={16} />
					</a>
				)}
			</Tag>
		);
	};
}

/** A Shiki-highlighted block (`build.ts`), with a copy button and the file name when the page gives one. */
function CodeBlock({ children, className, style: _style, ...props }: ComponentProps<"pre">) {
	const ref = useRef<HTMLPreElement>(null);
	const [copied, setCopied] = useState(false);
	const title = (props as { "data-title"?: string })["data-title"];

	const copy = async () => {
		await navigator.clipboard.writeText(ref.current?.textContent ?? "");
		setCopied(true);
		setTimeout(() => setCopied(false), 2000);
	};

	const button = (
		<IconButton
			icon={copied ? "check" : "copy"}
			label={copied ? t`Copied` : t`Copy code`}
			size="sm"
			onPress={() => void copy()}
			className={cn(
				!title &&
					"absolute end-2 top-2 bg-surface opacity-0 transition-opacity group-hover/code:opacity-100 focus-visible:opacity-100 pointer-coarse:opacity-100",
			)}
		/>
	);

	return (
		<div className="group/code docs-code relative overflow-hidden rounded-xl bg-surface shadow-surface">
			{title && (
				<div className="flex items-center justify-between gap-3 border-b border-separator py-1 ps-4 pe-1">
					<span className="truncate font-mono text-xs text-muted" dir="ltr">
						{title}
					</span>
					{button}
				</div>
			)}
			<pre ref={ref} dir="ltr" className={cn("overflow-x-auto p-4 font-mono text-body-sm", className)} {...props}>
				{children}
			</pre>
			{!title && button}
		</div>
	);
}

/** Markdown tables scroll sideways inside their card instead of squeezing their columns. */
function Table({ className, ...props }: ComponentProps<"table">) {
	return (
		<div className="overflow-x-auto rounded-xl bg-surface shadow-surface">
			<table className={cn("w-full border-collapse text-start text-body-sm", className)} {...props} />
		</div>
	);
}

type DocsImageProps = ComponentProps<"img">;

/**
 * A screenshot. The build turns its source into an imported asset and adds its size. It fills the column, but a tall
 * one (a dialog, a phone) stops at a readable height instead of filling the screen.
 */
function DocsImage({ alt = "", className, ...props }: DocsImageProps) {
	return (
		<img
			alt={alt}
			loading="lazy"
			decoding="async"
			className={cn("mx-auto block h-auto max-h-144 w-auto max-w-full rounded-xl", className)}
			{...props}
		/>
	);
}

type FrameProps = { caption?: string; children: ReactNode };

/** A picture on a surface, with its caption under it. */
function Frame({ caption, children }: FrameProps) {
	return (
		<figure className="rounded-2xl bg-surface p-2 shadow-surface">
			{children}
			{caption && (
				<figcaption className="px-2 pt-2.5 pb-1 text-center text-sm text-pretty text-muted">{caption}</figcaption>
			)}
		</figure>
	);
}

// The pages name Font Awesome icons (the hosted site's set); these are the app's closest glyphs.
const cardIcons: Record<string, IconName> = {
	briefcase: "briefcase",
	bullseye: "compass",
	"clipboard-check": "list-checks",
	"clipboard-list": "clipboard-text",
	cloud: "cloud-check",
	code: "code",
	comments: "chat-text",
	compress: "arrows-in-simple",
	envelope: "envelope",
	"file-arrow-down": "download-simple",
	"file-circle-plus": "file-plus",
	"file-lines": "file-text",
	"file-plus": "file-plus",
	font: "text-aa",
	github: "github-logo",
	handshake: "hand-heart",
	kanban: "kanban",
	list: "list-bullets",
	"list-check": "list-checks",
	"list-checks": "list-checks",
	markdown: "file-text",
	"messages-square": "chat-centered-text",
	palette: "palette",
	"pen-line": "pencil-line",
	"pen-to-square": "pencil-simple",
	plug: "plugs-connected",
	robot: "robot",
	rocket: "lightning",
	share: "share-network",
	"share-nodes": "share-network",
	shield: "shield-check",
	signal: "chart-line-up",
	sitemap: "graph",
	sparkles: "sparkle",
	"table-cells-large": "squares-four",
	"table-columns": "kanban",
	target: "compass",
};

type DocsCardProps = { title: string; icon?: string; href?: string; children?: ReactNode };

/** A feature or a next step; with `href`, the whole card is the link. */
function DocsCard({ title, icon, href, children }: DocsCardProps) {
	const glyph = icon ? cardIcons[icon] : undefined;
	const card = (
		<Card
			className={cn(
				"h-full gap-4",
				href && "transition-colors group-hover/card:bg-surface-secondary group-focus-visible/card:bg-surface-secondary",
			)}
		>
			<div className="flex items-start justify-between gap-3">
				{glyph ? (
					<span className="grid size-10 shrink-0 place-items-center rounded-xl bg-accent-soft text-accent-soft-foreground">
						<Icon name={glyph} />
					</span>
				) : (
					<span />
				)}
				{href && (
					<Icon
						name="arrow-right"
						size={16}
						className="mt-1 text-muted transition-transform group-hover/card:translate-x-0.5 rtl:group-hover/card:-translate-x-0.5"
					/>
				)}
			</div>
			<Card.Header className="gap-1">
				<Card.Title className="text-base font-semibold">{title}</Card.Title>
				{children && <div className="docs-flow text-body-sm text-muted">{children}</div>}
			</Card.Header>
		</Card>
	);
	if (!href) return card;
	return (
		<DocsLink href={href} className="group/card block rounded-3xl">
			{card}
		</DocsLink>
	);
}

type CardGroupProps = { cols?: number; children: ReactNode };

function CardGroup({ cols = 2, children }: CardGroupProps) {
	return (
		<div
			className={cn(
				"grid gap-4",
				cols >= 2 && "sm:grid-cols-2",
				cols >= 3 && "lg:grid-cols-3",
				cols >= 4 && "xl:grid-cols-4",
			)}
		>
			{children}
		</div>
	);
}

type StepsProps = { children: ReactNode };

/** Numbered steps on a line; the numbers are CSS counters (`docs.css`). */
function Steps({ children }: StepsProps) {
	return <ol className="docs-steps">{children}</ol>;
}

type StepProps = { title?: string; children?: ReactNode };

function Step({ title, children }: StepProps) {
	return (
		<li className="docs-step">
			{title && <p className="font-semibold text-foreground">{title}</p>}
			{children && <div className="docs-flow mt-1.5">{children}</div>}
		</li>
	);
}

type CalloutProps = { children: ReactNode };

/** The hosted site's callouts, as HeroUI alerts: notes and info in the neutral accent, tips as success. */
function callout(status: "accent" | "default" | "success" | "warning", icon: IconName, label: () => string) {
	return function DocsCallout({ children }: CalloutProps) {
		return (
			<Alert status={status} aria-label={label()}>
				<Alert.Indicator>
					<Icon name={icon} />
				</Alert.Indicator>
				<Alert.Content>
					<div className="docs-flow text-body-sm text-foreground">{children}</div>
				</Alert.Content>
			</Alert>
		);
	};
}

const InGroup = createContext(false);

type AccordionGroupProps = { children: ReactNode };

function AccordionGroup({ children }: AccordionGroupProps) {
	return (
		<Accordion variant="surface" allowsMultipleExpanded>
			<InGroup value>{children}</InGroup>
		</Accordion>
	);
}

type DocsAccordionProps = { title: string; children: ReactNode };

/** A collapsed answer or detail. Alone, it gets its own frame; in an AccordionGroup, it joins the group's. */
function DocsAccordion({ title, children }: DocsAccordionProps) {
	const id = useId();
	const item = (
		<Accordion.Item id={id}>
			<Accordion.Heading>
				<Accordion.Trigger className="text-start text-base font-medium">
					{title}
					<Accordion.Indicator />
				</Accordion.Trigger>
			</Accordion.Heading>
			<Accordion.Panel>
				<Accordion.Body>
					<div className="docs-flow text-body text-foreground">{children}</div>
				</Accordion.Body>
			</Accordion.Panel>
		</Accordion.Item>
	);
	return use(InGroup) ? item : <Accordion variant="surface">{item}</Accordion>;
}

type TabProps = { title: string; children: ReactNode };

/** Only read by Tabs, which draws the list and the panels. */
function Tab({ children }: TabProps) {
	return <>{children}</>;
}

type DocsTabsProps = { children: ReactNode };

function DocsTabs({ children }: DocsTabsProps) {
	const id = useId();
	const tabs = Children.toArray(children).filter(
		(child): child is ReactElement<TabProps> =>
			isValidElement<TabProps>(child) && typeof (child.props as Partial<TabProps>).title === "string",
	);
	return (
		<Tabs className="gap-4">
			<Tabs.ListContainer>
				<Tabs.List aria-label={t`Options`}>
					{tabs.map((tab, index) => (
						<Tabs.Tab key={tab.props.title} id={`${id}-${index}`}>
							{tab.props.title}
							<Tabs.Indicator />
						</Tabs.Tab>
					))}
				</Tabs.List>
			</Tabs.ListContainer>
			{tabs.map((tab, index) => (
				<Tabs.Panel key={tab.props.title} id={`${id}-${index}`} className="docs-flow px-0">
					{tab.props.children}
				</Tabs.Panel>
			))}
		</Tabs>
	);
}

/** The map MDX draws the pages with. */
export const docsComponents: DocsComponents = {
	a: ({ href, children }: ComponentProps<"a">) => (
		<DocsLink href={href} className={linkClass}>
			{children}
		</DocsLink>
	),
	h2: heading("h2", "text-2xl tracking-tight"),
	h3: heading("h3", "text-xl tracking-tight"),
	h4: heading("h4", "text-base"),
	pre: CodeBlock,
	table: Table,
	th: ({ className, ...props }: ComponentProps<"th">) => (
		<th
			className={cn("px-4 py-3 text-start align-bottom font-medium whitespace-nowrap text-muted", className)}
			{...props}
		/>
	),
	td: ({ className, ...props }: ComponentProps<"td">) => (
		<td className={cn("border-t border-separator px-4 py-3 align-top", className)} {...props} />
	),
	hr: () => <Separator className="my-4" />,
	img: DocsImage,
	DocsImage,
	Kbd: ({ children }: { children: ReactNode }) => <Kbd>{children}</Kbd>,
	Frame,
	Card: DocsCard,
	CardGroup,
	Steps,
	Step,
	Note: callout("accent", "note", () => t`Note`),
	Info: callout("default", "info", () => t`Info`),
	Tip: callout("success", "check-circle", () => t`Tip`),
	Warning: callout("warning", "warning", () => t`Warning`),
	Accordion: DocsAccordion,
	AccordionGroup,
	Tabs: DocsTabs,
	Tab,
};
