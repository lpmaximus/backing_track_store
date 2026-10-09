/**
 * Ícones do app (traço 1.8, 24×24) — os mesmos do protótipo de design.
 * Sem emoji: no app o ícone é sempre SVG em currentColor.
 */
type P = { size?: number; strokeWidth?: number };

function S({ size = 22, strokeWidth = 1.8, children }: P & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
      strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {children}
    </svg>
  );
}

export const IconHome = (p: P) => <S {...p}><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z" /></S>;
export const IconStudio = (p: P) => <S {...p}><path d="M4 6v12M9 9v6M14 4v16M19 8v8" /></S>;
export const IconList = (p: P) => <S {...p}><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></S>;
export const IconBand = (p: P) => (
  <S {...p}>
    <circle cx="9" cy="8" r="3.5" />
    <path d="M2.5 20c.8-3.5 3.4-5.5 6.5-5.5s5.7 2 6.5 5.5" />
    <path d="M16 4.6a3.5 3.5 0 0 1 0 6.8M18 14.8c1.8.7 3 2.5 3.5 5.2" />
  </S>
);
export const IconUser = (p: P) => <S {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21c1-4 4.3-6 8-6s7 2 8 6" /></S>;
export const IconBell = (p: P) => <S {...p}><path d="M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9" /><path d="M10.3 21a1.9 1.9 0 0 0 3.4 0" /></S>;
export const IconUpload = (p: P) => <S {...p}><path d="M12 16V4M7 9l5-5 5 5" /><path d="M4 16v3a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-3" /></S>;
export const IconChevronRight = (p: P) => <S strokeWidth={2} {...p}><path d="M9 6l6 6-6 6" /></S>;
export const IconBack = (p: P) => <S size={20} strokeWidth={2} {...p}><path d="M15 6l-6 6 6 6" /></S>;
export const IconMic = (p: P) => <S size={20} {...p}><rect x="9" y="3" width="6" height="11" rx="3" /><path d="M5 11a7 7 0 0 0 14 0M12 18v3" /></S>;
export const IconSearch = (p: P) => <S size={18} strokeWidth={2} {...p}><circle cx="11" cy="11" r="7" /><path d="M20 20l-3.5-3.5" /></S>;
export const IconPlus = (p: P) => <S size={18} strokeWidth={2.4} {...p}><path d="M12 5v14M5 12h14" /></S>;
export const IconCheck = (p: P) => <S size={18} strokeWidth={3} {...p}><path d="M5 12l5 5 9-10" /></S>;
export const IconMail = (p: P) => <S size={18} {...p}><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 7l9 6 9-6" /></S>;

export function IconPlay({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M8 5.5v13a1 1 0 0 0 1.5.9l10.2-6.5a1 1 0 0 0 0-1.8L9.5 4.6A1 1 0 0 0 8 5.5z" />
    </svg>
  );
}
export function IconPause({ size = 26 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <rect x="6" y="5" width="4" height="14" rx="1" /><rect x="14" y="5" width="4" height="14" rx="1" />
    </svg>
  );
}
export function IconGoogle({ size = 18 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <path fill="#4285F4" d="M21.6 12.2c0-.7-.1-1.4-.2-2H12v3.8h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.7 3-4.3 3-7.3z" />
      <path fill="#34A853" d="M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.1H3.1v2.6A10 10 0 0 0 12 22z" />
      <path fill="#FBBC05" d="M6.4 14c-.2-.6-.3-1.3-.3-2s.1-1.4.3-2V7.4H3.1a10 10 0 0 0 0 9.2z" />
      <path fill="#EA4335" d="M12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A10 10 0 0 0 3.1 7.4L6.4 10c.8-2.4 3-4.1 5.6-4.1z" />
    </svg>
  );
}

/** Marca oficial (BRD-001): pick laranja + waveform escura. */
export function BrandMark({ size = 28 }: { size?: number }) {
  return (
    <svg width={size} height={Math.round(size * 1.2)} viewBox="0 0 100 120" aria-hidden="true">
      <path d="M50 4 C76 4 96 20 96 44 C96 74 70 104 50 116 C30 104 4 74 4 44 C4 20 24 4 50 4 Z" fill="#FF9A00" />
      <g fill="#0D0D0F">
        <rect x="26" y="48" width="4" height="12" rx="2" />
        <rect x="33" y="42" width="4" height="24" rx="2" />
        <rect x="40" y="34" width="4" height="40" rx="2" />
        <rect x="47" y="26" width="4" height="56" rx="2" />
        <rect x="54" y="34" width="4" height="40" rx="2" />
        <rect x="61" y="42" width="4" height="24" rx="2" />
        <rect x="68" y="48" width="4" height="12" rx="2" />
      </g>
    </svg>
  );
}

export function Wordmark({ size = 12 }: { size?: number }) {
  return (
    <span style={{ fontSize: size, fontWeight: 800, letterSpacing: "0.08em" }}>
      BACKING TRACK <span style={{ color: "var(--accent)" }}>STORE</span>
    </span>
  );
}
