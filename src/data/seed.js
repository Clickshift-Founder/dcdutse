// ============================================================
//  SEED DATA  —  Departments, Cell Leaders, Prayer Points
//  All names are DUMMY. Replace via the Admin panel (no code needed).
// ============================================================

export const PRAYER_POINTS = [
  "Salvation & surrender to God",
  "Healing of body & health restoration",
  "Financial breakthrough & provision",
  "Marriage & relationship restoration",
  "Job / career direction & favour",
  "Peace of mind & mental wellbeing",
  "Family unity & reconciliation",
  "Deliverance from addictions & bondage",
  "Protection over my life & household",
  "Fruit of the womb / children",
  "Academic success & wisdom",
  "Travel mercies & safety",
  "Business breakthrough & prosperity",
  "Freedom from fear & anxiety",
  "Guidance & direction for major decisions",
  "Restoration of broken relationships",
  "Spiritual growth & deeper faith",
  "Prayer for my children",
  "Freedom from debt & financial burden",
  "Divine connection & destiny helpers",
];

export const DEPARTMENTS = [
  { id: "sanctuary", name: "Sanctuary Department", desc: "Maintain the holiness of God's house", leader: "Bro. Emmanuel Okonkwo", leaderPhone: "08023456701" },
  { id: "followup", name: "Followup Department", desc: "Reach out to newcomers & absentees", leader: "Sis. Grace Adeyemi", leaderPhone: "08023456702" },
  { id: "choir", name: "Choir Department", desc: "Lead worship & praise", leader: "Bro. David Chukwuma", leaderPhone: "08023456703" },
  { id: "ushering", name: "Ushering Department", desc: "Welcome and seat the congregation", leader: "Sis. Faith Obi", leaderPhone: "08023456704" },
  { id: "children", name: "Children Department", desc: "Train children in the way of the Lord", leader: "Sis. Ruth Nwachukwu", leaderPhone: "08023456705" },
  { id: "prayer", name: "Prayer Department", desc: "Intercede for the church & members", leader: "Bro. Joshua Adeniyi", leaderPhone: "08023456706" },
  { id: "mvp", name: "MVP (Most Valuable People)", desc: "Physical engagement with newcomers", leader: "Sis. Mercy Eze", leaderPhone: "08023456707" },
  { id: "security", name: "Security Department", desc: "Ensure safety of the church premises", leader: "Bro. Philip Abubakar", leaderPhone: "08023456708" },
  { id: "hospitality", name: "Hospitality Department", desc: "Food, refreshment & church events", leader: "Sis. Joy Nweke", leaderPhone: "08023456709" },
  { id: "welfare", name: "Welfare Department", desc: "Care for members in need", leader: "Sis. Comfort Bello", leaderPhone: "08023456710" },
  { id: "media", name: "Media & Tech Department", desc: "Broadcast, sound & digital presence", leader: "Bro. Samuel Ogundipe", leaderPhone: "08023456711" },
  { id: "protocol", name: "Protocol Department", desc: "Manage guest ministers & dignitaries", leader: "Sis. Esther Afolabi", leaderPhone: "08023456712" },
];

// Cell leaders matched to the location areas they cover.
// roles: a person can be cellLeader + zonalPastor + deptHead simultaneously.
export const CELL_LEADERS = [
  { id: "cl1", name: "Bro. Paul Eze", phone: "08012345601", email: "paul.eze@dc.ng", gender: "Male", zone: "Dutse Main Zone", roles: ["cellLeader"], areas: ["Dutse Alhaji", "Dutse Obasanjo Road", "Dutse Police Signboard"] },
  { id: "cl2", name: "Sis. Miriam Adeyemi", phone: "08012345602", email: "miriam.adeyemi@dc.ng", gender: "Female", zone: "Dutse South Zone", roles: ["cellLeader", "deptHead"], areas: ["Dutse Sokale", "Dutse Bokuma", "Dutse Makarantar"] },
  { id: "cl3", name: "Bro. Isaac Okoye", phone: "08012345603", email: "isaac.okoye@dc.ng", gender: "Male", zone: "Dutse North Zone", roles: ["cellLeader"], areas: ["Dutse Tipper Garage", "Bamko", "Gidan Pawa"] },
  { id: "cl4", name: "Sis. Hannah Moses", phone: "08012345604", email: "hannah.moses@dc.ng", gender: "Female", zone: "Ushafa Zone", roles: ["cellLeader"], areas: ["Ushafa", "Dawaki (Dutse)"] },
  { id: "cl5", name: "Pst. Caleb Bello", phone: "08012345605", email: "caleb.bello@dc.ng", gender: "Male", zone: "Bwari Zone", roles: ["cellLeader", "zonalPastor"], areas: ["Bwari Central", "Byazhin", "Kawu", "Kuduru", "Shere", "Usuma"] },
  { id: "cl6", name: "Sis. Deborah Nwosu", phone: "08012345606", email: "deborah.nwosu@dc.ng", gender: "Female", zone: "Kubwa Zone", roles: ["cellLeader"], areas: ["Kubwa", "Ushafa Ward"] },
  { id: "cl7", name: "Pst. Stephen Lawal", phone: "08012345607", email: "stephen.lawal@dc.ng", gender: "Male", zone: "Abuja Central Zone", roles: ["cellLeader", "zonalPastor"], areas: ["Garki", "Wuse", "Maitama", "Gwarinpa", "Karu / Nyanya", "Mpape", "Gwagwa / Jiwa"] },
  { id: "cl8", name: "Sis. Priscilla Abubakar", phone: "08012345608", email: "priscilla.abubakar@dc.ng", gender: "Female", zone: "Gwagwalada Zone", roles: ["cellLeader"], areas: ["Gwagwalada Centre", "Zuba", "Kutunku", "Staff Quarters"] },
];
