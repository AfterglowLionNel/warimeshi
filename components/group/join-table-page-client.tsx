"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ArrowLeft, Users, Calendar, Loader2, Lock, Archive } from "lucide-react";
import { toast } from "sonner";
import { getGuestToken, getGuestUserId, setGuestSession, hasGuestSession } from "@/lib/guest/guest-session";

interface TableData {
  id: string;
  owner_user_id: string | null;
  name: string;
  event_date: string;
  invite_token: string;
  is_archived: boolean;
  archived_at: string | null;
  is_locked: boolean;
  auto_lock_at: string | null;
  created_at: string;
  updated_at: string;
}

interface JoinTablePageClientProps {
  table: TableData | null;
  token: string;
  memberCount?: number;
  ownerName?: string;
  error?: string;
}

export function JoinTablePageClient({ table, token, memberCount = 0, ownerName = "作成者", error }: JoinTablePageClientProps) {
  const [displayName, setDisplayName] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isGuest, setIsGuest] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const checkAuth = async () => {
      const guestToken = getGuestToken();
      const guestUserId = getGuestUserId();

      if (guestToken && guestUserId) {
        const res = await fetch(`/api/auth/guest?token=${encodeURIComponent(guestToken)}`);
        if (res.ok) {
          const data = await res.json();
          setIsAuthenticated(true);
          setIsGuest(true);
          setDisplayName(data.nickname || "");
          setIsCheckingAuth(false);
          return;
        }
      }

      const res = await fetch("/api/users/profile");
      if (res.ok) {
        const data = await res.json();
        setIsAuthenticated(true);
        setIsGuest(false);
        setDisplayName(data.nickname || data.email?.split("@")[0] || "");
      }
      setIsCheckingAuth(false);
    };

    checkAuth();
  }, []);

  if (error === "invalid_invite" || !table) {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/group"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              グループ一覧に戻る
            </Link>
            <h1 className="text-xl font-bold text-primary">テーブルに参加</h1>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <p className="text-muted-foreground mb-4">無効な招待リンクです</p>
              <Button asChild>
                <Link href="/group">グループ一覧へ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const isAutoLocked = table.auto_lock_at && new Date(table.auto_lock_at) < new Date();
  const isLocked = table.is_locked || isAutoLocked;

  if (table.is_archived) {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/group"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              グループ一覧に戻る
            </Link>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Archive className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">アーカイブ済み</h2>
              <p className="text-sm text-muted-foreground mb-4">
                「{table.name}」はアーカイブされています
              </p>
              <p className="text-xs text-muted-foreground">
                {ownerName}さんがアーカイブを解除するまで参加できません
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (isLocked) {
    return (
      <main className="min-h-screen flex flex-col">
        <header className="border-b bg-card">
          <div className="container mx-auto px-4 py-4">
            <Link
              href="/group"
              className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
            >
              <ArrowLeft className="h-4 w-4" />
              グループ一覧に戻る
            </Link>
          </div>
        </header>

        <div className="flex-1 container mx-auto px-4 py-8">
          <Card className="max-w-md mx-auto">
            <CardContent className="py-12 text-center">
              <Lock className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h2 className="text-lg font-semibold mb-2">参加締め切り</h2>
              <p className="text-sm text-muted-foreground mb-4">
                「{table.name}」は参加を締め切りました
              </p>
              <p className="text-xs text-muted-foreground">
                {ownerName}さんがロックを解除するまで参加できません
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("表示名を入力してください");
      return;
    }

    setIsLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let guestToken = getGuestToken();

      if (!isAuthenticated) {
        const guestRes = await fetch("/api/auth/guest", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ displayName: displayName.trim() }),
        });

        if (!guestRes.ok) {
          toast.error("セッションの作成に失敗しました");
          setIsLoading(false);
          return;
        }

        const guestData = await guestRes.json();
        setGuestSession(guestData.guestToken, guestData.userId);
        guestToken = guestData.guestToken;
      }

      if (guestToken) {
        headers["X-Guest-Token"] = guestToken;
      }

      const res = await fetch("/api/table-members", {
        method: "POST",
        headers,
        body: JSON.stringify({
          tableId: table.id,
          displayName: displayName.trim(),
        }),
      });

      if (res.status === 401) {
        router.push(`/auth/login?redirect=/group/join/${token}`);
        return;
      }

      const data = await res.json();

      if (!res.ok) {
        if (data.error === "既にこのテーブルのメンバーです") {
          window.location.href = `/group/table/${token}`;
          return;
        }
        throw new Error(data.error || "Failed to join table");
      }

      toast.success("テーブルに参加しました");
      window.location.href = `/group/table/${token}`;
    } catch (error) {
      console.error("Error joining table:", error);
      toast.error("テーブルへの参加に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  if (isCheckingAuth) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/group"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            グループ一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">テーブルに参加</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>{table.name}</CardTitle>
            <CardDescription className="space-y-1">
              <span className="flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {new Date(table.event_date).toLocaleDateString("ja-JP")}
              </span>
              <span className="flex items-center gap-1">
                <Users className="h-3 w-3" />
                {memberCount}人が参加中
              </span>
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleJoin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="displayName">あなたの表示名 *</Label>
                <Input
                  id="displayName"
                  placeholder="例: 田中"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">このテーブルでの表示名です</p>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    参加中...
                  </>
                ) : (
                  "参加する"
                )}
              </Button>

              {!isAuthenticated && (
                <div className="text-center">
                  <p className="text-xs text-muted-foreground mb-2">
                    または
                  </p>
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/auth/login?redirect=/group/join/${token}`}>
                      ログインして参加
                    </Link>
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
