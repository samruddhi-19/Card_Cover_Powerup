// Inline SVGs rather than an icon font or CDN sprite: the CSP in vercel.json
// blocks external hosts, and inlining keeps icons recolourable via
// `currentColor` so they follow button state and dark mode for free.

const base = {
  width: 16,
  height: 16,
  viewBox: "0 0 16 16",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round",
  strokeLinejoin: "round",
  "aria-hidden": true,
  focusable: false,
};

export function ImageIcon(props) {
  return (
    <svg {...base} {...props}>
      <rect x="1.75" y="2.75" width="12.5" height="10.5" rx="2.25" />
      <path d="M1.9 10.6l3-2.7a1.6 1.6 0 0 1 2.2 0l2.5 2.3" />
      <path d="M9.2 9.5l1.3-1.1a1.6 1.6 0 0 1 2.1 0l1.5 1.3" />
      <circle cx="9.9" cy="5.9" r="1.05" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function PlusIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M8 3.5v9M3.5 8h9" />
    </svg>
  );
}

export function SwapIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.5 5.75h9.25M9.5 3.5l2.25 2.25L9.5 8" />
      <path d="M13.5 10.25H4.25M6.5 8l-2.25 2.25L6.5 12.5" />
    </svg>
  );
}

export function TrashIcon(props) {
  return (
    <svg {...base} {...props}>
      <path d="M2.75 4.25h10.5M6.25 4.25V3.1a.85.85 0 0 1 .85-.85h1.8a.85.85 0 0 1 .85.85v1.15" />
      <path d="M12.1 4.25l-.5 8.05a1.2 1.2 0 0 1-1.2 1.13H5.6a1.2 1.2 0 0 1-1.2-1.13l-.5-8.05" />
      <path d="M6.6 6.9v3.9M9.4 6.9v3.9" />
    </svg>
  );
}

export function CheckIcon(props) {
  return (
    <svg {...base} strokeWidth={2.1} {...props}>
      <path d="M3.25 8.4l3.1 3.1 6.4-6.9" />
    </svg>
  );
}

export function SpinnerIcon(props) {
  return (
    <svg {...base} className="cc-spin" {...props}>
      <path d="M8 1.9a6.1 6.1 0 1 1-4.31 1.79" opacity="0.9" />
    </svg>
  );
}
