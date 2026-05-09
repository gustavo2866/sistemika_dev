export type QuincenaValue = "1" | "2";

export const getQuincenaDateParts = (value?: unknown): {
  month: string;
  quincena: QuincenaValue;
} => {
  const dateValue = typeof value === "string" ? value.slice(0, 10) : "";
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dateValue);

  if (!match) {
    return { month: "", quincena: "1" };
  }

  const [, year, month, day] = match;
  return {
    month: `${year}-${month}`,
    quincena: Number(day) >= 16 ? "2" : "1",
  };
};

export const buildQuincenaDateValue = (
  month: string,
  quincena: QuincenaValue,
) => {
  if (!month) return "";
  return `${month}-${quincena === "1" ? "01" : "16"}`;
};

export const normalizeQuincenaDateValue = (value?: unknown) => {
  const { month, quincena } = getQuincenaDateParts(value);
  return buildQuincenaDateValue(month, quincena);
};
