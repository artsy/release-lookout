import * as dotenv from "dotenv"
dotenv.config()

import { DateTime } from "luxon"
import { sendReleaseReminder } from "./release-reminders"

/**
 * Manually trigger a reminder for a given date.
 * Usage: npx ts-node src/test-send.ts [YYYY-MM-DD]  (defaults to today if omitted)
 *
 * Use #bot-testing to avoid spamming #practice-mobile channel.
 * To inspect output without posting to Slack, add a console.log in sendReleaseReminder
 * and comment out the web.chat.postMessage calls.
 */
const dateArg = process.argv[2]
const date = dateArg ? DateTime.fromISO(dateArg, { zone: "local" }) : DateTime.now()

if (!date.isValid) {
  console.error(`Invalid date: ${dateArg}`)
  process.exit(1)
}

console.log(`Simulating: ${date.toISODate()} (${date.weekdayLong}, week ${date.weekNumber})`)
sendReleaseReminder(date)
