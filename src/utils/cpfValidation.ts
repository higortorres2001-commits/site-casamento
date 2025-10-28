export const isValidCPF = (cpf: string): boolean => {
  if (typeof cpf !== "string") return false;
  cpf = cpf.replace(/[^\d]+/g, ""); // Remove non-numeric characters

  if (cpf.length !== 11 || !!cpf.match(/(\d)\1{10}/)) return false;

  const CpfNumbers = cpf.split("").map((el) => +el);
  const rest = (count: number): number => {
    return (
      ((CpfNumbers.slice(0, count).reduce((sum, el, index) => sum + el * (count + 1 - index), 0) *
        10) %
        11) %
      10
    );
  };

  return rest(9) === CpfNumbers[9] && rest(10) === CpfNumbers[10];
};

export const formatCPF = (cpf: string): string => {
  if (!cpf) return "";
  cpf = cpf.replace(/\D/g, ""); // Remove tudo o que não é dígito
  cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2"); // Coloca um ponto entre o terceiro e o quarto dígitos
  cpf = cpf.replace(/(\d{3})(\d)/, "$1.$2"); // Coloca um ponto entre o sexto e o sétimo dígitos
  cpf = cpf.replace(/(\d{3})(\d{1,2})$/, "$1-$2"); // Coloca um hífen entre o nono e o décimo dígitos
  return cpf;
};