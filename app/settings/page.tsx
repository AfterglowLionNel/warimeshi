import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users } from "@/lib/db/schema";
import { eq } from "drizzle-orm";
import { SettingsForm } from "@/components/settings/settings-form";

export default async function SettingsPage() {
  const session = await auth();

  if (!session?.user?.id) {
    redirect("/auth/login?redirect=/settings");
  }

  let [dbUser] = await db
    .select()
    .from(users)
    .where(eq(users.id, session.user.id))
    .limit(1);

  // Fallback to email search
  if (!dbUser && session.user.email) {
    [dbUser] = await db
      .select()
      .from(users)
      .where(eq(users.email, session.user.email))
      .limit(1);
  }

  // Create user if not exists
  if (!dbUser && session.user.email) {
    const nickname = session.user.name || session.user.email.split("@")[0] || "ユーザー";
    try {
      const [newUser] = await db
        .insert(users)
        .values({
          id: session.user.id,
          email: session.user.email,
          nickname,
          image: session.user.image ?? null,
        })
        .onConflictDoNothing()
        .returning();
      if (newUser) {
        dbUser = newUser;
      }
    } catch {
      // Ignore creation errors
    }
  }

  if (!dbUser) {
    redirect("/auth/error?error=user_not_found");
  }

  // Convert to expected format
  const userForComponent = {
    id: dbUser.id,
    firebase_uid: dbUser.id,
    email: dbUser.email,
    nickname: dbUser.nickname,
    is_admin: dbUser.isAdmin,
    created_at: dbUser.createdAt.toISOString(),
    updated_at: dbUser.updatedAt.toISOString(),
  };

  return <SettingsForm user={userForComponent} />;
}
