export interface DelegateProfile {
  address: string;
  name: string;
  bio: string;
  votingPower: number;
  participationRate: number;
  proposalsVoted: number;
}

export const MOCK_DELEGATES: DelegateProfile[] = [
  {
    address: 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF',
    name: 'Aurora Governance',
    bio: 'Active voter focused on protocol upgrades and treasury stewardship.',
    votingPower: 1250000,
    participationRate: 0.94,
    proposalsVoted: 87,
  },
  {
    address: 'GBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBBWHF',
    name: 'Nova Collective',
    bio: 'Community-run delegate prioritising developer tooling and grants.',
    votingPower: 860000,
    participationRate: 0.81,
    proposalsVoted: 64,
  },
  {
    address: 'GCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCCWHF',
    name: 'Meridian Labs',
    bio: 'Security-first delegate reviewing every proposal before voting.',
    votingPower: 540000,
    participationRate: 0.72,
    proposalsVoted: 51,
  },
];
