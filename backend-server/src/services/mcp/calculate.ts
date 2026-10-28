export type CalcResult = { ok: true; text: string } | { ok: false; error: string };

const GLUCOSE_FACTOR = 18.0182;

export function convertGlucose(value: number, from: string, to: string): CalcResult {
  if (from !== "mmol/L" && from !== "mg/dL") return { ok: false, error: "from must be mmol/L or mg/dL." };
  if (to !== "mmol/L" && to !== "mg/dL") return { ok: false, error: "to must be mmol/L or mg/dL." };
  if (!Number.isFinite(value) || value <= 0 || value > 2000) {
    return { ok: false, error: "Glucose value must be greater than 0 and at most 2000." };
  }
  if (from === to) return { ok: true, text: `${formatNumber(value, 2)} ${from} is already in ${to}.` };
  const converted = from === "mmol/L" ? value * GLUCOSE_FACTOR : value / GLUCOSE_FACTOR;
  const shown = formatNumber(converted, to === "mg/dL" ? 1 : 2);
  return {
    ok: true,
    text: `${formatNumber(value, 2)} ${from} = ${shown} ${to}. Factor: 1 mmol/L = ${GLUCOSE_FACTOR} mg/dL. This is unit conversion, not a clinical interpretation.`,
  };
}

export function convertTemperature(value: number, from: string, to: string): CalcResult {
  if (from !== "C" && from !== "F") return { ok: false, error: "from must be C or F." };
  if (to !== "C" && to !== "F") return { ok: false, error: "to must be C or F." };
  if (!Number.isFinite(value) || value < -80 || value > 300) {
    return { ok: false, error: "Temperature must be from -80 to 300 in the source unit." };
  }
  if (from === to) return { ok: true, text: `${formatNumber(value, 1)} ${from} is already in ${to}.` };
  const converted = from === "C" ? (value * 9) / 5 + 32 : ((value - 32) * 5) / 9;
  return {
    ok: true,
    text: `${formatNumber(value, 1)} ${from} = ${formatNumber(converted, 1)} ${to}. This is unit conversion, not a clinical interpretation.`,
  };
}

export function bodyMassIndex(weightKg: number, heightCm: number): CalcResult {
  if (!Number.isFinite(weightKg) || weightKg < 1 || weightKg > 500) {
    return { ok: false, error: "Weight must be from 1 to 500 kg." };
  }
  if (!Number.isFinite(heightCm) || heightCm < 30 || heightCm > 300) {
    return { ok: false, error: "Height must be from 30 to 300 cm." };
  }
  const meters = heightCm / 100;
  const bmi = weightKg / (meters * meters);
  return {
    ok: true,
    text: `BMI = ${formatNumber(weightKg, 1)} kg / (${formatNumber(meters, 2)} m)^2 = ${formatNumber(bmi, 1)}. Formula: weight (kg) / height (m)^2. This is arithmetic, not a diagnosis.`,
  };
}

function formatNumber(value: number, digits: number): string {
  const factor = 10 ** digits;
  const rounded = Math.round(value * factor) / factor;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(digits).replace(/0+$/, "").replace(/\.$/, "");
}
