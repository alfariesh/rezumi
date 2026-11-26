// Home's relative days follow the account's timezone, not UTC or the phone's: a row from 00:30 in Jakarta is
// "Tomorrow" there while it is still the same day in UTC.
import type { HomeTime } from "./time";
import { useEffect } from "react";
import { useHomeTime } from "./time";
import { renderScreen } from "@/test/render-screen";

let mockTimezone = "Asia/Jakarta";
jest.mock("@/features/account/queries", () => ({ useProfile: () => ({ data: { timezone: mockTimezone } }) }));

type ProbeProps = { onTime: (time: HomeTime) => void };

function Probe({ onTime }: ProbeProps) {
	const time = useHomeTime();
	useEffect(() => onTime(time));
	return null;
}

async function homeTime(timezone: string): Promise<HomeTime> {
	mockTimezone = timezone;
	const onTime = jest.fn<void, [HomeTime]>();
	await renderScreen(<Probe onTime={onTime} />);
	const time = onTime.mock.calls.at(-1)?.[0];
	if (!time) throw new Error("useHomeTime did not render");
	return time;
}

describe("useHomeTime().dayOffset", () => {
	it("counts days in the account's timezone around midnight (UTC+7)", async () => {
		const time = await homeTime("Asia/Jakarta");
		const now = new Date("2026-11-21T16:30:00Z"); // 23:30 on the 21st in Jakarta
		expect(time.dayOffset("2026-11-21T16:00:00Z", now)).toBe(0); // 23:00 the same evening
		expect(time.dayOffset("2026-11-21T17:30:00Z", now)).toBe(1); // 00:30 on the 22nd, still the 21st in UTC
		expect(time.dayOffset("2026-11-20T16:59:00Z", now)).toBe(-1); // 23:59 on the 20th
		expect(time.dayOffset("2026-11-23T00:00:00Z", now)).toBeNull(); // the 23rd: two days on
	});

	it("counts days west of UTC too (UTC-8)", async () => {
		const time = await homeTime("America/Los_Angeles");
		const now = new Date("2026-11-22T05:00:00Z"); // 21:00 on the 21st in Los Angeles
		expect(time.dayOffset("2026-11-22T07:59:00Z", now)).toBe(0); // 23:59 the same day, the 22nd in UTC
		expect(time.dayOffset("2026-11-22T09:00:00Z", now)).toBe(1); // 01:00 on the 22nd
		expect(time.dayOffset("2026-11-21T07:00:00Z", now)).toBe(-1); // 23:00 on the 20th
	});
});
