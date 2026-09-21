revoke execute on function public.is_member() from anon;
revoke execute on function public.my_household_id() from anon;
revoke execute on function public.is_watcher(uuid) from anon;
revoke execute on function public.create_app_invite() from anon;
revoke execute on function public.create_household(text, text, text) from anon;
revoke execute on function public.redeem_invite(text, text) from anon;
