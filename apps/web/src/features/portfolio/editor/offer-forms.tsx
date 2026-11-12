import type { PortfolioData, PortfolioService } from "@rezumi/schema/portfolio/data";
import type { Draft } from "immer";
import { Button, Checkbox, Label, Modal } from "@heroui/react";
import { t } from "@lingui/core/macro";
import { Trans } from "@lingui/react/macro";
import { useId, useRef, useState } from "react";
import { getBrandIcon } from "@rezumi/resume/icons";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { Icon } from "@rezumi/ui/components/icon";
import { CellSwitchRow } from "@rezumi/ui/components/switch";
import { generateId } from "@rezumi/utils/string";
import { useRemovalFocus } from "../blocks/list-focus";
import { ImageField } from "../images/image-field";
import { renameClient } from "./clients";
import { useSourceResume } from "./context";
import { ChoiceSelect, moveItem, SortableCard, SortableList, TextInput, UrlInput } from "./fields";
import { editPortfolio, usePortfolioData } from "./store";
import { IconPicker } from "@/components/input/icon-picker";

const { text: max } = PORTFOLIO_LIMITS;

type ServiceAction = "whatsapp" | "contact" | "link";

type OfferList = "services" | "testimonials" | "clients";
type OfferItem<L extends OfferList> = Draft<PortfolioData[L]["items"][number]>;

/**
 * Changes one item of a list, found by its id: an upload, an AI rewrite or a late answer then lands on the item it
 * started from, even after the list was reordered or an item before it removed.
 */
function editOffer<L extends OfferList>(list: L, id: string, change: (item: OfferItem<L>) => void, key?: string) {
	editPortfolio(
		(draft) => {
			const items = draft[list].items as OfferItem<L>[];
			const target = items.find((entry) => entry.id === id);
			if (target) change(target);
		},
		key ? { key: `${list}.${id}.${key}` } : undefined,
	);
}

function removeOffer(list: OfferList, id: string) {
	editPortfolio(
		(draft) => {
			const items = draft[list].items as { id: string }[];
			const index = items.findIndex((entry) => entry.id === id);
			if (index !== -1) items.splice(index, 1);
		},
		{ structural: true },
	);
}

/** Services: what you offer, a starting price and how to order. */
export function ServicesForm() {
	const { services, contact } = usePortfolioData();
	const items = services.items;
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	const actions = [
		{ id: "whatsapp", label: t`WhatsApp, with a message naming the service` },
		{ id: "contact", label: t`Go to Contact` },
		{ id: "link", label: t`A link` },
	] as const satisfies readonly { id: ServiceAction; label: string }[];

	return (
		<div className="grid gap-3">
			<SortableList
				ids={items.map((item) => item.id)}
				onMove={(from, to) => editPortfolio((draft) => moveItem(draft.services.items, from, to), { structural: true })}
			>
				{items.map((service, index) => {
					const name = service.title.trim() || t`Untitled service`;
					const action: ServiceAction =
						service.cta.kind === "whatsapp" || service.cta.kind === "link" ? service.cta.kind : "contact";
					const update = (change: (target: PortfolioService) => void, key?: string) =>
						editOffer("services", service.id, change, key);
					return (
						<SortableCard
							key={service.id}
							id={service.id}
							list="services"
							index={index}
							name={name}
							itemProps={itemProps}
							onRemove={() => {
								removed(index);
								removeOffer("services", service.id);
							}}
						>
							<div className="flex items-end gap-2">
								<div className="min-w-0 flex-1">
									<TextInput
										label={t`Service`}
										icon="tag"
										value={service.title}
										maxLength={max.serviceTitle}
										placeholder={t`Logo design`}
										onChange={(value) =>
											update((target) => {
												target.title = value;
											}, "title")
										}
									/>
								</div>
								<IconPicker
									aria-label={t`Icon for ${name}`}
									value={service.icon ?? ""}
									onChange={(icon) =>
										update((target) => {
											if (icon) target.icon = icon;
											else delete target.icon;
										})
									}
								/>
							</div>
							<TextInput
								label={t`Description`}
								multiline
								rewrite="serviceDescription"
								value={service.description}
								maxLength={max.serviceDescription}
								onChange={(value) =>
									update((target) => {
										target.description = value;
									}, "description")
								}
							/>
							<TextInput
								label={t`Price (optional)`}
								icon="tag"
								value={service.price ?? ""}
								maxLength={max.servicePrice}
								placeholder={t`From Rp1.5m`}
								onChange={(value) =>
									update((target) => {
										if (value.trim()) target.price = value;
										else delete target.price;
									}, "price")
								}
							/>
							<ChoiceSelect
								label={t`Order button`}
								value={action}
								options={actions}
								warning={
									action === "whatsapp" && !contact.whatsapp.number
										? t`Add your WhatsApp number in Contact, or the button won't show.`
										: action === "link" && !service.cta.url
											? t`Add the order link, or the button won't show.`
											: undefined
								}
								onChange={(kind) =>
									update((target) => {
										target.cta = { kind, ...(target.cta.label ? { label: target.cta.label } : {}) };
									})
								}
							/>
							{action === "link" && (
								<UrlInput
									label={t`Order link`}
									value={service.cta.url}
									onChange={(url) =>
										update((target) => {
											if (url) target.cta.url = url;
											else delete target.cta.url;
										}, "cta.url")
									}
								/>
							)}
						</SortableCard>
					);
				})}
			</SortableList>
			<div ref={fallbackRef} className="contents">
				{items.length < PORTFOLIO_LIMITS.services && (
					<Button
						variant="secondary"
						className="w-fit"
						onPress={() =>
							editPortfolio((draft) => {
								draft.services.items.push({
									id: generateId(),
									title: "",
									description: "",
									cta: { kind: contact.whatsapp.number ? "whatsapp" : "contact" },
								});
							})
						}
					>
						<Icon name="plus" size={18} />
						<Trans>Add a service</Trans>
					</Button>
				)}
			</div>
		</div>
	);
}

/**
 * Testimonials: what someone said about your work, with their name and role. Each one is added with a statement that
 * it's genuine and its author agreed to show it (derived rule #12); the API refuses one without it.
 */
export function TestimonialsForm() {
	const { testimonials } = usePortfolioData();
	const items = testimonials.items;
	const [adding, setAdding] = useState(false);
	const { itemProps, fallbackRef, removed } = useRemovalFocus();

	return (
		<div className="grid gap-3">
			<SortableList
				ids={items.map((item) => item.id)}
				onMove={(from, to) =>
					editPortfolio((draft) => moveItem(draft.testimonials.items, from, to), { structural: true })
				}
			>
				{items.map((item, index) => {
					const name = item.name.trim() || t`Untitled testimonial`;
					const update = (change: (target: OfferItem<"testimonials">) => void, key?: string) =>
						editOffer("testimonials", item.id, change, key);
					return (
						<SortableCard
							key={item.id}
							id={item.id}
							list="testimonials"
							index={index}
							name={name}
							itemProps={itemProps}
							onRemove={() => {
								removed(index);
								removeOffer("testimonials", item.id);
							}}
						>
							<TestimonialFields
								value={item}
								onChange={(field, value) =>
									update((target) => {
										target[field] = value;
									}, field)
								}
							/>
							<ImageField
								label={t`Their photo (optional)`}
								value={item.photo}
								altSuggestion={item.name.trim()}
								onChange={(image, typing) =>
									update(
										(target) => {
											if (image) target.photo = image;
											else delete target.photo;
										},
										typing ? "photo.alt" : undefined,
									)
								}
							/>
							<UrlInput
								label={t`Where it was given (optional)`}
								value={item.sourceUrl}
								webOnly
								placeholder={t`https://linkedin.com/in/…`}
								onChange={(url) =>
									update((target) => {
										if (url) target.sourceUrl = url;
										else delete target.sourceUrl;
									}, "sourceUrl")
								}
							/>
						</SortableCard>
					);
				})}
			</SortableList>
			<div ref={fallbackRef} className="contents">
				{items.length < PORTFOLIO_LIMITS.testimonials && (
					<Button variant="secondary" className="w-fit" onPress={() => setAdding(true)}>
						<Icon name="plus" size={18} />
						<Trans>Add a testimonial</Trans>
					</Button>
				)}
			</div>
			{adding && <AddTestimonialDialog onClose={() => setAdding(false)} />}
		</div>
	);
}

type TestimonialText = { quote: string; name: string; role: string };

type TestimonialFieldsProps = {
	value: TestimonialText;
	onChange: (field: keyof TestimonialText, value: string) => void;
};

function TestimonialFields({ value, onChange }: TestimonialFieldsProps) {
	return (
		<>
			<TextInput
				label={t`What they said`}
				multiline
				value={value.quote}
				maxLength={max.quote}
				onChange={(text) => onChange("quote", text)}
			/>
			<TextInput
				label={t`Their name`}
				icon="user-circle"
				value={value.name}
				maxLength={max.personName}
				onChange={(text) => onChange("name", text)}
			/>
			<TextInput
				label={t`Their role and company`}
				icon="briefcase"
				value={value.role}
				maxLength={max.personRole}
				placeholder={t`Head of Marketing, Kopi Senja`}
				onChange={(text) => onChange("role", text)}
			/>
		</>
	);
}

/** A new testimonial is added only with the statement ticked, so the portfolio never holds one without it. */
type AddTestimonialDialogProps = { onClose: () => void };

function AddTestimonialDialog({ onClose }: AddTestimonialDialogProps) {
	const id = useId();
	const [value, setValue] = useState<TestimonialText>({ quote: "", name: "", role: "" });
	const [sourceUrl, setSourceUrl] = useState<string>();
	const [sourceValid, setSourceValid] = useState(true);
	const [consent, setConsent] = useState(false);
	const ready = consent && value.quote.trim() !== "" && value.name.trim() !== "" && sourceValid;

	const add = () => {
		if (!ready) return;
		editPortfolio((draft) => {
			draft.testimonials.items.push({
				id: generateId(),
				...value,
				...(sourceUrl ? { sourceUrl } : {}),
				consent: true,
			});
		});
		onClose();
	};

	return (
		<Modal.Backdrop isOpen onOpenChange={(open) => !open && onClose()}>
			<Modal.Container size="md">
				<Modal.Dialog aria-labelledby={`${id}-title`}>
					<Modal.CloseTrigger aria-label={t`Close`} />
					<Modal.Header>
						<Modal.Heading id={`${id}-title`}>
							<Trans>Add a testimonial</Trans>
						</Modal.Heading>
					</Modal.Header>
					<form
						noValidate
						onSubmit={(event) => {
							event.preventDefault();
							add();
						}}
					>
						<Modal.Body className="grid gap-4">
							<TestimonialFields value={value} onChange={(field, text) => setValue({ ...value, [field]: text })} />
							<UrlInput
								label={t`Where it was given (optional)`}
								value={sourceUrl}
								webOnly
								placeholder={t`https://linkedin.com/in/…`}
								onChange={setSourceUrl}
								onValidChange={setSourceValid}
							/>
							<Checkbox isSelected={consent} onChange={setConsent}>
								<Checkbox.Content className="items-start">
									<Checkbox.Control className="mt-0.5">
										<Checkbox.Indicator />
									</Checkbox.Control>
									<Label className="text-sm">
										<Trans>
											This testimonial is genuine, and the person who gave it agreed to show it on my portfolio.
										</Trans>
									</Label>
								</Checkbox.Content>
							</Checkbox>
						</Modal.Body>
						<Modal.Footer>
							<Button type="button" variant="secondary" onPress={onClose}>
								<Trans>Cancel</Trans>
							</Button>
							<Button type="submit" isDisabled={!ready}>
								<Trans>Add testimonial</Trans>
							</Button>
						</Modal.Footer>
					</form>
				</Modal.Dialog>
			</Modal.Container>
		</Modal.Backdrop>
	);
}

/**
 * Clients: names, with an uploaded logo or, when the icon set knows the brand, its logo. Uploading a logo states the
 * right to show it (derived rule #11).
 */
export function ClientsForm() {
	const { clients } = usePortfolioData();
	const source = useSourceResume();
	const items = clients.items;
	const { itemProps, fallbackRef, removed } = useRemovalFocus();
	// Clients whose brand logo was switched on, while their name is being typed (read in handlers only).
	const brandWanted = useRef(new Set<string>());

	const companies = [
		...new Set((source.data?.sections.experience.items ?? []).map((item) => item.company.trim()).filter(Boolean)),
	].filter((company) => !items.some((client) => client.name.trim().toLowerCase() === company.toLowerCase()));

	const withBrand = (name: string) => {
		const brandIcon = getBrandIcon(name);
		return brandIcon ? { logo: { brandIcon } } : {};
	};

	return (
		<div className="grid gap-3">
			<SortableList
				ids={items.map((item) => item.id)}
				onMove={(from, to) => editPortfolio((draft) => moveItem(draft.clients.items, from, to), { structural: true })}
			>
				{items.map((client, index) => {
					const name = client.name.trim() || t`Untitled client`;
					const brandIcon = getBrandIcon(client.name);
					const showsBrand = Boolean(client.logo && "brandIcon" in client.logo);
					const update = (change: (target: OfferItem<"clients">) => void, key?: string) =>
						editOffer("clients", client.id, change, key);
					return (
						<SortableCard
							key={client.id}
							id={client.id}
							list="clients"
							index={index}
							name={name}
							itemProps={itemProps}
							onRemove={() => {
								removed(index);
								removeOffer("clients", client.id);
							}}
						>
							<TextInput
								label={t`Name`}
								icon="briefcase"
								value={client.name}
								maxLength={max.clientName}
								onChange={(value) => {
									if (showsBrand) brandWanted.current.add(client.id);
									const wanted = brandWanted.current.has(client.id);
									update((target) => renameClient(target, value, wanted), "name");
								}}
							/>
							<ImageField
								label={t`Logo (optional)`}
								kind="logo"
								value={client.logo && "key" in client.logo ? client.logo : undefined}
								altSuggestion={client.name.trim() ? t`${client.name.trim()} logo` : ""}
								onChange={(image, typing) =>
									update(
										(target) => {
											if (image) target.logo = image;
											else {
												const brand = getBrandIcon(target.name);
												if (brand) target.logo = { brandIcon: brand };
												else delete target.logo;
											}
										},
										typing ? "logo.alt" : undefined,
									)
								}
							/>
							{brandIcon && !(client.logo && "key" in client.logo) && (
								<CellSwitchRow
									isSelected={showsBrand}
									onChange={(checked) => {
										if (checked) brandWanted.current.add(client.id);
										else brandWanted.current.delete(client.id);
										update((target) => {
											if (checked) target.logo = { brandIcon };
											else delete target.logo;
										});
									}}
									label={t`Show the ${name} logo`}
								/>
							)}
							<UrlInput
								label={t`Link (optional)`}
								value={client.url}
								webOnly
								onChange={(url) =>
									update((target) => {
										if (url) target.url = url;
										else delete target.url;
									}, "url")
								}
							/>
						</SortableCard>
					);
				})}
			</SortableList>
			<p className="px-1 text-body-xs text-muted">
				<Trans>By adding a logo, you confirm you have the right to show it.</Trans>
			</p>
			<div ref={fallbackRef} className="flex flex-wrap gap-2">
				{items.length < PORTFOLIO_LIMITS.clients && (
					<Button
						variant="secondary"
						onPress={() =>
							editPortfolio((draft) => {
								draft.clients.items.push({ id: generateId(), name: "" });
							})
						}
					>
						<Icon name="plus" size={18} />
						<Trans>Add a client</Trans>
					</Button>
				)}
				{companies.length > 0 && items.length < PORTFOLIO_LIMITS.clients && (
					<Button
						variant="secondary"
						onPress={() =>
							editPortfolio((draft) => {
								const room = PORTFOLIO_LIMITS.clients - draft.clients.items.length;
								for (const company of companies.slice(0, room))
									draft.clients.items.push({ id: generateId(), name: company, ...withBrand(company) });
							})
						}
					>
						<Icon name="briefcase" size={18} />
						<Trans>Add from Experience</Trans>
					</Button>
				)}
			</div>
		</div>
	);
}
