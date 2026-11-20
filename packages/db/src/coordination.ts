export type LimitResult = { allowed: boolean; remaining: number; reset: number };
export type LimitRule = { window: number; max: number; rolling?: boolean };
/** A running total, such as money spent today: `allowed` is false when `max` would be passed, and nothing was added. */
export type AddResult = { allowed: boolean; total: number; reset: number };
export type AddRule = { window: number; max?: number | undefined };

/** Native platform coordination replaces Redis for counters and short-lived run state. */
export type CoordinationService = {
	consume(key: string, rule: LimitRule): Promise<LimitResult>;
	/** Adds a whole `amount` (0 reads the total) to a total that starts when first added to and ends after `window`. */
	add(key: string, amount: number, rule: AddRule): Promise<AddResult>;
	get(key: string): Promise<string | null>;
	set(key: string, value: string, ttl: number): Promise<void>;
	publish(key: string, value: string): Promise<void>;
	subscribe(key: string, signal?: AbortSignal): AsyncIterable<string>;
};

let coordination: CoordinationService | undefined;

export function configureCoordination(service: CoordinationService): void {
	coordination = service;
}

export const getCoordination = () => coordination;
