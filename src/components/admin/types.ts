export interface AuditLog {
  id: string;
  user_id: string;
  action: string;
  target_user_id: string | null;
  details: Record<string, unknown>;
  created_at: string;
}

export interface Profile {
  id: string;
  email: string | null;
  nome: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
  ultimo_acesso: string | null;
  status_plano: string | null;
  data_expiracao_teste: string | null;
  observacoes_admin: string | null;
}

export interface Stats {
  totalUsuarios: number;
  usuariosAtivos: number;
  totalClientes: number;
  totalContratos: number;
  valorTotalEmprestado: number;
}

export interface UserStats {
  total_clientes: number;
  total_contratos: number;
  valor_emprestado: number;
  valor_a_receber: number;
  valor_recebido: number;
}

export interface UserContrato {
  id: string;
  cliente_nome: string;
  valor_emprestado: number;
  valor_total: number;
  status: string;
  data_emprestimo: string;
  numero_parcelas: number;
  periodicidade: string;
}

export interface UserCliente {
  id: string;
  nome: string;
  telefone: string | null;
  endereco: string | null;
}

export type StatusPlano = 'teste' | 'ativo' | 'expirado' | 'cancelado';