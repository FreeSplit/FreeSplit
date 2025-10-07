export const formatAmount = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '0.00';
  }

  return value.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
};
