# Verificação de identidade do entregador

As duas funções usam Stripe Identity para capturar documento oficial e selfie com prova de vida:

- `create-identity-session`: cria uma sessão autenticada e devolve o link seguro para o entregador.
- `identity-webhook`: recebe o resultado do Stripe e salva somente o status e os checks necessários no Supabase.

Configure estes secrets no projeto antes de publicar:

```text
STRIPE_SECRET_KEY=sk_...
STRIPE_WEBHOOK_SECRET=whsec_...
APP_URL=https://seu-dominio.com
```

O `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` são fornecidos automaticamente pelas Edge Functions. No Stripe, crie um endpoint apontando para `functions/v1/identity-webhook` e assine os eventos `identity.verification_session.verified`, `identity.verification_session.requires_input` e `identity.verification_session.canceled`.

A aprovação do motorista continua manual no painel administrativo e a função de banco recusa aprovação sem `status = 'verified'`.
