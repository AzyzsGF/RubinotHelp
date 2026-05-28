# Supabase Setup

1. Crie um projeto Supabase.
2. Aplique `supabase/migrations/20260528120000_initial_schema.sql` no SQL editor ou via Supabase CLI.
3. Copie `Project URL` e `anon public key` para `.env.local`.
4. Crie sua conta pelo site.
5. No SQL editor, marque seu usuário como admin:

```sql
update public.profiles
set is_admin = true
where email = 'seu-email@exemplo.com';
```

## RLS smoke test

- Usuário comum consegue ler bosses ativos.
- Usuário comum não consegue criar, editar ou desativar bosses.
- Usuário comum só consegue ler, criar, atualizar e remover os próprios check-ins.
- Admin consegue ver bosses inativos e gerenciar o catálogo.
- O Worker usa `SUPABASE_SERVICE_ROLE_KEY`, então ignora RLS apenas no processamento dos jobs.
