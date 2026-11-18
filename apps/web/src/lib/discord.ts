// Discord verification (/discord): the club server is for HFC students, so members sign in with HawkMail and
// connect Discord here, and the club's bot gives them their roles. Role names match the server's roles; the bot looks
// up their ids, so renaming a role in Discord means renaming it here too.

export const MEMBER_ROLE = "Member";
export const STAFF_ROLE = "Faculty & Staff";

/** Roles members pick to get pinged about, with the survey interests (src/lib/survey.ts) that suggest each one. */
export const DISCORD_INTERESTS = [
  { id: "games", role: "Game Nights", label: "Coding game nights", from: ["games"] },
  { id: "ai", role: "AI", label: "Building with AI", from: ["ai"] },
  { id: "web", role: "Web & Apps", label: "Websites & apps", from: ["web"] },
  { id: "gamedev", role: "Game Dev", label: "Making games", from: ["gamedev"] },
  { id: "security", role: "Security & CTFs", label: "Cybersecurity & CTFs", from: ["security"] },
  { id: "careers", role: "Careers & Interviews", label: "Internships & interviews", from: ["career", "interviews"] },
  { id: "hackathons", role: "Hackathons", label: "Hackathons", from: ["hackathons"] },
  { id: "classes", role: "Class Help", label: "Help with CS classes", from: ["classes"] },
] as const;

/** Every role verifying hands out. Verifying again swaps these and never touches roles officers give by hand. */
export const MANAGED_ROLES: string[] = [MEMBER_ROLE, STAFF_ROLE, ...DISCORD_INTERESTS.map((i) => i.role)];

/** Students (and officers) get Member; @hfcc.edu faculty and staff get Faculty & Staff. */
export type MemberKind = "student" | "staff";
export const kindOf = (email: string): MemberKind => (/@hfcc\.edu$/i.test(email.trim()) ? "staff" : "student");

/** Known interest ids only, in the list's order. */
export const cleanInterests = (ids: readonly string[]) => DISCORD_INTERESTS.filter((i) => ids.includes(i.id)).map((i) => i.id);

/** Interests to start from for someone who took the survey. */
export const suggestedInterests = (survey: readonly string[]) =>
  DISCORD_INTERESTS.filter((i) => i.from.some((f) => survey.includes(f))).map((i) => i.id);

/** The role names a verified member gets. */
export const rolesFor = (kind: MemberKind, interests: readonly string[]) => [
  kind === "staff" ? STAFF_ROLE : MEMBER_ROLE,
  ...DISCORD_INTERESTS.filter((i) => interests.includes(i.id)).map((i) => i.role),
];

/** A member's new role ids: everything they had except the roles verifying manages, plus the ones it gives now. */
export const mergeRoles = (current: readonly string[], managed: readonly string[], give: readonly string[]) => [
  ...new Set([...current.filter((r) => !managed.includes(r)), ...give]),
];

/** What went wrong, from the `?error=` the callback sends back. */
export const VERIFY_ERRORS = {
  denied: "Discord didn’t connect. Try again, and pick Authorize on Discord’s screen.",
  expired: "That took a little too long. Start again below.",
  failed: "Something went wrong on our end, so no roles changed. Try again, or message an officer if it keeps happening.",
} as const;
export type VerifyError = keyof typeof VERIFY_ERRORS;
