/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Skull, 
  Heart, 
  Zap, 
  Shield, 
  Package, 
  Map as MapIcon, 
  Terminal, 
  AlertTriangle,
  Radio,
  User,
  Backpack,
  Sword,
  Crosshair,
  Coins
} from 'lucide-react';
import { GoogleGenAI, Modality } from "@google/genai";

// --- Types ---

type Stat = 'STR' | 'PER' | 'END' | 'CHA' | 'INT' | 'AGI' | 'LCK';

interface PlayerStats {
  hp: number;
  maxHp: number;
  ap: number;
  maxAp: number;
  rads: number;
  hunger: number;
  thirst: number;
  caps: number;
  xp: number;
  level: number;
  special: Record<Stat, number>;
  perks: string[];
}

interface Item {
  id: string;
  name: string;
  type: 'weapon' | 'aid' | 'misc';
  effect?: (player: PlayerStats) => PlayerStats;
  description: string;
  value: number;
}

interface GameLog {
  id: number;
  text: string;
  type: 'info' | 'danger' | 'success' | 'combat';
}

// --- Constants ---

const INITIAL_SPECIAL: Record<Stat, number> = {
  STR: 5,
  PER: 5,
  END: 5,
  CHA: 5,
  INT: 5,
  AGI: 5,
  LCK: 5,
};

const ITEMS: Item[] = [
  { id: 'stimpack', name: 'Stimpack', type: 'aid', description: 'Heals 30 HP.', value: 25, effect: (p) => ({ ...p, hp: Math.min(p.maxHp, p.hp + 30) }) },
  { id: 'radaway', name: 'Rad-Away', type: 'aid', description: 'Removes 50 Rads.', value: 20, effect: (p) => ({ ...p, rads: Math.max(0, p.rads - 50) }) },
  { id: 'nuka_cola', name: 'Nuka-Alex', type: 'aid', description: 'Restores thirst and 10 HP. +5 Rads.', value: 15, effect: (p) => ({ ...p, hp: Math.min(p.maxHp, p.hp + 10), thirst: Math.max(0, p.thirst - 20), rads: p.rads + 5 }) },
  { id: 'cram', name: 'Cram', type: 'aid', description: 'Restores hunger.', value: 10, effect: (p) => ({ ...p, hunger: Math.max(0, p.hunger - 30) }) },
  { id: 'jet', name: 'Jet', type: 'aid', description: 'Restores 50 AP. +10 Rads.', value: 30, effect: (p) => ({ ...p, ap: Math.min(p.maxAp, p.ap + 50), rads: p.rads + 10 }) },
  { id: 'buffout', name: 'Buffout', type: 'aid', description: '+20 Max HP temporarily.', value: 40, effect: (p) => ({ ...p, maxHp: p.maxHp + 20, hp: p.hp + 20 }) },
  { id: '9mm_pistol', name: '9mm Pistol', type: 'weapon', description: 'Standard sidearm.', value: 100 },
  { id: 'service_rifle', name: 'Service Rifle', type: 'weapon', description: 'Reliable semi-auto rifle.', value: 250 },
  { id: 'power_fist', name: 'ALEX-Fist', type: 'weapon', description: 'Pneumatic punching glove.', value: 500 },
  { id: 'leather_armor', name: 'Leather Armor', type: 'misc', description: 'Basic protection.', value: 150 },
  { id: 'vault_suit', name: 'Vault 21 Suit', type: 'misc', description: 'Iconic blue jumpsuit.', value: 80 },
  { id: 'scrap_metal', name: 'Scrap Metal', type: 'misc', description: 'Useful for crafting.', value: 5 },
  { id: 'bent_tin_can', name: 'Bent Tin Can', type: 'misc', description: 'Literally trash.', value: 1 },
  { id: 'gold_bar', name: 'Gold Bar', type: 'misc', description: 'Extremely valuable.', value: 1000 },
  { id: 'combat_knife', name: 'Combat Knife', type: 'weapon', description: 'Sharp and deadly.', value: 50 },
  { id: 'plasma_pistol', name: 'Plasma Pistol', type: 'weapon', description: 'High-tech energy weapon.', value: 450 },
  { id: 'metal_armor', name: 'Metal Armor', type: 'misc', description: 'Heavy but protective.', value: 300 },
  { id: 'pre_war_money', name: 'Pre-War Money', type: 'misc', description: 'Old world currency.', value: 10 },
  { id: 'bobby_pin', name: 'Bobby Pin', type: 'misc', description: 'Used for lockpicking.', value: 2 },
  { id: 'dirty_water', name: 'Dirty Water', type: 'aid', description: 'Restores thirst. +15 Rads.', value: 5, effect: (p) => ({ ...p, thirst: Math.max(0, p.thirst - 15), rads: p.rads + 15 }) },
  { id: 'mac_n_cheese', name: 'BlamCo Mac & Cheese', type: 'aid', description: 'Old world comfort food.', value: 12, effect: (p) => ({ ...p, hunger: Math.max(0, p.hunger - 25) }) },
  { id: 'pipe', name: 'Lead Pipe', type: 'misc', description: 'Heavy and rusty.', value: 8 },
  { id: 'rope', name: 'Rope', type: 'misc', description: 'Strong hemp rope.', value: 6 },
  { id: 'gunpowder', name: 'Gunpowder', type: 'misc', description: 'Explosive powder.', value: 10 },
  { id: 'lead', name: 'Lead', type: 'misc', description: 'Heavy metal.', value: 7 },
  { id: 'adhesive', name: 'Wonderglue', type: 'misc', description: 'Sticky stuff.', value: 12 },
  { id: 'circuitry', name: 'Circuitry', type: 'misc', description: 'Electronic components.', value: 15 },
];

interface Recipe {
  id: string;
  name: string;
  ingredients: { itemId: string; count: number }[];
  resultId: string;
  description: string;
}

const RECIPES: Recipe[] = [
  { 
    id: 'pipe_rifle', 
    name: 'Pipe Rifle', 
    description: 'A crude but effective firearm.',
    ingredients: [{ itemId: 'pipe', count: 1 }, { itemId: 'scrap_metal', count: 2 }, { itemId: 'adhesive', count: 1 }],
    resultId: 'service_rifle' // Using existing item as result for simplicity or I could add new ones
  },
  {
    id: 'sturdy_armor',
    name: 'Sturdy Leather Armor',
    description: 'Reinforced protection.',
    ingredients: [{ itemId: 'leather_armor', count: 1 }, { itemId: 'scrap_metal', count: 3 }, { itemId: 'adhesive', count: 2 }],
    resultId: 'metal_armor'
  },
  {
    id: 'homemade_stimpack',
    name: 'Homemade Stimpack',
    description: 'Rough medical supplies.',
    ingredients: [{ itemId: 'dirty_water', count: 1 }, { itemId: 'adhesive', count: 1 }, { itemId: 'circuitry', count: 1 }],
    resultId: 'stimpack'
  }
];

const RADIO_STATIONS = [
  { id: 'new_alex', name: 'RADIO NEW ALEX', tracks: ["Big Iron - Marty Robbins", "Blue Moon - Frank Sinatra", "Ain't That a Kick in the Head - Dean Martin"] },
  { id: 'mojave', name: 'MOJAVE MUSIC RADIO', tracks: ["Heartaches by the Number - Guy Mitchell", "Jingle Jangle Jingle - Kay Kyser", "Johnny Guitar - Peggy Lee"] },
  { id: 'alex_png', name: 'ALEX.PNG BROADCAST', tracks: ["...STATIC...", "...GLITCH...", "...HE IS WATCHING...", "...01000001 01001100 01000101 01011000..."] },
];

const LOCATIONS = [
  "Goodsprings (Alex's Version)",
  "Primm",
  "Novac",
  "The Strip (Alex's Domain)",
  "Hoover Dam",
  "Red Rock Canyon",
  "Hidden Valley",
];

// --- Components ---

export default function App() {
  const [gameState, setGameState] = useState<'menu' | 'playing' | 'gameover'>('menu');
  const [player, setPlayer] = useState<PlayerStats>({
    hp: 100,
    maxHp: 100,
    ap: 100,
    maxAp: 100,
    rads: 0,
    hunger: 0,
    thirst: 0,
    caps: 50,
    xp: 0,
    level: 1,
    special: INITIAL_SPECIAL,
    perks: [],
  });
  const [inventory, setInventory] = useState<Item[]>([
    ITEMS[0], // Stimpack
    ITEMS[2], // Nuka-Alex
  ]);
  const [logs, setLogs] = useState<GameLog[]>([]);
  const [location, setLocation] = useState(LOCATIONS[0]);
  const [activeTab, setActiveTab] = useState<'STAT' | 'INV' | 'DATA' | 'MAP' | 'RADIO' | 'SHOP' | 'CRAFT'>('STAT');
  const [currentStation, setCurrentStation] = useState(0);
  const [currentTrack, setCurrentTrack] = useState(0);
  const [tradingSlots, setTradingSlots] = useState<(Item | null)[]>([null, null]);
  const [shopInventory, setShopInventory] = useState<Item[]>([
    ITEMS[0], ITEMS[1], ITEMS[4], ITEMS[6], ITEMS[9], ITEMS[13], ITEMS[14], ITEMS[15], ITEMS[19]
  ]);
  const [isAudioLoading, setIsAudioLoading] = useState(false);
  const [hasApiKey, setHasApiKey] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const logEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const checkKey = async () => {
      const win = window as any;
      if (win.aistudio?.hasSelectedApiKey) {
        const has = await win.aistudio.hasSelectedApiKey();
        setHasApiKey(has);
      }
    };
    checkKey();
  }, []);

  const playRadioMusic = async () => {
    if (!hasApiKey) return;
    
    setIsAudioLoading(true);
    try {
      const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });
      const station = RADIO_STATIONS[currentStation];
      const track = station.tracks[currentTrack];
      
      const prompt = `Generate a 30-second music track for a post-apocalyptic radio station. 
      The station is "${station.name}" and the track vibe is inspired by "${track}". 
      Make it sound slightly lo-fi and vintage.`;

      const response = await ai.models.generateContentStream({
        model: "lyria-3-clip-preview",
        contents: prompt,
      });

      let audioBase64 = "";
      let mimeType = "audio/wav";

      for await (const chunk of response) {
        const parts = chunk.candidates?.[0]?.content?.parts;
        if (!parts) continue;
        for (const part of parts) {
          if (part.inlineData?.data) {
            if (!audioBase64 && part.inlineData.mimeType) {
              mimeType = part.inlineData.mimeType;
            }
            audioBase64 += part.inlineData.data;
          }
        }
      }

      if (audioBase64) {
        const binary = atob(audioBase64);
        const bytes = new Uint8Array(binary.length);
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i);
        }
        const blob = new Blob([bytes], { type: mimeType });
        const audioUrl = URL.createObjectURL(blob);
        
        if (audioRef.current) {
          audioRef.current.src = audioUrl;
          audioRef.current.play();
        } else {
          const audio = new Audio(audioUrl);
          audioRef.current = audio;
          audio.play();
        }
      }
    } catch (error) {
      console.error("Audio generation failed:", error);
      addLog("Radio signal lost... (Audio error)", 'danger');
    } finally {
      setIsAudioLoading(false);
    }
  };

  useEffect(() => {
    if (gameState !== 'playing') return;
    
    // Play music when track or station changes
    if (hasApiKey) {
      playRadioMusic();
    }

    const trackInterval = setInterval(() => {
      setCurrentTrack(prev => (prev + 1) % RADIO_STATIONS[currentStation].tracks.length);
    }, 35000); // Slightly longer than 30s clip
    
    return () => clearInterval(trackInterval);
  }, [gameState, currentStation, currentTrack, hasApiKey]);

  useEffect(() => {
    if (logEndRef.current) {
      logEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs]);

  // Survival Ticks
  useEffect(() => {
    if (gameState !== 'playing') return;

    const interval = setInterval(() => {
      setPlayer(prev => {
        const newThirst = Math.min(100, prev.thirst + 2);
        const newHunger = Math.min(100, prev.hunger + 1.5);
        const newAp = Math.min(prev.maxAp, prev.ap + 5);
        let newHp = prev.hp;

        // Hunger and thirst now kill you
        if (prev.rads >= 1000) {
          newHp -= 5;
        }
        if (prev.hunger >= 100) {
          newHp -= 2;
        }
        if (prev.thirst >= 100) {
          newHp -= 3;
        }

        if (newHp <= 0) {
          setGameState('gameover');
          return { ...prev, hp: 0 };
        }

        return { ...prev, thirst: newThirst, hunger: newHunger, hp: newHp, ap: newAp };
      });
    }, 5000);

    return () => clearInterval(interval);
  }, [gameState]);

  const addLog = (text: string, type: GameLog['type'] = 'info') => {
    setLogs(prev => [...prev, { id: Date.now(), text, type }].slice(-50));
  };

  const startGame = () => {
    setGameState('playing');
    addLog("Welcome to the Mojave, Courier. Watch out for ALEX.png.");
    addLog("You wake up in Doc Mitchell's office in New ALEX.");
  };

  const explore = () => {
    const chance = Math.random();
    
    setPlayer(prev => {
      const newXp = prev.xp + 15;
      const newLevel = Math.floor(newXp / 100) + 1;
      if (newLevel > prev.level) {
        addLog(`LEVEL UP! You are now level ${newLevel}.`, 'success');
        // Add a random perk
        const perks = ["Toughness", "Action Boy", "Bloody Mess", "Lady Killer", "Strong Back"];
        const newPerk = perks[Math.floor(Math.random() * perks.length)];
        return { ...prev, xp: newXp, level: newLevel, perks: [...prev.perks, newPerk], maxHp: prev.maxHp + 10, hp: prev.hp + 10 };
      }
      return { ...prev, xp: newXp };
    });

    if (chance < 0.4) {
      // Combat
      const damage = Math.floor(Math.random() * 15) + 5;
      const lootCaps = Math.floor(Math.random() * 20) + 5;
      addLog(`Encountered a feral ALEX-ghoul! You took ${damage} damage but found ${lootCaps} caps.`, 'combat');
      setPlayer(prev => ({ ...prev, hp: Math.max(0, prev.hp - damage), caps: prev.caps + lootCaps }));
    } else if (chance < 0.7) {
      // Loot
      const lootPool = [...ITEMS];
      const item = lootPool[Math.floor(Math.random() * lootPool.length)];
      addLog(`Found a discarded ${item.name} in a rusty crate.`, 'success');
      setInventory(prev => [...prev, item]);
    } else {
      // Nothing
      addLog("You wandered the desert for hours. Nothing but sand and radiation.");
      setPlayer(prev => ({ ...prev, rads: prev.rads + 2 }));
    }

    // Random location change
    if (Math.random() < 0.2) {
      const newLoc = LOCATIONS[Math.floor(Math.random() * LOCATIONS.length)];
      if (newLoc !== location) {
        setLocation(newLoc);
        addLog(`Arrived at ${newLoc}.`, 'info');
      }
    }
  };

  const useVATS = () => {
    if (player.ap < 40) {
      addLog("Not enough AP for V.A.T.S.!", 'danger');
      return;
    }

    setPlayer(prev => ({ ...prev, ap: prev.ap - 40 }));
    const success = Math.random() > 0.3;
    if (success) {
      const loot = Math.floor(Math.random() * 50) + 20;
      addLog(`V.A.T.S. CRITICAL HIT! You obliterated an enemy and found ${loot} caps.`, 'success');
      setPlayer(prev => ({ ...prev, caps: prev.caps + loot, xp: prev.xp + 30 }));
    } else {
      addLog("V.A.T.S. MISSED! The enemy escaped.", 'danger');
    }
  };

  const useItem = (item: Item, index: number) => {
    if (activeTab === 'SHOP') {
      // Add to trading slots if available
      if (tradingSlots[0] === null) {
        setTradingSlots([item, tradingSlots[1]]);
        setInventory(prev => prev.filter((_, i) => i !== index));
      } else if (tradingSlots[1] === null) {
        setTradingSlots([tradingSlots[0], item]);
        setInventory(prev => prev.filter((_, i) => i !== index));
      } else {
        addLog("Trading slots are full! Remove an item first.", 'danger');
      }
      return;
    }

    if (item.effect) {
      setPlayer(prev => item.effect!(prev));
      setInventory(prev => prev.filter((_, i) => i !== index));
      addLog(`Used ${item.name}.`, 'success');
    }
  };

  const removeFromTrade = (slotIndex: number) => {
    const item = tradingSlots[slotIndex];
    if (item) {
      setInventory(prev => [...prev, item]);
      const newSlots = [...tradingSlots];
      newSlots[slotIndex] = null;
      setTradingSlots(newSlots);
    }
  };

  const buyItem = (item: Item, shopIndex: number) => {
    const tradeValue = (tradingSlots[0]?.value || 0) + (tradingSlots[1]?.value || 0);
    const cost = item.value;
    
    if (player.caps + tradeValue < cost) {
      addLog(`Not enough caps! You need ${cost - (player.caps + tradeValue)} more.`, 'danger');
      return;
    }

    // Calculate caps change
    const capsNeeded = Math.max(0, cost - tradeValue);
    const capsReturned = Math.max(0, tradeValue - cost);

    setPlayer(prev => ({ ...prev, caps: prev.caps - capsNeeded + capsReturned }));
    setInventory(prev => [...prev, item]);
    setShopInventory(prev => prev.filter((_, i) => i !== shopIndex));
    setTradingSlots([null, null]);
    addLog(`Traded for ${item.name}.`, 'success');
  };

  const sellItemDirectly = (item: Item, index: number) => {
    setPlayer(prev => ({ ...prev, caps: prev.caps + Math.floor(item.value * 0.7) }));
    setInventory(prev => prev.filter((_, i) => i !== index));
    addLog(`Sold ${item.name} for ${Math.floor(item.value * 0.7)} caps.`, 'success');
  };

  const craftItem = (recipe: Recipe) => {
    // Check if player has all ingredients
    const counts: Record<string, number> = {};
    inventory.forEach(item => {
      counts[item.id] = (counts[item.id] || 0) + 1;
    });

    const hasAll = recipe.ingredients.every(ing => (counts[ing.itemId] || 0) >= ing.count);

    if (!hasAll) {
      addLog("Missing ingredients for crafting!", 'danger');
      return;
    }

    // Remove ingredients
    let newInventory = [...inventory];
    recipe.ingredients.forEach(ing => {
      for (let i = 0; i < ing.count; i++) {
        const idx = newInventory.findIndex(item => item.id === ing.itemId);
        if (idx !== -1) {
          newInventory.splice(idx, 1);
        }
      }
    });

    // Add result
    const resultItem = ITEMS.find(item => item.id === recipe.resultId);
    if (resultItem) {
      newInventory.push(resultItem);
      setInventory(newInventory);
      addLog(`Crafted ${recipe.name}!`, 'success');
    }
  };

  const renderTab = () => {
    switch (activeTab) {
      case 'STAT':
        return (
          <div className="grid grid-cols-2 gap-4 h-full overflow-y-auto p-4">
            <div className="space-y-4">
              <div className="pip-boy-border p-2 bg-green-900/10">
                <h3 className="text-xl mb-2 flex items-center gap-2"><User size={20} /> CONDITION</h3>
                <div className="space-y-2">
                  <div className="flex justify-between"><span>HP:</span> <span>{Math.ceil(player.hp)}/{player.maxHp}</span></div>
                  <div className="w-full bg-green-900/30 h-2"><div className="bg-green-500 h-full" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div></div>
                  
                  <div className="flex justify-between"><span>AP:</span> <span>{Math.ceil(player.ap)}/{player.maxAp}</span></div>
                  <div className="w-full bg-green-900/30 h-2"><div className="bg-blue-400 h-full" style={{ width: `${(player.ap / player.maxAp) * 100}%` }}></div></div>

                  <div className="flex justify-between"><span>RADS:</span> <span>{player.rads}</span></div>
                  <div className="w-full bg-green-900/30 h-2"><div className="bg-yellow-500 h-full" style={{ width: `${Math.min(100, (player.rads / 1000) * 100)}%` }}></div></div>
                  
                  <div className="flex justify-between"><span>HUNGER:</span> <span>{Math.ceil(player.hunger)}%</span></div>
                  <div className="flex justify-between"><span>THIRST:</span> <span>{Math.ceil(player.thirst)}%</span></div>
                </div>
              </div>
              <div className="pip-boy-border p-2 bg-green-900/10">
                <h3 className="text-xl mb-2 flex items-center gap-2"><Zap size={20} /> LEVEL {player.level}</h3>
                <div className="flex justify-between"><span>XP:</span> <span>{player.xp}</span></div>
                <div className="w-full bg-green-900/30 h-2 mt-1"><div className="bg-blue-500 h-full" style={{ width: `${(player.xp % 100)}%` }}></div></div>
              </div>
            </div>
            <div className="space-y-4">
              <div className="pip-boy-border p-2 bg-green-900/10">
                <h3 className="text-xl mb-2">S.P.E.C.I.A.L.</h3>
                <div className="space-y-1">
                  {Object.entries(player.special).map(([stat, val]) => (
                    <div key={stat} className="flex justify-between border-b border-green-900/30 pb-1">
                      <span>{stat}</span>
                      <span>{val}</span>
                    </div>
                  ))}
                </div>
              </div>
              <div className="pip-boy-border p-2 bg-green-900/10">
                <h3 className="text-xl mb-2">PERKS</h3>
                <div className="text-xs space-y-1">
                  {player.perks.length === 0 ? (
                    <div className="opacity-50">NONE</div>
                  ) : (
                    player.perks.map((perk, i) => (
                      <div key={i} className="text-green-400">• {perk}</div>
                    ))
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      case 'INV':
        return (
          <div className="h-full flex flex-col p-4">
            <h3 className="text-xl mb-4 flex items-center gap-2"><Backpack size={20} /> INVENTORY ({inventory.length})</h3>
            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {inventory.length === 0 ? (
                <div className="text-center opacity-50 mt-10">EMPTY</div>
              ) : (
                inventory.map((item, i) => (
                  <div key={i} className="pip-boy-border p-2 flex justify-between items-center hover:bg-green-500 hover:text-black cursor-pointer transition-colors group" onClick={() => useItem(item, i)}>
                    <div>
                      <div className="font-bold">{item.name}</div>
                      <div className="text-xs opacity-70 group-hover:opacity-100">{item.description}</div>
                    </div>
                    <div className="text-sm flex items-center gap-1"><Coins size={14} /> {item.value}</div>
                  </div>
                ))
              )}
            </div>
          </div>
        );
      case 'MAP':
        return (
          <div className="h-full p-4 flex flex-col items-center justify-center text-center">
            <MapIcon size={64} className="mb-4 opacity-50" />
            <h3 className="text-2xl mb-2">MOJAVE WASTELAND</h3>
            <p className="text-xl text-green-400">CURRENT LOCATION: {location}</p>
            <div className="mt-8 grid grid-cols-2 gap-4 w-full max-w-md">
              <div className="border border-green-500/30 p-2 text-sm">NORTH: New ALEX</div>
              <div className="border border-green-500/30 p-2 text-sm">SOUTH: Primm</div>
              <div className="border border-green-500/30 p-2 text-sm">EAST: Hoover Dam</div>
              <div className="border border-green-500/30 p-2 text-sm">WEST: Goodsprings</div>
            </div>
          </div>
        );
      case 'DATA':
        return (
          <div className="h-full p-4 overflow-y-auto space-y-6">
            <div className="pip-boy-border p-4 bg-green-900/10">
              <h3 className="text-xl mb-2 flex items-center gap-2"><Terminal size={20} /> SYSTEM INFO</h3>
              <p className="text-sm opacity-80">OS: ALEX-DOS v4.2.0</p>
              <p className="text-sm opacity-80">HARDWARE: PIP-BOY 3000 (ALEX EDITION)</p>
              <p className="text-sm opacity-80">USER: COURIER #6</p>
            </div>
            
            <div className="space-y-2">
              <h3 className="text-lg border-b border-green-500/30 pb-1">SURVIVAL GUIDE</h3>
              <ul className="text-sm space-y-2 list-disc pl-4 opacity-80">
                <li><span className="text-green-400 font-bold">EXPLORE:</span> Search the wasteland for loot and XP. Be prepared for combat.</li>
                <li><span className="text-green-400 font-bold">REST:</span> Recover HP and reduce fatigue, but increases hunger and thirst.</li>
                <li><span className="text-green-400 font-bold">RADIATION:</span> High rads (1000+) will kill you. Use Rad-Away.</li>
                <li><span className="text-green-400 font-bold">ALEX.PNG:</span> The legend says he's everywhere. If you see a glitch, run.</li>
              </ul>
            </div>

            <div className="p-4 border border-dashed border-green-500/30 text-center">
              <p className="text-xs italic">"War... war never changes. But ALEX... ALEX is eternal."</p>
            </div>
          </div>
        );
      case 'RADIO':
        return (
          <div className="h-full p-4 space-y-4">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl flex items-center gap-2"><Radio size={20} /> RADIO STATIONS</h3>
              {!hasApiKey && (
                <button 
                  onClick={async () => {
                    const win = window as any;
                    if (win.aistudio?.openSelectKey) {
                      await win.aistudio.openSelectKey();
                      setHasApiKey(true);
                    }
                  }}
                  className="text-[10px] border border-yellow-500 text-yellow-500 px-2 py-1 hover:bg-yellow-500 hover:text-black animate-pulse"
                >
                  ACTIVATE RADIO (SET API KEY)
                </button>
              )}
            </div>
            <div className="space-y-2">
              {RADIO_STATIONS.map((station, i) => (
                <button
                  key={station.id}
                  onClick={() => {
                    setCurrentStation(i);
                    setCurrentTrack(0);
                    addLog(`Tuned to ${station.name}.`);
                  }}
                  className={`w-full text-left pip-boy-border p-2 transition-colors ${currentStation === i ? 'bg-green-500 text-black' : 'hover:bg-green-500/20'}`}
                >
                  {station.name} {currentStation === i ? '- [ACTIVE]' : ''}
                </button>
              ))}
            </div>
            <div className="mt-6 p-4 border-2 border-green-500 bg-green-900/20 relative">
              {isAudioLoading && (
                <div className="absolute inset-0 bg-black/60 flex items-center justify-center z-10">
                  <div className="text-xs animate-bounce">TUNING SIGNAL...</div>
                </div>
              )}
              <div className="text-xs opacity-50 mb-1">NOW PLAYING:</div>
              <div className="text-lg font-bold animate-pulse">
                {RADIO_STATIONS[currentStation].tracks[currentTrack]}
              </div>
            </div>
            <div className="mt-4 p-4 border-t border-green-500/30 italic text-sm opacity-80">
              {currentStation === 2 ? (
                <span className="text-red-500">"I CAN SEE YOU, COURIER. THE WASTELAND IS MY CANVAS..."</span>
              ) : (
                <span>"...and that was another hit on New ALEX Radio. Stay tuned for more wasteland classics..."</span>
              )}
            </div>
          </div>
        );
      case 'SHOP':
        const tradeValue = (tradingSlots[0]?.value || 0) + (tradingSlots[1]?.value || 0);
        return (
          <div className="h-full flex flex-col p-4 overflow-hidden">
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-xl flex items-center gap-2"><Coins size={20} /> CHET'S GENERAL STORE</h3>
              <div className="text-yellow-500 font-bold">YOUR CAPS: {player.caps}</div>
            </div>

            <div className="grid grid-cols-2 gap-4 flex-1 overflow-hidden">
              {/* Shop Inventory */}
              <div className="flex flex-col border-r border-green-500/30 pr-2 overflow-hidden">
                <h4 className="text-sm opacity-50 mb-2 uppercase tracking-widest">Available Items</h4>
                <div className="flex-1 overflow-y-auto space-y-2">
                  {shopInventory.map((item, i) => (
                    <div key={i} className="pip-boy-border p-2 flex justify-between items-center hover:bg-green-500 hover:text-black cursor-pointer group" onClick={() => buyItem(item, i)}>
                      <div>
                        <div className="font-bold text-sm">{item.name}</div>
                        <div className="text-[10px] opacity-70 group-hover:opacity-100">{item.description}</div>
                      </div>
                      <div className="text-xs font-bold">{item.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trade Interface */}
              <div className="flex flex-col space-y-4 overflow-hidden">
                <div className="pip-boy-border p-3 bg-green-900/10">
                  <h4 className="text-sm opacity-50 mb-3 uppercase tracking-widest">Barter Slots (2 Max)</h4>
                  <div className="grid grid-cols-2 gap-2 mb-3">
                    {tradingSlots.map((slot, i) => (
                      <div key={i} className="h-16 border-2 border-dashed border-green-500/30 flex items-center justify-center relative group">
                        {slot ? (
                          <div className="text-center p-1 w-full h-full flex flex-col justify-center bg-green-900/20 cursor-pointer" onClick={() => removeFromTrade(i)}>
                            <div className="text-[10px] font-bold truncate">{slot.name}</div>
                            <div className="text-[10px] text-yellow-500">{slot.value}c</div>
                            <div className="absolute inset-0 bg-red-500/20 opacity-0 group-hover:opacity-100 flex items-center justify-center text-[10px] font-bold">REMOVE</div>
                          </div>
                        ) : (
                          <div className="text-[10px] opacity-30">EMPTY SLOT</div>
                        )}
                      </div>
                    ))}
                  </div>
                  <div className="flex justify-between items-center border-t border-green-500/30 pt-2">
                    <span className="text-xs">TOTAL TRADE VALUE:</span>
                    <span className="text-yellow-500 font-bold">{tradeValue} CAPS</span>
                  </div>
                </div>

                <div className="flex-1 flex flex-col overflow-hidden">
                  <h4 className="text-sm opacity-50 mb-2 uppercase tracking-widest">Your Inventory (Click to Trade)</h4>
                  <div className="flex-1 overflow-y-auto space-y-1">
                    {inventory.map((item, i) => (
                      <div key={i} className="border border-green-500/20 p-1 flex justify-between items-center hover:bg-green-500/10 cursor-pointer text-xs" onClick={() => useItem(item, i)}>
                        <span>{item.name}</span>
                        <div className="flex gap-2">
                          <span className="text-yellow-500">{item.value}c</span>
                          <button 
                            onClick={(e) => { e.stopPropagation(); sellItemDirectly(item, i); }}
                            className="text-[8px] border border-green-500 px-1 hover:bg-green-500 hover:text-black"
                          >
                            SELL (70%)
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
      case 'CRAFT':
        return (
          <div className="h-full flex flex-col p-4 overflow-hidden">
            <h3 className="text-xl mb-4 flex items-center gap-2"><Sword size={20} /> WORKBENCH</h3>
            <div className="flex-1 overflow-y-auto space-y-4">
              {RECIPES.map((recipe) => {
                const counts: Record<string, number> = {};
                inventory.forEach(item => {
                  counts[item.id] = (counts[item.id] || 0) + 1;
                });
                const canCraft = recipe.ingredients.every(ing => (counts[ing.itemId] || 0) >= ing.count);

                return (
                  <div key={recipe.id} className={`pip-boy-border p-3 transition-colors ${canCraft ? 'hover:bg-green-500/10' : 'opacity-60'}`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <h4 className="font-bold text-lg">{recipe.name}</h4>
                        <p className="text-xs opacity-70">{recipe.description}</p>
                      </div>
                      <button 
                        onClick={() => craftItem(recipe)}
                        disabled={!canCraft}
                        className={`px-4 py-1 font-bold text-sm border-2 ${canCraft ? 'border-green-500 hover:bg-green-500 hover:text-black' : 'border-green-900 text-green-900 cursor-not-allowed'}`}
                      >
                        CRAFT
                      </button>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {recipe.ingredients.map((ing, idx) => {
                        const has = counts[ing.itemId] || 0;
                        const itemInfo = ITEMS.find(it => it.id === ing.itemId);
                        return (
                          <div key={idx} className={`text-[10px] px-2 py-1 border ${has >= ing.count ? 'border-green-500 text-green-400' : 'border-red-900 text-red-900'}`}>
                            {itemInfo?.name}: {has}/{ing.count}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      default:
        return null;
    }
  };

  if (gameState === 'menu') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
        <div className="crt-overlay crt-flicker"></div>
        <div className="scanline"></div>
        
        <motion.div 
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          className="z-10 text-center space-y-8 p-12 border-4 border-green-500 shadow-[0_0_50px_rgba(0,255,65,0.2)] bg-black/80 max-w-2xl"
        >
          <h1 className="text-6xl font-bold tracking-tighter pip-boy-text-shadow mb-4">FALLOUT</h1>
          <h2 className="text-4xl font-bold text-green-400 tracking-widest mb-8">NEW ALEX</h2>
          
          <div className="flex flex-col gap-4">
            <button 
              onClick={startGame}
              className="text-2xl border-2 border-green-500 py-3 hover:bg-green-500 hover:text-black transition-all font-bold uppercase tracking-widest"
            >
              New Game
            </button>
            <button className="text-2xl border-2 border-green-500/30 py-3 text-green-900 cursor-not-allowed font-bold uppercase tracking-widest">
              Load Game
            </button>
            <button className="text-2xl border-2 border-green-500/30 py-3 text-green-900 cursor-not-allowed font-bold uppercase tracking-widest">
              Options
            </button>
          </div>
          
          <p className="text-xs opacity-50 mt-8">PROPERTY OF VAULT-TEC & ALEX.PNG INDUSTRIES</p>
        </motion.div>
      </div>
    );
  }

  if (gameState === 'gameover') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-black relative overflow-hidden">
        <div className="crt-overlay crt-flicker"></div>
        <div className="scanline"></div>
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="z-10 text-center space-y-8 p-12 border-4 border-red-500 bg-black/90"
        >
          <Skull size={100} className="mx-auto text-red-500 mb-4" />
          <h1 className="text-6xl font-bold text-red-500 tracking-tighter">YOU ARE DEAD</h1>
          <p className="text-xl text-red-400">The wasteland claimed another soul. ALEX.png watches from the shadows.</p>
          <button 
            onClick={() => window.location.reload()}
            className="text-2xl border-2 border-red-500 px-8 py-3 hover:bg-red-500 hover:text-black transition-all font-bold uppercase"
          >
            Try Again
          </button>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="h-screen flex flex-col bg-black relative overflow-hidden p-4 md:p-8">
      <div className="crt-overlay crt-flicker"></div>
      <div className="scanline"></div>

      {/* Pip-Boy Interface */}
      <div className="flex-1 flex flex-col border-4 border-green-500 rounded-xl overflow-hidden shadow-[0_0_30px_rgba(0,255,65,0.1)] bg-[#050505] relative">
        
        {/* Header Tabs */}
        <div className="flex border-b-2 border-green-500 bg-green-900/10">
          {(['STAT', 'INV', 'DATA', 'MAP', 'RADIO', 'SHOP', 'CRAFT'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 py-3 font-bold tracking-widest transition-all text-[10px] md:text-sm ${activeTab === tab ? 'bg-green-500 text-black' : 'hover:bg-green-500/20'}`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Main Screen Content */}
        <div className="flex-1 flex flex-col md:flex-row overflow-hidden">
          
          {/* Left Side: Game Log */}
          <div className="w-full md:w-1/3 border-r-2 border-green-500 flex flex-col bg-black/40">
            <div className="p-2 border-b border-green-500/30 bg-green-900/20 text-xs font-bold flex justify-between">
              <span>SYSTEM LOG</span>
              <span>{location.toUpperCase()}</span>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2 font-mono text-sm">
              {logs.map((log) => (
                <div key={log.id} className={`
                  ${log.type === 'danger' || log.type === 'combat' ? 'text-red-400' : ''}
                  ${log.type === 'success' ? 'text-blue-400' : ''}
                  ${log.type === 'info' ? 'text-green-400' : ''}
                  border-l-2 pl-2 border-current/30
                `}>
                  <span className="opacity-50 mr-2">[{new Date(log.id).toLocaleTimeString([], { hour12: false, hour: '2-digit', minute: '2-digit' })}]</span>
                  {log.text}
                </div>
              ))}
              <div ref={logEndRef} />
            </div>
          </div>

          {/* Right Side: Tab Content */}
          <div className="flex-1 relative">
            <AnimatePresence mode="wait">
              <motion.div
                key={activeTab}
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
                transition={{ duration: 0.2 }}
                className="h-full"
              >
                {renderTab()}
              </motion.div>
            </AnimatePresence>
          </div>
        </div>

        {/* Footer Controls */}
        <div className="border-t-2 border-green-500 p-4 bg-green-900/10 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-4">
            <button 
              onClick={explore}
              className="pip-boy-border px-6 py-2 bg-green-500 text-black font-bold hover:bg-green-400 transition-colors flex items-center gap-2"
            >
              <Crosshair size={18} /> EXPLORE
            </button>
            <button 
              onClick={useVATS}
              className="pip-boy-border px-6 py-2 hover:bg-green-500 hover:text-black transition-colors font-bold flex items-center gap-2"
            >
              <Terminal size={18} /> V.A.T.S.
            </button>
            <button 
              onClick={() => {
                setPlayer(prev => ({ ...prev, hp: Math.min(prev.maxHp, prev.hp + 5), hunger: Math.min(100, prev.hunger + 10), thirst: Math.min(100, prev.thirst + 10), ap: prev.maxAp }));
                // Restock shop
                const newShopInv = Array.from({ length: 8 }, () => ITEMS[Math.floor(Math.random() * ITEMS.length)]);
                setShopInventory(newShopInv);
                addLog("You rested for a few hours. Restored some health and AP. The shop has restocked.");
              }}
              className="pip-boy-border px-6 py-2 hover:bg-green-500 hover:text-black transition-colors font-bold flex items-center gap-2"
            >
              <Zap size={18} /> REST
            </button>
          </div>

          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2 text-yellow-500">
              <Coins size={20} />
              <span className="font-bold text-xl">{player.caps} CAPS</span>
            </div>
            <div className="flex items-center gap-4">
              <div className="flex flex-col items-end">
                <span className="text-[10px] opacity-50">HEALTH</span>
                <div className="w-32 h-3 bg-green-900/30 border border-green-500">
                  <div className="bg-green-500 h-full" style={{ width: `${(player.hp / player.maxHp) * 100}%` }}></div>
                </div>
              </div>
              <div className="flex flex-col items-end">
                <span className="text-[10px] opacity-50 text-yellow-500">RADIATION</span>
                <div className="w-32 h-3 bg-yellow-900/30 border border-yellow-500">
                  <div className="bg-yellow-500 h-full" style={{ width: `${Math.min(100, (player.rads / 1000) * 100)}%` }}></div>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* ALEX.png Easter Egg */}
        <div className="absolute bottom-20 right-8 opacity-5 pointer-events-none select-none">
          <img 
            src="https://picsum.photos/seed/alex/200/200" 
            alt="ALEX.png" 
            className="grayscale contrast-200"
            referrerPolicy="no-referrer"
          />
          <p className="text-[8px] text-center">ALEX.PNG IS WATCHING</p>
        </div>
      </div>

      {/* Decorative Pip-Boy Knobs/Buttons (Visual Only) */}
      <div className="hidden lg:flex justify-between mt-4 px-10">
        <div className="flex gap-8">
          <div className="w-12 h-12 rounded-full border-4 border-green-900 bg-zinc-800 shadow-inner flex items-center justify-center">
            <div className="w-1 h-6 bg-zinc-600 rotate-45"></div>
          </div>
          <div className="w-12 h-12 rounded-full border-4 border-green-900 bg-zinc-800 shadow-inner flex items-center justify-center">
            <div className="w-1 h-6 bg-zinc-600 -rotate-12"></div>
          </div>
        </div>
        <div className="flex gap-4">
          <div className="w-16 h-8 bg-zinc-800 border-2 border-green-900 rounded flex items-center justify-center text-[10px] font-bold opacity-30">OFF</div>
          <div className="w-16 h-8 bg-green-900 border-2 border-green-500 rounded flex items-center justify-center text-[10px] font-bold">ON</div>
        </div>
      </div>
    </div>
  );
}
