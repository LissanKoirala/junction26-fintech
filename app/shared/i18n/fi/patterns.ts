// Finnish templates for strings that arrive inside data with values baked in (model reasons, engine notes).
// Key = the English template with {placeholders} where the values sit; value = the Finnish with the same placeholders.
// Used only by tData(). Placeholder names must be unique within a key. Longer literal text is tried first.
//   "{times}x your usual {category} purchase": "{times} kertaa tavallinen {category}-ostoksesi"
const patterns: Record<string, string> = {};

export default patterns;
