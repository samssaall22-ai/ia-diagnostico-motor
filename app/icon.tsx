import { ImageResponse } from "next/og";

export const runtime = "edge";
export const contentType = "image/png";

export default function Icon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 64,
          height: 64,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "transparent",
        }}
      >
        <svg
          width="46"
          height="46"
          viewBox="0 0 24 24"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            d="M13 2L3 14h7l-1 8 12-14h-7l-1-6z"
            stroke="#06b6d4"
            strokeWidth="2.2"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        </svg>
      </div>
    ),
    {
      width: 64,
      height: 64,
    },
  );
}

