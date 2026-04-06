import { useEffect, useState } from "react";
import { Bell } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";
import { format } from "date-fns";

interface ParcelaVencimento {
  id: string;
  data_vencimento: string;
  valor: number;
  clienteNome: string;
  tipo: "hoje" | "amanha";
}

export function NotificacoesVencimento() {
  const [parcelas, setParcelas] = useState<ParcelaVencimento[]>([]);

  useEffect(() => {
    loadNotificacoes();
  }, []);

  const loadNotificacoes = async () => {
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const amanha = new Date(hoje);
    amanha.setDate(amanha.getDate() + 1);

    const hojeStr = format(hoje, "yyyy-MM-dd");
    const amanhaStr = format(amanha, "yyyy-MM-dd");

    const { data, error } = await supabase
      .from("parcelas")
      .select(`
        id, data_vencimento, valor, valor_original, status,
        contratos!inner(
          clientes!inner(nome)
        )
      `)
      .in("data_vencimento", [hojeStr, amanhaStr])
      .in("status", ["pendente", "parcialmente_pago"]);

    if (error || !data) return;

    const mapped: ParcelaVencimento[] = data.map((p: any) => ({
      id: p.id,
      data_vencimento: p.data_vencimento,
      valor: Number(p.valor_original || p.valor),
      clienteNome: p.contratos?.clientes?.nome || "Cliente",
      tipo: p.data_vencimento === hojeStr ? "hoje" : "amanha",
    }));

    setParcelas(mapped);
  };

  const countHoje = parcelas.filter(p => p.tipo === "hoje").length;
  const countAmanha = parcelas.filter(p => p.tipo === "amanha").length;
  const total = parcelas.length;

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative" title="Notificações">
          <Bell className="h-4 w-4" />
          {total > 0 && (
            <span
              className={`absolute -top-1 -right-1 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-bold text-primary-foreground ${
                countHoje > 0 ? "bg-destructive" : "bg-warning"
              }`}
            >
              {total}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="end">
        <div className="border-b px-4 py-3">
          <h4 className="text-sm font-semibold">Vencimentos Próximos</h4>
          <p className="text-xs text-muted-foreground">
            {total === 0 ? "Nenhum vencimento próximo" : `${total} parcela${total > 1 ? "s" : ""}`}
          </p>
        </div>
        <div className="max-h-64 overflow-y-auto">
          {parcelas.length === 0 ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Tudo em dia! 🎉
            </div>
          ) : (
            parcelas.map((p) => (
              <Link
                key={p.id}
                to="/parcelas"
                className="flex items-center justify-between gap-2 border-b px-4 py-3 hover:bg-muted/50 transition-colors last:border-b-0"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">{p.clienteNome}</p>
                  <p className="text-xs text-muted-foreground">
                    R$ {p.valor.toLocaleString("pt-BR", { minimumFractionDigits: 2 })}
                  </p>
                </div>
                <span
                  className={`flex-shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold text-primary-foreground ${
                    p.tipo === "hoje" ? "bg-destructive" : "bg-warning"
                  }`}
                >
                  {p.tipo === "hoje" ? "Hoje" : "Amanhã"}
                </span>
              </Link>
            ))
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
