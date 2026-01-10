import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Difficulty, GridCell, Player, Lemming, BloodSplat, GameMode, Tetromino, Quest, QuestObjective, QuestObjectiveType, ControlScheme, ScoreEntry, KillerEntry } from './types';
import { COLS, ROWS, BLOCK_SIZE, RANDOM_TETROMINO, DIFFICULTY_SPEEDS, MAX_LEMMINGS } from './constants';
import { getTopScores, getTopKillers, saveScore, saveKiller } from './services/storageService';
import { saveScoreRemote, saveKillerRemote, fetchTopScoresRemote, fetchTopKillersRemote } from './services/databaseService';
import { audioController } from './services/audioService';

// --- Icons ---
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>;
const RotateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A10 10 0 1 0 22 17.8"/></svg>;
const DownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>;
const LeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const RightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;
const DropIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>;
const GearIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.86z"/></svg>;

export default function App() {
  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.KILL);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [score, setScore] = useState(0);
  const [lemmingsKilled, setLemmingsKilled] = useState(0); 
  const [lemmingsSaved, setLemmingsSaved] = useState(0);
  const [questsCompleted, setQuestsCompleted] = useState(0);
  const [currentSpeed, setCurrentSpeed] = useState(500);
  const [playerName, setPlayerName] = useState('');
  const [activeLemmingsCount, setActiveLemmingsCount] = useState(0);
  const [nextPieceState, setNextPieceState] = useState(RANDOM_TETROMINO());
  const [quest, setQuest] = useState<Quest | null>(null);

  // High Scores State (Combined Local + Remote)
  const [topScores, setTopScores] = useState<ScoreEntry[]>([]);
  const [topKillers, setTopKillers] = useState<KillerEntry[]>([]);

  // Settings State
  const [controlScheme, setControlScheme] = useState<ControlScheme>('SWIPE');
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVol] = useState(0.5);
  const [sfxVol, setSfxVol] = useState(0.5);

  // --- Refs ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const lemmingMoveCounterRef = useRef<number>(0);
  
  const gridRef = useRef<GridCell[][]>([]);
  const playerRef = useRef<Player | null>(null);
  const lemmingsRef = useRef<Lemming[]>([]);
  const bloodRef = useRef<BloodSplat[]>([]); 
  const isSpawningRef = useRef<boolean>(false);
  const linesToSpawnLemmingsRef = useRef<number>(0);
  const killsInCurrentFrameRef = useRef<number>(0);
  const nextPieceRef = useRef<Tetromino>(RANDOM_TETROMINO());
  const questRef = useRef<Quest | null>(null);
  const questsCompletedRef = useRef<number>(0); 
  
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  const touchLastPosRef = useRef<{x: number, y: number} | null>(null);
  const softDropIntervalRef = useRef<number | null>(null);
  const touchAxisRef = useRef<'none' | 'x' | 'y'>('none');

  // --- Load Scores ---
  const loadScores = useCallback(async () => {
    // 1. Get local scores
    const localScores = getTopScores(difficulty, gameMode);
    const localKillers = getTopKillers(difficulty, gameMode);
    
    // 2. Try remote scores
    const remoteScores = await fetchTopScoresRemote(difficulty, gameMode);
    const remoteKillers = await fetchTopKillersRemote(difficulty, gameMode);

    // 3. Merge and sort (unique by name+score or just trust remote if available)
    const mergedScores = [...remoteScores, ...localScores]
        .sort((a, b) => b.score - a.score)
        .slice(0, 10);
    const mergedKillers = [...remoteKillers, ...localKillers]
        .sort((a, b) => b.kills - a.kills)
        .slice(0, 10);

    setTopScores(mergedScores);
    setTopKillers(mergedKillers);
  }, [difficulty, gameMode]);

  useEffect(() => {
    if (gameState === GameState.MENU) {
        loadScores();
    }
  }, [gameState, loadScores]);

  // --- Initialization ---
  const initGame = useCallback(() => {
    audioController.init();
    audioController.setMusicVolume(musicVol);
    audioController.setSfxVolume(sfxVol);
    audioController.startMusic();

    const newGrid: GridCell[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ value: 0, color: '' }))
    );
    gridRef.current = newGrid;
    
    const startPiece = RANDOM_TETROMINO();
    const nextP = RANDOM_TETROMINO();
    
    playerRef.current = {
      x: Math.floor(COLS / 2) - 1,
      y: 0,
      tetromino: startPiece,
      rotation: 0,
    };
    
    nextPieceRef.current = nextP;
    setNextPieceState(nextP);

    lemmingsRef.current = [];
    bloodRef.current = [];
    setScore(0);
    setLemmingsKilled(0);
    setLemmingsSaved(0);
    setQuestsCompleted(0);
    questsCompletedRef.current = 0;
    setActiveLemmingsCount(0);
    isSpawningRef.current = false;
    linesToSpawnLemmingsRef.current = 0;
    
    setCurrentSpeed(DIFFICULTY_SPEEDS[difficulty]);
    generateQuest(1, gameMode);

    setGameState(GameState.PLAYING);
    lastTimeRef.current = performance.now();
  }, [gameMode, difficulty, musicVol, sfxVol]);

  const handleMusicVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setMusicVol(val);
      audioController.setMusicVolume(val);
  };

  const handleSfxVolChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const val = parseFloat(e.target.value);
      setSfxVol(val);
      audioController.setSfxVolume(val);
  };

  const generateQuest = (level: number, mode: GameMode) => {
      const objectives: QuestObjective[] = [];
      const numObjectives = Math.min(3, 1 + Math.floor(level / 3)); 
      const hasType = (t: QuestObjectiveType) => objectives.some(o => o.type === t);

      for (let i = 0; i < numObjectives; i++) {
          const r = Math.random();
          let obj: QuestObjective | null = null;

          if (mode === GameMode.SAVE) {
              if (r < 0.4 && !hasType('CLEAR_LINES')) {
                   const target = 2 + Math.floor(level * 1.5);
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
              } else if (r < 0.7 && !hasType('HAVE_LEMMINGS')) {
                   const target = Math.min(MAX_LEMMINGS - 2, 2 + Math.floor(level));
                   obj = { type: 'HAVE_LEMMINGS', target, current: 0, description: `Měj ${target} Lemmingů`, isCompleted: false };
              } else if (!hasType('CLEAR_DOUBLE') && level > 2) {
                   const target = 1 + Math.floor(level / 5);
                   obj = { type: 'CLEAR_DOUBLE', target, current: 0, description: `Smaž ${target}x 2-linku`, isCompleted: false };
              } else if (!hasType('CLEAR_LINES')) {
                   const target = 4 + level;
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
              }
          } 
          else if (mode === GameMode.KILL) {
              if (r < 0.4 && !hasType('KILL_TOTAL')) {
                   const target = 5 + (level * 2);
                   obj = { type: 'KILL_TOTAL', target, current: 0, description: `Zabij ${target} Lemmingů`, isCompleted: false };
              } else if (r < 0.7 && !hasType('CLEAR_LINES')) {
                   const target = 2 + level;
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
              } else if (!hasType('KILL_MULTI')) {
                   const target = Math.min(5, 2 + Math.floor(level / 2));
                   obj = { type: 'KILL_MULTI', target, current: 0, description: `Zabij ${target} jednou ranou`, isCompleted: false };
              } else if (!hasType('CLEAR_TRIPLE') && level > 3) {
                   obj = { type: 'CLEAR_TRIPLE', target: 1, current: 0, description: `Smaž 3-linku`, isCompleted: false };
              }
          }
          else if (mode === GameMode.CAGE) {
               if (r < 0.4 && !hasType('SELL_TOTAL')) {
                   const target = 5 + (level * 2);
                   obj = { type: 'SELL_TOTAL', target, current: 0, description: `Prodej ${target} Lemmingů`, isCompleted: false };
               } else if (r < 0.7 && !hasType('CLEAR_LINES')) {
                   const target = 2 + level;
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
               } else if (!hasType('SELL_BATCH')) {
                   const target = Math.min(10, 2 + Math.floor(level / 2));
                   obj = { type: 'SELL_BATCH', target, current: 0, description: `Prodej ${target} najednou`, isCompleted: false };
               }
          }
          if (obj) objectives.push(obj);
      }
      if (objectives.length === 0) {
          objectives.push({ type: 'CLEAR_LINES', target: 3, current: 0, description: 'Smaž 3 linky', isCompleted: false });
      }
      const newQuest: Quest = { objectives, level };
      setQuest(newQuest);
      questRef.current = newQuest;
  };

  const reportQuestProgress = (type: string | QuestObjectiveType, amount: number, isAbsolute: boolean = false) => {
      if (!questRef.current) return;
      
      let changed = false;
      let targetType = type;

      if (type === 'LINE_CLEAR_EVENT') {
          const clearTypes: QuestObjectiveType[] = ['CLEAR_TETRIS', 'CLEAR_TRIPLE', 'CLEAR_DOUBLE'];
          const typeToMinLines: Record<string, number> = { 'CLEAR_TETRIS': 4, 'CLEAR_TRIPLE': 3, 'CLEAR_DOUBLE': 2 };
          const availableLineQuests = questRef.current.objectives
              .filter(o => clearTypes.includes(o.type) && !o.isCompleted)
              .sort((a, b) => typeToMinLines[b.type] - typeToMinLines[a.type]);
          const match = availableLineQuests.find(o => amount >= typeToMinLines[o.type]);
          if (match) {
              targetType = match.type;
              amount = 1;
          } else {
              targetType = 'CLEAR_LINES';
          }
      }

      const newObjectives = questRef.current.objectives.map(obj => {
          if (obj.type === targetType) {
              let newCurrent = obj.current;
              if (isAbsolute) {
                  newCurrent = amount; 
              } else {
                  if (obj.type === 'KILL_MULTI' || obj.type === 'SELL_BATCH') {
                       if (amount > newCurrent) newCurrent = amount;
                  } else {
                       newCurrent += amount;
                  }
              }
              const isNowCompleted = newCurrent >= obj.target;
              if (obj.current !== newCurrent || obj.isCompleted !== isNowCompleted) {
                  changed = true;
                  return { ...obj, current: newCurrent, isCompleted: isNowCompleted };
              }
          }
          return obj;
      });

      const allCompleted = newObjectives.every(o => o.isCompleted);
      if (changed) {
          const updatedQuest = { ...questRef.current, objectives: newObjectives };
          questRef.current = updatedQuest;
          setQuest(updatedQuest);
      }
      if (allCompleted) {
          completeQuest();
      }
  };

  const completeQuest = () => {
      if (!questRef.current) return;
      audioController.playQuestComplete();
      const q = questRef.current;
      const newTotal = questsCompletedRef.current + 1;
      questsCompletedRef.current = newTotal;
      setQuestsCompleted(newTotal);
      if (newTotal % 2 === 0) {
          setCurrentSpeed(prev => Math.max(80, prev * 0.9));
      }
      let bonusPoints = 1000 * q.level;
      let color = '#fbbf24';
      if (gameMode === GameMode.SAVE) {
          const lemmingCount = lemmingsRef.current.length;
          bonusPoints += lemmingCount * 500 * q.level;
          lemmingsRef.current.forEach(l => {
             bloodRef.current.push({ x: l.x, y: Math.floor(l.y), alpha: 1.5, radius: 10, type: 'TEXT', text: `+${500 * q.level}`, color: '#4ade80' });
          });
          setLemmingsSaved(prev => prev + lemmingCount);
          lemmingsRef.current = [];
          setActiveLemmingsCount(0);
      } else {
          bloodRef.current.push({ x: COLS / 2 - 0.5, y: ROWS / 2 + 2.5, alpha: 2, radius: 20, type: 'TEXT', text: `+${bonusPoints}`, color: '#fbbf24' });
      }
      setScore(s => s + bonusPoints);
      bloodRef.current.push({ x: COLS / 2 - 0.5, y: ROWS / 2 - 1, alpha: 2, radius: 24, type: 'TEXT', text: 'ÚKOL', color: color });
      bloodRef.current.push({ x: COLS / 2 - 0.5, y: ROWS / 2 + 1, alpha: 2, radius: 24, type: 'TEXT', text: 'SPLNĚN!', color: color });
      generateQuest(q.level + 1, gameMode);
  };

  const countTrappedLemmings = (): number => {
      let count = 0;
      gridRef.current.forEach(row => {
          row.forEach(cell => {
              if (cell.hasLemming) count++;
          });
      });
      return count;
  };

  const isValidMove = (p: Player, grid: GridCell[][]) => {
    const { shape } = p.tetromino;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = x + p.x;
          const newY = y + p.y;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
          if (newY >= 0 && grid[newY][newX].value !== 0) return false;
        }
      }
    }
    return true;
  };

  const getGhostY = (p: Player, grid: GridCell[][]) => {
    let ghostY = p.y;
    while (isValidMove({ ...p, y: ghostY + 1 }, grid)) {
      ghostY++;
    }
    return ghostY;
  };

  const rotateMatrix = (matrix: number[][]) => {
    return matrix[0].map((val, index) => matrix.map(row => row[index]).reverse());
  };

  const spawnPiece = () => {
    if (gameState === GameState.GAME_OVER) return;
    const nextP = nextPieceRef.current;
    const pShape = nextP.shape.map(row => [...row]);
    const p: Player = {
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        tetromino: { ...nextP, shape: pShape },
        rotation: 0,
    };
    playerRef.current = p;
    const nextTemplate = RANDOM_TETROMINO();
    const nextShape = nextTemplate.shape.map(row => [...row]);
    const nextPiece = { ...nextTemplate, shape: nextShape };
    nextPieceRef.current = nextPiece;
    setNextPieceState(nextPiece);
    if (!isValidMove(p, gridRef.current)) {
        triggerGameOver();
    }
  };

  const triggerGameOver = () => {
    setGameState(GameState.GAME_OVER);
    audioController.stopMusic();
    audioController.playGameOver();
    playerRef.current = null;
    isSpawningRef.current = false;
  };

  const update = (time: number) => {
    if (gameState !== GameState.PLAYING) return;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    audioController.updateMusicState(activeLemmingsCount, currentSpeed);
    if (!isSpawningRef.current && playerRef.current) {
      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > currentSpeed) {
        playerDrop();
        dropCounterRef.current = 0;
      }
    }
    lemmingMoveCounterRef.current += deltaTime;
    if (lemmingMoveCounterRef.current > 33) {
        updateLemmings();
        lemmingMoveCounterRef.current = 0;
    }
    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const updateLemmings = () => {
    const grid = gridRef.current;
    const lemmings = lemmingsRef.current;
    const player = playerRef.current;
    let anyLemmingFalling = false;
    killsInCurrentFrameRef.current = 0;
    const survivingLemmings: Lemming[] = [];
    
    lemmings.forEach(lemming => {
      // POJISTKA PROTI NESMRTELNOSTI: Pokud je Lemming uvnitř bloku v gridu, hned zemře
      const gridX = Math.floor(lemming.x);
      const gridY = Math.floor(lemming.y);
      if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS && grid[gridY][gridX].value !== 0) {
          handleLemmingContact(lemming);
          return;
      }

      if (player && checkLemmingSquish(lemming, player)) {
        handleLemmingContact(lemming);
        return; 
      }
      
      if (lemming.state === 'FALLING') {
        anyLemmingFalling = true;
        const fallSpeed = 0.8;
        const nextY = lemming.y + fallSpeed;
        const checkY = Math.floor(nextY + 0.9);
        if (checkY >= ROWS || (checkY >= 0 && grid[checkY][Math.floor(lemming.x)].value !== 0)) {
           lemming.state = 'WALKING';
           lemming.y = Math.floor(lemming.y); 
           if (checkY < ROWS && grid[checkY][Math.floor(lemming.x)].value !== 0) {
             lemming.y = checkY - 1;
           } else if (checkY >= ROWS) {
             lemming.y = ROWS - 1;
           }
        } else {
           lemming.y = nextY;
        }
      } 
      else if (lemming.state === 'WALKING') {
        const groundY = Math.floor(lemming.y + 1);
        const centerXInt = Math.floor(lemming.x + 0.5);
        const isHoleBelow = groundY < ROWS && centerXInt >= 0 && centerXInt < COLS && grid[groundY] && grid[groundY][centerXInt] && grid[groundY][centerXInt].value === 0;
        const currentY = Math.floor(lemming.y);
        const isPathToHoleClear = currentY >= 0 && currentY < ROWS && centerXInt >= 0 && centerXInt < COLS && grid[currentY] && grid[currentY][centerXInt] && grid[currentY][centerXInt].value === 0;
        if (isHoleBelow && isPathToHoleClear) {
            lemming.state = 'FALLING';
            lemming.x = centerXInt + 0.5; 
        } else {
            const walkSpeed = 0.05;
            const nextX = lemming.x + (lemming.dx * walkSpeed);
            const lookAhead = lemming.dx > 0 ? 0.9 : 0.1;
            const checkWallX = Math.floor(nextX + lookAhead);
            const checkWallY = Math.floor(lemming.y);
            if (checkWallX < 0 || checkWallX >= COLS || grid[checkWallY][checkWallX].value !== 0) {
                lemming.dx *= -1;
            } else {
                lemming.x = nextX;
            }
        }
      }
      lemming.frame = (lemming.frame + 0.2) % 4;
      survivingLemmings.push(lemming);
    });

    if (killsInCurrentFrameRef.current > 0) {
        if (gameMode !== GameMode.CAGE) applyKillScore(killsInCurrentFrameRef.current);
        reportQuestProgress('KILL_TOTAL', killsInCurrentFrameRef.current);
    }
    lemmingsRef.current = survivingLemmings;
    const trapped = countTrappedLemmings();
    setActiveLemmingsCount(survivingLemmings.length + trapped);
    reportQuestProgress('HAVE_LEMMINGS', survivingLemmings.length, true);
    
    if (isSpawningRef.current && gameState === GameState.PLAYING) {
        if (!anyLemmingFalling) {
            if (linesToSpawnLemmingsRef.current > 0) {
                const totalLemmings = lemmingsRef.current.length + (gameMode === GameMode.CAGE ? countTrappedLemmings() : 0);
                if (totalLemmings < MAX_LEMMINGS) spawnLemming();
                linesToSpawnLemmingsRef.current--;
            } else {
                isSpawningRef.current = false;
                spawnPiece();
            }
        }
    }
  };

  const handleLemmingContact = (lemming: Lemming) => killLemming(lemming);

  const killLemming = (lemming: Lemming) => {
    audioController.playSquish();
    killsInCurrentFrameRef.current++;
    setLemmingsKilled(prev => prev + 1);
    bloodRef.current.push({ x: lemming.x, y: Math.floor(lemming.y), alpha: 1, radius: Math.random() * 10 + 10, type: 'BLOOD' });
  };

  const applyKillScore = (count: number) => {
      const baseVal = Math.floor(1000 * Math.pow(1.3, count) * count);
      if (gameMode === GameMode.SAVE) setScore(s => s - baseVal);
      else setScore(s => s + baseVal);
  };

  const checkLemmingSquish = (l: Lemming, p: Player): boolean => {
    const lx = Math.floor(l.x + 0.5);
    const ly = Math.floor(l.y + 0.5);
    const { shape } = p.tetromino;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const blockX = p.x + x;
          const blockY = p.y + y;
          if (blockX === lx && blockY === ly) return true;
        }
      }
    }
    return false;
  };

  const spawnLemming = () => {
    audioController.playLemmingSpawn();
    const x = Math.floor(Math.random() * (COLS - 2)) + 1;
    lemmingsRef.current.push({ id: Date.now() + Math.random(), x: x + 0.5, y: 0, dx: Math.random() > 0.5 ? 1 : -1, dy: 0, state: 'FALLING', frame: 0 });
  };

  const playerDrop = () => {
    if (!playerRef.current) return;
    const p = playerRef.current;
    p.y++;
    if (!isValidMove(p, gridRef.current)) {
      p.y--;
      lockPiece();
    }
  };

  const playerHardDrop = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    const p = playerRef.current;
    audioController.playDrop();
    let moved = true;
    while(moved) {
        p.y++;
        if (!isValidMove(p, gridRef.current)) {
            p.y--;
            moved = false;
        }
    }
    lockPiece();
  };

  const playerMove = (dir: -1 | 1) => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playMove();
    const p = playerRef.current;
    p.x += dir;
    if (!isValidMove(p, gridRef.current)) p.x -= dir;
  };

  const playerRotate = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playRotate();
    const p = playerRef.current;
    const originalShape = p.tetromino.shape;
    p.tetromino.shape = rotateMatrix(p.tetromino.shape);
    if (!isValidMove(p, gridRef.current)) {
        if (p.x < 0) p.x++;
        else if (p.x > COLS - 3) p.x--;
        if (!isValidMove(p, gridRef.current)) p.tetromino.shape = originalShape;
    }
  };

  const lockPiece = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING) return;
    audioController.playLand();
    const { x, y, tetromino } = playerRef.current;
    const grid = gridRef.current;

    // Kontrola pro Game Over při pokusu o umístění v horní řadě
    if (y < 0) {
        triggerGameOver();
        return;
    }

    const placedBlocks: {x: number, y: number}[] = [];
    let isGameOverDetected = false;

    tetromino.shape.forEach((row, dy) => {
      row.forEach((value, dx) => {
        if (value) {
            const gy = y + dy;
            const gx = x + dx;
            if (gy >= 0 && gy < ROWS) {
                placedBlocks.push({x: gx, y: gy});
            } else if (gy < 0) {
                isGameOverDetected = true;
            }
        }
      });
    });

    if (isGameOverDetected) {
        triggerGameOver();
        return;
    }

    // Umístění bloků do mřížky
    placedBlocks.forEach(pos => { 
        grid[pos.y][pos.x] = { value: 1, color: tetromino.color }; 
    });

    let trappedKills = 0;
    const survivingLemmings: Lemming[] = [];
    lemmingsRef.current.forEach(l => {
        const cx = Math.floor(l.x); // Změna na floor pro přesnější grid collision
        const cy = Math.floor(l.y);
        const isTrapped = placedBlocks.some(b => b.x === cx && b.y === cy);
        if (isTrapped) {
            if (gameMode === GameMode.CAGE) {
                if (grid[cy][cx].value !== 0) grid[cy][cx].hasLemming = true;
            } else {
                trappedKills++;
                setLemmingsKilled(prev => prev + 1);
                audioController.playSquish();
                bloodRef.current.push({ x: l.x, y: Math.floor(l.y), alpha: 1, radius: Math.random() * 10 + 10, type: 'BLOOD' });
            }
        } else {
            survivingLemmings.push(l);
        }
    });
    lemmingsRef.current = survivingLemmings;

    if (trappedKills > 0) {
        if (gameMode !== GameMode.CAGE) applyKillScore(trappedKills);
        reportQuestProgress('KILL_MULTI', trappedKills);
        reportQuestProgress('KILL_TOTAL', trappedKills);
    }

    let linesCleared = 0;
    let totalCashMoney = 0;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(cell => cell.value !== 0)) {
        if (gameMode === GameMode.CAGE) {
            grid[r].forEach((cell, colIndex) => {
                if (cell.hasLemming) {
                    totalCashMoney++;
                    setLemmingsKilled(prev => prev + 1); 
                    bloodRef.current.push({ x: colIndex, y: r, alpha: 1.5, radius: 20, type: 'MONEY', text: '$' });
                }
            });
        }
        linesCleared++;
        grid.splice(r, 1);
        grid.unshift(Array.from({length: COLS}, () => ({ value: 0, color: '' })));
        lemmingsRef.current.forEach(l => { if (l.y < r) l.y += 1; });
        bloodRef.current.forEach(p => { if (p.y < r) p.y += 1; });
      }
    }

    if (linesCleared > 0) {
        audioController.playLineClear(linesCleared >= 4);
        reportQuestProgress('CLEAR_LINES', linesCleared);
        reportQuestProgress('LINE_CLEAR_EVENT', linesCleared);
        if (gameMode === GameMode.CAGE) {
             reportQuestProgress('SELL_BATCH', totalCashMoney);
             reportQuestProgress('SELL_TOTAL', totalCashMoney);
        }
        const activeLemmings = lemmingsRef.current.length;
        let points = 0;
        if (gameMode === GameMode.SAVE) {
            const multiplier = 1 + (activeLemmings * 0.2);
            points = Math.floor(linesCleared * 100 * multiplier);
        } else if (gameMode === GameMode.KILL) {
            points = linesCleared * 100;
        } else if (gameMode === GameMode.CAGE) {
            points = linesCleared * 100;
            if (totalCashMoney > 0) points += (totalCashMoney * 500); 
        }
        setScore(prev => prev + points);
        linesToSpawnLemmingsRef.current += linesCleared;
        isSpawningRef.current = true;
        playerRef.current = null;
    } else {
        spawnPiece();
    }
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#0a0a0a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / (COLS * BLOCK_SIZE);
    ctx.save();
    ctx.scale(scale, scale);
    gridRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.value) drawBlock(ctx, x, y, cell.color, false, cell.hasLemming);
        else {
            ctx.strokeStyle = '#1a1a1a';
            ctx.lineWidth = 0.1; 
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      });
    });
    bloodRef.current.forEach(p => {
        const cx = p.x * BLOCK_SIZE + BLOCK_SIZE/2;
        const cy = p.y * BLOCK_SIZE + BLOCK_SIZE/2;
        if (p.type === 'BLOOD') {
            ctx.fillStyle = `rgba(180, 0, 0, ${p.alpha})`;
            ctx.beginPath(); 
            ctx.arc(cx, p.y * BLOCK_SIZE + BLOCK_SIZE, p.radius, 0, Math.PI*2); 
            ctx.fill();
        } else if (p.type === 'MONEY') {
            ctx.fillStyle = `rgba(34, 197, 94, ${p.alpha})`; 
            ctx.font = `bold ${p.radius}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text || '$', cx, cy - (1.5 - p.alpha) * 30);
        } else if (p.type === 'TEXT') {
            ctx.fillStyle = p.color || '#fff'; ctx.globalAlpha = p.alpha > 1 ? 1 : p.alpha;
            ctx.font = `bold ${p.radius}px "Press Start 2P"`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
            ctx.fillText(p.text || '', cx, cy); ctx.globalAlpha = 1;
        }
        p.alpha -= 0.01; 
    });
    bloodRef.current = bloodRef.current.filter(b => b.alpha > 0);
    
    if (playerRef.current && !isSpawningRef.current) {
        const ghostY = getGhostY(playerRef.current, gridRef.current);
        const { x, tetromino } = playerRef.current;
        tetromino.shape.forEach((row, dy) => {
            row.forEach((val, dx) => {
                if (val) drawBlock(ctx, x + dx, ghostY + dy, tetromino.color, false, false, true);
            });
        });
    }

    if (playerRef.current) {
        const { x, y, tetromino } = playerRef.current;
        tetromino.shape.forEach((row, dy) => {
            row.forEach((val, dx) => {
                if (val) drawBlock(ctx, x + dx, y + dy, tetromino.color, true);
            });
        });
    }
    lemmingsRef.current.forEach(lemming => drawLemming(ctx, lemming));
    ctx.restore();
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, active = false, hasLemming = false, isGhost = false) => {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    if (isGhost) {
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4);
        ctx.fillStyle = color;
        ctx.globalAlpha = 0.15;
        ctx.fillRect(px + 4, py + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8);
        ctx.globalAlpha = 1;
        return;
    }
    ctx.fillStyle = color;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(px, py, BLOCK_SIZE, 5);
    ctx.fillRect(px, py, 5, BLOCK_SIZE);
    if (hasLemming) {
        const eyeSize = 4; const eyeX = px + 10; const eyeY = py + 15;
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 10, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
        const shake = Math.random(); 
        ctx.fillStyle = 'black';
        ctx.beginPath(); ctx.arc(eyeX + shake, eyeY, eyeSize/2, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 10 + shake, eyeY, eyeSize/2, 0, Math.PI*2); ctx.fill();
    }
  };

  const drawLemming = (ctx: CanvasRenderingContext2D, lemming: Lemming) => {
    const px = lemming.x * BLOCK_SIZE;
    const py = lemming.y * BLOCK_SIZE;
    const size = BLOCK_SIZE;
    ctx.fillStyle = '#4ade80'; ctx.fillRect(px + size*0.25, py + size*0.1, size*0.5, size*0.3);
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(px + size*0.3, py + size*0.4, size*0.4, size*0.4);
    ctx.fillStyle = '#fff';
    const eye1X = px + size*0.4; const eye2X = px + size*0.6; const eyeY = py + size*0.25; const eyeSize = size * 0.12;
    ctx.beginPath(); ctx.arc(eye1X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eye2X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
    let pupX = 0; let pupY = 0;
    if (playerRef.current) {
        const targetX = (playerRef.current.x + 1.5) * BLOCK_SIZE; 
        const targetY = (playerRef.current.y + 1.5) * BLOCK_SIZE;
        const angle = Math.atan2(targetY - eyeY, targetX - (eye1X + eye2X)/2);
        const pupilDist = 1.5;
        pupX = Math.cos(angle) * pupilDist; pupY = Math.sin(angle) * pupilDist;
    }
    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(eye1X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eye2X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill();
    ctx.fillStyle = '#fca5a5';
    if (lemming.state === 'WALKING') {
        const legOffset = Math.sin(lemming.frame * Math.PI) * 5;
        ctx.fillRect(px + size*0.35 + legOffset, py + size*0.8, size*0.1, size*0.2);
        ctx.fillRect(px + size*0.55 - legOffset, py + size*0.8, size*0.1, size*0.2);
    } else {
        ctx.fillRect(px + size*0.35, py + size*0.7, size*0.1, size*0.2);
        ctx.fillRect(px + size*0.55, py + size*0.7, size*0.1, size*0.2);
        ctx.fillStyle = '#fff'; ctx.fillRect(px + size*0.1, py + size*0.3, size*0.8, size*0.1); 
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameState === GameState.MENU && e.key === 'Enter') {
            initGame();
        } else if (gameState === GameState.PLAYING) {
            switch(e.key) {
                case 'ArrowLeft': playerMove(-1); break;
                case 'ArrowRight': playerMove(1); break;
                case 'ArrowDown': playerDrop(); break;
                case 'ArrowUp': playerRotate(); break;
                case ' ': playerHardDrop(); break; 
                case 'p': case 'P': setGameState(GameState.PAUSED); audioController.stopMusic(); break;
            }
        } else if (gameState === GameState.PAUSED && !showSettings) {
            if (e.key === 'p' || e.key === 'P') { setGameState(GameState.PLAYING); audioController.startMusic(); }
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, initGame, showSettings]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState, difficulty, gameMode, currentSpeed, activeLemmingsCount]); 

  const handleTouchStart = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      touchLastPosRef.current = { x: touch.clientX, y: touch.clientY };
      touchAxisRef.current = 'none';
      if (softDropIntervalRef.current) clearInterval(softDropIntervalRef.current);
      softDropIntervalRef.current = window.setInterval(() => {
           if (touchStartRef.current && Date.now() - touchStartRef.current.time > 200) playerDrop();
      }, 50);
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchLastPosRef.current || !touchStartRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchLastPosRef.current.x;
      const deltaY = touch.clientY - touchLastPosRef.current.y;
      const totalDeltaX = touch.clientX - touchStartRef.current.x;
      const totalDeltaY = touch.clientY - touchStartRef.current.y;

      if (touchAxisRef.current === 'none') {
          if (Math.abs(totalDeltaX) > 15) touchAxisRef.current = 'x';
          else if (Math.abs(totalDeltaY) > 15) touchAxisRef.current = 'y';
      }

      if (touchAxisRef.current === 'x') {
          const MOVE_THRESHOLD = 30;
          if (Math.abs(deltaX) > MOVE_THRESHOLD) {
              if (softDropIntervalRef.current) { clearInterval(softDropIntervalRef.current); softDropIntervalRef.current = null; }
              const steps = Math.floor(Math.abs(deltaX) / MOVE_THRESHOLD);
              for(let i=0; i<steps; i++) playerMove(deltaX > 0 ? 1 : -1);
              touchLastPosRef.current.x = touch.clientX; 
          }
      }
      touchLastPosRef.current.y = touch.clientY;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchStartRef.current) return;
      if (softDropIntervalRef.current) { clearInterval(softDropIntervalRef.current); softDropIntervalRef.current = null; }
      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaX = touch.clientX - touchStartRef.current.x;
      const timeDiff = Date.now() - touchStartRef.current.time;
      const SWIPE_THRESHOLD = 60;

      if (timeDiff < 300) { 
          if (Math.abs(deltaY) > Math.abs(deltaX)) {
              if (Math.abs(deltaY) > SWIPE_THRESHOLD) {
                  if (deltaY > 0) playerHardDrop();
                  else playerRotate(); 
              }
          } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) {
             playerRotate();
          }
      }
      touchStartRef.current = null;
      touchLastPosRef.current = null;
      touchAxisRef.current = 'none';
  };

  const saveHighScore = async () => {
    if (!playerName.trim()) return;
    const scoreData = { 
        name: playerName, score, date: new Date().toLocaleDateString(), difficulty, mode: gameMode,
        saved: lemmingsSaved, killed: lemmingsKilled, quests: questsCompletedRef.current 
    };
    saveScore(scoreData);
    await saveScoreRemote(scoreData);
    
    if (lemmingsKilled > 0) {
        const killerData = { name: playerName, kills: lemmingsKilled, date: new Date().toLocaleDateString(), difficulty, mode: gameMode };
        saveKiller(killerData);
        await saveKillerRemote(killerData);
    }
    setGameState(GameState.MENU);
  };

  const renderNextPiece = (size: number = 10) => {
      const p = nextPieceState.shape;
      return (
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${p[0].length}, ${size}px)` }}>
              {p.map((row, y) => row.map((val, x) => (
                  <div key={`${x}-${y}`} className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size, backgroundColor: val ? nextPieceState.color : 'transparent' }} />
              )))}
          </div>
      );
  };

  return (
    <div 
        className="relative w-full h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-between overflow-hidden p-2 md:p-4"
        onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}
    >
      {/* Top HUD */}
      <div className="w-full max-w-lg flex items-start justify-between z-10 gap-2 mb-1 pointer-events-none">
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl min-w-[90px] backdrop-blur-sm">
                <div className="text-[8px] text-gray-400 uppercase">Skóre</div>
                <div className={`font-retro text-xs md:text-base ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[7px] md:text-[9px] text-gray-500">
                    <span>SPD:</span>
                    <span className="text-cyan-400 font-retro">{Math.round((1000 - currentSpeed) / 5)}%</span>
                </div>
            </div>
            <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl min-w-[90px] backdrop-blur-sm">
                <div className="text-[8px] text-gray-400 uppercase">
                    {gameMode === GameMode.SAVE ? 'Saved' : gameMode === GameMode.CAGE ? 'Sold' : 'Kills'}
                </div>
                <div className={`font-retro text-xs ${gameMode === GameMode.SAVE ? 'text-green-400' : gameMode === GameMode.CAGE ? 'text-yellow-400' : 'text-red-400'}`}>
                    {gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}
                </div>
            </div>
          </div>

          <div className="flex-1 flex justify-center pointer-events-auto mt-1">
            <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl text-center backdrop-blur-sm">
                 <div className="text-[8px] text-gray-500 uppercase mb-0.5">Příště</div>
                 <div className="flex justify-center scale-[0.6] md:scale-90 origin-top">{renderNextPiece(8)}</div>
            </div>
          </div>

          <div className="flex flex-col gap-1.5 items-end pointer-events-auto">
             <div className="flex gap-1.5">
                <button onClick={() => { setGameState(GameState.PAUSED); audioController.stopMusic(); setShowSettings(true); }} className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl hover:bg-gray-800 active:bg-gray-700"><GearIcon /></button>
                <button className="bg-gray-800/80 p-1.5 rounded hover:bg-gray-700 active:bg-gray-600 border border-gray-600" onClick={() => { if (gameState === GameState.PLAYING) { setGameState(GameState.PAUSED); audioController.stopMusic(); } else { setGameState(GameState.PLAYING); audioController.startMusic(); } }}>
                 <PauseIcon />
                </button>
             </div>
             <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl text-center hidden md:block backdrop-blur-sm">
                <div className="text-[8px] text-gray-500 uppercase mb-0.5">Pop: {activeLemmingsCount}</div>
                <div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(activeLemmingsCount / MAX_LEMMINGS) * 100}%` }} />
                </div>
             </div>
          </div>
      </div>

      {/* Main Container */}
      <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-center gap-2 overflow-hidden relative">
          
          {/* Desktop Left Quest Panel */}
          <div className="hidden lg:flex flex-col gap-3 w-40">
              {quest && (
                 <div className="bg-blue-900/20 p-2.5 rounded border border-blue-500/30 backdrop-blur-md">
                     <div className="text-[8px] text-blue-300 uppercase mb-2">Úkol Lv.{quest.level}</div>
                     <div className="flex flex-col gap-2.5">
                        {quest.objectives.map((obj, i) => (
                             <div key={i} className="flex flex-col">
                                <div className={`text-[8px] font-retro leading-tight ${obj.isCompleted ? 'text-green-400 line-through opacity-50' : 'text-white'}`}>{obj.description}</div>
                                <div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1">
                                    <div className={`h-full bg-blue-500`} style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }} />
                                </div>
                             </div>
                        ))}
                     </div>
                 </div>
              )}
          </div>

          {/* Canvas Wrapper */}
          <div className="relative flex-1 max-h-full flex items-center justify-center overflow-hidden">
            <canvas 
                ref={canvasRef} 
                width={COLS * BLOCK_SIZE} 
                height={ROWS * BLOCK_SIZE} 
                className="border-2 border-gray-800 bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] h-full max-h-[calc(100dvh-180px)] md:max-h-[85vh] object-contain touch-none" 
            />
          </div>

          {/* Mobile Quest HUD */}
          <div className="w-full lg:hidden flex flex-col items-center gap-1.5 pointer-events-none mb-1">
              {quest && (
                 <div className="w-full max-w-[280px] bg-blue-900/20 p-1.5 rounded border border-blue-500/20 pointer-events-auto backdrop-blur-sm">
                     <div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">
                        {quest.objectives.map((obj, i) => (
                             <div key={i} className="flex items-center gap-1.5">
                                <div className={`text-[7px] font-retro ${obj.isCompleted ? 'text-green-400 line-through' : 'text-blue-200'}`}>{obj.description}</div>
                                <div className="w-8 h-1 bg-gray-800 rounded-full overflow-hidden">
                                    <div className={`h-full bg-blue-500`} style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }} />
                                </div>
                             </div>
                        ))}
                     </div>
                 </div>
              )}
          </div>
      </div>

      {/* Controls Overlay */}
      {gameState === GameState.PLAYING && controlScheme === 'BUTTONS' && (
          <div className="w-full max-w-sm flex flex-col gap-2 pb-safe z-20 md:hidden pointer-events-auto mb-2">
              <div className="flex justify-between w-full px-4">
                   <div className="flex gap-3">
                        <button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerMove(-1)}><LeftIcon /></button>
                        <button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerMove(1)}><RightIcon /></button>
                   </div>
                   <div className="flex gap-3">
                        <button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerDrop()}><DownIcon /></button>
                        <button className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center backdrop-blur-md active:bg-red-500/30 border-2 border-red-500/30" onClick={() => playerRotate()}><RotateIcon /></button>
                   </div>
              </div>
          </div>
      )}

      {/* MENU Overlay */}
      {gameState === GameState.MENU && !showSettings && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-start z-50 p-6 overflow-y-auto">
            <div className="pt-10 flex flex-col items-center w-full">
                <h1 className="font-retro text-4xl md:text-6xl text-cyan-500 mb-2 text-center drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">LEMRIS 2</h1>
                <p className="text-[8px] text-gray-500 mb-6 tracking-[0.3em] uppercase">Save or Slaughter. You decide.</p>

                <div className="flex flex-wrap justify-center gap-2 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800">
                    <button onClick={() => setGameMode(GameMode.SAVE)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.SAVE ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'text-gray-500 hover:text-white'}`}>ZACHRAŇ</button>
                    <button onClick={() => setGameMode(GameMode.KILL)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.KILL ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'text-gray-500 hover:text-white'}`}>ZABÍJEJ</button>
                    <button onClick={() => setGameMode(GameMode.CAGE)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.CAGE ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'text-gray-500 hover:text-white'}`}>LOV</button>
                </div>

                <div className="flex gap-4 mb-8">
                    {Object.values(Difficulty).map(d => (
                        <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-lg font-retro text-[8px] border-2 transition-all ${difficulty === d ? 'bg-cyan-700 border-cyan-400 text-white' : 'border-gray-800 text-gray-600'}`}>{d}</button>
                    ))}
                </div>

                <button onClick={initGame} className={`px-10 py-5 text-white font-retro text-lg rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none transition-all mb-10 w-full max-w-xs ${ gameMode === GameMode.SAVE ? 'bg-green-600' : gameMode === GameMode.KILL ? 'bg-red-700' : 'bg-yellow-600' }`}>SPUSTIT HRU</button>
                
                {/* Scoreboards */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl text-[9px] mb-10">
                    <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 backdrop-blur-md">
                        <h3 className="font-retro text-yellow-500 mb-4 text-center tracking-widest uppercase">Globální Skóre</h3>
                        <table className="w-full text-left">
                            <thead><tr className="text-gray-600 border-b border-gray-800"><th>Hráč</th><th className="text-right">Úkoly</th><th className="text-right">Body</th></tr></thead>
                            <tbody>
                                {topScores.map((s, i) => (
                                    <tr key={i} className="border-b border-gray-800/30">
                                        <td className="py-2 max-w-[70px] truncate text-gray-300 font-bold">{s.name}</td><td className="text-right text-gray-500">{s.quests || 0}</td><td className="text-right text-yellow-400 font-retro text-[7px]">{s.score}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 backdrop-blur-md">
                        <h3 className="font-retro text-red-600 mb-4 text-center tracking-widest uppercase">Největší Vrazi</h3>
                        <table className="w-full text-left">
                            <thead><tr className="text-gray-600 border-b border-gray-800"><th>Hráč</th><th className="text-right">Mrtvol</th></tr></thead>
                            <tbody>
                                {topKillers.map((k, i) => (
                                    <tr key={i} className="border-b border-gray-800/30"><td className="py-2 max-w-[90px] truncate text-gray-300 font-bold">{k.name}</td><td className="text-right text-red-500 font-retro text-[7px]">{k.kills}</td></tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        </div>
      )}

      {/* GAME OVER Overlay */}
      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center z-50 p-6 overflow-y-auto">
              <h2 className="font-retro text-4xl text-white mb-6 text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">KONEC HRY</h2>
              <div className="bg-black/60 p-6 rounded-3xl text-center mb-8 w-full max-w-sm border border-red-800/50 backdrop-blur-md">
                  <div className="mb-2 text-gray-500 text-[9px] uppercase tracking-widest">Dosažené skóre</div>
                  <div className={`font-retro text-3xl mb-6 ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div>
                  <div className="grid grid-cols-2 gap-3 mb-6">
                      <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                          <div className="text-[7px] text-gray-600 mb-1 uppercase">ÚKOLY</div>
                          <div className="font-retro text-base text-cyan-400">{questsCompleted}</div>
                      </div>
                      <div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800">
                          <div className="text-[7px] text-gray-600 mb-1 uppercase">{gameMode === GameMode.SAVE ? 'SAVED' : 'KILLS'}</div>
                          <div className={`font-retro text-base ${gameMode === GameMode.SAVE ? 'text-green-500' : 'text-red-500'}`}>{gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}</div>
                      </div>
                  </div>
                  <div className="flex flex-col gap-2 text-left">
                      <label className="text-[9px] uppercase text-gray-500 tracking-widest ml-1">Tvé jméno:</label>
                      <input 
                        type="text" 
                        maxLength={12} 
                        placeholder="Hráč" 
                        className="bg-black border border-gray-800 text-white p-4 rounded-xl font-retro text-[10px] text-center focus:border-cyan-600 outline-none transition-all" 
                        value={playerName} 
                        onChange={(e) => setPlayerName(e.target.value)} 
                        autoFocus
                      />
                  </div>
              </div>
              <button onClick={saveHighScore} className="px-10 py-5 bg-green-700 hover:bg-green-600 text-white font-retro rounded-2xl shadow-xl active:translate-y-1 transition-all w-full max-w-xs">ULOŽIT VÝSLEDEK</button>
          </div>
      )}

      {/* Settings & Pause Overlays remain the same */}
      {showSettings && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-6">
              <h2 className="font-retro text-2xl text-cyan-400 mb-8 tracking-[0.2em]">NASTAVENÍ</h2>
              <div className="w-full max-w-sm bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-2xl">
                  <div className="mb-8">
                      <label className="block text-gray-500 text-[9px] uppercase mb-4 tracking-widest">Metoda ovládání</label>
                      <div className="flex bg-black rounded-xl p-1 gap-1 border border-gray-800">
                          <button className={`flex-1 py-3 text-[9px] font-retro rounded-lg transition-all ${controlScheme === 'BUTTONS' ? 'bg-cyan-700 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('BUTTONS')}>TLAČÍTKA</button>
                          <button className={`flex-1 py-3 text-[9px] font-retro rounded-lg transition-all ${controlScheme === 'SWIPE' ? 'bg-cyan-700 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('SWIPE')}>SWIPE</button>
                      </div>
                  </div>
                  <div className="space-y-6">
                      <div>
                          <div className="flex justify-between mb-2"><label className="text-gray-500 text-[9px] uppercase tracking-widest">Hudba</label><span className="text-[10px] text-cyan-400 font-retro">{Math.round(musicVol * 100)}%</span></div>
                          <input type="range" min="0" max="1" step="0.1" value={musicVol} onChange={handleMusicVolChange} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                      </div>
                      <div>
                          <div className="flex justify-between mb-2"><label className="text-gray-500 text-[9px] uppercase tracking-widest">Zvuky</label><span className="text-[10px] text-cyan-400 font-retro">{Math.round(sfxVol * 100)}%</span></div>
                          <input type="range" min="0" max="1" step="0.1" value={sfxVol} onChange={handleSfxVolChange} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" />
                      </div>
                  </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="mt-10 px-12 py-4 bg-green-600 text-white font-retro rounded-xl shadow-lg active:scale-95 transition-all">ZAVŘÍT</button>
          </div>
      )}

      {gameState === GameState.PAUSED && !showSettings && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50">
              <h2 className="font-retro text-3xl text-white mb-10 tracking-[0.2em] animate-pulse">PAUZA</h2>
              <button onClick={() => { setGameState(GameState.PLAYING); audioController.startMusic(); }} className="px-10 py-4 bg-cyan-700 text-white font-retro rounded-xl mb-4 w-64 shadow-xl active:translate-y-1 transition-all">POKRAČOVAT</button>
              <button onClick={() => setGameState(GameState.MENU)} className="px-10 py-4 bg-red-800 text-white font-retro rounded-xl w-64 shadow-xl active:translate-y-1 transition-all">MENU</button>
          </div>
      )}
    </div>
  );
}