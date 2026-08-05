import { getApplauseTaskText } from "../release-reminders";

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