import type { Database } from '../lib/database.types';
import { formatGroupIdentity } from './profileUtils';

type Profile = Database['public']['Tables']['profiles']['Row'];

const gradients = [
  'from-blue-400 to-indigo-500',
  'from-purple-400 to-pink-500',
  'from-green-400 to-teal-500',
  'from-orange-400 to-red-500',
];

export const getPartnerGradient = (id: string) => {
  const index = id.charCodeAt(0) % gradients.length;
  return gradients[index];
};

export const getPartnerSharePath = (profileId: string) => `/community/partner/${profileId}`;

export const getPartnerShareUrl = (profileId: string) => {
  if (typeof window === 'undefined') return getPartnerSharePath(profileId);
  return `${window.location.origin}${getPartnerSharePath(profileId)}`;
};

export const buildPartnerShareText = (profile: Profile) => {
  const groupText = formatGroupIdentity(profile.group_identity);
  const seeking = profile.skills_seeking ? `正在寻找：${profile.skills_seeking}` : '正在寻找志同道合的伙伴';
  const locationText = groupText ? `\n身份：${groupText}` : '';

  return `我在健文社区发现了一张伙伴名片：${profile.nickname}${locationText}\n${seeking}\n${getPartnerShareUrl(profile.id)}`;
};

export const sharePartnerProfile = async (profile: Profile) => {
  const url = getPartnerShareUrl(profile.id);
  const text = buildPartnerShareText(profile);
  const shouldUseNativeShare =
    typeof navigator.share === 'function' &&
    typeof window !== 'undefined' &&
    window.matchMedia('(pointer: coarse)').matches;

  if (shouldUseNativeShare) {
    try {
      await navigator.share({
        title: `${profile.nickname} 的伙伴名片`,
        text,
        url,
      });
      return;
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') {
        throw error;
      }
      console.warn('Native share failed, falling back to text copy.', error);
    }
  }

  const textarea = document.createElement('textarea');
  textarea.value = text;
  textarea.setAttribute('readonly', 'true');
  textarea.style.position = 'fixed';
  textarea.style.left = '-9999px';
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand('copy');
  document.body.removeChild(textarea);

  if (!copied) {
    throw new Error('复制失败');
  }
};
