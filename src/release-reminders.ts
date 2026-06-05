import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { assertNever } from "assert-never"
import {
	isFirstWeekOfCadence,
	RELEASE_CAPTAINS,
	CAPTAIN_DOCS_URL,
	getCurrentCaptainIndex,
	getNextCaptainIndex,
} from "./constants"

const web = new WebClient(process.env.SLACK_TOKEN)

const CHANNEL = process.env.SLACK_CHANNEL ?? ""

type Task =
	| "skip"
	| "recent-and-applause"
	| "feedback-form"
	| "release-notes-reminder"

export const sendReleaseReminder = async (now = DateTime.now()) => {
	try {
		const isWednesday = now.weekday === 3
		const isThursday = now.weekday === 4
		const isFriday = now.weekday === 5
		const isSecondWeekOfCadence = !isFirstWeekOfCadence(now)

		// MAIN LOGIC START
		let task: Task = "skip"
		let sendCaptainOnboarding = false
		if (isFirstWeekOfCadence(now) && isFriday) {
			task = "recent-and-applause"
		}
		if (isSecondWeekOfCadence && isWednesday) {
			task = "feedback-form"
		}
		if (isSecondWeekOfCadence && isThursday) {
			sendCaptainOnboarding = true
		}
		if (isFirstWeekOfCadence(now) && isThursday) {
			task = "release-notes-reminder"
		}

		if (task === "skip" && !sendCaptainOnboarding) {
			console.log("All good for today.")
			return
		}
		// MAIN LOGIC END

		if (task !== "skip") {
			const captainId = RELEASE_CAPTAINS[getCurrentCaptainIndex(now)]

			let text = `Captain <@${captainId}> 🫡, don't forget to ${await taskText(
				task,
				now.weekNumber
			)} today! ✨`

			if (task === "release-notes-reminder") {
				text = `${await taskText(task, now.weekNumber)}` // no need to mention the captain here
			}

			await web.chat.postMessage({
				channel: CHANNEL,
				text,
			})
		}

		if (sendCaptainOnboarding) {
			const nextCaptainId = RELEASE_CAPTAINS[getNextCaptainIndex(now)]
			await web.chat.postMessage({
				channel: CHANNEL,
				text: `Hey <@${nextCaptainId}>! Your Release Captain rotation starts tomorrow. Here's everything you need to know: ${CAPTAIN_DOCS_URL}`,
			})
			await web.conversations.setTopic({
				channel: CHANNEL,
				topic: `Captain: <@${nextCaptainId}>`,
			})
			console.log(`Updated channel topic to incoming captain <@${nextCaptainId}>.`)
		}

		console.log("Successfully sent reminder.")
	} catch (error) {
		console.error("Error while sending reminder. See below:")
		console.error({ error })
	}
}

const getGroupHandles = async () => {
	// add or edit the team handles here
	const teamHandles = [
		"george", // --- IGNORE --- replace with real handles before deploying
		// "mp-pals",
		// "emerald-devs",
		// "topaz-devs",
		// "onyx-devs",
		// "diamond-devs",
	]

	const groups = (await web.usergroups.list()).usergroups?.map((g) => ({
		id: g.id,
		handle: g.handle,
	}))

	const groupIds = teamHandles.map((handle) => {
		const groupId = groups?.find((g) => g.handle === handle)?.id
		return `<!subteam^${groupId}>`
	})

	return groupIds.join(" ")
}

const taskText = async (task: Task, weekNumber: number) => {
	switch (task) {
		case "skip":
			return "relax" // this will not show anyway
		case "recent-and-applause":
			return getApplauseTaskText(weekNumber)
		case "feedback-form":
			return "tell us how long the release took, because we are trying to optimize. Fill out this form: https://docs.google.com/forms/d/e/1FAIpQLSdfQlgk562b_Rmgz0PlFQi5a6NEELicTAXvZVPYA0nHEXMALA/viewform"
		case "release-notes-reminder":
			return `:wave: We are getting ready to release a new version of the Artsy mobile app! Tomorrow is codefreeze day 🥶. If you have any features you would like to be called out in the new version release notes please add them in the thread 👇🧵! \n You can find tips on formating release notes <https://docs.google.com/spreadsheets/d/1NK23Q1QwMxs6hucIrtZQ_s2mFpH62wEsspht7YS2_t8/edit#gid=172454703|here>. \n${await getGroupHandles()}`
		default:
			assertNever(task)
	}
}

export const getApplauseTaskText = (weekNumber: number): string => {
	const releaseNumber = Math.floor((weekNumber - 1) / 2) + 1
	const currentCycleIndex = (releaseNumber - 1) % 4 // 0-indexed cycle count
	const testSuite = currentCycleIndex < 2 ? "Test Suite 1" : "Test Suite 2"
	const platform = currentCycleIndex % 2 === 0 ? "Android" : "iOS"
	return `set up Recent Changes QA and Request Applause QA for the ${platform} app using ${testSuite}`
}
