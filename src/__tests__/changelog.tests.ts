import {
	compareVersions,
	extractPrNumbers,
	generateChangelogMarkdown,
	pickPreviousRcBranch,
	renderChangelog,
} from "../changelog"

const mockFetch = jest.fn()
global.fetch = mockFetch

describe("compareVersions", () => {
	it("orders numerically, not lexically", () => {
		expect(compareVersions("9.8.0", "9.12.0")).toBeLessThan(0)
		expect(compareVersions("9.12.0", "9.8.0")).toBeGreaterThan(0)
		expect(compareVersions("9.8.0", "9.8.0")).toBe(0)
		expect(compareVersions("10.0.0", "9.99.99")).toBeGreaterThan(0)
	})
})

describe("pickPreviousRcBranch", () => {
	const refs = [
		"refs/heads/rc-v9.8.0",
		"refs/heads/rc-v9.12.0",
		"refs/heads/rc-v9.10.0",
		"refs/heads/main",
		"refs/heads/some-feature",
	]

	it("picks the highest version strictly older than the current one", () => {
		expect(pickPreviousRcBranch(refs, "9.12.0")).toBe("rc-v9.10.0")
	})

	it("excludes the current version", () => {
		expect(pickPreviousRcBranch(["refs/heads/rc-v9.12.0"], "9.12.0")).toBeNull()
	})

	it("returns null when there is no older rc branch", () => {
		expect(pickPreviousRcBranch(["refs/heads/main"], "9.12.0")).toBeNull()
		expect(pickPreviousRcBranch(["refs/heads/rc-v9.13.0"], "9.12.0")).toBeNull()
	})
})

describe("extractPrNumbers", () => {
	it("extracts squash-merge and merge-commit PR numbers and de-duplicates in order", () => {
		expect(
			extractPrNumbers([
				"feat: add thing (#101)",
				"Merge pull request #102 from artsy/branch",
				"chore: noise without a number",
				"fix: again (#101)", // dupe
				"fix: another (#103)",
			])
		).toEqual([101, 102, 103])
	})
})

describe("renderChangelog", () => {
	it("groups by section in fixed order, uses ### headers, and attributes author + PR", () => {
		const md = renderChangelog({
			crossPlatformUserFacingChanges: [{ entry: "Cross thing", author: "alice", prNumber: 1 }],
			iOSUserFacingChanges: [{ entry: "iOS thing", author: "bob", prNumber: 2 }],
			androidUserFacingChanges: [],
			devChanges: [{ entry: "Dev thing", author: "carol", prNumber: 3 }],
		})
		expect(md).toBe(
			[
				"### Cross-platform user-facing changes",
				"- Cross thing — alice (#1)",
				"",
				"### iOS user-facing changes",
				"- iOS thing — bob (#2)",
				"",
				"### Dev changes",
				"- Dev thing — carol (#3)",
			].join("\n")
		)
		expect(md).not.toContain("#### ")
	})

	it("returns null when there are no entries", () => {
		expect(
			renderChangelog({
				crossPlatformUserFacingChanges: [],
				iOSUserFacingChanges: [],
				androidUserFacingChanges: [],
				devChanges: [],
			})
		).toBeNull()
	})
})

describe("generateChangelogMarkdown", () => {
	beforeEach(() => {
		jest.clearAllMocks()
		jest.spyOn(console, "log").mockImplementation(() => {})
	})

	afterEach(() => jest.restoreAllMocks())

	it("returns null when there is no previous RC branch", async () => {
		mockFetch.mockResolvedValueOnce({
			ok: true,
			json: async () => [{ ref: "refs/heads/rc-v9.12.0" }],
		})

		expect(await generateChangelogMarkdown("9.12.0")).toBeNull()
		expect(mockFetch).toHaveBeenCalledTimes(1)
	})

	it("builds changelog markdown from the PRs between the previous RC branch and main", async () => {
		mockFetch
			.mockResolvedValueOnce({
				ok: true,
				json: async () => [{ ref: "refs/heads/rc-v9.11.0" }, { ref: "refs/heads/rc-v9.12.0" }],
			}) // matching-refs -> previous = rc-v9.11.0
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					total_commits: 2,
					commits: [
						{ commit: { message: "feat: shiny thing (#101)" } },
						{ commit: { message: "chore: skip me (#102)" } },
					],
				}),
			}) // compare
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({
					body: "### Changelog updates\n#### iOS user-facing changes\n- Fixed input focus styles",
					user: { login: "alice" },
				}),
			}) // PR 101
			.mockResolvedValueOnce({
				ok: true,
				json: async () => ({ body: "#nochangelog", user: { login: "bob" } }),
			}) // PR 102 -> skipped

		const md = await generateChangelogMarkdown("9.12.0")

		expect(md).toBe("### iOS user-facing changes\n- Fixed input focus styles — alice (#101)")
		expect(mockFetch).toHaveBeenCalledTimes(4)
		const comparedUrl = mockFetch.mock.calls[1][0].toString()
		expect(comparedUrl).toContain("/compare/rc-v9.11.0...main")
	})
})
