import { ImageResponse } from "next/og";
import { readFileSync } from "fs";
import { join } from "path";

export const size = { width: 32, height: 32 };
export const contentType = "image/png";

// Source mark is 396x480 (w:h ratio 0.825), same asset the site's own <Logo />
// renders from /logo-mark.png — keeps the favicon and on-page mark in sync.
const MARK_RATIO = 396 / 480;

export default function Icon() {
  const logoPath = join(process.cwd(), "public", "logo-mark.png");
  const logoSrc = `data:image/png;base64,${readFileSync(logoPath).toString("base64")}`;
  const markHeight = 20;
  const markWidth = Math.round(markHeight * MARK_RATIO);

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
        <img src={logoSrc} width={markWidth} height={markHeight} alt="" />
      </div>
    ),
    { ...size },
  );
}
