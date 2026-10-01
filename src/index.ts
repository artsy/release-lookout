import * as dotenv from "dotenv"
dotenv.config()

import { DateTime } from "luxon"
import { sendReleaseReminder } from "./release-reminders"

// TEMP: run as tomorrow (Friday) for the Thu 2026-10-01 one-off. Revert on Friday.
sendReleaseReminder(DateTime.now().plus({ days: 1 }))
