"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { Order, TableMember, User } from "@/lib/types/group";
import { ArrowLeft, Loader2, Archive } from "lucide-react";
import { TableDetailClient } from "./table-detail-client";
import { getGuestToken } from "@/lib/guest/guest-session";

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

interface ApiUser {
  id: string;
  email: string | null;
  nickname: string | null;
  isAdmin?: boolean;
  createdAt?: string;
  updatedAt?: string;
}

interface ApiMember {
  id: string;
  tableId: string;
  userId: string | null;
  displayName: string;
  isMaster: boolean;
  isGuest: boolean;
  addedByUserId: string | null;
  joinedAt: string;
  user?: ApiUser;
}

interface ApiOrder {
  id: string;
  tableId: string;
  memberId: string;
  createdByUserId: string | null;
  itemName: string | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
  isShared?: boolean;
  sharedGroupId?: string | null;
  deletedAt: string | null;
  createdAt: string;
  updatedAt: string;
  member?: ApiMember;
}

function mapUserFromApi(user: ApiUser): User {
  return {
    id: user.id,
    firebase_uid: user.id,
    email: user.email,
    nickname: user.nickname,
    is_admin: user.isAdmin ?? false,
    created_at: user.createdAt ?? new Date().toISOString(),
    updated_at: user.updatedAt ?? new Date().toISOString(),
  };
}

function mapMemberFromApi(member: ApiMember): TableMember & { user?: User } {
  return {
    id: member.id,
    table_id: member.tableId,
    user_id: member.userId,
    display_name: member.displayName,
    is_master: member.isMaster,
    is_guest: member.isGuest,
    added_by_user_id: member.addedByUserId,
    joined_at: member.joinedAt,
    user: member.user ? mapUserFromApi(member.user) : undefined,
  };
}

function mapOrderFromApi(order: ApiOrder): Order & { member?: TableMember } {
  return {
    id: order.id,
    table_id: order.tableId,
    member_id: order.memberId,
    created_by_user_id: order.createdByUserId,
    item_name: order.itemName,
    unit_price: order.unitPrice,
    quantity: order.quantity,
    line_total: order.lineTotal,
    is_shared: order.isShared ?? false,
    shared_group_id: order.sharedGroupId ?? null,
    deleted_at: order.deletedAt,
    created_at: order.createdAt,
    updated_at: order.updatedAt,
    member: order.member ? mapMemberFromApi(order.member) : undefined,
  };
}

export function TableDetailPageClient({ table, token, ownerName = "作成者", error }: TableDetailPageClientProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [userId, setUserId] = useState<string | null>(null);
  const [isGuest, setIsGuest] = useState(false);
  const [membership, setMembership] = useState<TableMember | null>(null);
  const [members, setMembers] = useState<(TableMember & { user?: User })[]>([]);
  const [orders, setOrders] = useState<(Order & { member?: TableMember })[]>([]);
  const [dbUser, setDbUser] = useState<User | null>(null);
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
      let currentUser: User | null = null;

      if (guestToken) {
        const guestRes = await fetch(`/api/auth/guest?token=${encodeURIComponent(guestToken)}`);
        if (guestRes.ok) {
          const guestData = (await guestRes.json()) as { userId: string; nickname?: string | null };
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
          const profileData = (await profileRes.json()) as {
            id: string;
            email: string | null;
            nickname: string | null;
            isAdmin?: boolean;
            createdAt?: string;
            updatedAt?: string;
          };
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

      const membersData = (await membersRes.json()) as { data?: ApiMember[] };
      const membersFormatted = (membersData.data ?? []).map(mapMemberFromApi);

      setMembers(membersFormatted);

      // Find current user's membership
      const currentMembership = membersFormatted.find((m) => m.user_id === currentUserId);
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
        const ordersData = (await ordersRes.json()) as { data?: ApiOrder[] };
        const ordersFormatted = (ordersData.data ?? []).map(mapOrderFromApi);
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
