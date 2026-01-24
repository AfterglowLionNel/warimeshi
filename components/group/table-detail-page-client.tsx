"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, Archive } from "lucide-react";
import { TableDetailClient } from "./table-detail-client";
import { getGuestToken, getGuestUserId, hasGuestSession } from "@/lib/guest/guest-session";

interface TableData {
  id: string;
  owner_user_id: string | null;
  name: string;
  event_date: string;
  invite_token: string;
  invite_password: string | null;
  is_archived: boolean;
  archived_at: string | null;
  is_locked: boolean;
  auto_lock_at: string | null;
  created_at: string;
  updated_at: string;
}

interface TableDetailPageClientProps {
  table: TableData | null;
  token: string;
  ownerName?: string;
  error?: string;
}

export function TableDetailPageClient({ table, token, ownerName = "作成者", error }: TableDetailPageClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [membership, setMembership] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [orders, setOrders] = useState<any[]>([]);
  const [dbUser, setDbUser] = useState<any>(null);
  const router = useRouter();

  const fetchData = useCallback(async () => {
    if (!table) {
      setIsLoading(false);
      return;
    }

    const headers: Record<string, string> = {};
    const guestToken = getGuestToken();

    if (guestToken) {
      headers["X-Guest-Token"] = guestToken;
    }

    try {
      // First check authentication
      let currentUserId: string | null = null;
      let isGuestUser = false;
      let currentUser: any = null;

      if (guestToken) {
        const guestRes = await fetch(`/api/auth/guest?token=${encodeURIComponent(guestToken)}`);
        if (guestRes.ok) {
          const guestData = await guestRes.json();
          currentUserId = guestData.userId;
          isGuestUser = true;
          currentUser = {
            id: guestData.userId,
            firebase_uid: guestData.userId,
            email: null,
            nickname: guestData.nickname || "ゲスト",
            is_admin: false,
            created_at: new Date().toISOString(),
            updated_at: new Date().toISOString(),
          };
        }
      }

      if (!currentUserId) {
        const profileRes = await fetch("/api/users/profile");
        if (profileRes.ok) {
          const profileData = await profileRes.json();
          currentUserId = profileData.id;
          isGuestUser = false;
          currentUser = {
            id: profileData.id,
            firebase_uid: profileData.id,
            email: profileData.email,
            nickname: profileData.nickname,
            is_admin: profileData.isAdmin || false,
            created_at: profileData.createdAt || new Date().toISOString(),
            updated_at: profileData.updatedAt || new Date().toISOString(),
          };
        }
      }

      if (!currentUserId) {
        router.push(`/group/join/${token}`);
        return;
      }

      setUserId(currentUserId);
      setIsGuest(isGuestUser);
      setDbUser(currentUser);

      // Fetch members
      const membersRes = await fetch(`/api/table-members?tableId=${table.id}`, { headers });
      if (!membersRes.ok) {
        if (membersRes.status === 403) {
          router.push(`/group/join/${token}`);
          return;
        }
        throw new Error("Failed to fetch members");
      }

      const membersData = await membersRes.json();
      const membersFormatted = membersData.data.map((m: any) => ({
        id: m.id,
        table_id: m.tableId,
        user_id: m.userId,
        display_name: m.displayName,
        is_master: m.isMaster,
        is_guest: m.isGuest,
        added_by_user_id: m.addedByUserId,
        joined_at: m.joinedAt,
        user: m.user
          ? {
              id: m.user.id,
              firebase_uid: m.user.id,
              email: m.user.email,
              nickname: m.user.nickname,
              is_admin: m.user.isAdmin,
              created_at: m.user.createdAt,
              updated_at: m.user.updatedAt,
            }
          : undefined,
      }));

      setMembers(membersFormatted);

      // Find current user's membership
      const currentMembership = membersFormatted.find((m: any) => m.user_id === currentUserId);
      if (!currentMembership) {
        router.push(`/group/join/${token}`);
        return;
      }

      setMembership({
        id: currentMembership.id,
        table_id: currentMembership.table_id,
        user_id: currentMembership.user_id,
        display_name: currentMembership.display_name,
        is_master: currentMembership.is_master,
        is_guest: currentMembership.is_guest,
        added_by_user_id: currentMembership.added_by_user_id,
        joined_at: currentMembership.joined_at,
      });

      // Fetch orders
      const ordersRes = await fetch(`/api/orders?tableId=${table.id}`, { headers });
      if (ordersRes.ok) {
        const ordersData = await ordersRes.json();
        const ordersFormatted = (ordersData.data || []).map((o: any) => ({
          id: o.id,
          table_id: o.tableId,
          member_id: o.memberId,
          created_by_user_id: o.createdByUserId,
          item_name: o.itemName,
          unit_price: o.unitPrice,
          quantity: o.quantity,
          line_total: o.lineTotal,
          deleted_at: o.deletedAt,
          created_at: o.createdAt,
          updated_at: o.updatedAt,
          member: o.member
            ? {
                id: o.member.id,
                table_id: o.member.tableId,
                user_id: o.member.userId,
                display_name: o.member.displayName,
                is_master: o.member.isMaster,
                is_guest: o.member.isGuest,
                added_by_user_id: o.member.addedByUserId,
                joined_at: o.member.joinedAt,
              }
            : undefined,
        }));
        setOrders(ordersFormatted);
      }
    } catch (err) {
      console.error("Error fetching table data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [table, token, router]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (error === "table_not_found" || !table) {
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
              <p className="text-muted-foreground mb-4">テーブルが見つかりません</p>
              <Button asChild>
                <Link href="/group">グループ一覧へ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (table.is_archived && table.owner_user_id !== userId) {
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
                {ownerName}さんがアーカイブを解除するまで閲覧できません
              </p>
            </CardContent>
          </Card>
        </div>
      </main>
    );
  }

  if (isLoading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </main>
    );
  }

  if (!membership || !dbUser) {
    return null;
  }

  return (
    <TableDetailClient
      table={table}
      currentUser={dbUser}
      currentMembership={membership}
      initialMembers={members}
      initialOrders={orders}
      isGuestUser={isGuest}
    />
  );
}
