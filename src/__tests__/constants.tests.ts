import { DateTime } from "luxon"
import { getScheduleDate } from "../constants"

// Thursday
const THURSDAY = DateTime.fromISO("2026-10-08T10:00:00")

describe("getScheduleDate", () => {
	beforeEach(() => {
		jest.spyOn(console, "log").mockImplementation(() => {})
		jest.spyOn(console, "warn").mockImplementation(() => {})
	})
	afterEach(() => {
		jest.restoreAllMocks()
		delete process.env.RELEASE_DAY_OFFSET
		delete process.env.RELEASE_DAY_OFFSET_UNTIL
	})

	const setEnv = (env: Record<string, string>) => Object.assign(process.env, env)

	it("returns now when no offset is set", () => {
		expect(getScheduleDate(THURSDAY)).toBe(THURSDAY)
	})

	it("treats a thursday as friday with offset -1", () => {
		setEnv({ RELEASE_DAY_OFFSET: "-1" })
		expect(getScheduleDate(THURSDAY).weekday).toBe(5)
	})

	it("supports positive offsets", () => {
		setEnv({ RELEASE_DAY_OFFSET: "1" })
		expect(getScheduleDate(THURSDAY).weekday).toBe(3)
	})

	it("ignores a non-numeric offset", () => {
		setEnv({ RELEASE_DAY_OFFSET: "abc" })
		expect(getScheduleDate(THURSDAY)).toBe(THURSDAY)
	})

	it("applies the offset through the UNTIL date, inclusive", () => {
		setEnv({ RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "2026-10-08" })
		expect(getScheduleDate(THURSDAY).weekday).toBe(5)
	})

	it("ignores the offset after the UNTIL date", () => {
		setEnv({ RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "2026-10-07" })
		expect(getScheduleDate(THURSDAY)).toBe(THURSDAY)
	})

	it("ignores the offset when UNTIL is invalid", () => {
		setEnv({ RELEASE_DAY_OFFSET: "-1", RELEASE_DAY_OFFSET_UNTIL: "nope" })
		expect(getScheduleDate(THURSDAY)).toBe(THURSDAY)
	})
})
