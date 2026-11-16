-- DocuMind AI: Supabase schema (run once in the Supabase SQL Editor)
-- Idempotent: safe to re-run.

-- 1. Extensions -----------------------------------------------------------------
create extension if not exists vector with schema extensions;

-- 2. Tables ---------------------------------------------------------------------
create table if not exists public.documents (
  id              uuid primary key default gen_random_uuid(),
  name            text        not null check (char_length(name) between 1 and 255),
  mime_type       text        not null,
  size_bytes      integer     not null check (size_bytes > 0 and size_bytes <= 10485760),
  page_count      integer     not null default 0 check (page_count >= 0),
  chunk_count     integer     not null default 0 check (chunk_count >= 0),
  indexed_chunks  integer     not null default 0 check (indexed_chunks >= 0),
  status          text        not null default 'processing'
                              check (status in ('processing', 'ready', 'failed')),
  error_message   text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create table if not exists public.document_chunks (
  id             bigint generated always as identity primary key,
  document_id    uuid        not null references public.documents (id) on delete cascade,
  document_name  text        not null,
  chunk_index    integer     not null check (chunk_index >= 0),
  page_number    integer     not null check (page_number >= 1),
  content        text        not null,
  embedding      extensions.vector(1536) not null,
  created_at     timestamptz not null default now(),
  unique (document_id, chunk_index)
);

-- 3. Indexes --------------------------------------------------------------------
-- HNSW gives high recall without the "train after data load" step IVFFlat needs.
create index if not exists document_chunks_embedding_hnsw_idx
  on public.document_chunks
  using hnsw (embedding extensions.vector_cosine_ops)
  with (m = 16, ef_construction = 64);

create index if not exists document_chunks_document_id_idx
  on public.document_chunks (document_id);

create index if not exists documents_created_at_idx
  on public.documents (created_at desc);

-- 4. Row Level Security ---------------------------------------------------------
-- RLS on with *no* policies = the anon/authenticated keys can read nothing.
-- Only the NestJS backend (service_role key, which bypasses RLS) can access data.
alter table public.documents       enable row level security;
alter table public.document_chunks enable row level security;

revoke all on public.documents       from anon, authenticated;
revoke all on public.document_chunks from anon, authenticated;

-- Newer Supabase projects no longer auto-grant table privileges to service_role.
grant usage on schema public to service_role;
grant select, insert, update, delete on public.documents       to service_role;
grant select, insert, update, delete on public.document_chunks to service_role;
grant usage, select on sequence public.document_chunks_id_seq  to service_role;

-- 5. Similarity search RPC ------------------------------------------------------
create or replace function public.match_documents(
  query_embedding     extensions.vector(1536),
  match_threshold     float   default 0.72,
  match_count         int     default 4,
  filter_document_ids uuid[]  default null
)
returns table (
  id            bigint,
  document_id   uuid,
  document_name text,
  page_number   int,
  chunk_index   int,
  content       text,
  similarity    float
)
language sql
stable
set search_path = public, extensions
as $$
  select
    c.id,
    c.document_id,
    c.document_name,
    c.page_number,
    c.chunk_index,
    c.content,
    1 - (c.embedding <=> query_embedding) as similarity
  from public.document_chunks c
  join public.documents d on d.id = c.document_id
  where d.status = 'ready'
    and (filter_document_ids is null or c.document_id = any (filter_document_ids))
    and 1 - (c.embedding <=> query_embedding) > match_threshold
  order by c.embedding <=> query_embedding
  limit least(greatest(match_count, 1), 10);
$$;

revoke execute on function public.match_documents(extensions.vector, float, int, uuid[])
  from public, anon, authenticated;
grant execute on function public.match_documents(extensions.vector, float, int, uuid[])
  to service_role;
