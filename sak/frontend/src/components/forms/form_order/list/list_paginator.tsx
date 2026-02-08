import { ListPagination } from "@/components/list-pagination";
import { cn } from "@/lib/utils";

export const ListPaginator = ({
  className,
  rowsPerPageOptions,
}: {
  className?: string;
  rowsPerPageOptions?: number[];
}) => {
  return (
    <ListPagination
      rowsPerPageOptions={rowsPerPageOptions}
      className={cn(
        "gap-1 text-[8px] sm:gap-1.5 sm:text-[9px] [&_p]:text-[8px] sm:[&_p]:text-[9px] [&_p]:leading-none [&_[data-slot=page-range]]:text-[8px] sm:[&_[data-slot=page-range]]:text-[9px] [&_[data-slot=pagination-link]]:h-5 [&_[data-slot=pagination-link]]:w-5 [&_[data-slot=pagination-link]]:text-[8px] sm:[&_[data-slot=pagination-link]]:h-6 sm:[&_[data-slot=pagination-link]]:w-6 sm:[&_[data-slot=pagination-link]]:text-[9px] [&_[data-slot=pagination-link]]:min-w-0 [&_[data-slot=pagination-link]]:p-0 [&_[data-slot=pagination-link]]:px-0 [&_[data-slot=pagination-link]]:py-0 [&_svg]:h-3 [&_svg]:w-3 sm:[&_svg]:h-3.5 sm:[&_svg]:w-3.5 [&_[data-slot=select-trigger]]:h-6 [&_[data-slot=select-trigger]]:w-[58px] [&_[data-slot=select-trigger]]:text-[8px] sm:[&_[data-slot=select-trigger]]:text-[9px]",
        className
      )}
    />
  );
};
