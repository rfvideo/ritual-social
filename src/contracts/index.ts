import RitualSocialAbi from './abi/RitualSocialV2.json';
import RitualTreasuryAbi from './abi/RitualTreasury.json';
import RitualReputationAbi from './abi/RitualReputation.json';
import RitualCreatorTokenFactoryAbi from './abi/RitualCreatorTokenFactory.json';
import RitualCreatorTokenAbi from './abi/RitualCreatorToken.json';
import {
  RITUAL_SOCIAL_ADDRESS,
  RITUAL_TREASURY_ADDRESS,
  RITUAL_REPUTATION_ADDRESS,
  RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS,
} from '@/config/constants';

export const ritualSocialContract = {
  address: RITUAL_SOCIAL_ADDRESS,
  abi: RitualSocialAbi,
} as const;

export const ritualTreasuryContract = {
  address: RITUAL_TREASURY_ADDRESS,
  abi: RitualTreasuryAbi,
} as const;

export const ritualReputationContract = {
  address: RITUAL_REPUTATION_ADDRESS,
  abi: RitualReputationAbi,
} as const;

export const ritualCreatorTokenFactoryContract = {
  address: RITUAL_CREATOR_TOKEN_FACTORY_ADDRESS,
  abi: RitualCreatorTokenFactoryAbi,
} as const;

export const ritualCreatorTokenContract = (address: `0x${string}`) =>
  ({
    address,
    abi: RitualCreatorTokenAbi,
  }) as const;
