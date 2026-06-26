import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Users, FileText, Calculator, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

interface ClienteHit { id: string; nome: string; telefone?: string | null; }
interface ContratoHit { id: string; nome: string; }
interface ParcelaHit { id: string; nome: string; }

interface GlobalSearchProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function GlobalSearch({ open, onOpenChange }: GlobalSearchProps) {
  const navigate = useNavigate();
  const [term, setTerm] = useState("");
  const [loading, setLoading] = useState(false);
  const [clientes, setClientes] = useState<ClienteHit[]>([]);
  const [contratos, setContratos] = useState<ContratoHit[]>([]);
  const [parcelas, setParcelas] = useState<ParcelaHit[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  // Reset when closing
  useEffect(() => {
    if (!open) {
      setTerm("");
      setClientes([]);
      setContratos([]);
      setParcelas([]);
      setLoading(false);
    }
  }, [open]);

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    const q = term.trim();
    if (q.length < 2) {
      setClientes([]);
      setContratos([]);
      setParcelas([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    debounceRef.current = setTimeout(async () => {
      const like = `%${q}%`;
      const [cliRes, contRes, parcRes] = await Promise.all([
        supabase
          .from("clientes")
          .select("id, nome, telefone")
          .or(`nome.ilike.${like},telefone.ilike.${like}`)
          .order("nome")
          .limit(5),
        supabase
          .from("contratos")
          .select("id, clientes!inner(nome)")
          .ilike("clientes.nome", like)
          .limit(5),
        supabase
          .from("parcelas")
          .select("id, contratos!inner(clientes!inner(nome))")
          .in("status", ["pendente", "parcialmente_pago"])
          .ilike("contratos.clientes.nome", like)
          .limit(5),
      ]);

      setClientes((cliRes.data as ClienteHit[]) || []);
      setContratos(
        ((contRes.data as any[]) || []).map((c) => ({
          id: c.id,
          nome: c.clientes?.nome ?? "—",
        })),
      );
      setParcelas(
        ((parcRes.data as any[]) || []).map((p) => ({
          id: p.id,
          nome: p.contratos?.clientes?.nome ?? "—",
        })),
      );
      setLoading(false);
    }, 250);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [term]);

  const go = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  const hasResults = clientes.length > 0 || contratos.length > 0 || parcelas.length > 0;

  return (
    <CommandDialog open={open} onOpenChange={onOpenChange} shouldFilter={false}>
      <CommandInput
        placeholder="Buscar cliente, contrato ou parcela…"
        value={term}
        onValueChange={setTerm}
      />
      <CommandList>
        {loading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" /> Buscando…
          </div>
        )}
        {!loading && term.trim().length >= 2 && !hasResults && (
          <CommandEmpty>Nenhum resultado encontrado.</CommandEmpty>
        )}
        {!loading && term.trim().length < 2 && (
          <div className="py-6 text-center text-sm text-muted-foreground">
            Digite ao menos 2 caracteres para buscar.
          </div>
        )}

        {clientes.length > 0 && (
          <CommandGroup heading="Clientes">
            {clientes.map((c) => (
              <CommandItem
                key={`cli-${c.id}`}
                value={`cli-${c.id}`}
                onSelect={() => go(`/clientes?q=${encodeURIComponent(c.nome)}`)}
              >
                <Users className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{c.nome}</span>
                {c.telefone && (
                  <span className="ml-auto text-xs text-muted-foreground">{c.telefone}</span>
                )}
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {contratos.length > 0 && (
          <CommandGroup heading="Contratos">
            {contratos.map((c) => (
              <CommandItem
                key={`cont-${c.id}`}
                value={`cont-${c.id}`}
                onSelect={() => go(`/contratos?open=${c.id}`)}
              >
                <FileText className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{c.nome}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}

        {parcelas.length > 0 && (
          <CommandGroup heading="Parcelas">
            {parcelas.map((p) => (
              <CommandItem
                key={`parc-${p.id}`}
                value={`parc-${p.id}`}
                onSelect={() => go(`/parcelas?q=${encodeURIComponent(p.nome)}`)}
              >
                <Calculator className="mr-2 h-4 w-4 text-muted-foreground" />
                <span className="truncate">{p.nome}</span>
              </CommandItem>
            ))}
          </CommandGroup>
        )}
      </CommandList>
    </CommandDialog>
  );
}
