// src/shared/utils/formatCurrency.js

const CURRENCY_SYMBOLS = {
  USD: '$',
  CAD: 'CA$',
  EUR: '€',
  GBP: '£',
  AUD: 'A$',
  MXN: 'MX$',
  JPY: '¥',
  CHF: 'CHF ',
  SEK: 'kr',
  NOK: 'kr',
  DKK: 'kr',
  NZD: 'NZ$',
  HKD: 'HK$',
  SGD: 'S$',
  ZAR: 'R',
  BRL: 'R$',
};

/**
 * Format a numeric amount as a currency string.
 * @param {number|string|null} amount
 * @param {string} currencyCode  e.g. 'USD', 'CAD', 'EUR'
 * @returns {string}  e.g. '$12.50', 'CA$12.50', '€12.50'
 */
export function formatCurrency(amount, currencyCode = 'USD') {
  const symbol = CURRENCY_SYMBOLS[currencyCode] ?? `${currencyCode} `;
  const value  = parseFloat(amount ?? 0);
  return `${symbol}${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Same as formatCurrency but returns '—' when amount is null/undefined/empty string.
 * Use this wherever a missing cost should show a dash rather than $0.00.
 */
export function formatCurrencyOrDash(amount, currencyCode = 'USD') {
  if (amount == null || amount === '') return '—';
  return formatCurrency(amount, currencyCode);
}
