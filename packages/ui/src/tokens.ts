export const brandTokens = {
  colors: {
    gold: '#CBA624',
    navy: '#261F53',
  },
  orderIdPrefix: 'VS',
  brandName: 'Versuitality',
} as const;

export type BrandTokens = typeof brandTokens;
