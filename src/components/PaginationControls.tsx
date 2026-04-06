import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface PaginationControlsProps {
  currentPage: number;
  totalPages: number;
  onPrevPage: () => void;
  onNextPage: () => void;
}

export function PaginationControls({
  currentPage,
  totalPages,
  onPrevPage,
  onNextPage,
}: PaginationControlsProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-center gap-4 py-4">
      <Button
        variant="outline"
        size="sm"
        onClick={onPrevPage}
        disabled={currentPage <= 1}
      >
        <ChevronLeft className="h-4 w-4 mr-1" />
        Anterior
      </Button>
      <span className="text-sm text-muted-foreground">
        Página {currentPage} de {totalPages}
      </span>
      <Button
        variant="outline"
        size="sm"
        onClick={onNextPage}
        disabled={currentPage >= totalPages}
      >
        Próximo
        <ChevronRight className="h-4 w-4 ml-1" />
      </Button>
    </div>
  );
}
