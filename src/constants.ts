import { DateTime } from "luxon"

export const firstWeekOfCadenceIsEvenWeek = true // flip this if the bot is running on the wrong weeks
export const isFirstWeekOfCadence = (now: DateTime): boolean =>
	(firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 0) ||
	(!firstWeekOfCadenceIsEvenWeek && now.weekNumber % 2 === 1)
