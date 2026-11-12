/**
 * The part of a visitor's address that rate limits count: an IPv4 address as it is, an IPv6 address by its /64 network.
 * One IPv6 host usually holds a whole /64 and can pick a new address for every request, so counting full IPv6
 * addresses would let it pass every per-address limit. An IPv4 address written as IPv6 (`::ffff:1.2.3.4`) counts as
 * that IPv4 address. Null when there is no usable address (missing, `unknown`, or not an IP address).
 */
export function rateLimitAddress(address: string | undefined): string | null {
	const value = address?.trim().toLowerCase();
	if (!value) return null;
	if (IPV4.test(value)) return value;
	const groups = ipv6Groups(value);
	if (!groups) return null;
	if (groups.slice(0, 5).every((group) => group === 0) && groups[5] === 0xffff) {
		const [high = 0, low = 0] = groups.slice(6);
		return [high >> 8, high & 0xff, low >> 8, low & 0xff].join(".");
	}
	return `${groups
		.slice(0, 4)
		.map((group) => group.toString(16))
		.join(":")}::/64`;
}

/** Whether a value is an IPv4 or IPv6 address, for passing it on as one (Turnstile's `remoteip`). */
export function isIpAddress(address: string | undefined): address is string {
	const value = address?.trim().toLowerCase();
	return Boolean(value && (IPV4.test(value) || ipv6Groups(value)));
}

const OCTET = "(?:25[0-5]|2[0-4]\\d|1\\d\\d|[1-9]?\\d)";
const IPV4 = new RegExp(`^${OCTET}(?:\\.${OCTET}){3}$`);
const HEXTET = /^[0-9a-f]{1,4}$/;

/** The eight 16-bit groups of an IPv6 address (brackets and a zone allowed), or null when it isn't one. */
function ipv6Groups(input: string): number[] | null {
	let value = input.startsWith("[") && input.endsWith("]") ? input.slice(1, -1) : input;
	value = value.split("%")[0] ?? "";
	if (!value.includes(":")) return null;
	const halves = value.split("::");
	if (halves.length > 2) return null;
	const parse = (part: string): number[] | null => {
		if (!part) return [];
		const out: number[] = [];
		const pieces = part.split(":");
		for (const [index, piece] of pieces.entries()) {
			if (index === pieces.length - 1 && piece.includes(".")) {
				if (!IPV4.test(piece)) return null;
				const [a = 0, b = 0, c = 0, d = 0] = piece.split(".").map(Number);
				out.push((a << 8) | b, (c << 8) | d);
			} else if (HEXTET.test(piece)) out.push(Number.parseInt(piece, 16));
			else return null;
		}
		return out;
	};
	const head = parse(halves[0] ?? "");
	const tail = halves.length === 2 ? parse(halves[1] ?? "") : [];
	if (!head || !tail) return null;
	if (halves.length === 1) return head.length === 8 ? head : null;
	const missing = 8 - head.length - tail.length;
	return missing >= 1 ? [...head, ...Array.from({ length: missing }, () => 0), ...tail] : null;
}
