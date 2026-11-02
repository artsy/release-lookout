import { DateTime } from "luxon";
import { getApplauseFollowUp, getApplauseTaskText } from "../release-reminders";

describe('getApplauseTaskText', () => {
  it('should iterate through test suites properly if releases are on even weeks', () => {
    const result1 = getApplauseTaskText(2);
    expect(result1).toBe('set up Recent Changes QA and Request Applause QA for the Android app using Test Suite 1');
    const result2 = getApplauseTaskText(4);
    expect(result2).toBe('set up Recent Changes QA and Request Applause QA for the iOS app using Test Suite 1');
    const result3 = getApplauseTaskText(6);
    expect(result3).toBe('set up Recent Changes QA and Request Applause QA for the Android app using Test Suite 2');
    const result4 = getApplauseTaskText(8);
    expect(result4).toBe('set up Recent Changes QA and Request Applause QA for the iOS app using Test Suite 2');    
  });

  it('should iterate through test suites properly if releases are on odd weeks ', () => {
    const result1 = getApplauseTaskText(3);
    expect(result1).toBe('set up Recent Changes QA and Request Applause QA for the iOS app using Test Suite 1');
    const result2 = getApplauseTaskText(5);
    expect(result2).toBe('set up Recent Changes QA and Request Applause QA for the Android app using Test Suite 2');
    const result3 = getApplauseTaskText(7);
    expect(result3).toBe('set up Recent Changes QA and Request Applause QA for the iOS app using Test Suite 2');
    const result4 = getApplauseTaskText(9);
    expect(result4).toBe('set up Recent Changes QA and Request Applause QA for the Android app using Test Suite 1');
  });
});

describe("getApplauseFollowUp", () => {
  const followUpAt = (nowIso: string) =>
    getApplauseFollowUp(DateTime.fromISO(nowIso, { zone: "utc" }), "U123", 2);

  it("posts at 17:00 Berlin in summer time (UTC+2)", () => {
    expect(followUpAt("2026-07-10T10:00:00Z")?.postAt.toUTC().toISO()).toBe(
      "2026-07-10T15:00:00.000Z"
    );
  });

  it("posts at 17:00 Berlin in winter time (UTC+1)", () => {
    expect(followUpAt("2026-11-06T10:00:00Z")?.postAt.toUTC().toISO()).toBe(
      "2026-11-06T16:00:00.000Z"
    );
  });

  it("returns null once 17:00 Berlin has passed", () => {
    expect(followUpAt("2026-11-06T16:00:00Z")).toBeNull();
  });

  it("mentions the captain and this cycle's platform and test suite", () => {
    expect(followUpAt("2026-11-06T10:00:00Z")?.text).toBe(
      "Captain <@U123> ⏰ reminder: have you requested the Applause QA cycle for the Android app (Test Suite 1) yet? <https://support.applause.com|Request it here>"
    );
  });
});
