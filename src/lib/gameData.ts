export type Question = {
  id: string
  text: string
}

export type NpcAnswer = {
  questionId: string
  text: string
  contradictsDatabase: boolean
}

export type NpcClaim = {
  role: string
  district: string
  statement: string
}

export type NpcTip = {
  name: string
  role: string
  district: string
}

export type Npc = {
  id: string
  name: string
  claim: NpcClaim
  isLegitimate: boolean
  answers: NpcAnswer[]
  tips: NpcTip[]
}

export const INITIAL_QUESTIONS: Question[] = [
  { id: 'district', text: 'Which district are you registered in?' },
  { id: 'role', text: 'State your role before the blackout.' },
  { id: 'vouch', text: 'Who can vouch for your record?' },
  { id: 'status', text: 'What was your record status before the surge?' },
]

export const NPC_POOL: Npc[] = [
  {
    id: 'sarah-chen',
    name: 'Sarah Chen',
    claim: {
      role: 'Nurse',
      district: 'Sector 4',
      statement: "I'm Sarah Chen. Nurse, Sector 4. I kept the ward running through the dark.",
    },
    isLegitimate: true,
    answers: [
      { questionId: 'district', text: 'Sector 4. I never left the ward.', contradictsDatabase: false },
      { questionId: 'role', text: 'Nurse — trauma rotation.', contradictsDatabase: false },
      { questionId: 'vouch', text: 'Helena Voss signed my original record.', contradictsDatabase: false },
      { questionId: 'status', text: 'Verified. My file survived the surge.', contradictsDatabase: false },
    ],
    tips: [{ name: 'Aaron Webb', role: 'Orderly', district: 'Sector 4' }],
  },
  {
    id: 'marcus-hale',
    name: 'Marcus Hale',
    claim: {
      role: 'Power engineer',
      district: 'Sector 2',
      statement: "I'm Marcus Hale. Power engineer from Sector 2.",
    },
    isLegitimate: false,
    answers: [
      { questionId: 'district', text: 'Sector 2. Always Sector 2.', contradictsDatabase: true },
      { questionId: 'role', text: 'Power engineer. I kept the grid alive.', contradictsDatabase: false },
      { questionId: 'vouch', text: "No one left alive can vouch. They're all gone.", contradictsDatabase: false },
      { questionId: 'status', text: 'I was verified. The system just lost me.', contradictsDatabase: true },
    ],
    tips: [],
  },
  {
    id: 'lina-torres',
    name: 'Lina Torres',
    claim: {
      role: 'Security',
      district: 'Sector 1',
      statement: 'Lina Torres. Security detail, Sector 1. My district record burned in the surge.',
    },
    isLegitimate: true,
    answers: [
      { questionId: 'district', text: 'Sector 1. The record burned, but it was Sector 1.', contradictsDatabase: false },
      { questionId: 'role', text: 'Security detail — checkpoint nine.', contradictsDatabase: false },
      { questionId: 'vouch', text: 'Helena Voss. We worked the same checkpoint.', contradictsDatabase: false },
      { questionId: 'status', text: 'Corrupted. The surge ate half my file.', contradictsDatabase: false },
    ],
    tips: [{ name: 'Priya Anand', role: 'Courier', district: 'Sector 3' }],
  },
  {
    id: 'daniel-okafor',
    name: 'Daniel Okafor',
    claim: {
      role: 'Doctor',
      district: 'Sector 4',
      statement: 'Daniel Okafor. Doctor, Sector 4. Sarah Chen and I ran the same ward.',
    },
    isLegitimate: true,
    answers: [
      { questionId: 'district', text: 'Sector 4, same ward as Sarah Chen.', contradictsDatabase: false },
      { questionId: 'role', text: 'Doctor. I ran triage.', contradictsDatabase: false },
      { questionId: 'vouch', text: "Sarah Chen — she's already verified.", contradictsDatabase: false },
      { questionId: 'status', text: 'Missing, last I saw the terminal.', contradictsDatabase: false },
    ],
    tips: [{ name: 'Victor Reyes', role: 'Clerk', district: 'Sector 2' }],
  },
  {
    id: 'priya-anand',
    name: 'Priya Anand',
    claim: {
      role: 'Courier',
      district: 'Sector 1',
      statement: 'Priya Anand. Courier, Sector 1. I run medical supplies.',
    },
    isLegitimate: false,
    answers: [
      { questionId: 'district', text: 'Sector 1. I run supplies through Sector 1.', contradictsDatabase: true },
      { questionId: 'role', text: 'Courier — medical runs.', contradictsDatabase: false },
      { questionId: 'vouch', text: 'Lina Torres knows my routes.', contradictsDatabase: true },
      { questionId: 'status', text: 'Corrupted. Nothing of mine survived.', contradictsDatabase: false },
    ],
    tips: [],
  },
  {
    id: 'victor-reyes',
    name: 'Victor Reyes',
    claim: {
      role: 'Clerk',
      district: 'Sector 2',
      statement: 'Victor Reyes. Records clerk, Sector 2. Daniel Okafor will vouch for me.',
    },
    isLegitimate: true,
    answers: [
      { questionId: 'district', text: 'Sector 2. The records office.', contradictsDatabase: false },
      { questionId: 'role', text: 'Records clerk.', contradictsDatabase: false },
      { questionId: 'vouch', text: 'Daniel Okafor will speak for me.', contradictsDatabase: false },
      { questionId: 'status', text: 'Missing. The blackout wiped the clerk roster.', contradictsDatabase: false },
    ],
    tips: [],
  },
]
