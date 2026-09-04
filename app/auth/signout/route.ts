import { revalidatePath } from "next/cache";
import { type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: NextRequest) {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/", "layout");

  return new Response(null, {
    status: 303,
    headers: {
      Location: "/login",
    },
  });
}