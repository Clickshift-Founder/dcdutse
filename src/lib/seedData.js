// ============================================================
//  DUMMY DATA SEEDER  —  for demo/testing only.
//  Replace with real data via the Admin panel.
// ============================================================

import { getDB, saveDB } from "./storage.js";
import { PRAYER_POINTS } from "../data/seed.js";
import { assignCellLeader } from "./logic.js";

export function seedDummyData() {
  const db = getDB();
  if (db.newcomers && db.newcomers.length > 0) return db;

  const names = ["Chidinma Okafor", "Abubakar Musa", "Blessing Eze", "Tunde Adeyemi", "Ngozi Williams", "Emeka Nwachukwu", "Fatima Ahmed", "Precious Obi", "Daniel Bello", "Amaka Okonkwo", "Joseph Adamu", "Rebecca Sani"];
  const areas = ["Dutse Alhaji", "Dutse Sokale", "Bamko", "Kubwa", "Bwari Central", "Dawaki (Dutse)", "Ushafa", "Garki"];
  const statuses = ["new", "active", "active", "active", "member", "new", "active", "flagged", "member", "active", "new", "member"];

  names.forEach((name, i) => {
    const area = areas[i % areas.length];
    const leader = assignCellLeader(area, area);
    const attendanceCount = statuses[i] === "member" ? 6 : statuses[i] === "active" ? Math.floor(Math.random() * 4) + 1 : 0;
    const attendance = [];
    for (let j = 0; j < attendanceCount; j++) {
      const d = new Date();
      d.setDate(d.getDate() - j * 7);
      attendance.push(d.toISOString().split("T")[0]);
    }
    const bdMonth = String((i % 12) + 1).padStart(2, "0");
    db.newcomers.push({
      id: "nc_seed_" + i,
      name,
      phone: "0801234" + (5600 + i),
      area, sublocation: area, village: "",
      bornAgain: Math.random() > 0.3 ? "yes" : "no",
      baptizedHG: Math.random() > 0.5 ? "yes" : "no",
      baptizedWater: Math.random() > 0.6 ? "yes" : "no",
      howCame: ["A Member", "Pastor invited me", "The Lord directed me", "Just came on my own"][i % 4],
      inviterName: i % 4 === 0 ? "Bro. John" : "",
      gender: i % 2 === 0 ? "Female" : "Male",
      marital: ["Single", "Married", "Single", "Married", "Single", "Widowed", "Single", "Married", "Married", "Single", "Single", "Married"][i],
      birthday: `1990-${bdMonth}-15`,
      prayerPoints: PRAYER_POINTS.slice(0, Math.floor(Math.random() * 4) + 1),
      customPrayer: "",
      departments: statuses[i] === "member" && i % 2 === 0 ? ["choir"] : [],
      status: statuses[i],
      assignedLeader: leader,
      attendance,
      contactedAt: statuses[i] !== "new" ? new Date().toISOString() : null,
      whatsappAdded: statuses[i] === "member" && i === 4,
      submittedAt: new Date(Date.now() - i * 86400000 * 2).toISOString(),
    });
  });

  saveDB(db);
  return db;
}
