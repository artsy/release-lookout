import { DateTime } from "luxon"
import { getScheduleDate } from "../constants"

// Thursday
const THURSDAY = DateTime.fromISO("2026-10-08T10:00:00")

describe("getScheduleDate", () => {
	beforeEach(() => {
		jest.spyOn(console, "log").mockImplementation(() => {})
		jest.spyOn(console, "warn").mockImplementation(() => {})
	})
	afterEach(() => jest.restoreAllMocks())

	it("returns now when no offset is set", () => {
		expect(getScheduleDate(THURSDAY, {})).toBe(THURSDAY)
	})

	it("treats a thursday as friday with offset -1", () => {
		expect(getScheduleDate(THURSDAY, { RELEASE_DAY_OFFSET: "-1" }).weekday).toBe(5)
	})

	it("supports positive offsets", () => {
		expect(getScheduleDate(THURSDAY, { RELEASE_DAY_OFFSET: "1" }).weekday).toBe(3)
	})

	it("ignores a non-numeric offset", () => {
		expect(getScheduleDate(THURSDAY, { RELEASE_DAY_OFFSET: "abc" })).toBe(THURSDAY)
	})

	it("applies the offset through the UNTIL date, inclusive", () => {
		const env = { RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "2026-10-08" }
		expect(getScheduleDate(THURSDAY, env).weekday).toBe(5)
	})

	it("ignores the offset after the UNTIL date", () => {
		const env = { RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "2026-10-07" }
		expect(getScheduleDate(THURSDAY, env)).toBe(THURSDAY)
	})

	it("ignores the offset when UNTIL is invalid", () => {
		const env = { RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "nope" }
		expect(getScheduleDate(THURSDAY, env)).toBe(THURSDAY)
	})
})
