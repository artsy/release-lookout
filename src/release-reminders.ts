import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { assertNever } from "assert-never"

const web = new WebClient(process.env.SLACK_TOKEN)

const firstWeekOfCadenceIsEvenWeek = true // flip this if the bot is notifying on the wrong weeks

const CHANNEL = "C02BAQ5K7" // #practice-mobile
// const CHANNEL = "C012K7XU4LE" // #bot-testing

type Task = "recent-and-applause" | "applause-review" | "skip"

export const sendReleaseReminder = async () => {
	try {
		const now = DateTime.now()
		const isTuesday = now.weekday === 2
		const isFriday = now.weekday === 5
		const isFirstWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1)
		const isSecondWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0)

		let task: Task = "skip"
		if (isFirstWeekOfCadence && isFriday) {
			task = "recent-and-applause"
		}
		if (isSecondWeekOfCadence && isTuesday) {
			task = "applause-review"
		}

		if (task === "skip") {
			console.log("All good for today.")
			return
		}

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
		case "recent-and-applause":
			return "set up Recent Changes QA and Request Applause QA"
		case "applause-review":
			return "review Applause bugs and export them to the Applause Jira board"
		case "skip":
			return "relax" // this will not show anyway
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
