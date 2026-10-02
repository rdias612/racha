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

**Nota (tipos de RPC)**: args de RPC com `DEFAULT` no banco são gerados como `?: T` (sem `| null`). Consumidores devem **omitir** o argumento quando ausente (`?? undefined`), nunca passar `null` explícito — precedentes: `src/lib/partidas.ts` (`abrir_partida`, `registrar_evento`, `editar_evento`) e `src/lib/dividas.ts` (`registrar_divida`). Verificação obrigatória pós-regeneração: `npm run build`.

O gerador também pode alterar o `PostgrestVersion` do cabeçalho (ex.: `'14.15'` ↔ `'14.5'`); é apenas metadata, sem consumidor no código — nenhuma ação necessária.
