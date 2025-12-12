import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Mail, ArrowLeft } from "lucide-react"

export default function SignUpSuccessPage() {
  return (
    <div className="flex min-h-svh w-full items-center justify-center p-6">
      <div className="w-full max-w-sm">
        <div className="flex flex-col gap-6">
          <Link
            href="/"
            className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            トップに戻る
          </Link>

          <Card>
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 p-3 rounded-full bg-primary/10 w-fit">
                <Mail className="h-8 w-8 text-primary" />
              </div>
              <CardTitle className="text-2xl">登録ありがとうございます</CardTitle>
              <CardDescription>確認メールを送信しました</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                登録したメールアドレスに確認メールを送信しました。
                メール内のリンクをクリックして、アカウントを有効化してください。
              </p>
              <Button asChild variant="outline" className="w-full bg-transparent">
                <Link href="/auth/login">ログインページへ</Link>
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
