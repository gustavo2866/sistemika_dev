export const getStartOfWeek = (base: Date) => {
  const date = new Date(base);
  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);
  date.setHours(0, 0, 0, 0);
  return date;
};

export const getNextWeekStart = (base: Date) => {
  const start = getStartOfWeek(base);
  start.setDate(start.getDate() + 7);
  return start;
};

export const formatDateRange = (start: Date, end: Date, locale = "es-AR") => {
  const formatDate = (date: Date) => date.toLocaleDateString(locale, { day: "2-digit", month: "2-digit" });
  return `${formatDate(start)} - ${formatDate(end)}`;
};
