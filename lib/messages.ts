// lib/messages.ts
// All the friendly wording for things that go wrong, in one place.

export const MSG = {
  playerStatsFailed: (name: string) => `Couldn't load ${name}'s stats. That must be the refs again.`,
  severalStatsFailed: 'The stat team is taking their time. Perhaps you should also check your connection.',
  notPlayedYet: "It seems like that player hasn't played yet. Once he does, we'll have his stats.",
  rosterFailed: "We failed to grab that team's roster.",
  newsFailed: 'There seems to be a miscommunication with the news team.',
  liveSoon: 'Live stats will appear once the game starts.',
  badShareLink: "That link doesn't look right. Ask your friend to send it again.",
  addTeamFailed: "Couldn't add that team. Your device may be low on storage.",
  generic: "That's awkward. We swear this never happens.",
  tryAgain: 'Try again',
} as const;
