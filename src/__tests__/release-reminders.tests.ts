import { getApplauseTaskText } from "../release-reminders";
import { getCurrentCaptainIndex, getNextCaptainIndex, ROTATION_EPOCH, RELEASE_CAPTAINS } from "../constants";

describe('captain rotation', () => {
  const n = RELEASE_CAPTAINS.length;

  it('returns index 0 at the epoch date', () => {
    expect(getCurrentCaptainIndex(ROTATION_EPOCH)).toBe(0);
  });

  it('returns index 0 one week after epoch (same captain serves 2 weeks)', () => {
    expect(getCurrentCaptainIndex(ROTATION_EPOCH.plus({ weeks: 1 }))).toBe(0);
  });

  it('advances to index 1 after two weeks', () => {
    expect(getCurrentCaptainIndex(ROTATION_EPOCH.plus({ weeks: 2 }))).toBe(1 % n);
  });

  it('wraps back to index 0 after a full rotation', () => {
    expect(getCurrentCaptainIndex(ROTATION_EPOCH.plus({ weeks: n * 2 }))).toBe(0);
  });

  it('getNextCaptainIndex is always (current + 1) % n', () => {
    const anchors = [ROTATION_EPOCH, ROTATION_EPOCH.plus({ weeks: 2 }), ROTATION_EPOCH.plus({ weeks: 4 })];
    for (const date of anchors) {
      const current = getCurrentCaptainIndex(date);
      expect(getNextCaptainIndex(date)).toBe((current + 1) % n);
    }
  });
});

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