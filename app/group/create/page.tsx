"use client";

import type React from "react";
import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { ArrowLeft, Loader2, Lock } from "lucide-react";
import { toast } from "sonner";
import { getGuestToken, hasGuestSession, setGuestSession } from "@/lib/guest/guest-session";

export default function CreateTablePage() {
  const [tableName, setTableName] = useState("");
  const [eventDate, setEventDate] = useState(new Date().toISOString().split("T")[0]);
  const [displayName, setDisplayName] = useState("");
  const [usePassword, setUsePassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  useEffect(() => {
    const loadDefaultName = async () => {
      const guestToken = getGuestToken();

      if (guestToken) {
        const res = await fetch(`/api/auth/guest?token=${encodeURIComponent(guestToken)}`);
        if (res.ok) {
          const data = await res.json();
          setDisplayName((prev) => prev || data.nickname || "");
        }
        return;
      }

      const res = await fetch("/api/users/profile");
      if (!res.ok) return;
      const json = (await res.json()) as {
        nickname?: string | null;
        email?: string | null;
        userMetadata?: { nickname?: string | null; name?: string | null } | null;
      };
      const fallback =
        json.userMetadata?.nickname || json.userMetadata?.name || (json.email ? json.email.split("@")[0] : "") || "";
      const suggested = json.nickname || fallback;
      setDisplayName((prev) => prev || suggested || "");
    };

    void loadDefaultName();
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tableName.trim() || !eventDate || !displayName.trim()) {
      toast.error("全ての項目を入力してください");
      return;
    }

    setIsLoading(true);

    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      let guestToken = getGuestToken();

      if (!guestToken && !hasGuestSession()) {
        const checkSession = await fetch("/api/users/profile");
        if (!checkSession.ok) {
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
      }

      if (guestToken) {
        headers["X-Guest-Token"] = guestToken;
      }

      const res = await fetch("/api/tables", {
        method: "POST",
        headers,
        body: JSON.stringify({ tableName, eventDate, displayName, usePassword }),
      });

      if (res.status === 401) {
        router.push("/auth/login?redirect=/group/create");
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to create table");
      }

      const { inviteToken } = (await res.json()) as { inviteToken: string };

      toast.success("テーブルを作成しました");
      router.push(`/group/table/${inviteToken}`);
    } catch (error) {
      console.error("Error creating table:", error);
      toast.error("テーブルの作成に失敗しました");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/group"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            グループ一覧に戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">新規テーブル作成</h1>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <CardTitle>テーブル情報</CardTitle>
            <CardDescription>飲み会やイベントの情報を入力してください</CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="tableName">テーブル名 *</Label>
                <Input
                  id="tableName"
                  placeholder="例: 忘年会2024"
                  required
                  value={tableName}
                  onChange={(e) => setTableName(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="eventDate">開催日 *</Label>
                <Input
                  id="eventDate"
                  type="date"
                  required
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="displayName">あなたの表示名 *</Label>
                <Input
                  id="displayName"
                  placeholder="例: 田中"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                />
                <p className="text-xs text-muted-foreground">このテーブルでの表示名です（テーブルごとに変更可能）</p>
              </div>

              <div className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">招待パスワード</p>
                    <p className="text-xs text-muted-foreground">参加時にパスワード入力を必須にする</p>
                  </div>
                </div>
                <Switch checked={usePassword} onCheckedChange={setUsePassword} />
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "テーブルを作成"
                )}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
