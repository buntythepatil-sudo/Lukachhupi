import { getPresetById } from '../game/characterPresets';

export interface ProfileAvatarOption {
  id: string;
  label: string;
  bgHex: string;
  kind: 'character' | 'banyan' | 'diya';
  presetId?: string;
}

export const PROFILE_AVATAR_OPTIONS: ProfileAvatarOption[] = [
  { id: 'raju', label: 'Raju', bgHex: '#3b2b1f', kind: 'character', presetId: 'raju' },
  { id: 'meena', label: 'Meena', bgHex: '#25394a', kind: 'character', presetId: 'meena' },
  { id: 'chintu', label: 'Chintu', bgHex: '#3c3428', kind: 'character', presetId: 'chintu' },
  { id: 'guddi', label: 'Guddi', bgHex: '#4a2634', kind: 'character', presetId: 'guddi' },
  { id: 'bhola', label: 'Bhola', bgHex: '#4b251c', kind: 'character', presetId: 'bhola' },
  { id: 'munna', label: 'Munna', bgHex: '#223e2c', kind: 'character', presetId: 'munna' },
  { id: 'kavita', label: 'Kavita', bgHex: '#29354d', kind: 'character', presetId: 'kavita' },
  { id: 'bunty', label: 'Bunty', bgHex: '#24354c', kind: 'character', presetId: 'bunty' },
  { id: 'pinki', label: 'Pinki', bgHex: '#4c381c', kind: 'character', presetId: 'pinki' },
  { id: 'sonu', label: 'Sonu', bgHex: '#1f4240', kind: 'character', presetId: 'sonu' },
  { id: 'banyan_emblem', label: 'Banyan', bgHex: '#223b26', kind: 'banyan' },
  { id: 'diya_emblem', label: 'Diya', bgHex: '#4a2915', kind: 'diya' },
];

export function getProfileAvatarOption(avatarId: string): ProfileAvatarOption {
  return (
    PROFILE_AVATAR_OPTIONS.find((item) => item.id === avatarId) ??
    PROFILE_AVATAR_OPTIONS[0]
  );
}

interface ProfileAvatarProps {
  avatarId: string;
  sizeClass?: string;
  className?: string;
}

export function ProfileAvatar({
  avatarId,
  sizeClass = 'w-10 h-10',
  className = '',
}: ProfileAvatarProps) {
  if (avatarId === 'private') {
    return (
      <span
        className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-amber-200/30 bg-[#231913] shrink-0 ${sizeClass} ${className}`}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
          <circle cx="20" cy="20" r="19" fill="#231913" />
          <path
            d="M20 8 L30 12.5 V20.5 C30 26.8 25.6 31.3 20 33 C14.4 31.3 10 26.8 10 20.5 V12.5 Z"
            fill="#3a281d"
            stroke="#e0b56d"
            strokeWidth="1.6"
          />
          <circle cx="20" cy="17.5" r="3.2" fill="#e0b56d" opacity="0.9" />
          <path
            d="M14.5 25.5 C15.5 22.5 24.5 22.5 25.5 25.5"
            stroke="#e0b56d"
            strokeWidth="1.8"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      </span>
    );
  }

  const option = getProfileAvatarOption(avatarId);

  if (option.kind === 'banyan') {
    return (
      <span
        className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-amber-200/40 shrink-0 ${sizeClass} ${className}`}
        style={{ backgroundColor: option.bgHex }}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
          <circle cx="20" cy="20" r="19" fill="#234029" />
          <rect x="17" y="21" width="6" height="13" rx="1.5" fill="#6f4728" />
          <path d="M12 24 C14 27 14 31 13 34" stroke="#5c3a20" strokeWidth="1.8" fill="none" />
          <path d="M28 24 C26 27 26 31 27 34" stroke="#5c3a20" strokeWidth="1.8" fill="none" />
          <circle cx="20" cy="15" r="9.5" fill="#4f9442" />
          <circle cx="13" cy="18" r="6" fill="#3f7c36" />
          <circle cx="27" cy="18" r="6" fill="#3f7c36" />
          <circle cx="20" cy="11" r="6.5" fill="#63ab4e" />
        </svg>
      </span>
    );
  }

  if (option.kind === 'diya') {
    return (
      <span
        className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-amber-200/40 shrink-0 ${sizeClass} ${className}`}
        style={{ backgroundColor: option.bgHex }}
      >
        <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
          <circle cx="20" cy="20" r="19" fill="#3b1d12" />
          <circle cx="20" cy="14" r="9" fill="#ffbe4d" opacity="0.22" />
          <path
            d="M20 7 C23.5 11.5 23.5 16.5 20 19 C16.5 16.5 16.5 11.5 20 7 Z"
            fill="#ffaa2b"
          />
          <path
            d="M20 10 C21.8 12.6 21.8 15.6 20 17.5 C18.2 15.6 18.2 12.6 20 10 Z"
            fill="#fff3b0"
          />
          <path
            d="M9 22 C11 29 29 29 31 22 Z"
            fill="#b85a2a"
            stroke="#e8944a"
            strokeWidth="1.2"
          />
          <ellipse cx="20" cy="22" rx="11" ry="2.2" fill="#d97b38" />
        </svg>
      </span>
    );
  }

  const preset = getPresetById(option.presetId ?? 'raju');
  const hasBindi = preset.faceStyle === 'bright_bindi';
  const hasGlasses = preset.accessory === 'spectacles';
  const hasCap = preset.accessory === 'cap';
  const hasGamcha = preset.accessory === 'gamcha';
  const hasTwinBraids = preset.hairStyle === 'twin_braids';
  const hasHighBun = preset.hairStyle === 'high_bun';

  return (
    <span
      className={`relative inline-flex items-center justify-center overflow-hidden rounded-full border border-amber-200/40 shrink-0 ${sizeClass} ${className}`}
      style={{ backgroundColor: option.bgHex }}
    >
      <svg viewBox="0 0 40 40" className="w-full h-full" aria-hidden="true">
        <circle cx="20" cy="20" r="19" fill={option.bgHex} />
        {/* High bun or twin braids behind head */}
        {hasHighBun && <circle cx="20" cy="6.5" r="4.5" fill="#181210" />}
        {hasTwinBraids && (
          <>
            <rect x="8.5" y="16" width="3.5" height="12" rx="1.6" fill="#181210" />
            <rect x="28" y="16" width="3.5" height="12" rx="1.6" fill="#181210" />
            <circle cx="10.2" cy="27.5" r="1.4" fill="#e6a832" />
            <circle cx="29.8" cy="27.5" r="1.4" fill="#e6a832" />
          </>
        )}
        {/* Shoulders / outfit */}
        <path
          d="M8 38 C9 30 14 27 20 27 C26 27 31 30 32 38 Z"
          fill={preset.outfitColorHex}
        />
        {hasGamcha && (
          <path
            d="M12 28 L16 38 M28 28 L24 38"
            stroke="#c43b2b"
            strokeWidth="2.4"
            strokeLinecap="round"
          />
        )}
        {/* Neck */}
        <rect x="17.5" y="23.5" width="5" height="4.5" rx="1.5" fill={preset.skinHex} />
        {/* Head */}
        <circle cx="20" cy="17.5" r="8.4" fill={preset.skinHex} />
        {/* Hair */}
        <path
          d="M11.6 17 C11.6 10.6 15.2 8.2 20 8.2 C24.8 8.2 28.4 10.6 28.4 17 C26.6 13.4 23.6 12.2 20 12.2 C16.4 12.2 13.4 13.4 11.6 17 Z"
          fill="#181210"
        />
        {hasCap && (
          <>
            <path d="M11.5 13.5 C12.5 8.5 27.5 8.5 28.5 13.5 Z" fill="#c94b2d" />
            <rect x="12" y="12.2" width="16" height="2.2" rx="1" fill="#e8b84b" />
          </>
        )}
        {/* Eyes */}
        <circle cx="16.8" cy="17.3" r="1.1" fill="#1b1411" />
        <circle cx="23.2" cy="17.3" r="1.1" fill="#1b1411" />
        <circle cx="17.1" cy="17.0" r="0.35" fill="#ffffff" />
        <circle cx="23.5" cy="17.0" r="0.35" fill="#ffffff" />
        {/* Spectacles */}
        {hasGlasses && (
          <g stroke="#2a2420" strokeWidth="0.9" fill="none">
            <circle cx="16.8" cy="17.3" r="2.3" />
            <circle cx="23.2" cy="17.3" r="2.3" />
            <line x1="19.1" y1="17.3" x2="20.9" y2="17.3" />
          </g>
        )}
        {/* Bindi */}
        {hasBindi && <circle cx="20" cy="14.5" r="0.9" fill="#c82829" />}
        {/* Smile */}
        <path
          d="M17.2 21.1 Q20 23.1 22.8 21.1"
          stroke="#5c2b21"
          strokeWidth="1.25"
          strokeLinecap="round"
          fill="none"
        />
      </svg>
    </span>
  );
}
