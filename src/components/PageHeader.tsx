import { ReactNode } from "react";

interface PageHeaderProps {
  title: string;
  description?: string;
  children?: ReactNode;
}

export function PageHeader({ title, description, children }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
      <div className="page-header">
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {children && <div className="flex gap-2 flex-wrap">{children}</div>}
    </div>
  );
}
