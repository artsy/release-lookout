import { DateTime } from "luxon"
import { createReleaseCandidate } from "../create-release-candidate"

jest.mock("dotenv", () => ({ config: jest.fn() }))

jest.mock("@slack/web-api", () => ({
	WebClient: jest.fn().mockImplementation(() => ({
		chat: { postMessage: jest.fn().mockResolvedValue({}) },
	})),
}))

const mockFetch = jest.fn()
global.fetch = mockFetch

// 2026-05-01: Friday, week 18 (even = RC week when firstWeekOfCadenceIsEvenWeek=true)
const RC_FRIDAY = DateTime.fromISO("2026-05-01") as DateTime<true>
// 2026-04-24: Friday, week 17 (odd = non-RC week)
const NON_RC_FRIDAY = DateTime.fromISO("2026-04-24") as DateTime<true>
// 2026-04-27: Monday, week 18
const RC_MONDAY = DateTime.fromISO("2026-04-27") as DateTime<true>

const appJsonContent = Buffer.from(JSON.stringify({ version: "9.8.0" })).toString("base64")

const mockSuccessfulGithubCalls = () => {
	mockFetch
		.mockResolvedValueOnce({ ok: true, json: async () => ({ content: appJsonContent }) }) // GET app.json
		.mockResolvedValueOnce({ ok: true, json: async () => ({ object: { sha: "abc123" } }) }) // GET main ref
		.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST create branch
		.mockResolvedValueOnce({ ok: true, json: async () => ({ tree: { sha: "tree123" } }) }) // GET commit
		.mockResolvedValueOnce({ ok: true, json: async () => ({ sha: "newcommit123" }) }) // POST empty commit
		.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // PATCH branch ref
		.mockResolvedValueOnce({ ok: true, json: async () => ({ number: 123, html_url: "https://github.com/artsy/eigen/pull/123" }) }) // POST PR
		.mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // POST labels
}

describe("createReleaseCandidate", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		jest.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => {
		jest.restoreAllMocks()
	})

	it("exits early when it is not Friday", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(RC_MONDAY)

		await createReleaseCandidate()

		expect(console.log).toHaveBeenCalledWith("Not RC creation day (not Friday).")
		expect(mockFetch).not.toHaveBeenCalled()
	})

	it("exits early when it is not the first week of cadence", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(NON_RC_FRIDAY)

		await createReleaseCandidate()

		expect(console.log).toHaveBeenCalledWith("Not RC creation day (not first week of cadence).")
		expect(mockFetch).not.toHaveBeenCalled()
	})

	it("creates RC branch, PR and sends Slack notification on RC Friday", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(RC_FRIDAY)
		mockSuccessfulGithubCalls()

		await createReleaseCandidate()

		expect(mockFetch).toHaveBeenCalledTimes(8)
		expect(console.log).toHaveBeenCalledWith(
			"Successfully created RC branch rc-v9.8.0 and PR #123"
		)
	})

	it("creates a PR with the correct title and body", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(RC_FRIDAY)
		mockSuccessfulGithubCalls()

		await createReleaseCandidate()

		const prCall = mockFetch.mock.calls.find((call) =>
			call[0].toString().includes("/pulls")
		)
		const prBody = JSON.parse(prCall[1].body)
		expect(prBody.title).toBe("chore(release): v9.8.0 RC")
		expect(prBody.body).toContain("#nochangelog")
		expect(prBody.body).toContain("⚠️")
	})

	it("throws when version cannot be found in app.json", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(RC_FRIDAY)
		const emptyAppJson = Buffer.from(JSON.stringify({})).toString("base64")
		mockFetch.mockResolvedValueOnce({ ok: true, json: async () => ({ content: emptyAppJson }) })

		await expect(createReleaseCandidate()).rejects.toThrow("Could not find version in app.json")
	})

	it("throws when GitHub API returns an error", async () => {
		jest.spyOn(DateTime, "now").mockReturnValue(RC_FRIDAY)
		mockFetch.mockResolvedValueOnce({
			ok: false,
			status: 401,
			text: async () => "Bad credentials",
		})

		await expect(createReleaseCandidate()).rejects.toThrow("GitHub API error 401")
	})
})
