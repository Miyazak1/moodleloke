import type { CSSProperties } from 'react';
import type { User } from '../lib/api';

type AvatarUser = Pick<User, 'id' | 'email' | 'displayName'>;

type UserAvatarProps = {
  user: AvatarUser;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
};

const DEFAULT_AVATARS = [
  { from: '#315dff', to: '#13c7a3', accent: '#cafa66' },
  { from: '#6d4aff', to: '#36a5ff', accent: '#ffd166' },
  { from: '#ff715e', to: '#f1a826', accent: '#fff3b0' },
  { from: '#087c66', to: '#13c7a3', accent: '#b7ef43' },
  { from: '#2448d8', to: '#7c5cff', accent: '#74e7d1' },
  { from: '#d94f70', to: '#ff8a5b', accent: '#ffe066' },
  { from: '#176b87', to: '#36a5ff', accent: '#a7f3d0' },
  { from: '#5b4bb7', to: '#d66efd', accent: '#b7ef43' }
] as const;

const DECORATION_PATHS = [
  'M-4 48C12 35 23 38 35 27S58 8 70 13',
  'M-5 17C12 25 18 10 35 18S55 39 70 29',
  'M-4 38C11 48 27 43 34 30S55 12 70 20',
  'M-5 11C12 5 20 20 35 17S55 2 70 10',
  'M-4 29C10 18 24 20 34 32S56 49 70 40',
  'M-4 52C13 43 22 48 36 36S56 18 70 24',
  'M-4 22C12 34 23 28 35 18S57 8 70 17',
  'M-4 43C12 31 24 35 38 24S58 5 70 14'
] as const;

function stableAvatarIndex(seed: string) {
  let hash = 2166136261;
  for (let index = 0; index < seed.length; index += 1) {
    hash ^= seed.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash) % DEFAULT_AVATARS.length;
}

export function UserAvatar({ user, size = 'md', className = '' }: UserAvatarProps) {
  const seed = String(user.id || user.email).trim().toLowerCase();
  const variant = stableAvatarIndex(seed);
  const palette = DEFAULT_AVATARS[variant];
  const faceOffset = (variant % 3) - 1;
  const label = user.displayName || user.email;
  const style = {
    '--avatar-from': palette.from,
    '--avatar-to': palette.to,
    '--avatar-accent': palette.accent
  } as CSSProperties;

  return (
    <span
      className={['user-avatar', `user-avatar-${size}`, className].filter(Boolean).join(' ')}
      data-avatar-variant={variant + 1}
      role="img"
      aria-label={label}
      style={style}
    >
      <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
        <path className="user-avatar-ribbon" d={DECORATION_PATHS[variant]} />
        <circle className="user-avatar-accent" cx={variant % 2 ? 12 : 51} cy={variant % 3 ? 13 : 49} r="5" />
        <path className="user-avatar-body" d="M11 64c1.5-15 9.5-23 21-23s19.5 8 21 23z" />
        <circle className="user-avatar-face" cx={32 + faceOffset} cy="28" r="15" />
        <path className="user-avatar-hair" d={variant % 2 ? 'M18 28c0-10 6-17 15-17 8 0 14 5 15 13-7 0-13-3-17-7-2 6-7 9-13 11z' : 'M17 25c2-10 8-15 16-15 9 0 15 6 16 16-7-5-14-7-22-5-3 1-6 3-10 4z'} />
        <circle className="user-avatar-eye" cx={27 + faceOffset} cy="29" r="1.7" />
        <circle className="user-avatar-eye" cx={37 + faceOffset} cy="29" r="1.7" />
        <path className="user-avatar-smile" d={variant % 3 === 0 ? `M27 ${35 + faceOffset}c3 2 7 2 10 0` : `M28 ${35 + faceOffset}c2 3 6 3 8 0`} />
      </svg>
    </span>
  );
}
