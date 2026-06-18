// ============================================================
//  CHURCH CONFIGURATION  —  EDIT THIS FILE TO REBRAND
//  This single file is what makes DC Connect a reusable product.
//  Another church can fork the repo, change this file, drop in
//  their logo, and they have their own branded platform.
// ============================================================

export const CHURCH = {
  name: "Dominion City",
  branch: "Dutse Branch",
  city: "Abuja, Nigeria",
  address: "No. 2 Dutse Obasanjo Rd, after Mae Suya, Dutse Alhaji, FCT Abuja",
  leadPastor: "Pastor Stanley Nzewigbo",
  pastorWife: "Pastor Mrs. Chioma Nzewigbo",
  logo: "/church-logo.png", // drop your logo image here in /public

  // The live app URL — used in WhatsApp messages so leaders can tap to log in.
  // Update this to your real domain once you have one (e.g. https://connect.dcdutse.org)
  appUrl: "https://dcdutse.vercel.app",

  // Service schedule (shown to newcomers & in WhatsApp welcome)
  services: [
    { name: "Midweek Service", day: "Wednesday", time: "6:00 PM" },
    { name: "Super Sunday Service", day: "Sunday", time: "8:00 AM" },
  ],

  // Membership rule: how many services attended before auto-promotion
  membershipThreshold: 5,

  // Follow-up SLA: hours within which a newcomer should be contacted
  followupSLAHours: 48,

  // Foundational class name (Dominion City Academy)
  foundationClass: "DCA (Dominion City Academy)",

  // Theme colors — change to match any church's brand
  theme: {
    primary: "#0b115b",      // dominion navy
    primaryLight: "#2563eb", // mid blue accent
    primaryDark: "#070b3d",
    accent: "#1d4ed8",
    bg: "#f7f9fc",           // crisp white
    bgCard: "#ffffff",
  },

  // Notification messages (the {placeholders} get filled automatically)
  messages: {
    newcomerWelcome:
      "🙏 Welcome to {church} {branch}, {firstName}! We're so glad you joined us today. " +
      "Your HomeCell leader is {leaderName} ({leaderPhone}) — they'll reach out to you soon. " +
      "Join us: Wednesday Midweek 6PM & Super Sunday 8AM. God bless you! ✝️",
    leaderAssignment:
      "📋 New person assigned to your cell, {leaderName}! " +
      "{ncName} ({ncPhone}) from {ncArea}. Prayer needs: {prayerPoints}. " +
      "Please call & follow up within 48 hours.",
    deptInterest:
      "🏛 {ncName} ({ncPhone}) has shown interest in joining your {deptName} department. " +
      "Please follow up to welcome and guide them.",
    membershipReached:
      "🎉 {ncName} has attended {count} services and now qualifies as a MEMBER! " +
      "Please add them to the church WhatsApp group and guide them toward a department + {foundationClass}.",
    birthdayReminder:
      "🎂 It's {name}'s birthday today! A quick call or message from the church family means the world.",
  },
};

// Admin PIN — CHANGE THIS, and ideally move to backend .env for production
export const ADMIN_PIN = "1234";

// Cell Admin PIN — a restricted admin (e.g. cell coordinator) who can view
// reports and cell performance but not alter sensitive settings.
// The super admin can change which tabs the cell admin sees, in Settings.
export const CELL_ADMIN_PIN = "5678";

// Default tabs a Cell Admin may access (super admin can edit in Settings).
// Super admin always sees everything.
export const DEFAULT_CELL_ADMIN_TABS = [
  "dashboard", "report", "cellperf", "weeklyreports", "newcomers",
  "directory", "members", "pending", "flagged", "birthdays",
];
