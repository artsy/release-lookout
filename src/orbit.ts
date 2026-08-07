import { DateTime } from "luxon"

/**
 * Orbit integration.
 *
 * Orbit (github.com/artsy/orbit) is Artsy's on-call rotation scheduler and is
 * the sole source of truth for the Release Captain rotation — there is no
 * local fallback. ORBIT_URL and ORBIT_ROTATION_ID are required; resolveCaptains
 * throws immediately if either is unset, and throws if the Orbit lookup fails,
 * rather than silently degrading.
 *
 *   ORBIT_URL          e.g. https://orbit.artsy.net
 *   ORBIT_ROTATION_ID  the Release Captain rotation's id
 *   ORBIT_TOKEN        a service token (see the note on auth below)
 *
 * NOTE ON AUTH: Orbit's API currently requires an interactive next-auth session
 * (Gravity `team` role), which a headless bot can't obtain. Using Orbit from
 * here needs Orbit to accept a service token for read access — that's the main
 * adjustment tracked on the Orbit side.
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

interface OrbitConfig {
	url: string
	rotationId: string
	token?: string
}

const requireConfig = (): OrbitConfig => {
	const url = process.env.ORBIT_URL
	const rotationId = process.env.ORBIT_ROTATION_ID
	if (!url || !rotationId) {
		throw new Error(
			"Orbit is not configured: ORBIT_URL and ORBIT_ROTATION_ID must both be set."
		)
	}
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

/**
 * Ask Orbit who's on call now and next, mapped to Slack user IDs. Returns
 * `null` when the lookup fails or Orbit's data doesn't resolve to two Slack
 * IDs.
 */
export const resolveCaptainsFromOrbit = async (
	now: DateTime,
	config: OrbitConfig
): Promise<Captains | null> => {
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
		console.error("Orbit lookup failed.", error)
		return null
	}
}

export const resolveCaptains = async (now: DateTime): Promise<Captains> => {
	const config = requireConfig() // fail fast, before any I/O
	const captains = await resolveCaptainsFromOrbit(now, config)
	if (!captains) {
		throw new Error("Orbit lookup failed to resolve current/next captain.")
	}
	return captains
}
