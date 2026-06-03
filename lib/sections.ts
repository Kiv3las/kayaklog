// Section parsing shared by the add form and the map.
//
// A lap's `section` is a "-"-joined combo of the presets Alto/Medio/Bajo
// (e.g. "Alto-Medio"), the legacy literal "Todo", or a free-text custom name.

const PRESET_PARTS = ['Alto', 'Medio', 'Bajo'];

// "Todo" is shorthand for all three presets. Normalize it so the combo path
// (split on "-") handles both new entries and legacy "Todo" rows.
export function normalizeSection(section: string): string {
  return section.trim() === 'Todo' ? 'Alto-Medio-Bajo' : section.trim();
}

// True when the section is only a combination of Alto/Medio/Bajo (or "Todo"),
// as opposed to a custom name.
export function isPresetCombo(section: string): boolean {
  const s = section.trim();
  if (!s) return false;
  if (s === 'Todo') return true;
  return s.split('-').every((p) => PRESET_PARTS.includes(p));
}

// Split a section into its individual parts. A preset combo splits on "-";
// a custom section is a single part. Empty section → no parts.
export function sectionParts(section: string | undefined): string[] {
  const s = normalizeSection((section ?? '').trim());
  if (!s) return [];
  return isPresetCombo(s) ? s.split('-').filter(Boolean) : [s];
}
