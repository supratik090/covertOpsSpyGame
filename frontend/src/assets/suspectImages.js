import tariqMahmood from './suspect_tariq_mahmood.png';
import zubairKhan from './suspect_zubair_khan.png';
import faisalShah from './suspect_faisal_shah.png';
import farhanChowdhury from './suspect_farhan_chowdhury.png';
import kaziRahman from './suspect_kazi_rahman.png';
import mustafizurHasan from './suspect_mustafizur_hasan.png';
import eliCohen from './suspect_eli_cohen.png';
import davidBirnbaum from './suspect_david_birnbaum.png';
import tamarGolan from './suspect_tamar_golan.png';

// Maps attacker names (from session.attackerNames) to their generated portrait images
const SUSPECT_IMAGES = {
  // Scenarios 1, 2, 3: Operation Thunder, Coastal Thunder, Silent Edge
  'Tariq Mahmood': tariqMahmood,
  'Zubair Khan': zubairKhan,
  'Faisal Shah': faisalShah,
  'Faizal Khan': faisalShah,

  // Scenarios 4 & 6: Kidnap Bangladeshi PM, ASEAN Defense Operation
  'Farhan Chowdhury': farhanChowdhury,
  'Kazi Rahman': kaziRahman,
  'Mustafizur Hasan': mustafizurHasan,

  // Scenario 5: Assassinate Iran General
  'Eli Cohen': eliCohen,
  'David Birnbaum': davidBirnbaum,
  'Tamar Golan': tamarGolan,

  // Scenario 7: Operation Dnieper Shield (Russia-Ukraine)
  'Artem Bondarenko': tariqMahmood,
  'Taras Shevchenko': zubairKhan,
  'Mykola Kovalenko': faisalShah,

  // Scenario 8: Operation Channel Fortress (English Channel)
  'Viktor Petrov': farhanChowdhury,
  'Sergei Sokolov': kaziRahman,
  'Mikhail Kozlov': mustafizurHasan,

  // Scenario 9: Operation Border Vanguard (Americas Cartel)
  'Mateo Guzman': eliCohen,
  'Mateo "El Sombra" Guzman': eliCohen,
  'Alejandro Morales': davidBirnbaum,
  'Alejandro "El Toro" Morales': davidBirnbaum,
  'Santiago Reyes': tamarGolan,
  'Santiago "El Halcon" Reyes': tamarGolan,

  // Scenario 10: Operation Silicon Shield (East Asia Semiconductor)
  'Wei Zhang': tariqMahmood,
  'Chen Wei': zubairKhan,
  'Lin Feng': faisalShah,
};

const PORTRAIT_LIST = [
  tariqMahmood, zubairKhan, faisalShah, farhanChowdhury,
  kaziRahman, mustafizurHasan, eliCohen, davidBirnbaum, tamarGolan
];

/**
 * Returns the suspect portrait image for a given name.
 * Falls back to a deterministic portrait if no exact key is mapped.
 */
export function getSuspectImage(name) {
  if (!name) return PORTRAIT_LIST[0];
  // Direct match
  if (SUSPECT_IMAGES[name]) return SUSPECT_IMAGES[name];
  // Partial / case-insensitive match
  const key = Object.keys(SUSPECT_IMAGES).find(
    k => k.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(k.split(' ')[0].toLowerCase())
  );
  if (key) return SUSPECT_IMAGES[key];

  // Deterministic fallback based on character codes sum
  let hash = 0;
  for (let i = 0; i < name.length; i++) {
    hash = (hash << 5) - hash + name.charCodeAt(i);
  }
  const index = Math.abs(hash) % PORTRAIT_LIST.length;
  return PORTRAIT_LIST[index];
}

export default SUSPECT_IMAGES;
