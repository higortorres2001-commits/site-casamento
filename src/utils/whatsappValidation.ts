export const formatWhatsapp = (phone: string): string => {
  if (!phone) return "";
  phone = phone.replace(/\D/g, ""); // Remove tudo o que não é dígito

  if (phone.length > 11) {
    phone = phone.substring(0, 11);
  }

  if (phone.length > 10) {
    // (XX) XXXXX-XXXX
    return phone.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  } else if (phone.length > 6) {
    // (XX) XXXX-XXXX
    return phone.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  } else if (phone.length > 2) {
    // (XX) XXXX
    return phone.replace(/(\d{2})(\d)/, "($1) $2");
  } else if (phone.length > 0) {
    // (XX
    return phone.replace(/(\d*)/, "($1");
  }
  return phone;
};

export const isValidWhatsapp = (phone: string): boolean => {
  if (typeof phone !== "string") return false;
  phone = phone.replace(/\D/g, ""); // Remove non-numeric characters
  // Basic validation: 10 or 11 digits for Brazilian numbers
  return phone.length === 10 || phone.length === 11;
};