import { expect, test } from "bun:test";
import { CLUB, WEEK_STARTS, isHalloweenMonth, isHfcEmail, isWinter, roomFor } from "./season";

test("isHfcEmail takes HawkMail and staff emails only", () => {
  expect(isHfcEmail("jsmith@hawkmail.hfcc.edu")).toBe(true);
  expect(isHfcEmail(" JSmith@HawkMail.HFCC.edu ")).toBe(true);
  expect(isHfcEmail("advisor@hfcc.edu")).toBe(true);
  expect(isHfcEmail("jsmith@gmail.com")).toBe(false);
  expect(isHfcEmail("jsmith@hfcc.edu.evil.com")).toBe(false);
  expect(isHfcEmail("jsmith@nothfcc.edu")).toBe(false);
});

test("roomFor moves only the Oct 21 meeting to the Gaming Room", () => {
  expect(roomFor(new Date("2026-10-21T17:00:00-04:00"))).toBe("Gaming Room (E-180)");
  expect(roomFor(new Date("2026-10-28T17:00:00-04:00"))).toBe(CLUB.room);
  expect(WEEK_STARTS.filter((d) => roomFor(d) !== CLUB.room)).toHaveLength(1);
});

test("winter runs November through February in Detroit, and never overlaps October", () => {
  expect(isWinter(new Date("2026-10-31T23:59:00-04:00"))).toBe(false);
  expect(isWinter(new Date("2026-11-01T00:01:00-04:00"))).toBe(true);
  expect(isWinter(new Date("2027-01-15T12:00:00-05:00"))).toBe(true);
  expect(isWinter(new Date("2027-02-28T23:59:00-05:00"))).toBe(true);
  expect(isWinter(new Date("2027-03-01T00:01:00-05:00"))).toBe(false);
  // Already November in UTC, still October 31 in Detroit.
  expect(isWinter(new Date("2026-11-01T02:00:00Z"))).toBe(false);
  expect(isHalloweenMonth(new Date("2026-11-01T02:00:00Z"))).toBe(true);
});
