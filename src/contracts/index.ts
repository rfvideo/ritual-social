import RitualSocialAbi from './abi/RitualSocial.json';
import RitualTreasuryAbi from './abi/RitualTreasury.json';
import { RITUAL_SOCIAL_ADDRESS, RITUAL_TREASURY_ADDRESS } from '@/config/constants';

export const ritualSocialContract = {
  address: RITUAL_SOCIAL_ADDRESS,
  abi: RitualSocialAbi,
} as const;

export const ritualTreasuryContract = {
  address: RITUAL_TREASURY_ADDRESS,
  abi: RitualTreasuryAbi,
} as const;
