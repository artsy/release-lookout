import * as dotenv from "dotenv"
dotenv.config()

import { sendReleaseReminder } from "./release-reminders"

sendReleaseReminder()
