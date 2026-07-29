import tariqMahmood from './suspect_tariq_mahmood.png';
import zubairKhan from './suspect_zubair_khan.png';
import faisalShah from './suspect_faisal_shah.png';

// Maps attacker names (from session.attackerNames) to their generated portrait images
const SUSPECT_IMAGES = {
  'Tariq Mahmood': tariqMahmood,
  'Zubair Khan': zubairKhan,
  'Faisal Shah': faisalShah,
};

/**
 * Returns the suspect portrait image for a given name.
 * Falls back to null if no image is mapped.
 */
export function getSuspectImage(name) {
  if (!name) return null;
  // Direct match
  if (SUSPECT_IMAGES[name]) return SUSPECT_IMAGES[name];
  // Partial / case-insensitive match
  const key = Object.keys(SUSPECT_IMAGES).find(
    k => k.toLowerCase() === name.toLowerCase() || name.toLowerCase().includes(k.split(' ')[0].toLowerCase())
  );
  return key ? SUSPECT_IMAGES[key] : null;
}

export default SUSPECT_IMAGES;
