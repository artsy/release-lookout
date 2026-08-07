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
