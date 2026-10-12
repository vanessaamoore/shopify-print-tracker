/**
 * PROFESSION PRINTS
 * =================
 * Products titled "<PROFESSION> <Garment> - <Color>" (e.g. "THERAPIST Mockneck - Honeycrisp")
 * get their prints from here instead of the Print Reference sheet, so new colors
 * and garments never need new sheet rows.
 *
 * FRONT: the profession's print code. The title must START with the profession name
 *        (a leading "(PRE-ORDER)" is ignored). Matching is case-insensitive.
 * BACK:  the back print for each back-print option the customer picks.
 *        An empty list means no back print.
 *
 * To add a profession or back option, add a line below. Any print code used here
 * also needs a row on the Inventory tab, or it won't be counted.
 */

const PROFESSION_FRONT_PRINTS = {
  "SOCIAL WORK": "SW",
  "NURSING": "NUR",
  "PSYCH": "PSYCH",
  "COUNSELOR": "COU",
  "THERAPIST": "THE",
  "TEACHER": "TEA",
  "OCCUPATIONAL THERAPY": "OTHE",
  "RECREATIONAL THERAPY": "RTHE",
};

const BACK_PRINT_OPTIONS = {
  "Plain": [],
  "Safe With Me Print": ["SWM"],
  "Healing Isn't Linear": ["HILW"],
};

module.exports = { PROFESSION_FRONT_PRINTS, BACK_PRINT_OPTIONS };
