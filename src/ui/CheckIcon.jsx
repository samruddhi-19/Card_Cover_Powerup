// Shared checkmark used by both the auth success screen and Settings, so
// the two "you're connected" moments stay visually identical by
// construction rather than by two people remembering to keep them in sync.
export default function CheckIcon() {
  return (
    <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <path
        d="M5 12.5L9.5 17L19 7"
        stroke="#4BCE97"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}