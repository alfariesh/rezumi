import type { IconName } from "../../forme/icons";
import type { Style } from "../../forme/style-types";
import type { CustomField } from "@rezumi/schema/resume/data";
import { View } from "#react-pdf-renderer";
import { useRender } from "../../context";
import { resolvedPdfFlowProps } from "../../semantic/adapter";
import { useResolvedNode, useSemanticNodeKey, useSemanticNodeVisible } from "../../semantic/context";
import { semanticNodeKeys } from "../../semantic/node-keys";
import { getCustomFieldLinkUrl, getWebsiteDisplayText } from "./contact";
import { useTemplateFeature, useTemplateStyle } from "./context";
import { Icon, Link, Text } from "./primitives";
import { composeStyles } from "./styles";

type ContactStyle = Style | Style[];

type WebsiteDisplay = {
	url: string;
	label?: string | undefined;
};

/**
 * On a right-to-left page a contact reads in the direction of its own first letter, so "@studio", "site.com/" and
 * "Gender:" keep their marks at the end while Arabic text stays right to left. A phone number has no letters and reads
 * left to right: "+62 812 5550 1824" read "1824 5550 812 62+".
 */
const useContactTextStyle = (textStyle: ContactStyle | undefined, direction: "auto" | "ltr" = "auto") => {
	const { rtl } = useRender();
	return rtl ? composeStyles(textStyle, { direction }) : textStyle;
};

const useContactNodeKeys = (name: string, id?: string, primitiveNodeKey?: string) => {
	const headerNodeKey = useSemanticNodeKey();
	const contactListNodeKey = headerNodeKey ? semanticNodeKeys.contactList(headerNodeKey) : undefined;
	const contactNodeKey = contactListNodeKey ? semanticNodeKeys.contactItem(contactListNodeKey, name, id) : undefined;

	return {
		contactNodeKey,
		primitiveNodeKey: primitiveNodeKey ?? contactNodeKey,
		fieldNodeKey: contactNodeKey ? semanticNodeKeys.field(contactNodeKey, name) : undefined,
		iconNodeKey: contactNodeKey ? semanticNodeKeys.icon(contactNodeKey, "contact") : undefined,
	};
};

type WebsiteContactItemProps = {
	website: WebsiteDisplay;
	style?: ContactStyle;
	textStyle?: ContactStyle | undefined;
	iconColor?: string;
	primitiveNodeKey?: string | undefined;
};

type CustomFieldContactItemProps = {
	field: CustomField;
	style?: ContactStyle;
	textStyle?: ContactStyle | undefined;
	iconColor?: string;
	primitiveNodeKey?: string | undefined;
};

export const WebsiteContactItem = ({
	website,
	style,
	textStyle,
	iconColor,
	primitiveNodeKey,
}: WebsiteContactItemProps) => {
	const keys = useContactNodeKeys("website", undefined, primitiveNodeKey);
	const visible = useSemanticNodeVisible(keys.primitiveNodeKey);
	const valueStyle = useContactTextStyle(textStyle);
	if (!website.url || !visible) return null;

	return (
		<Link nodeKey={keys.primitiveNodeKey} src={website.url} {...(style ? { style } : {})}>
			<Icon
				iconRole="contact"
				nodeKey={keys.iconNodeKey}
				name="globe-02"
				{...(iconColor ? { color: iconColor } : {})}
			/>
			<Text nodeKey={keys.fieldNodeKey} {...(valueStyle ? { style: valueStyle } : {})}>
				{getWebsiteDisplayText(website)}
			</Text>
		</Link>
	);
};

export const CustomFieldContactItem = ({
	field,
	style,
	textStyle,
	iconColor,
	primitiveNodeKey,
}: CustomFieldContactItemProps) => {
	const linkUrl = getCustomFieldLinkUrl(field);
	const keys = useContactNodeKeys("custom", field.id, primitiveNodeKey);
	const labelStyle = useTemplateStyle("contactLabel");
	const iconColumn = useTemplateFeature("contactIconColumn");
	const resolved = useResolvedNode(keys.primitiveNodeKey);
	const visible = useSemanticNodeVisible(keys.primitiveNodeKey);
	const valueStyle = useContactTextStyle(textStyle);
	const fieldLabelStyle = useContactTextStyle(composeStyles(textStyle, labelStyle));
	const children = (
		<>
			<Icon
				iconRole="contact"
				nodeKey={keys.iconNodeKey}
				name={field.icon as IconName}
				keepSpace={iconColumn}
				{...(iconColor ? { color: iconColor } : {})}
			/>
			{field.label && (
				<Text bindSemanticNode={false} style={fieldLabelStyle}>
					{`${field.label}:`}
				</Text>
			)}
			<Text nodeKey={keys.fieldNodeKey} {...(valueStyle ? { style: valueStyle } : {})}>
				{field.text}
			</Text>
		</>
	);
	if (!visible) return null;

	if (linkUrl) {
		return (
			<Link nodeKey={keys.primitiveNodeKey} src={linkUrl} {...(style ? { style } : {})}>
				{children}
			</Link>
		);
	}

	return (
		<View {...resolvedPdfFlowProps(resolved)} style={composeStyles(style, resolved.style)}>
			{children}
		</View>
	);
};

type EmailContactItemProps = {
	email: string;
	style?: ContactStyle;
	textStyle?: ContactStyle | undefined;
	iconColor?: string;
	/** Override icon; defaults to "mail-01". */
	iconName?: IconName;
	primitiveNodeKey?: string | undefined;
};

export const EmailContactItem = ({
	email,
	style,
	textStyle,
	iconColor,
	iconName = "mail-01",
	primitiveNodeKey,
}: EmailContactItemProps) => {
	const keys = useContactNodeKeys("email", undefined, primitiveNodeKey);
	const visible = useSemanticNodeVisible(keys.primitiveNodeKey);
	const valueStyle = useContactTextStyle(textStyle);
	if (!email || !visible) return null;
	return (
		<Link nodeKey={keys.primitiveNodeKey} src={`mailto:${email}`} {...(style ? { style } : {})}>
			<Icon
				iconRole="contact"
				nodeKey={keys.iconNodeKey}
				name={iconName}
				{...(iconColor ? { color: iconColor } : {})}
			/>
			<Text nodeKey={keys.fieldNodeKey} {...(valueStyle ? { style: valueStyle } : {})}>
				{email}
			</Text>
		</Link>
	);
};

type PhoneContactItemProps = {
	phone: string;
	style?: ContactStyle;
	textStyle?: ContactStyle | undefined;
	iconColor?: string;
	primitiveNodeKey?: string | undefined;
};

export const PhoneContactItem = ({ phone, style, textStyle, iconColor, primitiveNodeKey }: PhoneContactItemProps) => {
	const keys = useContactNodeKeys("phone", undefined, primitiveNodeKey);
	const visible = useSemanticNodeVisible(keys.primitiveNodeKey);
	const numberStyle = useContactTextStyle(textStyle, "ltr");
	if (!phone || !visible) return null;
	return (
		<Link nodeKey={keys.primitiveNodeKey} src={`tel:${phone}`} {...(style ? { style } : {})}>
			<Icon iconRole="contact" nodeKey={keys.iconNodeKey} name="call-02" {...(iconColor ? { color: iconColor } : {})} />
			<Text nodeKey={keys.fieldNodeKey} {...(numberStyle ? { style: numberStyle } : {})}>
				{phone}
			</Text>
		</Link>
	);
};

type LocationContactItemProps = {
	location: string;
	style?: ContactStyle;
	textStyle?: ContactStyle | undefined;
	iconColor?: string;
	primitiveNodeKey?: string | undefined;
};

export const LocationContactItem = ({
	location,
	style,
	textStyle,
	iconColor,
	primitiveNodeKey,
}: LocationContactItemProps) => {
	const keys = useContactNodeKeys("location", undefined, primitiveNodeKey);
	const resolved = useResolvedNode(keys.primitiveNodeKey);
	const visible = useSemanticNodeVisible(keys.primitiveNodeKey);
	const valueStyle = useContactTextStyle(textStyle);
	if (!location || !visible) return null;
	return (
		<View {...resolvedPdfFlowProps(resolved)} style={composeStyles(style, resolved.style)}>
			<Icon
				iconRole="contact"
				nodeKey={keys.iconNodeKey}
				name="location-01"
				{...(iconColor ? { color: iconColor } : {})}
			/>
			<Text nodeKey={keys.fieldNodeKey} {...(valueStyle ? { style: valueStyle } : {})}>
				{location}
			</Text>
		</View>
	);
};
