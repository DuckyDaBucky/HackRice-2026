import { ImageResponse } from "next/og";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#0b1120",
          borderRadius: 7,
        }}
      >
        <div
          style={{
            width: 16,
            height: 16,
            background: "#1ec9b3",
            transform: "rotate(45deg)",
            clipPath: "polygon(0% 100%, 0% 40%, 60% 40%, 60% 0%, 100% 0%, 100% 100%)",
          }}
        />
      </div>
    ),
    { ...size },
  );
}
