"use client";

import { useState } from "react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { UserPlus, X, Loader2, Check, LogIn } from "lucide-react";
import { toast } from "sonner";
import { getGuestToken, clearGuestSession } from "@/lib/guest/guest-session";

interface GuestLinkPromptProps {
  onLinked?: () => void;
  onDismiss?: () => void;
  variant?: "card" | "inline" | "dialog";
  showDismiss?: boolean;
}

export function GuestLinkPrompt({
  onLinked,
  onDismiss,
  variant = "card",
  showDismiss = true,
}: GuestLinkPromptProps) {
  const [isLinking, setIsLinking] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [linkResult, setLinkResult] = useState<{
    migratedTables: number;
    migratedMemberships: number;
    migratedOrders: number;
  } | null>(null);

  const handleLink = async () => {
    const guestToken = getGuestToken();
    if (!guestToken) {
      toast.error("ゲストセッションが見つかりません");
      return;
    }

    setIsLinking(true);

    try {
      const response = await fetch("/api/auth/link-guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guestToken }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "Failed to link account");
      }

      const result = await response.json();
      setLinkResult({
        migratedTables: result.migratedTables,
        migratedMemberships: result.migratedMemberships,
        migratedOrders: result.migratedOrders,
      });

      clearGuestSession();
      toast.success("アカウントを紐付けしました");
      setIsDialogOpen(true);

      if (onLinked) {
        onLinked();
      }
    } catch (error) {
      console.error("Link error:", error);
      const message = error instanceof Error ? error.message : "紐付けに失敗しました";
      toast.error(message);
    } finally {
      setIsLinking(false);
    }
  };

  const handleDismiss = () => {
    if (onDismiss) {
      onDismiss();
    }
  };

  if (variant === "inline") {
    return (
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg">
        <UserPlus className="h-4 w-4 text-primary flex-shrink-0" />
        <p className="text-sm flex-1">
          ログインすると、このデータをアカウントに保存できます
        </p>
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login?redirect=/group">ログイン</Link>
        </Button>
        {showDismiss && (
          <Button variant="ghost" size="sm" onClick={handleDismiss}>
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    );
  }

  if (variant === "dialog") {
    return (
      <>
        <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle className="flex items-center gap-2">
                <Check className="h-5 w-5 text-green-500" />
                紐付け完了
              </AlertDialogTitle>
              <AlertDialogDescription>
                ゲストデータをアカウントに紐付けしました。
              </AlertDialogDescription>
            </AlertDialogHeader>
            {linkResult && (
              <div className="space-y-2 py-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">移行したテーブル</span>
                  <span className="font-medium">{linkResult.migratedTables}件</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">移行したメンバーシップ</span>
                  <span className="font-medium">{linkResult.migratedMemberships}件</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">移行した注文</span>
                  <span className="font-medium">{linkResult.migratedOrders}件</span>
                </div>
              </div>
            )}
            <AlertDialogFooter>
              <AlertDialogAction onClick={() => window.location.reload()}>
                OK
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>

        <Button onClick={handleLink} disabled={isLinking} size="sm">
          {isLinking ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              紐付け中...
            </>
          ) : (
            <>
              <UserPlus className="h-4 w-4 mr-2" />
              アカウントに紐付け
            </>
          )}
        </Button>
      </>
    );
  }

  return (
    <>
      <AlertDialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Check className="h-5 w-5 text-green-500" />
              紐付け完了
            </AlertDialogTitle>
            <AlertDialogDescription>
              ゲストデータをアカウントに紐付けしました。
            </AlertDialogDescription>
          </AlertDialogHeader>
          {linkResult && (
            <div className="space-y-2 py-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">移行したテーブル</span>
                <span className="font-medium">{linkResult.migratedTables}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">移行したメンバーシップ</span>
                <span className="font-medium">{linkResult.migratedMemberships}件</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">移行した注文</span>
                <span className="font-medium">{linkResult.migratedOrders}件</span>
              </div>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => window.location.reload()}>
              OK
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-start justify-between">
            <div>
              <CardTitle className="text-base flex items-center gap-2">
                <LogIn className="h-4 w-4" />
                アカウントに保存
              </CardTitle>
              <CardDescription>
                ログインしてこのデータを保存しませんか？
              </CardDescription>
            </div>
            {showDismiss && (
              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            現在ゲストとして使用しています。ログインすると、他のデバイスからもアクセスできるようになります。
          </p>
          <div className="flex gap-2">
            <Button asChild className="flex-1">
              <Link href="/auth/login?redirect=/group">
                <LogIn className="h-4 w-4 mr-2" />
                ログイン
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </>
  );
}

export function GuestLinkBanner({ onDismiss }: { onDismiss?: () => void }) {
  const [isDismissed, setIsDismissed] = useState(false);

  if (isDismissed) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) {
      onDismiss();
    }
  };

  return (
    <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 mb-4">
      <div className="flex items-center gap-3">
        <UserPlus className="h-5 w-5 text-primary flex-shrink-0" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium">ゲストモードで利用中</p>
          <p className="text-xs text-muted-foreground">
            ログインするとデータを保存できます
          </p>
        </div>
        <Button asChild size="sm" variant="outline">
          <Link href="/auth/login?redirect=/group">ログイン</Link>
        </Button>
        <Button variant="ghost" size="icon" className="h-8 w-8" onClick={handleDismiss}>
          <X className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}
