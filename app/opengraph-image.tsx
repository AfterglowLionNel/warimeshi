import { ImageResponse } from "next/og"

export const runtime = "edge"

export const alt = "warimeshi - 割り勘計算アプリ"
export const size = {
  width: 1200,
  height: 630,
}
export const contentType = "image/png"

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          height: "100%",
          width: "100%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          backgroundColor: "#fffbeb",
          backgroundImage: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            marginBottom: 40,
          }}
        >
          <div
            style={{
              width: 120,
              height: 120,
              borderRadius: 24,
              backgroundColor: "#d97706",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              marginRight: 24,
            }}
          >
            <span style={{ fontSize: 64, color: "white" }}>🍻</span>
          </div>
          <span
            style={{
              fontSize: 72,
              fontWeight: "bold",
              color: "#d97706",
            }}
          >
            warimeshi
          </span>
        </div>
        <div
          style={{
            fontSize: 36,
            color: "#78350f",
            textAlign: "center",
            maxWidth: 800,
          }}
        >
          飲み会の割り勘・注文管理とタクシー料金計算
        </div>
        <div
          style={{
            marginTop: 24,
            fontSize: 24,
            color: "#92400e",
          }}
        >
          グループで注文を共有し、公平に割り勘できる無料アプリ
        </div>
      </div>
    ),
    {
      ...size,
    }
  )
}
