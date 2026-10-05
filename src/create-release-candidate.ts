import * as dotenv from "dotenv"
dotenv.config()

import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { generateChangelogMarkdown } from "./changelog"
import { isFirstWeekOfCadence } from "./constants"
import { github } from "./github"

const SLACK_CHANNEL = process.env.SLACK_CHANNEL ?? ""

const web = new WebClient(process.env.SLACK_TOKEN)

export const createReleaseCandidate = async () => {
	const now = DateTime.now()
	const isFriday = now.weekday === 5
	if (!isFriday) {
		console.log("Not RC creation day (not Friday).")
		return
	}
	if (!isFirstWeekOfCadence(now)) {
		console.log("Not RC creation day (not first week of cadence).")
		return
	}

	console.log("Fetching version from eigen's app.json...")
	const appJsonFile = await github<{ content: string }>(
		"https://api.github.com/repos/artsy/eigen/contents/app.json?ref=main"
	)
	const appJson = JSON.parse(Buffer.from(appJsonFile.content, "base64").toString())
	const version: string = appJson.version ?? appJson.expo?.version
	if (!version) throw new Error("Could not find version in app.json")

	const branchName = `rc-v${version}`
	console.log(`Creating RC branch: ${branchName}`)

	const mainRef = await github<{ object: { sha: string } }>(
		"https://api.github.com/repos/artsy/eigen/git/ref/heads/main"
	)
	const sha = mainRef.object.sha

	await github("https://api.github.com/repos/artsy/eigen/git/refs", {
		method: "POST",
		body: JSON.stringify({ ref: `refs/heads/${branchName}`, sha }),
	})

	const commit = await github<{ tree: { sha: string } }>(
		`https://api.github.com/repos/artsy/eigen/git/commits/${sha}`
	)

	const emptyCommit = await github<{ sha: string }>(
		"https://api.github.com/repos/artsy/eigen/git/commits",
		{
			method: "POST",
			body: JSON.stringify({
				message: `chore: open release candidate ${version}`,
				tree: commit.tree.sha,
				parents: [sha],
			}),
		}
	)

	await github(`https://api.github.com/repos/artsy/eigen/git/refs/heads/${branchName}`, {
		method: "PATCH",
		body: JSON.stringify({ sha: emptyCommit.sha }),
	})

	// Best-effort: a changelog failure must never block RC creation.
	let changelog: string | null = null
	try {
		changelog = await generateChangelogMarkdown(version)
	} catch (error) {
		console.error("Failed to generate changelog (continuing without it):", error)
	}

	const body = [
		`## Release Candidate ${version}`,
		``,
		`This branch was automatically created as the release candidate for version ${version}.`,
		``,
		`> ⚠️ Do not merge this PR. It is used for tracking the release and 🍒 cherry-picking fixes only.`,
		...(changelog ? [``, `## Changelog`, ``, changelog] : []),
		``,
		`#nochangelog`,
	].join("\n")

	const pr = await github<{ number: number; html_url: string }>(
		"https://api.github.com/repos/artsy/eigen/pulls",
		{
			method: "POST",
			body: JSON.stringify({
				title: `chore(release): v${version} RC`,
				head: branchName,
				base: "main",
				body,
			}),
		}
	)

	await github(`https://api.github.com/repos/artsy/eigen/issues/${pr.number}/labels`, {
		method: "POST",
		body: JSON.stringify({ labels: ["Do not merge"] }),
	})

	await web.chat.postMessage({
		channel: SLACK_CHANNEL,
		text: `🥶🥶 Code freeze Release candidate branch \`${branchName}\` has been created in eigen! PR: ${pr.html_url}`,
	})

	console.log(`Successfully created RC branch ${branchName} and PR #${pr.number}`)
}

// Prevents auto-execution when imported in tests
if (require.main === module) {
	createReleaseCandidate().catch((error) => {
		console.error("Error creating release candidate:", error)
		process.exit(1)
	})
}
