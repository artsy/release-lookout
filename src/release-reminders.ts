import { WebClient } from "@slack/web-api"
import { DateTime } from "luxon"
import { assertNever } from "assert-never"

const web = new WebClient(process.env.SLACK_TOKEN)

const firstWeekOfCadenceIsEvenWeek = true // flip this if the bot is notifying on the wrong weeks

const CHANNEL = process.env.SLACK_CHANNEL ?? ""

type Task = "recent-and-applause" | "feedback-form" | "release-notes-reminder"

export const sendReleaseReminder = async () => {
	try {
		const now = DateTime.now()
		const isWednesday = now.weekday === 3
		const isThursday = now.weekday === 4
		const isFirstWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1)
		const isSecondWeekOfCadence =
			(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1) ||
			(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0)

		// MAIN LOGIC START
		let tasks: Task[] = []
		if (isFirstWeekOfCadence && isThursday) {
			tasks = ["release-notes-reminder", "recent-and-applause"]
		}
		if (isSecondWeekOfCadence && isWednesday) {
			tasks = ["feedback-form"]
		}

		if (tasks.length === 0) {
			console.log("All good for today.")
			return
		}
		// MAIN LOGIC END

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

		for (const task of tasks) {
			let text: string
			if (task === "release-notes-reminder") {
				text = `${await taskText(task, now.weekNumber)}` // no need to mention the captain here
			} else {
				text = captain
					? `Captain <@${captain}> 🫡, don't forget to ${await taskText(
							task,
							now.weekNumber
					  )} today! ✨`
					: `There is no Release Captain set <@${george}> <@${brian}>! Make sure to add one on the channel's topic. Someone should ${await taskText(
							task,
							now.weekNumber
					  )} today!`
			}

			await web.chat.postMessage({
				channel: CHANNEL,
				text,
			})
			console.log(`Successfully sent reminder: ${task}`)
		}
	} catch (error) {
		console.error("Error while sending reminder. See below:")
		console.error({ error })
	}
}

const getGroupHandles = async () => {
	// add or edit the team handles here
	const teamHandles = [
		"mp-pals",
		"emerald-devs",
		"topaz-devs",
		"onyx-devs",
		"diamond-devs",
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
