"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import type { UserSummary } from "@/lib/types/group";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { LogoutButton } from "@/components/auth/logout-control";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  ArrowLeft,
  Plus,
  UserPlus,
  Users,
  Crown,
  MoreVertical,
  Archive,
  ArchiveRestore,
  Trash2,
  Settings,
  LogOut,
  ChevronRight,
  Loader2,
  Link2,
  Camera,
  X,
} from "lucide-react";
import { toast } from "sonner";
import jsQR from "jsqr";
import {
  getGuestToken,
  getGuestUserId,
  setGuestSession,
  hasGuestSession,
  clearGuestSession,
} from "@/lib/guest/guest-session";

interface TableData {
  id: string;
  name: string;
  event_date: string;
  invite_token: string;
  is_archived: boolean;
  is_master: boolean;
  member_count: number;
}

interface GroupPageClientProps {
  serverUser: UserSummary | null;
  serverTables: TableData[];
}

export function GroupPageClient({ serverUser, serverTables }: GroupPageClientProps) {
  const [user, setUser] = useState<UserSummary | null>(serverUser);
  const [tables, setTables] = useState<TableData[]>(serverTables);
  const [isLoading, setIsLoading] = useState(!serverUser);
  const [isGuest, setIsGuest] = useState(false);

  const fetchGuestData = useCallback(async () => {
    const guestToken = getGuestToken();
    const guestUserId = getGuestUserId();

    if (!guestToken || !guestUserId) {
      setIsLoading(false);
      return;
    }

    try {
      const response = await fetch(`/api/auth/guest?token=${encodeURIComponent(guestToken)}`);
      if (!response.ok) {
        clearGuestSession();
        setIsLoading(false);
        return;
      }

      const guestData = await response.json();

      setUser({
        id: guestData.userId,
        email: null,
        nickname: guestData.nickname || "ゲスト",
      });
      setIsGuest(true);

      const tablesResponse = await fetch("/api/tables", {
        headers: {
          "X-Guest-Token": guestToken,
        },
      });

      if (tablesResponse.ok) {
        const tablesData = await tablesResponse.json();
        setTables(tablesData.tables || []);
      }
    } catch {
      clearGuestSession();
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!serverUser && hasGuestSession()) {
      fetchGuestData();
    } else {
      setIsLoading(false);
    }
  }, [serverUser, fetchGuestData]);

  const activeTables = tables.filter((t) => !t.is_archived);
  const archivedTables = tables.filter((t) => t.is_archived);

  const handleArchive = async (tableId: string, archive: boolean) => {
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    const guestToken = getGuestToken();
    if (guestToken) {
      headers["X-Guest-Token"] = guestToken;
    }

    const res = await fetch("/api/tables/archive", {
      method: "POST",
      headers,
      body: JSON.stringify({ tableId, archive }),
    });

    if (!res.ok) {
      toast.error(archive ? "アーカイブに失敗しました" : "アーカイブ解除に失敗しました");
      return;
    }

    setTables((prev) => prev.map((t) => (t.id === tableId ? { ...t, is_archived: archive } : t)));
    toast.success(archive ? "アーカイブしました" : "アーカイブを解除しました");
  };

  const handleDelete = async (tableId: string) => {
    const headers: Record<string, string> = {};
    const guestToken = getGuestToken();
    if (guestToken) {
      headers["X-Guest-Token"] = guestToken;
    }

    const res = await fetch(`/api/tables/${tableId}`, {
      method: "DELETE",
      headers,
    });

    if (!res.ok) {
      toast.error("削除に失敗しました");
      return;
    }

    setTables((prev) => prev.filter((t) => t.id !== tableId));
    toast.success("テーブルを削除しました");
  };

  const handleGuestLogout = () => {
    clearGuestSession();
    setUser(null);
    setTables([]);
    setIsGuest(false);
  };

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!user) {
    return <GuestLoginPrompt />;
  }

  return (
    <main className="min-h-screen flex flex-col">
      {/* Header */}
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            トップに戻る
          </Link>
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-xl font-bold text-primary">グループモード</h1>
              <p className="text-sm text-muted-foreground">テーブルを管理</p>
            </div>
            <div className="flex items-center gap-2">
              <JoinTableButton />
              <Button asChild size="sm">
                <Link href="/group/create">
                  <Plus className="h-4 w-4 mr-1" />
                  新規作成
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-4 space-y-4">
        {/* User Info */}
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-lg font-bold text-primary">
                    {user.nickname?.charAt(0) || user.email?.charAt(0) || "G"}
                  </span>
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium">{user.nickname || "ユーザー"}</p>
                    {isGuest && (
                      <Badge variant="secondary" className="text-xs">
                        ゲスト
                      </Badge>
                    )}
                  </div>
                  {user.email ? (
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  ) : isGuest ? (
                    <p className="text-xs text-muted-foreground">ログインすると履歴を保存できます</p>
                  ) : null}
                </div>
              </div>
              <div className="flex items-center gap-2">
                {isGuest ? (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/auth/login?redirect=/group">ログイン</Link>
                    </Button>
                    <Button variant="ghost" size="sm" onClick={handleGuestLogout}>
                      <LogOut className="h-4 w-4" />
                    </Button>
                  </>
                ) : (
                  <>
                    <Button asChild variant="outline" size="sm">
                      <Link href="/settings">
                        <Settings className="h-4 w-4" />
                      </Link>
                    </Button>
                    <LogoutButton variant="outline" size="sm" iconOnly />
                  </>
                )}
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Tables */}
        <Tabs defaultValue="active">
          <TabsList className="w-full h-11 p-1 bg-[var(--wm-surface)]">
            <TabsTrigger
              value="active"
              className="flex-1 h-9 gap-1.5 text-[13px] font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              参加中
              <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full bg-[var(--wm-accent)] text-white text-[10px] font-bold wm-num">
                {activeTables.length}
              </span>
            </TabsTrigger>
            <TabsTrigger
              value="archived"
              className="flex-1 h-9 gap-1.5 text-[13px] font-semibold data-[state=active]:bg-card data-[state=active]:shadow-sm"
            >
              アーカイブ
              <span className="inline-flex items-center justify-center min-w-[20px] h-[18px] px-1 rounded-full bg-[var(--wm-ink-4)] text-white text-[10px] font-bold wm-num">
                {archivedTables.length}
              </span>
            </TabsTrigger>
          </TabsList>

          <TabsContent value="active" className="mt-4 space-y-3">
            {activeTables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground mb-4">参加中のテーブルがありません</p>
                  <Button asChild>
                    <Link href="/group/create">テーブルを作成</Link>
                  </Button>
                </CardContent>
              </Card>
            ) : (
              activeTables.map((table) => (
                <TableCard key={table.id} table={table} onArchive={handleArchive} onDelete={handleDelete} />
              ))
            )}
          </TabsContent>

          <TabsContent value="archived" className="mt-4 space-y-3">
            {archivedTables.length === 0 ? (
              <Card>
                <CardContent className="py-12 text-center">
                  <p className="text-muted-foreground">アーカイブされたテーブルはありません</p>
                </CardContent>
              </Card>
            ) : (
              archivedTables.map((table) => (
                <TableCard key={table.id} table={table} onArchive={handleArchive} onDelete={handleDelete} />
              ))
            )}
          </TabsContent>
        </Tabs>
      </div>
    </main>
  );
}

function GuestLoginPrompt() {
  const [isCreatingGuest, setIsCreatingGuest] = useState(false);
  const [guestName, setGuestName] = useState("");

  const handleStartAsGuest = async () => {
    setIsCreatingGuest(true);
    try {
      const response = await fetch("/api/auth/guest", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ displayName: guestName || "ゲスト" }),
      });

      if (!response.ok) {
        toast.error("ゲストセッションの作成に失敗しました");
        return;
      }

      const data = await response.json();
      setGuestSession(data.guestToken, data.userId);
      window.location.reload();
    } catch {
      toast.error("エラーが発生しました");
    } finally {
      setIsCreatingGuest(false);
    }
  };

  return (
    <main className="min-h-screen flex flex-col">
      <header className="border-b bg-card">
        <div className="container mx-auto px-4 py-4">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-2"
          >
            <ArrowLeft className="h-4 w-4" />
            トップに戻る
          </Link>
          <h1 className="text-xl font-bold text-primary">グループモード</h1>
          <p className="text-sm text-muted-foreground">複数人での割り勘計算</p>
        </div>
      </header>

      <div className="flex-1 container mx-auto px-4 py-8">
        <div className="max-w-md mx-auto space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>ログインして始める</CardTitle>
              <CardDescription>アカウントでログインすると、履歴が保存されます</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button asChild className="w-full">
                <Link href="/auth/login?redirect=/group">ログイン / 新規登録</Link>
              </Button>
            </CardContent>
          </Card>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">または</span>
            </div>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>ゲストで始める</CardTitle>
              <CardDescription>
                ログインなしで使えます（データはこの端末にのみ保存されます）
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="guestName">表示名（任意）</Label>
                <Input
                  id="guestName"
                  placeholder="例：田中"
                  value={guestName}
                  onChange={(e) => setGuestName(e.target.value)}
                />
              </div>
              <Button
                variant="outline"
                className="w-full"
                onClick={handleStartAsGuest}
                disabled={isCreatingGuest}
              >
                {isCreatingGuest ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    作成中...
                  </>
                ) : (
                  "ゲストで始める"
                )}
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </main>
  );
}

function JoinTableButton() {
  const [open, setOpen] = useState(false);
  const [inviteCode, setInviteCode] = useState("");
  const [isScanning, setIsScanning] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanningRef = useRef(false);
  const animationRef = useRef<number | null>(null);
  const router = useRouter();

  const extractToken = (input: string): string | null => {
    const trimmed = input.trim();
    const joinMatch = trimmed.match(/\/group\/join\/([a-zA-Z0-9_-]+)/);
    if (joinMatch) return joinMatch[1];
    const tableMatch = trimmed.match(/\/group\/table\/([a-zA-Z0-9_-]+)/);
    if (tableMatch) return tableMatch[1];
    if (/^[a-zA-Z0-9_-]+$/.test(trimmed) && trimmed.length > 5) return trimmed;
    return null;
  };

  const handleJoin = () => {
    const token = extractToken(inviteCode);
    if (!token) {
      toast.error("有効な招待リンクまたはコードを入力してください");
      return;
    }
    setOpen(false);
    setInviteCode("");
    router.push(`/group/join/${token}`);
  };

  const stopCamera = useCallback(() => {
    scanningRef.current = false;
    if (animationRef.current) {
      cancelAnimationFrame(animationRef.current);
      animationRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setIsScanning(false);
  }, []);

  const scanQRCode = useCallback(() => {
    if (!scanningRef.current || !videoRef.current || !canvasRef.current) return;

    const video = videoRef.current;
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });

    if (!ctx || video.readyState !== video.HAVE_ENOUGH_DATA) {
      animationRef.current = requestAnimationFrame(scanQRCode);
      return;
    }

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0);

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const code = jsQR(imageData.data, imageData.width, imageData.height, {
      inversionAttempts: "dontInvert",
    });

    if (code && code.data) {
      const token = extractToken(code.data);
      if (token) {
        stopCamera();
        setOpen(false);
        router.push(`/group/join/${token}`);
        return;
      }
    }

    if (scanningRef.current) {
      animationRef.current = requestAnimationFrame(scanQRCode);
    }
  }, [router, stopCamera]);

  const startCamera = async () => {
    try {
      let stream: MediaStream;
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" } }
        });
      } catch {
        stream = await navigator.mediaDevices.getUserMedia({ video: true });
      }
      streamRef.current = stream;
      scanningRef.current = true;
      setIsScanning(true);
    } catch (err: unknown) {
      const errorName = err instanceof Error ? err.name : "";
      if (errorName === "NotAllowedError" || errorName === "PermissionDeniedError") {
        toast.error("カメラへのアクセスを許可してください");
      } else if (errorName === "NotFoundError") {
        toast.error("カメラが見つかりません");
      } else {
        toast.error("カメラの起動に失敗しました");
      }
    }
  };

  useEffect(() => {
    if (isScanning && streamRef.current && videoRef.current) {
      const video = videoRef.current;
      video.srcObject = streamRef.current;
      video.play().then(() => {
        scanQRCode();
      }).catch(() => {
        stopCamera();
        toast.error("カメラの映像を表示できませんでした");
      });
    }
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current);
      }
    };
  }, [isScanning, scanQRCode, stopCamera]);

  useEffect(() => {
    return () => { stopCamera(); };
  }, [stopCamera]);

  const handleDialogChange = (isOpen: boolean) => {
    setOpen(isOpen);
    if (!isOpen) {
      stopCamera();
      setInviteCode("");
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <UserPlus className="h-4 w-4 mr-1" />
          参加
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>テーブルに参加</DialogTitle>
          <DialogDescription>
            QRコードをスキャンまたは招待コードを入力
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          {/* QR Scanner */}
          {isScanning ? (
            <div className="relative">
              <video
                ref={videoRef}
                className="w-full aspect-square object-cover rounded-lg bg-black"
                autoPlay
                playsInline
                muted
              />
              <canvas ref={canvasRef} className="hidden" />
              <Button
                variant="secondary"
                size="sm"
                className="absolute top-2 right-2"
                onClick={stopCamera}
              >
                <X className="h-4 w-4" />
              </Button>
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="w-48 h-48 border-2 border-primary rounded-lg" />
              </div>
              <p className="text-xs text-center text-muted-foreground mt-2">
                QRコードを枠内に合わせてください
              </p>
            </div>
          ) : (
            <Button
              variant="outline"
              className="w-full h-20 flex-col gap-2"
              onClick={startCamera}
            >
              <Camera className="h-6 w-6" />
              <span className="text-sm">QRコードをスキャン</span>
            </Button>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-background px-2 text-muted-foreground">または</span>
            </div>
          </div>

          {/* URL/Code Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Link2 className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm font-medium">招待リンク・コードを入力</span>
            </div>
            <Input
              placeholder="https://... または招待コード"
              value={inviteCode}
              onChange={(e) => setInviteCode(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleJoin(); }}
            />
            <Button
              className="w-full"
              onClick={handleJoin}
              disabled={!inviteCode.trim()}
            >
              参加する
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

const WEEKDAY_JP = ["日", "月", "火", "水", "木", "金", "土"] as const;

function formatRelativeDate(date: Date): { label: string; tone: "today" | "near" | "past" | "future" } {
  const now = new Date();
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const diffDays = Math.round((startOfDay(date) - startOfDay(now)) / (1000 * 60 * 60 * 24));
  if (diffDays === 0) return { label: "今日", tone: "today" };
  if (diffDays === -1) return { label: "昨日", tone: "near" };
  if (diffDays === 1) return { label: "明日", tone: "near" };
  if (diffDays > 1 && diffDays <= 7) return { label: `${diffDays}日後`, tone: "future" };
  if (diffDays < -1 && diffDays >= -7) return { label: `${-diffDays}日前`, tone: "near" };
  if (diffDays > 7) return { label: `${diffDays}日後`, tone: "future" };
  return { label: `${-diffDays}日前`, tone: "past" };
}

function TableCard({
  table,
  onArchive,
  onDelete,
}: {
  table: TableData;
  onArchive: (id: string, archive: boolean) => void;
  onDelete: (id: string) => void;
}) {
  const eventDate = new Date(table.event_date);
  const relative = formatRelativeDate(eventDate);
  const month = eventDate.getMonth() + 1;
  const day = eventDate.getDate();
  const weekday = WEEKDAY_JP[eventDate.getDay()];

  const dateBlockStyle =
    relative.tone === "today"
      ? "bg-[var(--wm-accent)] text-white"
      : relative.tone === "near" || relative.tone === "future"
      ? "bg-[var(--wm-accent-soft)] text-[var(--wm-accent-pressed)]"
      : "bg-[var(--wm-surface)] text-[var(--wm-ink-2)]";

  return (
    <Card className="overflow-hidden border-[var(--wm-line)] transition-all hover:border-[var(--wm-accent)]/40 hover:shadow-md active:scale-[0.997]">
      <CardContent className="p-0">
        <div className="flex items-stretch">
          <Link
            href={`/group/table/${table.invite_token}`}
            className="flex flex-1 items-stretch gap-3 min-w-0 group"
          >
            {/* 日付ブロック */}
            <div
              className={`flex flex-col items-center justify-center w-[68px] shrink-0 py-3 ${dateBlockStyle}`}
            >
              <div className="text-[10px] font-semibold leading-none opacity-80">{month}月</div>
              <div className="wm-num mt-0.5 text-[26px] font-bold leading-none tabular-nums">{day}</div>
              <div className="text-[10px] font-semibold leading-none mt-1 opacity-80">({weekday})</div>
            </div>

            {/* メイン情報 */}
            <div className="flex-1 min-w-0 py-3 pr-2 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                {table.is_master && (
                  <span
                    className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-md"
                    style={{ background: "var(--wm-accent-soft)", color: "var(--wm-accent-pressed)" }}
                    aria-label="主催者"
                  >
                    <Crown className="h-3 w-3" />
                  </span>
                )}
                <h3 className="text-[15px] font-bold leading-tight text-foreground truncate">
                  {table.name}
                </h3>
              </div>
              <div className="mt-1.5 flex items-center gap-2 text-[11.5px] text-[var(--wm-ink-3)]">
                <span
                  className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 font-semibold ${
                    relative.tone === "today"
                      ? "bg-[var(--wm-accent-soft)] text-[var(--wm-accent-pressed)]"
                      : "bg-[var(--wm-surface)] text-[var(--wm-ink-2)]"
                  }`}
                >
                  {relative.label}
                </span>
                <span className="inline-flex items-center gap-1">
                  <Users className="h-3 w-3" />
                  <span className="wm-num font-semibold text-[var(--wm-ink-2)]">{table.member_count}</span>
                  <span>人</span>
                </span>
                {table.is_master && (
                  <span className="text-[10px] font-bold tracking-wider text-[var(--wm-accent-pressed)]">
                    主催
                  </span>
                )}
              </div>
            </div>

            <div className="flex items-center pr-2 transition-transform group-hover:translate-x-0.5">
              <ChevronRight className="h-5 w-5 text-[var(--wm-ink-3)]" />
            </div>
          </Link>

          {table.is_master && (
            <div className="flex items-center pr-2">
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-9 w-9 flex-shrink-0 text-[var(--wm-ink-3)] hover:bg-[var(--wm-surface)]"
                    aria-label="メニュー"
                  >
                    <MoreVertical className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  {table.is_archived ? (
                    <DropdownMenuItem onClick={() => onArchive(table.id, false)}>
                      <ArchiveRestore className="h-4 w-4 mr-2" />
                      アーカイブ解除
                    </DropdownMenuItem>
                  ) : (
                    <DropdownMenuItem onClick={() => onArchive(table.id, true)}>
                      <Archive className="h-4 w-4 mr-2" />
                      アーカイブ
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuSeparator />
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onSelect={(e) => e.preventDefault()}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />
                        削除
                      </DropdownMenuItem>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>テーブルを削除しますか？</AlertDialogTitle>
                        <AlertDialogDescription>
                          「{table.name}」と関連する全てのデータ（注文履歴、メンバー情報など）が完全に削除されます。
                          この操作は取り消せません。
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>キャンセル</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => onDelete(table.id)}
                          className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                        >
                          削除する
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
