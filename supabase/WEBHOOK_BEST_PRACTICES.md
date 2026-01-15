# Boas Práticas para Webhooks - Sistema de Casamento

> **Última Atualização:** 15/01/2026  
> **Problema Resolvido:** Webhook Asaas penalizado por timeout

---

## 📋 Resumo do Problema

Gateways de pagamento como **Asaas**, **Stripe**, e **PagSeguro** penalizam webhooks que:
1. **Demoram mais de 5-10 segundos** para responder HTTP 200
2. **Retornam erros** (HTTP 4xx/5xx) repetidamente
3. **Não respondem** (timeout)

### Penalizações Típicas:
- Aumento do intervalo entre retentativas (exponential backoff)
- Desativação automática do webhook
- Bloqueio temporário do endpoint

---

## ✅ Padrão Implementado: "Acknowledge First, Process Later"

### Fluxo Correto:
```
1. Receber webhook
2. Validar assinatura (rápido)
3. Fazer APENAS operação crítica (update de status)
4. Retornar HTTP 200 IMEDIATAMENTE
5. Processar emails/notificações em BACKGROUND
```

### Tempo de Resposta Ideal:
| Operação | Tempo Máximo |
|----------|--------------|
| Resposta HTTP 200 | < 500ms |
| Operação crítica (update DB) | < 1s |
| Total antes do return | < 2s |

---

## 🔍 Edge Functions Afetadas no Sistema

### 1. `asaas-webhook` ✅ CORRIGIDO
**Localização:** `supabase/functions/asaas-webhook/index.ts`

**Eventos Processados:**
- `PAYMENT_CREATED` → Ignorado (apenas acknowledge)
- `PAYMENT_CONFIRMED` → Processa pagamento
- `PAYMENT_RECEIVED` → Processa pagamento

**Operações em Background:**
- Atualização de quantidade de presentes
- Envio de emails (recibo, primeiro presente)
- Meta Conversion API (CAPI)

**Status:** ✅ Refatorado para resposta rápida

---

### 2. `create-asaas-payment` ⚠️ VERIFICAR
**Localização:** `supabase/functions/create-asaas-payment/index.ts`

**Potenciais Riscos:**
- Não é webhook, mas pode ter timeout longo
- Chamadas sequenciais ao Asaas API
- Emails disparados sincronamente

**Recomendação:** Verificar se há operações que podem ser movidas para background.

---

### 3. `send-gift-receipt` ⚠️ VERIFICAR
**Localização:** `supabase/functions/send-gift-receipt/index.ts`

**Potenciais Riscos:**
- Envio de email pode demorar
- Se chamado por webhook, pode contribuir para timeout

**Recomendação:** Garantir que não seja chamado sincronamente por webhooks.

---

## 🛠️ Checklist para Novos Webhooks

Antes de implementar qualquer novo webhook, verifique:

- [ ] **Resposta rápida:** O endpoint retorna HTTP 200 em menos de 2 segundos?
- [ ] **Operações críticas primeiro:** O update de status acontece ANTES de emails/notificações?
- [ ] **Background processing:** Emails e APIs externas são chamados sem `await`?
- [ ] **Idempotência:** O webhook pode ser chamado múltiplas vezes sem duplicar operações?
- [ ] **Tratamento de erros:** Erros retornam HTTP 200 (com log) para evitar retentativas?
- [ ] **Logs adequados:** Toda operação crítica é logada para debug?

---

## 📝 Código de Referência

### Padrão para Webhook Rápido:
```typescript
serve(async (req) => {
  try {
    const payload = await req.json();
    
    // 1. Validação rápida
    if (!isValidSignature(req)) {
      return new Response(JSON.stringify({ error: 'Invalid signature' }), { status: 401 });
    }
    
    // 2. Operação CRÍTICA (síncrona)
    await updateStatus(payload.id, 'paid');
    
    // 3. Operações SECUNDÁRIAS (background - NÃO usar await)
    processInBackground(payload).catch(console.error);
    
    // 4. Resposta IMEDIATA
    return new Response(JSON.stringify({ success: true }), { status: 200 });
    
  } catch (error) {
    // 5. Erro retorna 200 para evitar retentativas
    logger.critical('Webhook failed', { error });
    return new Response(JSON.stringify({ success: false }), { status: 200 });
  }
});
```

---

## 🔗 Links Úteis

- [Asaas - Documentação de Webhooks](https://docs.asaas.com/reference/webhooks)
- [Stripe - Best Practices for Webhooks](https://stripe.com/docs/webhooks/best-practices)
- [Supabase Edge Functions](https://supabase.com/docs/guides/functions)

---

## 📊 Monitoramento

### Como verificar se há problemas:
1. Acessar painel do Asaas → Integrações → Webhooks
2. Verificar taxa de sucesso (deve ser > 99%)
3. Verificar tempo médio de resposta (deve ser < 2s)

### Logs no Sistema:
```sql
SELECT * FROM logs 
WHERE context = 'asaas-webhook' 
AND level = 'error'
ORDER BY created_at DESC
LIMIT 20;
```

---

## ⚠️ Histórico de Incidentes

### 15/01/2026 - Webhook Penalizado
**Problema:** Evento `PAYMENT_CREATED` causou timeout.  
**Causa:** Operações de email e DB executadas sincronamente.  
**Solução:** Refatoração para padrão "Acknowledge First, Process Later".  
**Arquivos Alterados:** `supabase/functions/asaas-webhook/index.ts`
