# Racha Migrate

## Login

```
npx supabase login
npx supabase link --project-ref jtavmrlllyctkuxefhpc
```

## Migrate db

```
npx supabase db push
```

## Deploy edge functions

```
npx supabase functions deploy
```

## Regenerar types do banco

```
npx supabase gen types typescript --project-id jtavmrlllyctkuxefhpc > src/lib/database.types.ts
```

Rodar no **Git Bash** (PowerShell corrompe o encoding do arquivo).

**Atenção (trap de tipos de RPC)**: testado com CLIs de 1.100 a 2.119 — o gerador atual emite os args de RPC **sem** `| null`, e o arquivo versionado não é reproduzível por nenhuma toolchain disponível. Após regenerar, a seção `registrar_divida` (linha ~1328) precisa voltar a ter `?: T | null` nos args com `DEFAULT NULL` no banco, como decidido na fase 1 do plano 35 (Clipes do Filma Eu): o consumidor `src/lib/dividas.ts` (~linha 118) passa `null` explícito e o build quebra sem esse patch. Ponto análogo, hoje seguro mas mesmo foot-gun: `atualizar_dados_pix_telefone` (linha ~1056), consumidor `src/lib/jogadores.ts` (~linha 498) passa `''`. Verificação obrigatória pós-regeneração: `npm run build`.

O gerador também pode alterar o `PostgrestVersion` do cabeçalho (ex.: `'14.15'` ↔ `'14.5'`); é apenas metadata, sem consumidor no código — nenhuma ação necessária.
