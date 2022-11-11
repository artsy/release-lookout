import { WebClient } from "@slack/web-api"

const web = new WebClient(process.env.SLACK_TOKEN)

const CHANNEL = "C012K7XU4LE" // bot-testing

export const sendReleaseReminder = async () => {
	try {
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
			? `Hey <@${captain}>, time to do releases!`
			: `There is no captain, and there are releases to be done! <@${pavlos}>`

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
