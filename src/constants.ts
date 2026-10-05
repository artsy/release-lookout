import { DateTime } from "luxon"

// A Thursday in a first-week-of-cadence (see isFirstWeekOfCadence).
// Update if the rotation's phase changes.
// Both functions below align to startOf('week') so Mon–Wed aren't miscounted
// against a Thursday epoch boundary.
export const ROTATION_EPOCH = DateTime.fromISO("2026-06-11", { zone: "utc" })

const weeksSinceEpoch = (now: DateTime): number =>
	Math.round(now.startOf("week").diff(ROTATION_EPOCH.startOf("week"), "weeks").weeks)

// Epoch-based so year boundaries (week 52→1, week 53→1) don't break parity.
export const isFirstWeekOfCadence = (now: DateTime): boolean =>
	((weeksSinceEpoch(now) % 2) + 2) % 2 === 0

export const CAPTAIN_DOCS_URL =
	"https://www.notion.so/artsy/Release-Captain-Tasks-7ca3e6f5d16e41079a1fb1b1706bd018" // link to your captain runbook

/**
 * Shifts the release schedule by whole days, for bank holidays.
 *
 * RELEASE_DAY_OFFSET: integer days. -1 runs the schedule one day earlier
 * (real Thursday behaves like Friday); +1 runs it one day later.
 * RELEASE_DAY_OFFSET_UNTIL: optional ISO date (inclusive). After it the offset
 * is ignored, so a forgotten variable can't shift future releases.
 *
 * Use the returned date for weekday/cadence checks only. Anything tied to the
 * real calendar (e.g. Orbit's on-call lookup) must keep using the real `now`.
 */
export const getScheduleDate = (
	now: DateTime = DateTime.now(),
	env: NodeJS.ProcessEnv = process.env
): DateTime => {
	const offset = Number.parseInt(env.RELEASE_DAY_OFFSET ?? "", 10)
	if (!Number.isFinite(offset) || offset === 0) return now

	const untilRaw = env.RELEASE_DAY_OFFSET_UNTIL
	if (untilRaw) {
		const until = DateTime.fromISO(untilRaw, { zone: now.zone })
		if (!until.isValid) {
			console.warn(`Ignoring RELEASE_DAY_OFFSET: invalid RELEASE_DAY_OFFSET_UNTIL "${untilRaw}".`)
			return now
		}
		if (now > until.endOf("day")) return now
	}

	console.log(`Applying RELEASE_DAY_OFFSET=${offset} (schedule date: ${now.minus({ days: offset }).toISODate()}).`)
	return now.minus({ days: offset })
}
