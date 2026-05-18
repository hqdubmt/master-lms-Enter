import clsx from "clsx";

interface CardProps {
  title: string;
  value: string | number;
  description?: string;
  className?: string;
  icon?: React.ReactNode;
  trend?: {
    value: number;
    label: string;
    positive?: boolean;
  };
}

export function Card({
  title,
  value,
  description,
  className,
  icon,
  trend,
}: CardProps) {
  return (
    <div
      className={clsx(
        "bg-white rounded-xl border border-gray-200 p-6 shadow-sm",
        className
      )}
    >
      <div className="flex items-start justify-between">
        <div className="flex-1">
          <p className="text-sm font-medium text-gray-500">{title}</p>
          <p className="mt-2 text-3xl font-bold text-gray-900">
            {typeof value === "number" ? value.toLocaleString() : value}
          </p>
          {description && (
            <p className="mt-1 text-sm text-gray-400">{description}</p>
          )}
          {trend && (
            <div className="mt-2 flex items-center gap-1">
              <span
                className={clsx(
                  "text-xs font-medium",
                  trend.positive !== false
                    ? "text-green-600"
                    : "text-red-600"
                )}
              >
                {trend.positive !== false ? "+" : ""}
                {trend.value}%
              </span>
              <span className="text-xs text-gray-400">{trend.label}</span>
            </div>
          )}
        </div>
        {icon && (
          <div className="ml-4 p-3 bg-primary-50 rounded-xl text-primary-600">
            {icon}
          </div>
        )}
      </div>
    </div>
  );
}
