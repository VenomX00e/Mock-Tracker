import React from "react";

/**
 * Parses simple math format strings into formatted React elements.
 * e.g., 'sqrt(144)' -> <SVG root>144</SVG>
 * '2^3' -> 2³
 * '(12 + sqrt(144))' -> ...
 */

export function MathRenderer({ expr }: { expr: string }) {
  // We'll tokenize by regex:
  // - sqrt(\d+)
  // - cbrt(\d+)
  // - (\d+)\^(\d+)

  const tokenRegex = /(sqrt\(\d+\))|(\bcbrt\(\d+\))|(\b\d+\^\d+\b)/g;

  const parts = [];
  let lastIndex = 0;

  let match;
  while ((match = tokenRegex.exec(expr)) !== null) {
    if (match.index > lastIndex) {
      const textPiece = expr.slice(lastIndex, match.index);
      const subParts = textPiece.split(" ").filter((s) => s !== "");
      subParts.forEach((part, i) => {
        parts.push(
          <span key={`text-${lastIndex}-${i}`}>
            {part}
          </span>,
        );
      });
    }

    const matchedStr = match[0];
    if (matchedStr.startsWith("sqrt(")) {
      const num = matchedStr.replace("sqrt(", "").replace(")", "");
      parts.push(
        <span
          key={`sqrt-${match.index}`}
          className="inline-flex items-stretch mx-1 align-middle"
        >
          <svg
            viewBox="0 0 16 26"
            className="w-[1em] h-[1em] fill-none stroke-current stroke-2 scale-y-[1.1]"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d="M2 13 L5 23 L14 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="border-t-2 border-current pt-[2px] pr-1">{num}</span>
        </span>,
      );
    } else if (matchedStr.startsWith("cbrt(")) {
      const num = matchedStr.replace("cbrt(", "").replace(")", "");
      parts.push(
        <span
          key={`cbrt-${match.index}`}
          className="inline-flex items-stretch mx-1 relative align-middle"
        >
          <span className="text-[0.4em] font-bold absolute left-0 top-[20%]">
            3
          </span>
          <svg
            viewBox="0 0 16 26"
            className="w-[1em] h-[1em] fill-none stroke-current stroke-2 scale-y-[1.1] ml-[0.3em]"
            preserveAspectRatio="xMidYMid meet"
          >
            <path
              d="M2 13 L5 23 L14 2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className="border-t-2 border-current pt-[2px] pr-1">{num}</span>
        </span>,
      );
    } else if (matchedStr.includes("^")) {
      const [base, exp] = matchedStr.split("^");
      parts.push(
        <span
          key={`pow-${match.index}`}
          className="inline-flex items-baseline align-middle"
        >
          <span>{base}</span>
          <sup className="text-[0.6em] ml-[1px]">{exp}</sup>
        </span>,
      );
    }

    lastIndex = tokenRegex.lastIndex;
  }

  if (lastIndex < expr.length) {
    const textPiece = expr.slice(lastIndex);
    const subParts = textPiece.split(" ").filter((s) => s !== "");
    subParts.forEach((part, i) => {
      parts.push(<span key={`text-${lastIndex}-${i}`}>{part}</span>);
    });
  }

  return (
    <span
      className="inline-flex flex-wrap items-center max-w-full justify-center gap-x-[0.25em] gap-y-1"
      style={{ lineHeight: "1.4" }}
    >
      {parts}
    </span>
  );
}
