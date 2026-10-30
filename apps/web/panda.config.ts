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
        colors: {
          // Cores primárias de identidade visual
          brand: {
            50: { value: '#eef2ff' },
            100: { value: '#e0e7ff' },
            500: { value: '#6366f1' },
            600: { value: '#4f46e5' },
            700: { value: '#4338ca' },
          },
          // Sucesso e Entradas financeiras (Income / Salários / Rendimentos)
          income: {
            50: { value: '#ecfdf5' },
            100: { value: '#d1fae5' },
            200: { value: '#a7f3d0' },
            400: { value: '#34d399' },
            500: { value: '#10b981' },
            600: { value: '#059669' },
            700: { value: '#047857' },
          },
          // Alerta e Saídas / Dívidas (Expense / Contas / Dívidas)
          expense: {
            50: { value: '#fef2f2' },
            100: { value: '#fee2e2' },
            200: { value: '#fecaca' },
            400: { value: '#f87171' },
            500: { value: '#ef4444' },
            600: { value: '#dc2626' },
            700: { value: '#b91c1c' },
          },
          // Atenção e Vencimentos próximos
          warning: {
            50: { value: '#fffbeb' },
            100: { value: '#fef3c7' },
            500: { value: '#f59e0b' },
            600: { value: '#d97706' },
          },
          // Superfícies neutras
          slate: {
            50: { value: '#f8fafc' },
            100: { value: '#f1f5f9' },
            200: { value: '#e2e8f0' },
            300: { value: '#cbd5e1' },
            400: { value: '#94a3b8' },
            500: { value: '#64748b' },
            600: { value: '#475569' },
            700: { value: '#334155' },
            800: { value: '#1e293b' },
            900: { value: '#0f172a' },
          },
        },
      },
      semanticTokens: {
        colors: {
          brand: {
            primary: { value: 'var(--profile-primary)' },
            primaryHover: { value: 'var(--profile-primary-hover)' },
            primarySoft: { value: 'var(--profile-primary-soft)' },
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

          borderDefault: { value: '{colors.slate.200}' },
          borderHover: { value: '{colors.slate.300}' },
          bgCard: { value: '#ffffff' },
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
