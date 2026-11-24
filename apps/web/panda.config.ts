import { defineConfig } from '@pandacss/dev';

export default defineConfig({
  // Ativa presets padrão do Panda
  preflight: true,

  // Arquivos a serem escaneados por classes/recipes
  include: ['./src/**/*.{js,jsx,ts,tsx}'],

  // Arquivos ignorados
  exclude: [],

  // Framework JSX alvo
  jsxFramework: 'react',

  // Configuração do Tema
  theme: {
    extend: {
      tokens: {
        fontSizes: { '2xs': { value: '0.75rem' } },
        fonts: {
          heading: { value: 'Baskerville, "Baskerville Old Face", Georgia, serif' },
          body: { value: '"Segoe UI", Roboto, Arial, sans-serif' },
        },
        radii: {
          md: { value: '4px' },
          lg: { value: '5px' },
          xl: { value: '7px' },
          '2xl': { value: '8px' },
        },
        colors: {
          paper: { value: '#fffef8' },
          // Cores primárias de identidade visual
          brand: {
            50: { value: '#e8efeb' },
            100: { value: '#d5e4de' },
            200: { value: '#b9d0c6' },
            500: { value: '#466f63' },
            600: { value: '#244e42' },
            700: { value: '#193b33' },
          },
          // Sucesso e Entradas financeiras (Income / Salários / Rendimentos)
          income: {
            50: { value: '#edf3ec' },
            100: { value: '#e1ebdf' },
            200: { value: '#c6d7c3' },
            300: { value: '#abc3a7' },
            400: { value: '#86a481' },
            500: { value: '#52744f' },
            600: { value: '#456644' },
            700: { value: '#345632' },
          },
          // Alerta e Saídas / Dívidas (Expense / Contas / Dívidas)
          expense: {
            50: { value: '#f8eeea' },
            100: { value: '#f0ddd6' },
            200: { value: '#ddc1b8' },
            300: { value: '#cca499' },
            400: { value: '#b28072' },
            500: { value: '#9b5e4f' },
            600: { value: '#914e40' },
            700: { value: '#7c4035' },
            800: { value: '#64352d' },
          },
          // Atenção e Vencimentos próximos
          warning: {
            50: { value: '#f8f1df' },
            100: { value: '#f2e5bf' },
            200: { value: '#e2d2a5' },
            500: { value: '#946719' },
            600: { value: '#825a16' },
            700: { value: '#69480e' },
          },
          // Superfícies neutras
          slate: {
            50: { value: '#f7f6f0' },
            100: { value: '#eeeee6' },
            200: { value: '#d8dbcf' },
            300: { value: '#a9afa1' },
            400: { value: '#687266' },
            500: { value: '#596458' },
            600: { value: '#495549' },
            700: { value: '#354137' },
            800: { value: '#2b372d' },
            900: { value: '#202e26' },
          },
        },
      },
      semanticTokens: {
        colors: {
          brand: {
            primary: { value: '{colors.brand.600}' },
            primaryHover: { value: '{colors.brand.700}' },
            primarySoft: { value: '{colors.brand.50}' },
            secondary: { value: 'var(--profile-secondary)' },
            secondarySoft: { value: 'var(--profile-secondary-soft)' },
          },
          // Tokens semânticos para UI financeira
          incomeText: { value: '{colors.income.700}' },
          incomeBg: { value: '{colors.income.50}' },
          incomeBorder: { value: '{colors.income.200}' },

          expenseText: { value: '{colors.expense.700}' },
          expenseBg: { value: '{colors.expense.50}' },
          expenseBorder: { value: '{colors.expense.200}' },

          fieldBorder: { value: '#858e80' },
          borderDefault: { value: '{colors.slate.200}' },
          borderHover: { value: '{colors.slate.300}' },
          bgCard: { value: '{colors.paper}' },
          textMuted: { value: '{colors.slate.500}' },
        },
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0', transform: 'translateY(-6px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
    },
  },

  // Pasta de saída do sistema de estilos gerado
  outdir: 'styled-system',
});
