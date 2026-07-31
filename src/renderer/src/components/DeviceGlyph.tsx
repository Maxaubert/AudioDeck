// Device-kind glyph derived from the endpoint form factor. Simple inline
// SVGs in currentColor so they inherit text color and stay legible at size.

const SIZE = 30;

function pathFor(formFactor: number | null): string {
  switch (formFactor) {
    case 1: // Speakers: cabinet with tweeter + woofer, like the Windows picker glyph
      return "M9 3h12a2 2 0 0 1 2 2v20a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2z M15 8.5a1.5 1.5 0 1 0 0 3 1.5 1.5 0 0 0 0-3z M15 15a4.5 4.5 0 1 0 0 9 4.5 4.5 0 0 0 0-9z";
    case 2: // Line level
      return "M4 11h5l6-5v18l-6-5H4z M18 9a6 6 0 0 1 0 12";
    case 3: // Headphones
      return "M5 21v-6a10 10 0 0 1 20 0v6 M5 15h3v7H5z M22 15h3v7h-3z";
    case 5: // Headset
      return "M5 20v-5a10 10 0 0 1 20 0v5 M5 14h3v7H5z M22 14h3v7h-3z M25 21a5 5 0 0 1-5 4h-4";
    case 4: // Microphone
      return "M15 3a4 4 0 0 1 4 4v7a4 4 0 0 1-8 0V7a4 4 0 0 1 4-4z M7 13a8 8 0 0 0 16 0 M15 21v5";
    case 8: // Digital / SPDIF
      return "M15 4a11 11 0 1 1 0 22 11 11 0 0 1 0-22z M15 10a5 5 0 1 1 0 10 5 5 0 0 1 0-10z";
    case 9: // TV / display
      return "M4 6h22v14H4z M11 24h8";
    default:
      return "M4 11h5l6-5v18l-6-5H4z";
  }
}

export function DeviceGlyph({ formFactor }: { formFactor: number | null }) {
  return (
    <svg
      className="device-glyph"
      width={SIZE}
      height={SIZE}
      viewBox="0 0 30 30"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={pathFor(formFactor)} />
    </svg>
  );
}
