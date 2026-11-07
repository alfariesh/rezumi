import type { PortfolioViewSection } from "../view";
import { ResumeIcon, UiIcon } from "./icons";
import { hostOf, linkAttributes, Picture } from "./primitives";

type ServicesSection = Extract<PortfolioViewSection, { kind: "services" }>;

type ServiceListProps = {
	section: ServicesSection;
	/** The list's class (`lg-services`); the variant goes in `data-variant`. */
	className: string;
	variant: string;
	/** Classes a theme's CSS needs on a service's parts, instead of the shared ones. */
	classNames?: { item?: string; head?: string };
	/**
	 * A footer row under the description for the order button (Mozaik's `mz-service__foot`), and for the price too when
	 * `price` is set; otherwise the price sits beside the title.
	 */
	foot?: { className: string; price: boolean };
};

/** Services: each one's icon and title, price, description and order button. */
export function ServiceList({ section, className, variant, classNames = {}, foot }: ServiceListProps) {
	const priceBelow = foot?.price ?? false;
	return (
		<ul className={className} data-variant={variant}>
			{section.services.map((service) => {
				const price = service.price && <span className="pf-service__price">{service.price}</span>;
				const cta = service.cta && (
					<a className="pf-service__cta" {...linkAttributes(service.cta.href, service.cta)}>
						{service.cta.label}
						<UiIcon name="arrow-right" flip />
					</a>
				);
				return (
					<li key={service.id} className={classNames.item ?? "pf-service"}>
						<div className={classNames.head ?? "pf-service__head"}>
							<h3>
								<ResumeIcon name={service.icon} />
								{service.title}
							</h3>
							{!priceBelow && price}
						</div>
						{service.description && <p className="pf-service__desc">{service.description}</p>}
						{foot
							? ((priceBelow && service.price) || service.cta) && (
									<div className={foot.className}>
										{priceBelow && price}
										{cta}
									</div>
								)
							: cta}
					</li>
				);
			})}
		</ul>
	);
}

type TestimonialsSection = Extract<PortfolioViewSection, { kind: "testimonials" }>;

type TestimonialListProps = {
	section: TestimonialsSection;
	/** The list's class (`lg-quotes`); the variant goes in `data-variant`. */
	className: string;
	variant: string;
	/** A row that holds the person and the source link (Mozaik's `mz-quote__foot`). */
	footClassName?: string;
};

/** Testimonials: the quote, then who said it (photo or initials, name, role) and where it was posted. */
export function TestimonialList({ section, className, variant, footClassName }: TestimonialListProps) {
	return (
		<ul className={className} data-variant={variant}>
			{section.testimonials.map((testimonial) => {
				const person = (
					<div className="pf-person">
						<span className="pf-avatar" aria-hidden="true">
							{testimonial.photo ? <Picture image={testimonial.photo} decorative sizes="44px" /> : testimonial.initials}
						</span>
						<span className="pf-person__text">
							<b>{testimonial.name}</b>
							{testimonial.role && <span>{testimonial.role}</span>}
						</span>
					</div>
				);
				const source = testimonial.sourceUrl && (
					<a className="pf-quote__source" {...linkAttributes(testimonial.sourceUrl)}>
						{hostOf(testimonial.sourceUrl)}
					</a>
				);
				return (
					<li key={testimonial.id} className="pf-quote">
						<blockquote>{testimonial.quote}</blockquote>
						{footClassName ? (
							<div className={footClassName}>
								{person}
								{source}
							</div>
						) : (
							<>
								{person}
								{source}
							</>
						)}
					</li>
				);
			})}
		</ul>
	);
}
