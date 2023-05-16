import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { assertNever } from "assert-never"

const web = new WebClient(process.env.SLACK_TOKEN)

const firstWeekOfCadenceIsEvenWeek = false // flip this if the bot is notifying on the wrong weeks

const CHANNEL = "C02BAQ5K7" // #practice-mobile
// const CHANNEL = "C012K7XU4LE" // #bot-testing

type Task =
	| "skip"
	| "recent-and-applause"
	| "feedback-form"
	| "update-android-rollout-50"
	| "update-android-rollout-100"

export const sendReleaseReminder = async () => {
	try {
		const now = DateTime.now()
		const isMonday = now.weekday === 1
		const isTuesday = now.weekday === 2
		const isWednesday = now.weekday === 3
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
		const pavlos = users.find((m) => m.displayName === "pavlos")?.id ?? ""
		const brian = users.find((m) => m.displayName === "brian.b")?.id ?? ""

		const text = captain
			? `Captain <@${captain}> 🫡, don't forget to ${taskText(task)} today! ✨`
			: `There is no Release Captain set <@${pavlos}> <@${brian}>! Make sure to add one on the channel's topic. Someone should ${taskText(
					task
			  )} today!`

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

const taskText = (task: Task) => {
	switch (task) {
		case "skip":
			return "relax" // this will not show anyway
		case "recent-and-applause":
			return "set up Recent Changes QA and Request Applause QA"
		case "feedback-form":
			return "tell us how long the release took, because we are trying to optimize. Fill out this form: https://docs.google.com/forms/d/e/1FAIpQLSdfQlgk562b_Rmgz0PlFQi5a6NEELicTAXvZVPYA0nHEXMALA/viewform"
		case "update-android-rollout-50":
			return "update the Android rollout to 50% in the Play Store"
		case "update-android-rollout-100":
			return "update the Android rollout to 100% in the Play Store"
		default:
			assertNever(task)
	}
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
