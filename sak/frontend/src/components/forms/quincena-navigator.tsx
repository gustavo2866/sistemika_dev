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
  const firstHalf = date.getDate() <= 15;
  return {
    start: new Date(year, month, firstHalf ? 1 : 16),
    end: firstHalf
      ? new Date(year, month, 15)
      : new Date(year, month + 1, 0),
    number: firstHalf ? 1 : 2,
  };
};

export const moveQuincena = (start: Date, direction: -1 | 1) => {
  const year = start.getFullYear();
  const month = start.getMonth();
  const firstHalf = start.getDate() === 1;
  if (direction === 1) {
    return firstHalf ? new Date(year, month, 16) : new Date(year, month + 1, 1);
  }
  return firstHalf ? new Date(year, month - 1, 16) : new Date(year, month, 1);
};

const formatQuincena = (start: Date, number: number) => {
  const month = start.toLocaleDateString("es-AR", { month: "long" });
  return `${number}ª quincena · ${month} ${start.getFullYear()}`;
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
}: {
  rangeStart: Date;
  rangeEnd: Date;
  quincenaNumber: number;
  selectedDate: string;
  onPrevious: () => void;
  onNext: () => void;
  onSelectedDateChange: (value: string) => void;
}) => (
  <>
    <div className="flex items-center rounded-md border border-slate-200 bg-white shadow-xs">
      <Button
        type="button"
        variant="ghost"
        size="icon"
        className="h-6 w-6 rounded-r-none"
        onClick={onPrevious}
        aria-label="Quincena anterior"
        title="Quincena anterior"
      >
        <ChevronLeft className="size-3" />
      </Button>
      <div className="min-w-[168px] border-x border-slate-200 px-2 text-center">
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
        className="h-6 w-6 rounded-l-none"
        onClick={onNext}
        aria-label="Quincena siguiente"
        title="Quincena siguiente"
      >
        <ChevronRight className="size-3" />
      </Button>
    </div>

    <input
      type="date"
      aria-label="Fecha de la quincena"
      value={selectedDate}
      onChange={(event) => onSelectedDateChange(event.target.value)}
      className="h-6 w-[116px] rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 shadow-xs outline-none focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50"
    />
  </>
);
