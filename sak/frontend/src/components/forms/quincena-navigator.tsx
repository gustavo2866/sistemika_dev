"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";

import { Button } from "@/components/ui/button";

export type QuincenaRange = {
  start: Date;
  end: Date;
  number: 1 | 2;
};

export const parseDateOnly = (value?: string | null) => {
  const [year, month, day] = String(value ?? "").split("-").map(Number);
  if (!year || !month || !day) return new Date();
  return new Date(year, month - 1, day);
};

export const toISODate = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const getQuincenaRange = (date: Date): QuincenaRange => {
  const year = date.getFullYear();
  const month = date.getMonth();
  const day = date.getDate();
  if (day <= 10) {
    return {
      start: new Date(year, month - 1, 26),
      end: new Date(year, month, 10),
      number: 1,
    };
  }
  if (day <= 25) {
    return {
      start: new Date(year, month, 11),
      end: new Date(year, month, 25),
      number: 2,
    };
  }
  return {
    start: new Date(year, month, 26),
    end: new Date(year, month + 1, 10),
    number: 1,
  };
};

export const moveQuincena = (start: Date, direction: -1 | 1) => {
  const normalizedStart = getQuincenaRange(start).start;
  const year = normalizedStart.getFullYear();
  const month = normalizedStart.getMonth();
  const firstHalf = normalizedStart.getDate() === 26;
  if (direction === 1) {
    return firstHalf ? new Date(year, month + 1, 11) : new Date(year, month, 26);
  }
  return firstHalf ? new Date(year, month, 11) : new Date(year, month - 1, 26);
};

const formatQuincena = (start: Date, number: number) => {
  const referenceDate = number === 1 ? new Date(start.getFullYear(), start.getMonth() + 1, 1) : start;
  const month = referenceDate.toLocaleDateString("es-AR", { month: "long" });
  return `${number}ª quincena · ${month} ${referenceDate.getFullYear()}`;
};

const formatDateRange = (start: Date, end: Date) =>
  `${start.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })} - ${end.toLocaleDateString("es-AR", { day: "2-digit", month: "2-digit" })}`;

export const QuincenaNavigator = ({
  rangeStart,
  rangeEnd,
  quincenaNumber,
  selectedDate,
  onPrevious,
  onNext,
  onSelectedDateChange,
  showSelectedDate = true,
}: {
  rangeStart: Date;
  rangeEnd: Date;
  quincenaNumber: number;
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectedDateChange: (value: string) => void;
  showSelectedDate?: boolean;
}) => (
  <>
    <div className="flex h-8 items-center rounded-md border border-slate-200 bg-white shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-7 rounded-r-none"
        onClick={onPrevious}
        aria-label="Quincena anterior"
        title="Quincena anterior"
      >
        <ChevronLeft className="size-3" />
      </Button>
      <div className="flex h-full min-w-[184px] flex-col justify-center border-x border-slate-200 px-2 text-center">
        <div className="text-[10px] font-semibold capitalize text-slate-700">
          {formatQuincena(rangeStart, quincenaNumber)}
        </div>
        <div className="text-[8px] text-slate-500">
          {formatDateRange(rangeStart, rangeEnd)}
        </div>
      </div>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-8 w-7 rounded-l-none"
        onClick={onNext}
        aria-label="Quincena siguiente"
        title="Quincena siguiente"
      >
        <ChevronRight className="size-3" />
      </Button>
    </div>

    {showSelectedDate ? (
      <input
        type="date"
        aria-label="Fecha de la quincena"
        value={selectedDate}
        onChange={(event) => onSelectedDateChange(event.target.value)}
        className="h-8 w-[132px] rounded-md border border-slate-200 bg-white px-2 text-[11px] font-semibold text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
      />
    ) : null}
  </>
);
