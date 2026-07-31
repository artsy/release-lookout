import { DateTime } from "luxon"
import {
	RELEASE_CAPTAINS,
	getCurrentCaptainIndex,
	getNextCaptainIndex,
} from "./constants"

/**
 * Orbit integration (proof of concept).
 *
 * Orbit (github.com/artsy/orbit) is Artsy's on-call rotation scheduler. Instead
 * of hardcoding the captain list + rotation math in `constants.ts`, we can ask
 * Orbit who is on call — and get overrides/shift-swaps applied for free.
 *
 * This module fetches Orbit's computed schedule for the "Release Captain"
 * rotation and returns the current + next captain as Slack user IDs. It is
 * OPT-IN via env vars and falls back to the local `constants.ts` math when
 * unset, so behaviour is unchanged until Orbit is wired up:
 *
 *   ORBIT_URL          e.g. https://orbit.artsy.net
 *   ORBIT_ROTATION_ID  the Release Captain rotation's id
 *   ORBIT_TOKEN        a service token (see the note on auth below)
 *
 * NOTE ON AUTH: Orbit's API currently requires an interactive next-auth session
 * (Gravity `team` role), which a headless bot can't obtain. Using Orbit from
 * here needs Orbit to accept a service token for read access — that's the main
 * adjustment tracked on the Orbit side. Until then, leave the env vars unset
 * and this module no-ops to the local fallback.
 */

// Minimal shapes of the bits of Orbit's `GET /api/rotations/[id]/schedule`
// response we consume (see Orbit's `ScheduleResponse` / `Engineer`).
interface OrbitEngineer {
	id: string
	slackUserId: string | null
}

interface OrbitScheduleEntry {
	periodStart: string // ISO
	periodEnd: string // ISO (exclusive)
	effectiveEngineerId: string | null
}

export interface Captains {
	current: string
	next: string
}

const readConfig = () => {
	const url = process.env.ORBIT_URL
	const rotationId = process.env.ORBIT_ROTATION_ID
	if (!url || !rotationId) return null
	return { url, rotationId, token: process.env.ORBIT_TOKEN }
}

const authHeaders = (token?: string): Record<string, string> =>
	token ? { Authorization: `Bearer ${token}` } : {}

const fetchJson = async <T>(url: string, token?: string): Promise<T> => {
	const res = await fetch(url, { headers: authHeaders(token) })
	if (!res.ok) {
		throw new Error(`Orbit request failed (${res.status}): ${url}`)
	}
	return (await res.json()) as T
}

/** The local, hardcoded fallback — the behaviour that shipped before Orbit. */
export const resolveCaptainsLocally = (now: DateTime): Captains => ({
	current: RELEASE_CAPTAINS[getCurrentCaptainIndex(now)],
	next: RELEASE_CAPTAINS[getNextCaptainIndex(now)],
})

/**
 * Ask Orbit who's on call now and next, mapped to Slack user IDs. Returns
 * `null` when Orbit isn't configured or the lookup fails, so callers can fall
 * back to the local math.
 */
export const resolveCaptainsFromOrbit = async (
	now: DateTime
): Promise<Captains | null> => {
	const config = readConfig()
	if (!config) return null

	try {
		const start = now.toUTC().toISO()
		// Two cadences ahead is plenty to always contain "current" and "next".
		const end = now.plus({ weeks: 4 }).toUTC().toISO()

		const schedule = await fetchJson<{ entries: OrbitScheduleEntry[] }>(
			`${config.url}/api/rotations/${config.rotationId}/schedule?start=${encodeURIComponent(
				start ?? ""
			)}&end=${encodeURIComponent(end ?? "")}`,
			config.token
		)
		const engineers = await fetchJson<OrbitEngineer[]>(
			`${config.url}/api/engineers`,
			config.token
		)

		const slackIdByEngineer = new Map(
			engineers.map((e) => [e.id, e.slackUserId])
		)

		const sorted = [...schedule.entries].sort(
			(a, b) =>
				DateTime.fromISO(a.periodStart).toMillis() -
				DateTime.fromISO(b.periodStart).toMillis()
		)
		const nowMs = now.toMillis()
		const currentIndex = sorted.findIndex(
			(e) =>
				DateTime.fromISO(e.periodStart).toMillis() <= nowMs &&
				nowMs < DateTime.fromISO(e.periodEnd).toMillis()
		)
		if (currentIndex === -1) return null

		const currentSlack = slackIdByEngineer.get(
			sorted[currentIndex].effectiveEngineerId ?? ""
		)
		const nextSlack = slackIdByEngineer.get(
			sorted[currentIndex + 1]?.effectiveEngineerId ?? ""
		)
		if (!currentSlack || !nextSlack) return null

		return { current: currentSlack, next: nextSlack }
	} catch (error) {
		console.error("Orbit lookup failed; falling back to local rotation.", error)
		return null
	}
}

/** Prefer Orbit when configured; otherwise use the local `constants.ts` math. */
export const resolveCaptains = async (now: DateTime): Promise<Captains> =>
	(await resolveCaptainsFromOrbit(now)) ?? resolveCaptainsLocally(now)
