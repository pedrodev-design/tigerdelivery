# Verificação de identidade do entregador

O fluxo atual usa a câmera do aparelho para detectar um rosto, pedir uma ação simples de prova de vida e enviar a selfie ao bucket privado `driver-selfies`. A equipe confere a captura no painel administrativo antes de aprovar o motorista.

Esse fluxo não usa serviço externo e não precisa de secrets adicionais. `SUPABASE_URL` e as chaves internas necessárias ao Storage e ao banco já são fornecidas pelo próprio Supabase.

As funções `create-identity-session` e `identity-webhook` pertencem ao fluxo opcional do Stripe Identity e permanecem no repositório apenas para uma futura validação terceirizada. Elas não são chamadas pelo aplicativo atual.
