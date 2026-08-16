-- Axiom metadata sync.
--
-- One table, two opaque columns. There is no user table, no email, no Telegram
-- id, and nothing to join against — by design. A dump of this table is a list
-- of random-looking ids mapped to ciphertext nobody here can decrypt.

create table if not exists public.overlays (
  -- base64url of HMAC-SHA256(sync key, 'axiom:vault-id:v1'). 43 chars.
  id          text primary key check (id ~ '^[A-Za-z0-9_-]{43}$'),
  -- AES-256-GCM ciphertext (12-byte nonce prefix), base64url. Never readable here.
  payload     text not null check (length(payload) <= 262144),
  -- Monotonic per-device counter used for last-writer-wins.
  clock       bigint not null default 0,
  updated_at  timestamptz not null default now()
);

-- RLS on with NO policies: PostgREST's anon and authenticated roles get
-- nothing at all. Every request must come through the Netlify function, which
-- holds the service-role key and is the only thing that may touch this table.
alter table public.overlays enable row level security;

-- Housekeeping: rows nobody has touched in a year are almost certainly from a
-- browser profile that no longer exists. The files themselves are in Telegram
-- and are entirely unaffected by dropping a cache row.
create index if not exists overlays_updated_at_idx on public.overlays (updated_at);
