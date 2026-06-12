begin;

create or replace function public.enforce_review_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  last_created_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(new.author_id::text));

  select count(*), max(created_at)
  into recent_count, last_created_at
  from public.reviews
  where author_id = new.author_id
    and created_at >= now() - interval '1 hour';

  if recent_count >= 5 then
    raise exception '每小时最多提交5条饭评，请稍后再试'
      using errcode = 'P0001';
  end if;

  if last_created_at is not null
    and last_created_at >= now() - interval '30 seconds' then
    raise exception '提交太快了，请30秒后再试'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

create or replace function public.enforce_comment_rate_limit()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  recent_count integer;
  last_created_at timestamptz;
begin
  perform pg_advisory_xact_lock(hashtext(new.author_id::text));

  select count(*), max(created_at)
  into recent_count, last_created_at
  from public.comments
  where author_id = new.author_id
    and created_at >= now() - interval '1 hour';

  if recent_count >= 15 then
    raise exception '每小时最多提交15条评论，请稍后再试'
      using errcode = 'P0001';
  end if;

  if last_created_at is not null
    and last_created_at >= now() - interval '5 seconds' then
    raise exception '评论太快了，请5秒后再试'
      using errcode = 'P0001';
  end if;

  return new;
end;
$$;

drop trigger if exists reviews_rate_limit on public.reviews;
create trigger reviews_rate_limit
before insert on public.reviews
for each row
execute function public.enforce_review_rate_limit();

drop trigger if exists comments_rate_limit on public.comments;
create trigger comments_rate_limit
before insert on public.comments
for each row
execute function public.enforce_comment_rate_limit();

revoke all on function public.enforce_review_rate_limit() from public;
revoke all on function public.enforce_comment_rate_limit() from public;

commit;
