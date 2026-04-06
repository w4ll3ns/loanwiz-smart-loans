import { useState, useMemo } from "react";

export function usePagination<T>(items: T[], itemsPerPage = 20) {
  const [currentPage, setCurrentPage] = useState(1);

  const totalPages = Math.ceil(items.length / itemsPerPage);
  const showPagination = items.length > itemsPerPage;

  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * itemsPerPage;
    return items.slice(start, start + itemsPerPage);
  }, [items, currentPage, itemsPerPage]);

  // Reset to page 1 when items change significantly
  const safeCurrentPage = currentPage > totalPages ? 1 : currentPage;
  if (safeCurrentPage !== currentPage && totalPages > 0) {
    setCurrentPage(1);
  }

  return {
    paginatedItems,
    currentPage,
    totalPages,
    showPagination,
    setCurrentPage,
    goToNextPage: () => setCurrentPage((p) => Math.min(p + 1, totalPages)),
    goToPrevPage: () => setCurrentPage((p) => Math.max(p - 1, 1)),
  };
}
