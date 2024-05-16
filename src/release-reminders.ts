import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { assertNever } from "assert-never"

const web = new WebClient(process.env.SLACK_TOKEN)

const firstWeekOfCadenceIsEvenWeek = false // flip this if the bot is notifying on the wrong weeks

const CHANNEL = process.env.SLACK_CHANNEL ?? ""

type Task =
	| "skip"
	| "recent-and-applause"
	| "feedback-form"
	| "update-android-rollout-50"
	| "update-android-rollout-100"
	| "release-notes-reminder"

export const sendReleaseReminder = async () => {
	try {
		const now = DateTime.now()
		const isMonday = now.weekday === 1
		const isWednesday = now.weekday === 3
		const isThursday = now.weekday === 4
		const isFriday = now.weekday === 5
		const isFirstWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1)
		const isSecondWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0)

		// MAIN LOGIC START
		let task: Task = "skip"
		if (isFirstWeekOfCadence && isFriday) {
			task = "recent-and-applause"
		}
		if (isSecondWeekOfCadence && isWednesday) {
			task = "feedback-form"
		}
		if (isSecondWeekOfCadence && isFriday) {
			task = "update-android-rollout-50"
		}
		if (isFirstWeekOfCadence && isThursday) {
			task = "release-notes-reminder"
		}
		// this is the third week of the release
		if (isFirstWeekOfCadence && isMonday) {
			task = "update-android-rollout-100"
		}

		if (task === "skip") {
			console.log("All good for today.")
			return
		}
		// MAIN LOGIN END

		const info = await web.conversations.info({
			channel: CHANNEL,
		})
		const topic = info.channel?.topic?.value ?? ""

		const regexp = /Captain: <@(.*)>/
		const match = topic.match(regexp)
		const captain = match ? match[1] : null

		const users = (await web.users.list()).members!.map((m) => ({
			id: m.id,
			displayName: m.profile?.display_name ?? "",
		}))

		const george = users.find((m) => m.displayName === "george")?.id ?? ""
		const brian = users.find((m) => m.displayName === "brian.b")?.id ?? ""

		let text = captain
			? `Captain <@${captain}> 🫡, don't forget to ${taskText(
					task,
					now.weekNumber
			  )} today! ✨`
			: `There is no Release Captain set <@${george}> <@${brian}>! Make sure to add one on the channel's topic. Someone should ${taskText(
					task,
					now.weekNumber
			  )} today!`

		if (task === "release-notes-reminder") {
			text = `${taskText(task, now.weekNumber)}` // no need to mention the captain here
		}

		await web.chat.postMessage({
			channel: CHANNEL,
			text,
		})
		console.log("Successfully sent reminder.")
	} catch (error) {
		console.error("Error while sending reminder. See below:")
		console.error({ error })
	}
}

const taskText = (task: Task, weekNumber: number) => {
	switch (task) {
		case "skip":
			return "relax" // this will not show anyway
		case "recent-and-applause":
			return getApplauseTaskText(weekNumber)
		case "feedback-form":
			return "tell us how long the release took, because we are trying to optimize. Fill out this form: https://docs.google.com/forms/d/e/1FAIpQLSdfQlgk562b_Rmgz0PlFQi5a6NEELicTAXvZVPYA0nHEXMALA/viewform"
		case "update-android-rollout-50":
			return "update the Android rollout to 50% in the Play Store"
		case "update-android-rollout-100":
			return "update the Android rollout to 100% in the Play Store"
		case "release-notes-reminder":
			return ":wave: We are getting ready to release a new version of the Artsy mobile app! Tomorrow is codefreeze day 🥶. If you have any features you would like to be called out in the new version release notes please add them in the thread 👇🧵! \n You can find tips on formating release notes <https://docs.google.com/spreadsheets/d/1NK23Q1QwMxs6hucIrtZQ_s2mFpH62wEsspht7YS2_t8/edit#gid=172454703|here>."
		default:
			assertNever(task)
	}
}

const getApplauseTaskText = (weekNumber: number): string => {
	const currentCycleIndex = (weekNumber - 1) % 4 // 0-indexed cycle count
	const testSuite = currentCycleIndex < 2 ? "Test Suite 1" : "Test Suite 2"
	const platform = currentCycleIndex % 2 === 0 ? "Android" : "iOS"
	return `set up Recent Changes QA and Request Applause QA for the ${platform} app using ${testSuite}`
}

// some calculations :D
//
// firstIsEven true
// 2 mon tue FRI
// 3 MON tue fri
//
// firstIsEven false
// 1 mon tue FRI
// 2 MON tue fri
//
