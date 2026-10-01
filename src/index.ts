import * as dotenv from "dotenv"
dotenv.config()

import { currentTime } from "./constants"
import { sendReleaseReminder } from "./release-reminders"

sendReleaseReminder(currentTime())
