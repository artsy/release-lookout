<img src="assets/icon.png" width="100" />

# Release Lookout

The bot that drives Artsy's mobile release cadence. It reminds the Release Captain of the tasks
due on a given day, and cuts the release candidate itself on code-freeze day.

The captain-facing runbook is [Release Captain Tasks 🔐](https://app.notion.com/p/artsy/Release-Captain-Tasks-3b3cab0764a08079bba8ffd86843072a).

## Meta

- **Slack App Link:** https://api.slack.com/apps/A04BAKXR83S
- **Point People:** [@gkartalis](https://github.com/gkartalis)

## What it does

A single CircleCI job (`send_reminder`) runs at **10:00 UTC, Monday–Friday** (`.circleci/config.yml`)
and executes two scripts in order — `yarn send-reminder`, then `yarn create-rc`. Each one decides for
itself whether today is its day and no-ops otherwise, so most runs do nothing.

We release on a two-week cadence: code freeze on the **Friday of week 1**, submission on the
**Tuesday of week 2**.

| When | What happens | Script |
| --- | --- | --- |
| Thu, week 1 | Release-notes call-out in Slack, tagging every team handle (no captain mention) | `send-reminder` |
| Fri, week 1 | Reminder to set up Recent Changes QA + request Applause, naming **this cycle's platform and test suite** from the 4-release rotation | `send-reminder` |
| Fri, week 1 | Cuts `rc-v<version>` from eigen's `main`, opens the `chore(release): v<version> RC` PR labelled "Do not merge" with the generated changelog, posts the code-freeze message | `create-rc` |
| Wed, week 2 | Feedback-form nudge | `send-reminder` |
| Thu, week 2 | DMs the **incoming** captain the runbook link and sets the channel topic to `Captain: <@next>` | `send-reminder` |

Opening the RC PR is what triggers the rest of the release in eigen —
[`rc-release-automation.yml`](https://github.com/artsy/eigen/blob/main/.github/workflows/rc-release-automation.yml)
pushes the RC branch to `beta-ios`/`beta-android`, builds the four betas, then creates the Mobile App
QA document in Notion. Nothing about the betas or the QA doc lives in this repo.

### Cadence maths

`isFirstWeekOfCadence` in `src/constants.ts` is anchored to `ROTATION_EPOCH` rather than to ISO week
parity, so year boundaries (week 52→1, 53→1) don't flip the cadence. Everything aligns to
`startOf('week')` so Mon–Wed aren't miscounted against the Thursday epoch.

### Who's the captain

[Orbit](https://github.com/artsy/orbit) The rotation of the captains lives in orbit https://orbit.artsy.net/rotations/cms7oon4o0000s011fwzr9s1n, which gives us overrides and shift swaps.

You can also find the captain's name as a topic of the #practice-mobile channel.

## How to develop

- Run `yarn setup:artsy` to get your `.env` file set up (`yarn setup:artsy:update!` to refresh it —
  do this if `GITHUB_TOKEN` has expired, the usual cause of `create-rc` failing locally).
- Run `yarn install` to install deps.
- Run `yarn send-reminder` to send today's reminder, `yarn create-rc` to cut the release candidate.
- Run `yarn test` for the unit tests, which cover the cadence maths, the Applause rotation and the
  changelog generation.

Both scripts gate on the real date, so running them off-cadence just prints why they skipped. To
exercise the message paths, pass a `DateTime` to `sendReleaseReminder(now)` / use `src/test-send.ts`.

### Testing

By default messages go to the `#bot-testing` channel — add yourself there to see them.

## Uncommenting the manual workflow

`.circleci/config.yml` has a commented-out `release_cadence_manual` workflow that runs the job on
every push. Handy for debugging on a branch; don't merge it uncommented.

## Shifting the schedule (bank holidays)

Set these in the CircleCI project's environment variables (no code change or deploy needed):

| Variable | Meaning |
| --- | --- |
| `RELEASE_DAY_OFFSET` | Whole days to shift. `-1` runs the schedule a day earlier (Thursday behaves as Friday), `1` a day later. Default `0`. |
| `RELEASE_DAY_OFFSET_UNTIL` | Optional ISO date (inclusive). After it the offset is ignored, so it can't linger. |

**Example:** Friday 2026-10-09 is a bank holiday, so the Friday tasks (RC creation, applause reminder) should run on Thursday the 8th, and Thursday's tasks on Wednesday the 7th. Set:

```
RELEASE_DAY_OFFSET=-1
RELEASE_DAY_OFFSET_UNTIL=2026-10-08
```

The offset applies through the end of Thursday the 8th. From Friday the 9th on it is ignored automatically, so there is nothing to unset afterwards (you can still delete the variables to tidy up). Without `RELEASE_DAY_OFFSET_UNTIL`, the offset stays active until you remove it.

The offset applies to both reminders and RC creation. Orbit's captain lookup still uses the real date.

**Weekends and week boundaries**

- The cron only runs Monday–Friday, so tasks shifted onto a Saturday or Sunday never run (e.g. `1` would move Friday's tasks to Saturday and skip them). Use offsets that keep every task on a weekday.
- An offset that moves the schedule date across a Sunday/Monday boundary also changes which cadence week it counts as. Offsets of 1–2 days around a normal Thursday/Friday release don't cross it.
- The captain-handover message still says the rotation starts "tomorrow", while Orbit's actual switch keeps its real date.
