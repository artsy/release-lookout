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

By default, from the ordered `RELEASE_CAPTAINS` list of Slack user IDs in `src/constants.ts`, indexed
by cadences since `ROTATION_EPOCH`. **Changing the rotation needs a PR** — deliberately, for
auditability. If you reshuffle the list, update `ROTATION_EPOCH` too, or the index maths shifts
everyone.

`src/orbit.ts` is an opt-in proof of concept that asks [Orbit](https://github.com/artsy/orbit) for
the on-call schedule instead, which would give us overrides and shift swaps for free. It is **not
enabled** — set `ORBIT_URL`, `ORBIT_ROTATION_ID` and `ORBIT_TOKEN` to turn it on. It's blocked on
Orbit accepting a service token for read access (its API currently needs an interactive next-auth
session, which a headless bot can't get). With the env vars unset it no-ops to the local maths.

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
