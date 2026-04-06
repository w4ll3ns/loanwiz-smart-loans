/**
 * Funções compartilhadas de cálculo de juros e contratos.
 */

export type TipoJuros = "simples" | "parcela" | "composto";

export interface DadosContrato {
  valor_emprestado: number;
  percentual: number;
  numero_parcelas: number;
  tipo_juros: TipoJuros;
}

/**
 * Calcula o valor total de um contrato com base no tipo de juros.
 */
export function calcularValorTotal(
  valorEmprestado: number,
  percentual: number,
  numeroParcelas: number,
  tipoJuros: TipoJuros
): number {
  switch (tipoJuros) {
    case "parcela":
      return valorEmprestado + (valorEmprestado * (percentual / 100) * numeroParcelas);
    case "composto":
      return valorEmprestado * Math.pow(1 + (percentual / 100), numeroParcelas);
    case "simples":
    default:
      return valorEmprestado + (valorEmprestado * percentual / 100);
  }
}

/**
 * Calcula os juros de uma parcela individual baseado no valor principal.
 * Fórmula: (valor_emprestado / numero_parcelas) * percentual / 100
 */
export function calcularJurosParcela(
  valorEmprestado: number,
  numeroParcelas: number,
  percentual: number
): number {
  const valorPrincipalParcela = valorEmprestado / numeroParcelas;
  return (valorPrincipalParcela * percentual) / 100;
}

/**
 * Calcula o lucro (juros recebidos) de uma parcela paga.
 * lucro = valor_pago - (valor_emprestado / numero_parcelas)
 */
export function calcularLucroParcela(
  valorPago: number,
  valorEmprestado: number,
  numeroParcelas: number
): number {
  const principalParcela = valorEmprestado / numeroParcelas;
  return Math.max(valorPago - principalParcela, 0);
}

/**
 * Retorna a explicação textual do tipo de juros.
 */
export function getExplicacaoJuros(
  tipoJuros: TipoJuros,
  valor: number,
  percentual: number,
  parcelas: number
): string {
  switch (tipoJuros) {
    case "simples": {
      const juros = valor * (percentual / 100);
      return `Juros Fixo: O percentual (${percentual}%) é aplicado uma única vez sobre o valor emprestado. Exemplo: ${percentual}% de R$ ${valor.toLocaleString('pt-BR')} = R$ ${juros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} de juros total.`;
    }
    case "parcela": {
      const juros = valor * (percentual / 100) * parcelas;
      return `Juros por Parcela: O percentual (${percentual}%) é multiplicado pelo número de parcelas (${parcelas}x). Exemplo: ${percentual}% × ${parcelas} parcelas = ${percentual * parcelas}% total. Juros = R$ ${juros.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
    }
    case "composto": {
      const valorFinal = valor * Math.pow(1 + (percentual / 100), parcelas);
      return `Juros Composto: Os juros incidem sobre o montante do mês anterior (juros sobre juros). Exemplo com ${parcelas} meses: Mês 1: R$ ${(valor * (1 + percentual / 100)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Mês 2: R$ ${(valor * Math.pow(1 + percentual / 100, 2)).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}, Mês 3: R$ ${valorFinal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}.`;
    }
    default:
      return "";
  }
}

/**
 * Retorna o label do tipo de juros.
 */
export function getLabelTipoJuros(tipoJuros: string): string {
  switch (tipoJuros) {
    case "parcela": return "Por Parcela";
    case "composto": return "Composto";
    case "simples": return "Fixo";
    default: return tipoJuros;
  }
}

/**
 * Formata valor em reais.
 */
export function formatarMoeda(valor: number): string {
  return `R$ ${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`;
}

/**
 * Remove acentos de texto para busca normalizada.
 */
export function removerAcentos(texto: string): string {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

/**
 * Calcula dias de atraso de uma parcela.
 */
export function calcularDiasAtraso(dataVencimento: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const vencimento = new Date(dataVencimento + 'T00:00:00');
  const diffTime = hoje.getTime() - vencimento.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

/**
 * Formata data no formato dd/MM/yyyy evitando problemas de timezone.
 */
export function formatDateSafe(dateString: string): string {
  const { format } = require('date-fns');
  return format(new Date(dateString + 'T00:00:00'), 'dd/MM/yyyy');
}
