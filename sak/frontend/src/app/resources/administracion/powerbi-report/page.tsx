"use client";

const POWERBI_REPORT_URL =
  "https://app.powerbi.com/view?r=eyJrIjoiMjE5MjU0NzItNjY1MS00NzU2LTliOWEtZDViYmEyZmJiZWRmIiwidCI6IjBhNjYzOWQ0LTgwZmEtNGFjYy1hZDhjLTAzMWRiNmJmOWNmMyIsImMiOjR9";

export const PowerBiReportPage = () => (
  <div className="flex h-[calc(100vh-5rem)] w-full flex-col gap-3 px-1 sm:px-2">
    <div className="flex shrink-0 items-center justify-between gap-3">
      <div>
        <h1 className="text-base font-semibold text-foreground sm:text-lg">
          Reporte Power BI
        </h1>
      </div>
    </div>

    <div className="min-h-0 flex-1 overflow-hidden rounded-md border border-border bg-background">
      <iframe
        title="Reporte Power BI"
        src={POWERBI_REPORT_URL}
        className="h-full w-full border-0"
        allowFullScreen
      />
    </div>
  </div>
);

export default PowerBiReportPage;
