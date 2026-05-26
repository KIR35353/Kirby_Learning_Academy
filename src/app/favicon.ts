import { ImageResponse } from "next/og";

export const runtime = "nodejs";

export default function favicon() {
  return new ImageResponse(
    (
      <div
        style={{
          fontSize: 88,
          background: "linear-gradient(135deg, #003366 0%, #004d99 100%)",
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          color: "white",
          fontWeight: "bold",
        }}
      >
        K
      </div>
    ),
    {
      width: 32,
      height: 32,
    }
  );
}
