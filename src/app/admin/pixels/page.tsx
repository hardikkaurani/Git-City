import { redirect } from "next/navigation";
import { createServerSupabase } from "@/lib/supabase-server";
import { getGithubLoginFromUser, isAdminGithubLogin } from "@/lib/admin";
import { PixelsDashboard } from "./PixelsDashboard";

export default async function AdminPixelsPage() {
  const supabase = await createServerSupabase();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/");

  const login = getGithubLoginFromUser(user);
  if (!isAdminGithubLogin(login)) redirect("/");

  return <PixelsDashboard />;
}
