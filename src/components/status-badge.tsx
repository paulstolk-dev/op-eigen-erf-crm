import { STATUS_STYLES, statusLabel, isLeadStatus } from "@/lib/constants";

export function StatusBadge({ status }: { status: string }) {
  const style = isLeadStatus(status)
    ? STATUS_STYLES[status]
    : "bg-gray-100 text-gray-700 ring-gray-500/20";
  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${style}`}
    >
      {statusLabel(status)}
    </span>
  );
}
