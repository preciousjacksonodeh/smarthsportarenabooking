import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type Me = {
  id: string;
  email: string | null;
  displayName: string;
  isAdmin: boolean;
};

export const meQueryOptions = queryOptions({
  queryKey: ["me"],
  queryFn: async (): Promise<Me | null> => {
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return null;
    const [{ data: profile }, { data: roles }] = await Promise.all([
      supabase.from("profiles").select("display_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);
    return {
      id: user.id,
      email: user.email ?? null,
      displayName: profile?.display_name ?? user.email ?? "Admin",
      isAdmin: !!roles?.some((r) => r.role === "admin"),
    };
  },
  staleTime: 60_000,
});
