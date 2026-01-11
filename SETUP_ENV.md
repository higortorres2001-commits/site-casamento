# 🛠️ Configuração de Ambiente e Integrações (Setup Guide)

Este documento é a **fonte oficial** de todas as configurações, tokens e segredos necessários para rodar o projeto **DuetLove** (Frontend + Backend Supabase).

---

## 📋 Resumo Rápido

Para o sistema funcionar, você precisa configurar 3 serviços principais:
1.  **Supabase** (Banco de dados e Edge Functions)
2.  **Resend** (Envio de e-mails transacionais)
3.  **Asaas** (Pagamentos via PIX/Cartão)
4.  **Vercel** (Hospedagem e Cron Jobs)

---

## 1. Frontend (Vite/React)

O frontend precisa se conectar ao Supabase.

### Arquivo `.env` (Recomendado)
Crie um arquivo `.env` na raiz do projeto (`/`) com as chaves públicas do seu projeto Supabase:

```env
VITE_SUPABASE_URL=https://seu-projeto.supabase.co
VITE_SUPABASE_ANON_KEY=sua-chave-publica-anon-key
```

> **Nota:** Atualmente, o arquivo `src/integrations/supabase/client.ts` pode conter chaves "hardcoded". Para maior segurança, recomendamos usar o `.env`.

---

## 2. Supabase Edge Functions (Backend)

As funções do servidor (em `supabase/functions/`) são cruciais para pagamentos e e-mails. Elas **NÃO** leem o arquivo `.env` da raiz. Você deve configurar os "Secrets" diretamente no painel do Supabase.

### 🔑 Lista Mestra de Segredos (Supabase Secrets)

Adicione estas variáveis em **Supabase Dashboard > Project Settings > Edge Functions > Secrets**:

| Nome da Variável | Serviço | Descrição | Exemplo |
| :--- | :--- | :--- | :--- |
| `RESEND_API_KEY` | Resend | Chave para enviar e-mails. | `re_123456...` |
| `EMAIL_FROM` | Resend | Remetente verificado. | `Noivos <ola@casamento.com>` |
| `APP_URL` | Geral | URL do site (para links nos e-mails). | `https://casamento.com.br` |
| `CRON_SECRET` | Cron | Senha para proteger o disparo diário. | `token-secreto-aleatorio` |
| `ASAAS_API_KEY` | Asaas | Chave de API de pagamentos. | `$aact_...` |
| `ASAAS_API_URL` | Asaas | URL da API (Sandbox ou Prod). | `https://www.asaas.com/api/v3` |
| `ASAAS_WEBHOOK_TOKEN`| Asaas | Token para validar notificações (opcional). | `token-webhook` |

### 🚀 Comando Rápido (Via Terminal)
Se você tiver o [Supabase CLI](https://supabase.com/docs/guides/cli) instalado:

```bash
supabase secrets set RESEND_API_KEY=re_seuchave \
  EMAIL_FROM="Operação Casamento <ola@seudominio.com>" \
  APP_URL=https://seudominio.com \
  CRON_SECRET=token-secreto-seguro \
  ASAAS_API_KEY=$aact_suachave \
  ASAAS_API_URL=https://www.asaas.com/api/v3
```

---

## 3. Configuração do Resend (E-mails)

O sistema usa o Resend para enviar recibos de presentes e resumos diários.

1.  Crie uma conta em [Resend.com](https://resend.com).
2.  Cadastre e verifique seu domínio (DNS Records).
3.  Gere uma **API Key** com permissão de envio.
4.  Adicione a chave como `RESEND_API_KEY` no Supabase.
5.  Defina `EMAIL_FROM` no Supabase com o e-mail verificado.

---

## 4. Configuração do Asaas (Pagamentos)

O sistema usa o Asaas para gerar PIX e Cartão de Crédito transparente.

1.  Crie uma conta no [Asaas](https://www.asaas.com) (Use [Sandbox](https://sandbox.asaas.com) para testes).
2.  Vá em **Minha Conta > Integração**.
3.  Gere a **API Key**.
4.  Configure no Supabase:
    *   **Teste:** `ASAAS_API_URL` = `https://sandbox.asaas.com/api/v3`
    *   **Produção:** `ASAAS_API_URL` = `https://www.asaas.com/api/v3`
5.  Configure o Webhook no painel do Asaas para receber atualizações de pagamento:
    *   **URL:** `https://seu-projeto.supabase.co/functions/v1/asaas-webhook`
    *   **Eventos:** `PAYMENT_RECEIVED`, `PAYMENT_CONFIRMED`, `PAYMENT_OVERDUE`.

---

## 5. Daily Digest (Resumo Diário)

O "Daily Digest" envia um e-mail às 20h para os noivos com o resumo do dia.

### Como funciona:
O **Vercel Cron** chama a rota `/api/cron/daily-digest` (ou direto a Edge Function), que verifica o `CRON_SECRET`.

### Configuração na Vercel:
1.  No arquivo `vercel.json` (já configurado), existe a definição do cron job.
2.  No painel da Vercel (**Settings > Environment Variables**), adicione:
    *   `CRON_SECRET`: O mesmo valor definido nos Secrets do Supabase.
    *   `SUPABASE_URL`: URL do projeto Supabase.
    *   `SUPABASE_SERVICE_ROLE_KEY` (Opcional, se a rota da API precisar de acesso admin direto, mas geralmente a Edge Function cuida disso).

---

## 6. Desenvolvimento Local

Para rodar o projeto localmente:

1.  **Frontend**:
    ```bash
    npm install
    npm run dev
    ```
2.  **Edge Functions (Simulação)**:
    Para testar funções localmente, você precisa de um arquivo `.env` dentro da pasta `supabase/`.
    ```bash
    # supabase/.env
    RESEND_API_KEY=...
    ASAAS_API_KEY=...
    ...
    ```
    Execute:
    ```bash
    supabase functions serve --env-file supabase/.env
    ```

---

## ⚠️ Checklist de Troubleshooting

*   **Erro 500 no Webhook:** Verifique se `ASAAS_API_KEY` está correta no Supabase.
*   **E-mail não chega:** Verifique se o domínio no `EMAIL_FROM` está verificado no painel do Resend.
*   **Pagamento não atualiza:** Verifique se a URL do Webhook no Asaas está apontando para o projeto correto.
*   **Checkout falha:** Verifique logs da função `create-asaas-payment` no painel do Supabase.

---
**Dúvidas?** Consulte a documentação oficial do [Supabase](https://supabase.com/docs) ou dos serviços integrados.

---

## 7. Monitoramento de Erros (Sentry)

O sistema usa o Sentry para monitorar erros no Frontend (React) e Backend (Edge Functions).

### Configuração:

#### A. Frontend (Vercel)
Adicione nas **Environment Variables** do projeto na Vercel:

| Nome da Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `VITE_SENTRY_DSN` | DSN do projeto React no Sentry. | `https://xxxx@yyy.ingest.sentry.io/zzzz` |

#### B. Backend (Supabase)
Adicione nos **Secrets** das Edge Functions no Supabase Dashboard:

| Nome da Variável | Descrição | Exemplo |
| :--- | :--- | :--- |
| `SENTRY_DSN` | DSN do projeto Deno/Node no Sentry. | `https://xxxx@yyy.ingest.sentry.io/zzzz` |

> **Nota:** Você pode usar a mesma DSN para ambos ou criar projetos separados no Sentry (recomendado) para melhor organização.
