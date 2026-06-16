// ============================================================
//  LOCATION REPOSITORY  —  FCT Abuja
//  Newcomers select Area > Neighbourhood > Village/Estate.
//  Admins can add more locations from the admin panel
//  (stored separately in the DB and merged at runtime).
// ============================================================

export const LOCATION_DATA = {
  "Dutse": {
    label: "Dutse (Main)", color: "#f59e0b",
    subs: {
      "Dutse Alhaji": ["Sokale", "Gidan Bawa", "Dutse Express Area", "Shishinpe", "Tungan Sarkin"],
      "Dutse Obasanjo Road": ["Freedom Avenue", "Mama Baby Area", "Obasanjo Rd Extension", "Obasanjo Close"],
      "Dutse Police Signboard": ["Signboard Area", "Tungan Signboard", "Signboard Extension"],
      "Dutse Sokale": ["Sokale Main", "Sokale Phase 2", "Sokale Low Cost", "Sokale Extension", "Gidan Bawa (Sokale)"],
      "Dutse Tipper Garage": ["Tipper Garage Area", "Mechanics Quarter", "Rugan Mota"],
      "Dutse Makarantar": ["Old Dutse Village", "Makarantar Quarters", "Gidan Pawa"],
      "Bamko": ["Bamko Phase 1", "Bamko Phase 2", "Bamko Extension", "Donabayi"],
      "Ushafa": ["Ushafa Old Village", "Jigo", "Yaupe", "Pamba", "Peyi", "Kogo 1", "Kogo 2"],
      "Dutse Bokuma": ["Bokuma Quarters", "Rugan S/Fulani"],
      "Dawaki (Dutse)": ["Dawaki Main", "Dawaki Extension", "Mapa"],
      "Gidan Pawa": ["Gidan Pawa Main", "Gidan Babachi", "Gidan Baushe"],
    },
  },
  "Bwari Area Council": {
    label: "Bwari", color: "#3b82f6",
    subs: {
      "Bwari Central": ["Bwari Town", "Bazango", "Galuwyi", "Gaba", "Gudupe", "Gutpo", "Sagwari"],
      "Kubwa": ["Kubwa Phase 1", "Kubwa Phase 2", "Kubwa Phase 3", "Kubwa Phase 4", "Dei-Dei", "Sabon Gari Kubwa", "Tudun Wada"],
      "Byazhin": ["Byazhi", "Chikale", "Simape", "Sumpe"],
      "Ushafa Ward": ["Ushafa", "Kogo", "Jigo", "Pamba", "Peyi", "Yaupe", "Tokulo"],
      "Igu": ["Igu", "Kaima", "Karaku", "Karawa", "Kasaru", "Kawadashi", "Piko"],
      "Kawu": ["Kawu", "Barago", "Baran Rafi", "Barangoni", "Barapa", "Dankoru", "Dauda"],
      "Kuduru": ["Kuduru", "Bunko", "Duba", "Kikumi", "Kimtaru", "Kute", "Kwabwure"],
      "Shere": ["Shere", "Kuchibuyi", "Panda", "Panunuki", "Paspa", "Payi", "Ruriji"],
      "Usuma": ["Usuma", "Apugye", "Tunga Adoka", "Tunga Bijimi", "Yaba", "Yajida", "Yaupe"],
    },
  },
  "AMAC - Abuja Municipal": {
    label: "AMAC (Abuja Municipal)", color: "#10b981",
    subs: {
      "Garki": ["Area 1", "Area 2", "Area 3", "Area 7", "Area 8", "Area 10", "Area 11"],
      "Wuse": ["Wuse Zone 1", "Wuse Zone 2", "Wuse Zone 3", "Wuse Zone 4", "Wuse Zone 5", "Wuse Zone 6", "Wuse Zone 7"],
      "Maitama": ["Maitama Main", "Asokoro Adjacent", "Ministers Hill"],
      "Gwarinpa": ["Gwarinpa Estate", "Setraco Area", "Jahi District"],
      "Karu / Nyanya": ["Nyanya", "Karu", "Jukwoyi", "Kurudu", "Orozo"],
      "Mpape": ["Mpape Phase 1", "Mpape Phase 2", "Jikoko", "Mapa"],
      "Gwagwa / Jiwa": ["Gwagwa Village", "Jiwa", "Karmo"],
    },
  },
  "Gwagwalada": {
    label: "Gwagwalada", color: "#8b5cf6",
    subs: {
      "Gwagwalada Centre": ["Gwagwalada Town", "University Area", "Hospital Area"],
      "Zuba": ["Zuba Main", "Zuba Market Area"],
      "Kutunku": ["Kutunku", "Tungan Maje"],
      "Staff Quarters": ["UniAbuja Staff Quarters"],
    },
  },
  "Kuje": {
    label: "Kuje", color: "#ef4444",
    subs: {
      "Kuje": ["Kuje Main", "Kuje Market Area"],
      "Rubochi": ["Rubochi"], "Gaube": ["Gaube"], "Kwaku": ["Kwaku"],
    },
  },
  "Kwali": {
    label: "Kwali", color: "#ec4899",
    subs: { "Kwali": ["Kwali Main", "Kwali Market Area"], "Yangoji": ["Yangoji"], "Pai": ["Pai"] },
  },
  "Abaji": {
    label: "Abaji", color: "#f97316",
    subs: { "Abaji Central": ["Abaji Town"], "Agyana / Pandagi": ["Agyana", "Pandagi"], "Nuku": ["Nuku"] },
  },
};

// Merge custom admin-added locations into the base data.
// Matches existing areas/neighbourhoods case-insensitively (and against the
// human label too) so "Dutse Main" resolves to the existing "Dutse" key
// instead of creating a duplicate. Custom additions are mostly new villages.
export function mergeLocations(base, customLocs = []) {
  const merged = JSON.parse(JSON.stringify(base));

  // Resolve a typed area name to an existing key, or return null if new.
  const findAreaKey = (typed) => {
    const t = (typed || "").trim().toLowerCase();
    return Object.keys(merged).find(
      (k) => k.toLowerCase() === t || (merged[k].label || "").toLowerCase() === t
    ) || null;
  };
  const findSubKey = (areaKey, typed) => {
    const t = (typed || "").trim().toLowerCase();
    return Object.keys(merged[areaKey].subs).find((k) => k.toLowerCase() === t) || null;
  };

  customLocs.forEach((l) => {
    const typedArea = (l.area || "").trim();
    const typedSub = (l.sub || "").trim();
    if (!typedArea) return;

    // Area: reuse existing key if it matches, else create new
    let areaKey = findAreaKey(typedArea);
    if (!areaKey) {
      areaKey = typedArea;
      merged[areaKey] = { label: typedArea, color: "#64748b", subs: {} };
    }

    // Neighbourhood: reuse existing key if it matches, else create new
    if (typedSub) {
      let subKey = findSubKey(areaKey, typedSub);
      if (!subKey) {
        subKey = typedSub;
        merged[areaKey].subs[subKey] = [];
      }
      // Villages: add any new ones (case-insensitive de-dupe)
      if (l.villages) {
        const existing = merged[areaKey].subs[subKey].map((v) => v.toLowerCase());
        l.villages.split(",").map((v) => v.trim()).filter(Boolean).forEach((v) => {
          if (!existing.includes(v.toLowerCase())) merged[areaKey].subs[subKey].push(v);
        });
      }
    }
  });
  return merged;
}
