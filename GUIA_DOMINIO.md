# Guia de Configuração de Domínio Personalizado

Este guia explica todas as configurações necessárias para usar um domínio personalizado no site de casamento.

## Domínio Alvo
- **Domínio:** `casei.sejatudoqueveiopraser.com.br`
- **Status do CORS:** ✅ Já configurado

---

## Checklist de Configuração

### 1. Vercel (Hospedagem)

1. Acesse [Vercel Dashboard](https://vercel.com/dashboard)
2. Selecione o projeto `site-casamento`
3. Vá em **Settings → Domains**
4. Clique em **Add Domain**
5. Digite: `casei.sejatudoqueveiopraser.com.br`
6. Anote os registros DNS fornecidos pela Vercel

### 2. DNS do Domínio

No painel do seu provedor de domínio (onde registrou `sejatudoqueveiopraser.com.br`):

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| CNAME | casei | cname.vercel-dns.com | 3600 |

Ou se preferir usar A record:

| Tipo | Nome | Valor | TTL |
|------|------|-------|-----|
| A | casei | 76.76.21.21 | 3600 |

> **Nota:** A propagação DNS pode levar até 48 horas, mas geralmente é rápida (minutos).

### 3. Supabase Edge Functions (CORS)

✅ **Já configurado!** O domínio foi adicionado em:
```
supabase/functions/_shared/cors.ts
```

Após adicionar novos domínios, sempre fazer deploy:
```bash
npx supabase functions deploy --project-ref afgbyzukzpdgkpmnvihb
```

### 4. Supabase Auth (Redirect URLs)

1. Acesse [Supabase Dashboard](https://supabase.com/dashboard)
2. Selecione o projeto → **Authentication** → **URL Configuration**
3. Em **Redirect URLs**, adicione:
   - `https://casei.sejatudoqueveiopraser.com.br/**`

### 5. Asaas (Opcional - Se mudar Webhook)

Se quiser que os emails de confirmação mostrem o novo domínio:
1. Acesse o painel Asaas
2. Vá em **Integrações → Webhooks**
3. Verifique se a URL do webhook está correta:
   - `https://afgbyzukzpdgkpmnvihb.supabase.co/functions/v1/asaas-webhook`
   
> **Nota:** O webhook do Supabase não muda, só o frontend muda de domínio.

---

## Verificação Pós-Configuração

Após configurar tudo, verifique:

1. [ ] Site abre em `https://casei.sejatudoqueveiopraser.com.br`
2. [ ] Certificado SSL está ativo (cadeado verde)
3. [ ] Login funciona normalmente
4. [ ] Checkout e pagamento funcionam
5. [ ] Webhooks Asaas processam corretamente

---

## Solução de Problemas

| Problema | Solução |
|----------|---------|
| Erro de CORS | Verifique se o domínio está em `cors.ts` e fez deploy |
| "Redirect URI mismatch" | Adicione URL no Supabase Auth |
| Site não carrega | Verifique propagação DNS com `dig casei.sejatudoqueveiopraser.com.br` |
| SSL inválido | Aguarde até 24h para emissão automática pela Vercel |

---

## Comandos Úteis

```bash
# Deploy de todas as Edge Functions
npx supabase functions deploy --project-ref afgbyzukzpdgkpmnvihb

# Verificar DNS
dig casei.sejatudoqueveiopraser.com.br

# Testar se CORS está funcionando
curl -I -X OPTIONS https://afgbyzukzpdgkpmnvihb.supabase.co/functions/v1/create-asaas-payment \
  -H "Origin: https://casei.sejatudoqueveiopraser.com.br"
```
