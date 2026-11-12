import type { PortfolioView, PortfolioViewWork } from "../view";
import { useRender } from "./context";
import { UiIcon } from "./icons";
import { EmbedFacade, LinkCard, PdfCard, VideoFacade } from "./media";
import { MetricGroup } from "./metric";
import { Button, Prose } from "./parts";
import { headingId, Picture } from "./primitives";

/**
 * An address on the portfolio's home page: the home itself, or one of its sections. The editor's preview keeps the
 * default home (`#main`), where a section is its own `#anchor` on the same document.
 */
export function homeLink(view: Pick<PortfolioView, "homeUrl">, anchor?: string): string {
	if (!anchor) return view.homeUrl;
	return view.homeUrl.startsWith("#") ? `#${anchor}` : `${view.homeUrl}#${anchor}`;
}

/** Whether a work's page holds a gallery, so the picture viewer comes with it. */
export function hasGallery(work: PortfolioViewWork): boolean {
	return work.blocks.some((block) => block.type === "images");
}

type WorkBlocksProps = { work: PortfolioViewWork };

/** A work's blocks in order: text, galleries, metrics, videos, embeds, PDFs and link cards. */
function WorkBlocks({ work }: WorkBlocksProps) {
	const { view, imageUrl } = useRender();
	if (!work.blocks.length) return null;
	return (
		<div className="pf-blocks">
			{work.blocks.map((block) => {
				switch (block.type) {
					case "text":
						return <Prose key={block.id} html={block.html} topLevel />;
					case "images":
						return (
							<div key={block.id} className="pf-gallery" data-layout={block.layout}>
								{block.images.map((image, index) => {
									const full = imageUrl(image.src);
									if (!full) return null;
									// The picture names its link: its own text, else its caption, else the work and its place.
									const alt =
										image.alt ||
										image.caption ||
										(block.images.length > 1 ? `${work.title} (${index + 1}/${block.images.length})` : work.title);
									return (
										<figure key={`${image.src}-${index}`}>
											{/* The full picture: the page script opens it in the viewer; without it (or in the editor's inert
											preview) the link opens the file in a new tab. */}
											<a
												className="pf-zoom"
												href={full}
												target="_blank"
												rel="noopener"
												data-lightbox=""
												{...(image.caption ? { "data-caption": image.caption } : {})}
											>
												<Picture
													image={{ ...image, alt }}
													sizes={
														block.layout === "grid"
															? "(min-width: 860px) 400px, 100vw"
															: "(min-width: 860px) 820px, 100vw"
													}
												/>
											</a>
											{image.caption && <figcaption>{image.caption}</figcaption>}
										</figure>
									);
								})}
							</div>
						);
					case "metrics":
						return <MetricGroup key={block.id} metrics={block.items} variant={view.design.variants.metric} />;
					case "video":
						return <VideoFacade key={block.id} block={block} />;
					case "embed":
						return <EmbedFacade key={block.id} block={block} />;
					case "pdf":
						return <PdfCard key={block.id} block={block} />;
					case "link":
						return <LinkCard key={block.id} block={block} />;
				}
			})}
		</div>
	);
}

type NeighbourProps = { work: PortfolioViewWork; label: string; side: "previous" | "next" };

function Neighbour({ work, label, side }: NeighbourProps) {
	return (
		<a
			className={`pf-workpage__step pf-workpage__step--${side}`}
			href={work.href}
			rel={side === "previous" ? "prev" : "next"}
		>
			<span>
				{side === "previous" && <UiIcon name="arrow-left" flip />}
				{label}
				{side === "next" && <UiIcon name="arrow-right" flip />}
			</span>
			<b>{work.title}</b>
		</a>
	);
}

/**
 * A work's own page (`/<username>/work/<slug>`, Phase 13 B2), the same in every theme: a link back to all the work, the
 * work's title as the page's one `h1`, its summary, role, year and tags, its cover, its blocks and its main link, then
 * the works before and after it in the Work section, by title. `PageShell` draws it in place of the home page's
 * sections; a theme styles it under `.pf[data-theme="<id>"] .pf-workpage`.
 */
export function WorkArticle() {
	const { view, messages, page } = useRender();
	if (page.kind !== "work") return null;
	const { work, previous, next } = page;
	return (
		<article className="pf-workpage">
			<a className="pf-workpage__back" href={homeLink(view, "work")}>
				<UiIcon name="arrow-left" flip />
				{messages.allWork}
			</a>
			<header className="pf-detail__head">
				<h1 className="pf-detail__title" id={headingId(work.anchor)}>
					{work.title}
				</h1>
				{work.summary && <p className="pf-detail__summary">{work.summary}</p>}
				{(work.role || work.date) && (
					<div className="pf-detail__meta">
						{work.role && (
							<span>
								{messages.role} <b>{work.role}</b>
							</span>
						)}
						{work.date && (
							<span>
								{messages.year} <b>{work.date}</b>
							</span>
						)}
					</div>
				)}
				{work.tags.length > 0 && (
					<ul className="pf-tags">
						{work.tags.map((tag) => (
							<li key={tag}>{tag}</li>
						))}
					</ul>
				)}
			</header>
			{work.cover && (
				<div className="pf-cover pf-detail__hero">
					<Picture image={work.cover} eager sizes="(min-width: 1000px) 960px, 100vw" />
				</div>
			)}
			<WorkBlocks work={work} />
			{work.primaryLink && (
				<div className="pf-btns">
					<Button link={work.primaryLink} primary icon="link" />
				</div>
			)}
			{(previous || next) && (
				<nav className="pf-workpage__more" aria-label={messages.otherWork}>
					{previous && <Neighbour work={previous} label={messages.previous} side="previous" />}
					{next && <Neighbour work={next} label={messages.next} side="next" />}
				</nav>
			)}
		</article>
	);
}
