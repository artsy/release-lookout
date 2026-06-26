import { changelogTemplateSections, parsePRDescription } from "@artsy/changelog"
import { github } from "./github"

const OWNER = "artsy"
const REPO = "eigen"
const PER_PAGE = 250

type SectionKey = keyof typeof changelogTemplateSections

// Fixed display order for the rendered changelog.
const SECTION_ORDER: SectionKey[] = [
	"crossPlatformUserFacingChanges",
	"iOSUserFacingChanges",
	"androidUserFacingChanges",
	"devChanges",
]

interface ChangelogEntry {
	entry: string
	author: string
	prNumber: number
}

type SectionedEntries = Record<SectionKey, ChangelogEntry[]>

const emptySections = (): SectionedEntries => ({
	crossPlatformUserFacingChanges: [],
	iOSUserFacingChanges: [],
	androidUserFacingChanges: [],
	devChanges: [],
})

// --- pure helpers (exported for tests) ---

export const parseVersion = (version: string): number[] =>
	version.split(".").map((part) => parseInt(part, 10) || 0)

// Numeric semver-ish comparison: negative if a < b, positive if a > b, 0 if equal.
export const compareVersions = (a: string, b: string): number => {
	const pa = parseVersion(a)
	const pb = parseVersion(b)
	const len = Math.max(pa.length, pb.length)
	for (let i = 0; i < len; i++) {
		const da = pa[i] ?? 0
		const db = pb[i] ?? 0
		if (da !== db) return da - db
	}
	return 0
}

// From a list of git ref names, pick the most recent `rc-v{version}` branch whose version is
// strictly older than `currentVersion` (the just-created current RC branch is excluded).
export const pickPreviousRcBranch = (refNames: string[], currentVersion: string): string | null => {
	const versions = refNames
		.map((ref) => ref.replace(/^refs\/heads\//, ""))
		.filter((name) => /^rc-v\d+(\.\d+)*$/.test(name))
		.map((name) => name.slice("rc-v".length))
		.filter((version) => compareVersions(version, currentVersion) < 0)
		.sort(compareVersions)

	if (versions.length === 0) return null
	return `rc-v${versions[versions.length - 1]}`
}

// Pull PR numbers out of commit messages (squash merges: `(#123)`, or merge commits).
export const extractPrNumbers = (messages: string[]): number[] => {
	const seen = new Set<number>()
	const result: number[] = []
	for (const message of messages) {
		const match = message.match(/\(#(\d+)\)/m) || message.match(/Merge pull request #(\d+)/m)
		if (!match) continue
		const prNumber = parseInt(match[1], 10)
		if (!seen.has(prNumber)) {
			seen.add(prNumber)
			result.push(prNumber)
		}
	}
	return result
}

export const renderChangelog = (sections: SectionedEntries): string | null => {
	const blocks: string[] = []
	for (const key of SECTION_ORDER) {
		const entries = sections[key]
		if (!entries || entries.length === 0) continue
		const lines = entries.map((e) => `- ${e.entry} — ${e.author} (#${e.prNumber})`)
		// Use `###` (not `####`) so this rendered summary can never be re-parsed as
		// changelog source by eigen's own tooling.
		blocks.push(`### ${changelogTemplateSections[key]}\n${lines.join("\n")}`)
	}
	if (blocks.length === 0) return null
	return blocks.join("\n\n")
}

// --- GitHub-fetching pipeline ---

interface GitRef {
	ref: string
}

interface CompareResponse {
	total_commits: number
	commits: Array<{ commit: { message: string } }>
}

interface PullResponse {
	body: string | null
	user: { login: string } | null
}

const fetchCommitMessages = async (base: string, head: string): Promise<string[]> => {
	const messages: string[] = []
	let page = 1
	let total = Infinity
	while (messages.length < total) {
		const compare = await github<CompareResponse>(
			`https://api.github.com/repos/${OWNER}/${REPO}/compare/${base}...${head}?per_page=${PER_PAGE}&page=${page}`
		)
		total = compare.total_commits
		for (const c of compare.commits) messages.push(c.commit.message)
		if (compare.commits.length === 0) break
		page++
	}
	return messages
}

// Builds the changelog markdown for the release `version` by diffing the previous RC branch
// against eigen's `main` and parsing the changelog sections out of each merged PR.
// Returns null when there is no previous RC branch or no changelog entries.
export const generateChangelogMarkdown = async (version: string): Promise<string | null> => {
	const refs = await github<GitRef[]>(
		`https://api.github.com/repos/${OWNER}/${REPO}/git/matching-refs/heads/rc-v`
	)
	const previousBranch = pickPreviousRcBranch(
		refs.map((r) => r.ref),
		version
	)
	if (!previousBranch) {
		console.log("No previous RC branch found; skipping changelog generation.")
		return null
	}

	console.log(`Generating changelog: ${previousBranch}...main`)
	const messages = await fetchCommitMessages(previousBranch, "main")
	const prNumbers = extractPrNumbers(messages)

	const sections = emptySections()
	for (const prNumber of prNumbers) {
		const pr = await github<PullResponse>(
			`https://api.github.com/repos/${OWNER}/${REPO}/pulls/${prNumber}`
		)
		const parsed = parsePRDescription(pr.body ?? "")
		if (parsed.type !== "changes") continue
		const author = pr.user?.login ?? "unknown"
		for (const key of SECTION_ORDER) {
			for (const entry of parsed[key]) {
				sections[key].push({ entry, author, prNumber })
			}
		}
	}

	return renderChangelog(sections)
}
