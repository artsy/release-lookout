import { DateTime } from "luxon"

// A Thursday in a first-week-of-cadence where RELEASE_CAPTAINS[0] takes over.
// Update this when the list is reshuffled so the index math stays correct.
// Both functions below align to startOf('week') so Mon–Wed aren't miscounted
// against a Thursday epoch boundary.
export const ROTATION_EPOCH = DateTime.fromISO("2026-06-11", { zone: "utc" })

const weeksSinceEpoch = (now: DateTime): number =>
	Math.round(now.startOf("week").diff(ROTATION_EPOCH.startOf("week"), "weeks").weeks)

// Epoch-based so year boundaries (week 52→1, week 53→1) don't break parity.
export const isFirstWeekOfCadence = (now: DateTime): boolean =>
	((weeksSinceEpoch(now) % 2) + 2) % 2 === 0

// Ordered list of Slack user IDs in rotation order.
// Requires a PR to change — intentional for auditability.
export const RELEASE_CAPTAINS: string[] = [
	"URE5S7BBN", // @brian.b
	"U01RRGTBMU3", // @ole
	"U02CNMURE7R", // @sultan
	"U01427GSPK9", // @mounir
	"U023RJ49TUN", // @george
	"U02HAF8J1QV", // @daria
	"U02DTPDPGTA", // @carlos
]

export const CAPTAIN_DOCS_URL =
	"https://www.notion.so/artsy/Release-Captain-Tasks-7ca3e6f5d16e41079a1fb1b1706bd018" // link to your captain runbook

export const getCurrentCaptainIndex = (now: DateTime): number => {
	const n = RELEASE_CAPTAINS.length
	return ((Math.floor(weeksSinceEpoch(now) / 2) % n) + n) % n
}

export const getNextCaptainIndex = (now: DateTime): number => {
	const n = RELEASE_CAPTAINS.length
	return (getCurrentCaptainIndex(now) + 1) % n
}
