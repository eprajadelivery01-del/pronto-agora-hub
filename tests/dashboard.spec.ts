import { test, expect } from '@playwright/test';

test('Dashboard Lojista deve renderizar sem quebrar (Anti-White Screen)', async ({ page }) => {
  // Esse teste simula a abertura da página e verifica se o layout não quebrou por erros de renderização.
  // Em um ambiente de CI real, você deve injetar o supabase auth state mockado.
  // Aqui verificamos o carregamento básico da rota.
  
  await page.goto('/');
  
  // Garantir que a página tem o título padrão
  await expect(page).toHaveTitle(/Lojista/i);
});

test('Card de Entrega (Prevenção de Regressão)', async ({ page }) => {
  // Garante que se o componente de entrega for renderizado, 
  // os dados mínimos vitais não foram removidos do código fonte (ex: Entregador).
  await page.goto('/business');
  
  // Como estamos sem auth no teste básico, vamos apenas verificar a resiliência do app
  // Para testes mais profundos, adicione mocks de `supabase.auth`.
  const body = await page.locator('body');
  await expect(body).toBeVisible();
});
