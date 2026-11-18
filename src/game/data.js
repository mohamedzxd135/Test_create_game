export const CLASSES = {
  swordsman: {
    id: 'swordsman',
    name: 'Swordsman',
    order: '01',
    title: 'The Lionblade',
    role: 'Frontline Duelist',
    difficulty: 'Balanced',
    color: '#eab45f',
    dark: '#6e441d',
    glow: '#ffd88a',
    description: 'A knight of the royal vanguard. Closes distance, breaks guards, and turns the tide with a lion’s roar.',
    hp: 280, mp: 90, stamina: 115, speed: 9.4,
    basic: { name: 'Lion Claw', kind: 'melee', dmg: 32, range: 4.5, arc: 1.35, cd: 0.4 },
    abilities: [
      { key: 'q', name: 'Solar Slash', tag: 'Combat', type: 'solar', cost: 18, cd: 3.2, damage: 58, color: '#ffc85f', icon: 'sun', desc: 'A blazing crescent tears through every foe in front of you. 58 damage, heavy knockback.' },
      { key: 'e', name: 'Shield Break', tag: 'Combat', type: 'shieldbreak', cost: 26, cd: 7.5, damage: 52, color: '#ffd79a', icon: 'shield', desc: 'Charge shield-first through the enemy line. 52 damage and a 1.4s stun on impact.' },
      { key: 'r', name: 'Lionheart', tag: 'Special', type: 'lionheart', cost: 50, cd: 22, color: '#ffe6a6', icon: 'lion', desc: 'Invoke the lion spirit: restore 35% health and gain +60% damage for 10 seconds.' }
    ]
  },
  archer: {
    id: 'archer',
    name: 'Archer',
    order: '02',
    title: 'The Gale Ranger',
    role: 'Mobile Sharpshooter',
    difficulty: 'Agile',
    color: '#83d9a0',
    dark: '#245a3c',
    glow: '#c7ffd9',
    description: 'A wind-warden of the deep woods. Strikes from range, pierces armor, and vanishes before the answer comes.',
    hp: 185, mp: 120, stamina: 135, speed: 10.6,
    basic: { name: 'Swift Shot', kind: 'arrow', dmg: 20, range: 34, cd: 0.34 },
    abilities: [
      { key: 'q', name: 'Rapid Volley', tag: 'Combat', type: 'volley', cost: 18, cd: 4.2, damage: 23, color: '#93f0ad', icon: 'arrows', desc: 'Loose six seeking arrows across up to three targets. 23 damage per arrow.' },
      { key: 'e', name: 'Piercing Shot', tag: 'Combat', type: 'pierce', cost: 24, cd: 7, damage: 82, color: '#c4ffd5', icon: 'pierce', desc: 'Draw a wind-sheathed arrow that pierces every enemy in a 40m line for 82 damage.' },
      { key: 'r', name: 'Wind Step', tag: 'Special', type: 'windstep', cost: 35, cd: 16, color: '#a8ffc4', icon: 'wind', desc: 'Blink 14m forward, shed all aggro, and gain +40% speed for 5 seconds.' }
    ]
  },
  mage: {
    id: 'mage',
    name: 'Mage',
    order: '03',
    title: 'The Astral Sage',
    role: 'Arcane Controller',
    difficulty: 'Technical',
    color: '#93a7ff',
    dark: '#2d3778',
    glow: '#d7deff',
    description: 'A scholar of the astral weave. Bends frost and time itself, controlling the battlefield from afar.',
    hp: 155, mp: 175, stamina: 100, speed: 8.9,
    basic: { name: 'Arcane Spark', kind: 'bolt', dmg: 22, range: 30, cd: 0.46 },
    abilities: [
      { key: 'q', name: 'Arcane Bolt', tag: 'Combat', type: 'arcanebolt', cost: 15, cd: 2.6, damage: 26, color: '#aebaff', icon: 'bolt', desc: 'Release three homing motes of starfire. 26 damage each.' },
      { key: 'e', name: 'Frost Nova', tag: 'Combat', type: 'frostnova', cost: 30, cd: 7.5, damage: 55, color: '#a8e6ff', icon: 'frost', desc: 'Shatter a ring of frost around you. 55 damage and 45% slow for 4 seconds.' },
      { key: 'r', name: 'Time Warp', tag: 'Special', type: 'timewarp', cost: 50, cd: 24, color: '#c3b2ff', icon: 'time', desc: 'Distort time in a 22m sphere. Enemies move at 35% speed for 6s and you recover mana.' }
    ]
  }
};

export const QUESTS = [
  { id: 'q1', title: 'First Blood', desc: 'Cull 6 Goblins in the Beginner’s Forest', type: 'kill', target: 'goblin', count: 6, xp: 260, gold: 120 },
  { id: 'q2', title: 'The Whispering Hollow', desc: 'Clear the Whispering Hollow dungeon', type: 'dungeon', target: 'hollow', count: 1, xp: 520, gold: 300, item: 'Hollow Sigil' },
  { id: 'q3', title: 'Tusk and Thunder', desc: 'Defeat 3 Orcs in the Beginner’s Forest', type: 'kill', target: 'orc', count: 3, xp: 430, gold: 220 },
  { id: 'q4', title: 'Trial of Ash', desc: 'Clear any Monster Forest dungeon', type: 'dungeonAny', target: 'monster', count: 1, xp: 1200, gold: 800, item: 'Obsidian Relic' }
];

export const RANKS = ['F', 'E', 'D', 'C', 'B', 'A', 'S', 'SS'];

export const VILLAGES = [
  { id: 'meadowbrook', name: 'Meadowbrook', x: -470, z: 430, desc: 'A sleepy farming hamlet known for honey and tall tales.' },
  { id: 'riverbend', name: 'Riverbend', x: 520, z: 560, desc: 'Fisherfolk and ferrymen who trade along the great river.' },
  { id: 'stoneford', name: 'Stoneford', x: -720, z: 800, desc: 'A stonecutters’ village at the edge of the wild hills.' },
  { id: 'emberfall', name: 'Emberfall', x: 760, z: 880, desc: 'Hunters’ outpost beneath the smoking northern peaks.' }
];

export const DUNGEONS = {
  hollow: { id: 'hollow', name: 'Whispering Hollow', rank: 'D', x: -720, z: -820, boss: 'Grelk the Goblin King', reward: { xp: 600, gold: 350, item: 'Hollow Sigil' }, palette: '#3d5c4a', desc: 'A collapsed barrow where goblins crown their king.' },
  crypt: { id: 'crypt', name: 'Goblin King’s Crypt', rank: 'B', x: -1060, z: -1320, boss: 'Marrow, the Bonecaller', reward: { xp: 950, gold: 550, item: 'Bonebound Ring' }, palette: '#4c4a58', desc: 'Beneath the old roots, the dead keep their own court.' },
  spire: { id: 'spire', name: 'Obsidian Spire', rank: 'A', x: 560, z: -1180, boss: 'Veyra the Ashen', reward: { xp: 1500, gold: 900, item: 'Obsidian Relic' }, palette: '#3b2e46', desc: 'A black tower humming with hungry starlight.' },
  sanctum: { id: 'sanctum', name: 'Abyssal Sanctum', rank: 'SS', x: 1010, z: -1620, boss: 'The Hollow Sovereign', reward: { xp: 2600, gold: 1600, item: 'Sovereign’s Crown' }, palette: '#26233d', desc: 'The deepest wound of the Monster Forest.' }
};
