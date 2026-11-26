import type { PortfolioData } from "@rezumi/schema/portfolio/data";
import type { PortfolioSectionKey } from "@rezumi/schema/portfolio/sections";
import type { ReactNode } from "react";
import { useLingui } from "@lingui/react/macro";
import { useState } from "react";
import { View } from "react-native";
import { newMetric } from "@rezumi/portfolio/editing";
import { PORTFOLIO_BUTTON_KINDS, PORTFOLIO_JOB_TYPES } from "@rezumi/schema/portfolio/data";
import { PORTFOLIO_LIMITS } from "@rezumi/schema/portfolio/limits";
import { PORTFOLIO_THEME_INFO } from "@rezumi/schema/portfolio/themes";
import { generateId } from "@rezumi/utils/string";
import { openPortfolioLink } from "../queries";
import { AiField } from "./ai";
import { Field, Group, Order, Toggle } from "./fields";
import { Metric } from "./metric";
import { AddPictures, PicturePreview } from "./pictures";
import { useEdit } from "./store";
import { useSession } from "@/auth/session";
import { RichTextToolbar } from "@/features/entries/rich-text-field";
import { Button, ChipInput, ConfirmDialog, ListRow, Screen, Text } from "@/ui";

const { text: max } = PORTFOLIO_LIMITS;
type ContentProps = { data: PortfolioData; actions: ReactNode; contactAvailable: boolean };

export function Content({ data, actions, contactAvailable }: ContentProps) {
	const { t } = useLingui();
	const edit = useEdit();
	const { server } = useSession();
	const [testimonial, setTestimonial] = useState(false);
	const roles = data.hero.availability.roles;
	const types = data.hero.availability.types;
	const jobLabels = {
		"full-time": t`Full-time`,
		"part-time": t`Part-time`,
		contract: t`Contract`,
		freelance: t`Freelance`,
		internship: t`Internship`,
	};
	const buttonLabels = {
		resume: t`Resume`,
		pdf: t`Resume PDF`,
		contact: t`Contact`,
		whatsapp: "WhatsApp",
		email: t`Email`,
		profile: t`Profile`,
		link: t`Link`,
		vcard: t`Save contact`,
	};
	return (
		<>
			<RichTextToolbar />
			<Screen testID="portfolio-editor-content">
				{actions}
				<Group title={t`Intro`}>
					<Field
						label={t`Name`}
						value={data.basics.name ?? ""}
						max={max.name}
						onChange={(name) =>
							edit(
								(draft) => {
									draft.basics.name = name;
								},
								{ key: "name" },
							)
						}
					/>
					<Field
						label={t`Headline`}
						value={data.basics.headline ?? ""}
						max={max.headline}
						onChange={(headline) =>
							edit(
								(draft) => {
									draft.basics.headline = headline;
								},
								{ key: "headline" },
							)
						}
					/>
					<AiField
						label={t`Greeting`}
						value={data.hero.greeting}
						field="greeting"
						max={max.greeting}
						read={(before) => before.hero.greeting}
						write={(draft, text) => {
							draft.hero.greeting = text;
						}}
					/>
					<Toggle
						label={t`Show photo`}
						value={data.hero.showPicture}
						onChange={(value) =>
							edit((draft) => {
								draft.hero.showPicture = value;
							})
						}
					/>
					{data.basics.picture ? <PicturePreview picture={data.basics.picture} /> : null}
					<AddPictures
						label={t`Choose intro photo`}
						kind="portrait"
						onPictures={([picture]) => {
							if (picture)
								edit((draft) => {
									draft.basics.picture = picture;
									draft.hero.showPicture = true;
								});
						}}
					/>
					{data.basics.picture !== undefined ? (
						<Button
							size="sm"
							variant="secondary"
							onPress={() =>
								edit((draft) => {
									delete draft.basics.picture;
								})
							}
						>{t`Use source photo`}</Button>
					) : null}
					<Toggle
						label={t`Open to work`}
						value={data.hero.availability.show}
						onChange={(value) =>
							edit((draft) => {
								draft.hero.availability.show = value;
							})
						}
					/>
					{data.hero.availability.show ? (
						<>
							<Field
								label={t`Availability text`}
								value={data.hero.availability.text}
								max={max.availability}
								onChange={(text) =>
									edit(
										(draft) => {
											draft.hero.availability.text = text;
										},
										{ key: "availability" },
									)
								}
							/>
							<ChipInput
								label={t`Roles you're looking for`}
								values={roles}
								max={PORTFOLIO_LIMITS.availabilityRoles}
								maxLength={max.availabilityRole}
								removeLabel={(role) => t`Remove ${role}`}
								onChange={(values) =>
									edit((draft) => {
										draft.hero.availability.roles = values
											.slice(0, PORTFOLIO_LIMITS.availabilityRoles)
											.map((role) => role.slice(0, max.availabilityRole));
									})
								}
							/>
							{PORTFOLIO_JOB_TYPES.map((type) => (
								<Toggle
									key={type}
									label={jobLabels[type]}
									value={types.includes(type)}
									onChange={(selected) =>
										edit((draft) => {
											draft.hero.availability.types = selected
												? [...draft.hero.availability.types, type]
												: draft.hero.availability.types.filter((item) => item !== type);
										})
									}
								/>
							))}
						</>
					) : null}
				</Group>
				<Group title={t`Intro buttons`}>
					{data.hero.buttons.map((item, index) => (
						<View key={`${item.kind}:${index}`} className="gap-2 rounded-lg border border-border p-3">
							<Text weight="medium">{buttonLabels[item.kind]}</Text>
							<Field
								label={t`Button label`}
								value={item.label ?? ""}
								max={max.buttonLabel}
								onChange={(label) =>
									edit(
										(draft) => {
											const button = draft.hero.buttons[index];
											if (button) button.label = label;
										},
										{ key: `button:${index}:label` },
									)
								}
							/>
							{item.kind === "link" || item.kind === "profile" ? (
								<Field
									label={t`Button URL`}
									value={item.url ?? ""}
									keyboard="url"
									max={max.url}
									onChange={(url) =>
										edit(
											(draft) => {
												const button = draft.hero.buttons[index];
												if (button) {
													if (url.trim()) button.url = url.trim();
													else delete button.url;
												}
											},
											{ key: `button:${index}:url` },
										)
									}
								/>
							) : null}
							<Order
								remove={() =>
									edit(
										(draft) => {
											draft.hero.buttons.splice(index, 1);
										},
										{ structural: true },
									)
								}
							/>
						</View>
					))}
					{data.hero.buttons.length < PORTFOLIO_LIMITS.heroButtons ? (
						<View className="flex-row flex-wrap gap-2">
							{PORTFOLIO_BUTTON_KINDS.filter((kind) => !data.hero.buttons.some((item) => item.kind === kind)).map(
								(kind) => (
									<Button
										key={kind}
										size="sm"
										variant="secondary"
										onPress={() =>
											edit((draft) => {
												draft.hero.buttons.push({ kind });
											})
										}
									>
										{t`Add ${buttonLabels[kind]} button`}
									</Button>
								),
							)}
						</View>
					) : null}
				</Group>
				<Group title={t`About`}>
					<AiField
						label={t`About me`}
						field="about"
						rich
						value={data.about.content}
						read={(before) => before.about.content}
						write={(draft, text) => {
							draft.about.content = text;
						}}
					/>
				</Group>
				<Group
					title={t`Highlights`}
					action={
						<Button
							size="sm"
							variant="secondary"
							isDisabled={data.hero.highlights.length >= PORTFOLIO_LIMITS.highlights}
							onPress={() =>
								edit((draft) => {
									draft.hero.highlights.push(newMetric());
								})
							}
						>{t`Add metric`}</Button>
					}
				>
					{data.hero.highlights.map((metric) => (
						<Metric
							key={metric.id}
							metric={metric}
							change={(change, key) =>
								edit(
									(draft) => {
										const item = draft.hero.highlights.find(({ id }) => id === metric.id);
										if (item) change(item);
									},
									{ key },
								)
							}
							remove={() =>
								edit((draft) => {
									draft.hero.highlights = draft.hero.highlights.filter(({ id }) => id !== metric.id);
								})
							}
						/>
					))}
				</Group>
				<Group
					title={t`Testimonials`}
					action={
						<Button
							size="sm"
							variant="secondary"
							isDisabled={data.testimonials.items.length >= PORTFOLIO_LIMITS.testimonials}
							onPress={() => setTestimonial(true)}
						>{t`Add testimonial`}</Button>
					}
				>
					{data.testimonials.items.map((item) => (
						<View key={item.id} className="gap-2 rounded-lg border border-border p-3">
							{(
								[
									{ key: "quote", label: t`Quote`, limit: max.quote },
									{ key: "name", label: t`Name`, limit: max.personName },
									{ key: "role", label: t`Role and company`, limit: max.personRole },
								] as const
							).map(({ key, label, limit }) => (
								<Field
									key={key}
									label={label}
									value={item[key]}
									max={limit}
									multiline={key === "quote"}
									onChange={(value) =>
										edit(
											(draft) => {
												const target = draft.testimonials.items.find(({ id }) => id === item.id);
												if (target) target[key] = value;
											},
											{ key: `${item.id}:${key}` },
										)
									}
								/>
							))}
							{item.photo ? <PicturePreview picture={item.photo} /> : null}
							<AddPictures
								label={t`Choose testimonial photo`}
								kind="portrait"
								onPictures={([picture]) =>
									edit((draft) => {
										const target = draft.testimonials.items.find(({ id }) => id === item.id);
										if (target && picture) target.photo = picture;
									})
								}
							/>
							<Order
								remove={() =>
									edit((draft) => {
										draft.testimonials.items = draft.testimonials.items.filter(({ id }) => id !== item.id);
									})
								}
							/>
						</View>
					))}
				</Group>
				<Group
					title={t`Clients`}
					action={
						<Button
							size="sm"
							variant="secondary"
							isDisabled={data.clients.items.length >= PORTFOLIO_LIMITS.clients}
							onPress={() =>
								edit((draft) => {
									draft.clients.items.push({ id: generateId(), name: "" });
								})
							}
						>{t`Add client`}</Button>
					}
				>
					{data.clients.items.map((item) => (
						<View key={item.id} className="gap-2 rounded-lg border border-border p-3">
							<Field
								label={t`Client name`}
								value={item.name}
								max={max.clientName}
								onChange={(name) =>
									edit(
										(draft) => {
											const target = draft.clients.items.find(({ id }) => id === item.id);
											if (target) target.name = name;
										},
										{ key: `${item.id}:name` },
									)
								}
							/>
							{item.logo && "key" in item.logo ? <PicturePreview picture={item.logo} /> : null}
							<AddPictures
								label={t`Choose client logo`}
								kind="logo"
								onPictures={([picture]) =>
									edit((draft) => {
										const target = draft.clients.items.find(({ id }) => id === item.id);
										if (target && picture) target.logo = picture;
									})
								}
							/>
							<Order
								remove={() =>
									edit((draft) => {
										draft.clients.items = draft.clients.items.filter(({ id }) => id !== item.id);
									})
								}
							/>
						</View>
					))}
				</Group>
				<Sections data={data} />
				<Group title={t`Contact`}>
					{(
						[
							{ key: "email", label: t`Show email` },
							{ key: "phone", label: t`Show phone number` },
							{ key: "website", label: t`Show website` },
							{ key: "profiles", label: t`Show profile links` },
							{ key: "form", label: t`Show contact form` },
							{ key: "saveContact", label: t`Show Save contact button` },
						] as const
					).map(({ key, label }) => (
						<Toggle
							key={key}
							label={label}
							value={data.contact[key]}
							disabled={key === "form" && !contactAvailable && !data.contact.form}
							onChange={(show) =>
								edit((draft) => {
									draft.contact[key] = show;
								})
							}
						/>
					))}
					<Field
						label={t`Contact note`}
						value={data.contact.note}
						max={max.contactNote}
						multiline
						onChange={(note) =>
							edit(
								(draft) => {
									draft.contact.note = note;
								},
								{ key: "contact-note" },
							)
						}
					/>
					<Toggle
						label={t`Show WhatsApp`}
						value={data.contact.whatsapp.show}
						onChange={(show) =>
							edit((draft) => {
								draft.contact.whatsapp.show = show;
							})
						}
					/>
					{data.contact.whatsapp.show ? (
						<Field
							label={t`WhatsApp number with country code`}
							value={data.contact.whatsapp.number}
							max={15}
							keyboard="phone-pad"
							onChange={(number) =>
								edit(
									(draft) => {
										draft.contact.whatsapp.number = number.replace(/\D/g, "");
									},
									{ key: "contact-whatsapp" },
								)
							}
						/>
					) : null}
				</Group>
				<Group title={t`Location card`}>
					<Text tone="muted">
						{data.location.label || data.basics.location || t`Uses the location from your source.`}
					</Text>
					<ListRow title={t`Set up on the web`} onPress={() => void openPortfolioLink(`${server}/builder/portfolio`)} />
				</Group>
			</Screen>
			<ConfirmDialog
				isOpen={testimonial}
				onOpenChange={setTestimonial}
				title={t`Add a testimonial?`}
				message={t`Confirm the testimonial is genuine and its author has agreed to share it publicly.`}
				cancelLabel={t`Cancel`}
				confirmLabel={t`I have permission`}
				onConfirm={() => {
					setTestimonial(false);
					edit((draft) => {
						draft.testimonials.items.push({ id: generateId(), name: "", quote: "", role: "", consent: true });
					});
				}}
			/>
		</>
	);
}

function Sections({ data }: Pick<ContentProps, "data">) {
	const { t } = useLingui();
	const edit = useEdit();
	const labels = {
		about: t`About`,
		work: t`Work`,
		services: t`Services`,
		testimonials: t`Testimonials`,
		clients: t`Clients`,
		experience: t`Experience`,
		education: t`Education`,
		skills: t`Skills`,
		languages: t`Languages`,
		certifications: t`Certifications`,
		awards: t`Awards`,
		publications: t`Publications`,
		volunteer: t`Volunteering`,
		interests: t`Interests`,
		profiles: t`Profiles`,
		contact: t`Contact`,
	};
	const sections = [
		...new Set<PortfolioSectionKey>([
			...data.sections.order,
			...PORTFOLIO_THEME_INFO[data.theme].sectionOrder,
			...data.custom.map(({ id }) => `custom:${id}` as const),
		]),
	].slice(0, PORTFOLIO_LIMITS.sectionKeys);
	const move = (from: number, to: number) => {
		const next = [...sections];
		const [item] = next.splice(from, 1);
		if (!item) return;
		next.splice(to, 0, item);
		edit(
			(draft) => {
				draft.sections.order = next;
			},
			{ structural: true },
		);
	};
	return (
		<Group title={t`Page sections`}>
			{sections.map((key, index) => {
				const label =
					data.sections.titles[key] ||
					labels[key as keyof typeof labels] ||
					data.custom.find(({ id }) => key === `custom:${id}`)?.title ||
					key;
				return (
					<View key={key} className="flex-row items-center justify-between gap-2">
						<View className="flex-1">
							<Toggle
								label={label}
								value={!data.sections.hidden.includes(key)}
								onChange={(show) =>
									edit((draft) => {
										draft.sections.hidden = show
											? draft.sections.hidden.filter((item) => item !== key)
											: [...draft.sections.hidden, key];
									})
								}
							/>
						</View>
						<Order
							up={index > 0 ? () => move(index, index - 1) : undefined}
							down={index < sections.length - 1 ? () => move(index, index + 1) : undefined}
						/>
					</View>
				);
			})}
			<Button
				variant="secondary"
				onPress={() =>
					edit(
						(draft) => {
							draft.sections.order = [];
						},
						{ structural: true },
					)
				}
			>{t`Restore theme order`}</Button>
		</Group>
	);
}
