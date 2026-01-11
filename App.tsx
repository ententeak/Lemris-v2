import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Difficulty, GridCell, Player, Lemming, Particle, GameMode, Tetromino, Quest, QuestObjective, QuestObjectiveType, ControlScheme, ScoreEntry, KillerEntry } from './types';
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

  // High Scores State
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
  const particlesRef = useRef<Particle[]>([]); 
  const isSpawningRef = useRef<boolean>(false);
  const linesToSpawnLemmingsRef = useRef<number>(0);
  const killsInCurrentFrameRef = useRef<number>(0);
  const nextPieceRef = useRef<Tetromino>(RANDOM_TETROMINO());
  const questRef = useRef<Quest | null>(null);
  const questsCompletedRef = useRef<number>(0); 
  
  // Audio Refs for immediate access
  const walkingCountRef = useRef<number>(0);
  const trappedCountRef = useRef<number>(0);
  
  const touchStartRef = useRef<{x: number, y: number, time: number} | null>(null);
  const touchLastPosRef = useRef<{x: number, y: number} | null>(null);
  const softDropIntervalRef = useRef<number | null>(null);
  const touchAxisRef = useRef<'none' | 'x' | 'y'>('none');

  // --- Load Scores ---
  const loadScores = useCallback(async () => {
    const localScores = getTopScores(difficulty, gameMode);
    const localKillers = getTopKillers(difficulty, gameMode);
    const remoteScores = await fetchTopScoresRemote(difficulty, gameMode);
    const remoteKillers = await fetchTopKillersRemote(difficulty, gameMode);
    const mergedScores = [...remoteScores, ...localScores].sort((a, b) => b.score - a.score).slice(0, 10);
    const mergedKillers = [...remoteKillers, ...localKillers].sort((a, b) => b.kills - a.kills).slice(0, 10);
    setTopScores(mergedScores);
    setTopKillers(mergedKillers);
  }, [difficulty, gameMode]);

  useEffect(() => {
    if (gameState === GameState.MENU) loadScores();
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
    particlesRef.current = [];
    setScore(0);
    setLemmingsKilled(0);
    setLemmingsSaved(0);
    setQuestsCompleted(0);
    questsCompletedRef.current = 0;
    setActiveLemmingsCount(0);
    walkingCountRef.current = 0;
    trappedCountRef.current = 0;
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
              if (r < 0.4 && !hasType('CLEAR_LINES')) obj = { type: 'CLEAR_LINES', target: 2 + Math.floor(level * 1.5), current: 0, description: `Smaž ${2 + Math.floor(level * 1.5)} linek`, isCompleted: false };
              else if (r < 0.7 && !hasType('HAVE_LEMMINGS')) obj = { type: 'HAVE_LEMMINGS', target: Math.min(MAX_LEMMINGS - 2, 2 + Math.floor(level)), current: 0, description: `Měj ${Math.min(MAX_LEMMINGS - 2, 2 + Math.floor(level))} Lemmingů`, isCompleted: false };
              else if (!hasType('CLEAR_DOUBLE') && level > 2) obj = { type: 'CLEAR_DOUBLE', target: 1 + Math.floor(level / 5), current: 0, description: `Smaž ${1 + Math.floor(level / 5)}x 2-linku`, isCompleted: false };
          } else if (mode === GameMode.KILL) {
              if (r < 0.4 && !hasType('KILL_TOTAL')) obj = { type: 'KILL_TOTAL', target: 5 + (level * 2), current: 0, description: `Zabij ${5 + (level * 2)} Lemmingů`, isCompleted: false };
              else if (r < 0.7 && !hasType('CLEAR_LINES')) obj = { type: 'CLEAR_LINES', target: 2 + level, current: 0, description: `Smaž ${2 + level} linek`, isCompleted: false };
              else if (!hasType('KILL_MULTI')) obj = { type: 'KILL_MULTI', target: Math.min(5, 2 + Math.floor(level / 2)), current: 0, description: `Zabij ${Math.min(5, 2 + Math.floor(level / 2))} najednou`, isCompleted: false };
          } else if (mode === GameMode.CAGE) {
               if (r < 0.4 && !hasType('SELL_TOTAL')) obj = { type: 'SELL_TOTAL', target: 5 + (level * 2), current: 0, description: `Prodej ${5 + (level * 2)} Lemmingů`, isCompleted: false };
               else if (r < 0.7 && !hasType('CLEAR_LINES')) obj = { type: 'CLEAR_LINES', target: 2 + level, current: 0, description: `Smaž ${2 + level} linek`, isCompleted: false };
          }
          if (obj) objectives.push(obj);
      }
      if (objectives.length === 0) objectives.push({ type: 'CLEAR_LINES', target: 3, current: 0, description: 'Smaž 3 linky', isCompleted: false });
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
          if (match) { targetType = match.type; amount = 1; } else { targetType = 'CLEAR_LINES'; }
      }
      const newObjectives = questRef.current.objectives.map(obj => {
          if (obj.type === targetType) {
              let newCurrent = isAbsolute ? amount : obj.current + amount;
              if (obj.type === 'KILL_MULTI' || obj.type === 'SELL_BATCH') if (amount > obj.current) newCurrent = amount;
              const isNowCompleted = newCurrent >= obj.target;
              if (obj.current !== newCurrent || obj.isCompleted !== isNowCompleted) { changed = true; return { ...obj, current: newCurrent, isCompleted: isNowCompleted }; }
          }
          return obj;
      });
      if (changed) { const updatedQuest = { ...questRef.current, objectives: newObjectives }; questRef.current = updatedQuest; setQuest(updatedQuest); if (newObjectives.every(o => o.isCompleted)) completeQuest(); }
  };

  const completeQuest = () => {
      if (!questRef.current) return;
      audioController.playQuestComplete();
      const q = questRef.current;
      const newTotal = questsCompletedRef.current + 1;
      questsCompletedRef.current = newTotal;
      setQuestsCompleted(newTotal);
      if (newTotal % 2 === 0) setCurrentSpeed(prev => Math.max(80, prev * 0.9));
      let bonusPoints = 1000 * q.level;
      if (gameMode === GameMode.SAVE) {
          const lemmingCount = lemmingsRef.current.length;
          bonusPoints += lemmingCount * 500 * q.level;
          lemmingsRef.current.forEach(l => {
             createParticleEffect(l.x, l.y, 'TEXT', { text: `+${500 * q.level}`, color: '#4ade80' });
             createParticleEffect(l.x, l.y, 'SPARK', { count: 5, color: '#4ade80' });
          });
          setLemmingsSaved(prev => prev + lemmingCount);
          lemmingsRef.current = [];
          setActiveLemmingsCount(0);
      } else {
          createParticleEffect(COLS/2, ROWS/2, 'TEXT', { text: `+${bonusPoints}`, color: '#fbbf24', size: 20 });
      }
      setScore(s => s + bonusPoints);
      createParticleEffect(COLS/2, ROWS/2 - 2, 'TEXT', { text: 'ÚKOL', color: '#fbbf24', size: 24 });
      createParticleEffect(COLS/2, ROWS/2, 'TEXT', { text: 'SPLNĚN!', color: '#fbbf24', size: 24 });
      
      // Confetti effect
      for(let i=0; i<30; i++) {
        createParticleEffect(COLS/2 + (Math.random()-0.5)*5, ROWS/2 + (Math.random()-0.5)*5, 'DEBRIS', { color: ['#f00', '#0f0', '#00f', '#ff0'][Math.floor(Math.random()*4)] });
      }

      generateQuest(q.level + 1, gameMode);
  };

  const countTrappedLemmings = (): number => {
      let count = 0;
      gridRef.current.forEach(row => row.forEach(cell => { if (cell.hasLemming) count++; }));
      return count;
  };

  const isValidMove = (p: Player, grid: GridCell[][]) => {
    const { shape } = p.tetromino;
    for (let y = 0; y < shape.length; y++) {
      for (let x = 0; x < shape[y].length; x++) {
        if (shape[y][x]) {
          const newX = x + p.x; const newY = y + p.y;
          if (newX < 0 || newX >= COLS || newY >= ROWS) return false;
          if (newY >= 0 && grid[newY][newX].value !== 0) return false;
        }
      }
    }
    return true;
  };

  const getGhostY = (p: Player, grid: GridCell[][]) => {
    let ghostY = p.y;
    while (isValidMove({ ...p, y: ghostY + 1 }, grid)) ghostY++;
    return ghostY;
  };

  const rotateMatrix = (matrix: number[][]) => matrix[0].map((val, index) => matrix.map(row => row[index]).reverse());

  const spawnPiece = () => {
    if (gameState === GameState.GAME_OVER) return;
    const nextP = nextPieceRef.current;
    const p: Player = { x: Math.floor(COLS / 2) - 1, y: 0, tetromino: { ...nextP, shape: nextP.shape.map(row => [...row]) }, rotation: 0 };
    playerRef.current = p;
    const nextTemplate = RANDOM_TETROMINO();
    const nextPiece = { ...nextTemplate, shape: nextTemplate.shape.map(row => [...row]) };
    nextPieceRef.current = nextPiece;
    setNextPieceState(nextPiece);
    if (!isValidMove(p, gridRef.current)) triggerGameOver();
  };

  const triggerGameOver = () => { setGameState(GameState.GAME_OVER); audioController.stopMusic(); audioController.playGameOver(); playerRef.current = null; isSpawningRef.current = false; };

  const createParticleEffect = (x: number, y: number, type: Particle['type'], options?: { count?: number, color?: string, text?: string, size?: number }) => {
      const count = options?.count || 1;
      for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          let speed = 0;
          let life = 60;
          let size = options?.size || (Math.random() * 4 + 2);
          let gravity = 0;
          let friction = 0.95;
          
          if (type === 'BLOOD') {
              speed = 0.1 + Math.random() * 0.2;
              life = 100 + Math.random() * 50;
              gravity = 0.015;
              friction = 0.98;
          } else if (type === 'DEBRIS') {
              speed = 0.1 + Math.random() * 0.4;
              life = 40 + Math.random() * 20;
              gravity = 0.02;
              size = size * 1.5;
          } else if (type === 'SPARK') {
              speed = 0.2 + Math.random() * 0.3;
              life = 20 + Math.random() * 10;
              gravity = 0.01;
              size = 2;
          } else if (type === 'SMOKE') {
              speed = 0.02 + Math.random() * 0.05;
              life = 50 + Math.random() * 30;
              gravity = -0.005; // float up
              size = 5 + Math.random() * 5;
          } else if (type === 'TEXT' || type === 'MONEY') {
              speed = 0.02;
              life = 80;
              gravity = -0.005;
          }

          particlesRef.current.push({
              x: x, 
              y: y, 
              vx: type === 'TEXT' || type === 'MONEY' ? 0 : Math.cos(angle) * speed, 
              vy: type === 'TEXT' || type === 'MONEY' ? -0.05 : Math.sin(angle) * speed, 
              life, 
              maxLife: life,
              radius: size, 
              type, 
              text: options?.text,
              color: options?.color || '#fff',
              gravity,
              friction,
              rotation: Math.random() * Math.PI,
              rotSpeed: (Math.random() - 0.5) * 0.2
          });
      }
  };

  const update = (time: number) => {
    if (gameState !== GameState.PLAYING) return;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    
    audioController.updateMusicState(walkingCountRef.current, trappedCountRef.current, currentSpeed);
    
    if (!isSpawningRef.current && playerRef.current) {
      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > currentSpeed) { playerDrop(); dropCounterRef.current = 0; }
    }
    lemmingMoveCounterRef.current += deltaTime;
    if (lemmingMoveCounterRef.current > 33) { updateLemmings(); lemmingMoveCounterRef.current = 0; }
    
    draw();
    requestRef.current = requestAnimationFrame(update);
  };

  const updateLemmings = () => {
    const grid = gridRef.current; const lemmings = lemmingsRef.current; const player = playerRef.current;
    let anyLemmingFalling = false; killsInCurrentFrameRef.current = 0; const survivingLemmings: Lemming[] = [];
    
    lemmings.forEach(lemming => {
      const gridX = Math.floor(lemming.x); const gridY = Math.floor(lemming.y);
      
      // Detekce rozdrcení blokem (střed Lemminga je uvnitř plného bloku)
      if (gridY >= 0 && gridY < ROWS && gridX >= 0 && gridX < COLS && grid[gridY][gridX].value !== 0) { killLemming(lemming); return; }
      if (player && checkLemmingSquish(lemming, player)) { killLemming(lemming); return; }
      
      if (lemming.state === 'FALLING') {
        anyLemmingFalling = true; const fallSpeed = 0.8; lemming.y += fallSpeed; const checkY = Math.floor(lemming.y + 0.9);
        if (checkY >= ROWS || (checkY >= 0 && grid[checkY][Math.floor(lemming.x)].value !== 0)) { 
            lemming.state = 'WALKING'; lemming.y = Math.floor(lemming.y); 
            if (checkY < ROWS && grid[checkY][Math.floor(lemming.x)].value !== 0) lemming.y = checkY - 1; 
            else if (checkY >= ROWS) lemming.y = ROWS - 1; 
        }
      } else if (lemming.state === 'WALKING') {
        const groundY = Math.floor(lemming.y + 1); const centerXInt = Math.floor(lemming.x);
        if (groundY < ROWS && centerXInt >= 0 && centerXInt < COLS && grid[groundY][centerXInt].value === 0) { 
            lemming.state = 'FALLING'; lemming.x = centerXInt + 0.5; 
        } else {
            const nextX = lemming.x + (lemming.dx * 0.05); 
            // Robustnější detekce stěn s nárazníkem 0.3
            const checkWallX = Math.floor(nextX + (lemming.dx > 0 ? 0.3 : -0.3)); 
            const checkWallY = Math.floor(lemming.y);
            
            if (checkWallX < 0 || checkWallX >= COLS || (checkWallY >= 0 && grid[checkWallY][checkWallX].value !== 0)) {
                // Hitted a wall
                let startedClimbing = false;
                if (lemming.canClimb && checkWallX >= 0 && checkWallX < COLS && checkWallY - 1 >= 0) {
                    if (grid[checkWallY - 1][checkWallX].value === 0 && grid[checkWallY - 1][Math.floor(lemming.x)].value === 0) {
                        lemming.state = 'CLIMBING';
                        lemming.x = Math.floor(lemming.x) + 0.5;
                        lemming.y -= 0.1; 
                        startedClimbing = true;
                    }
                }
                if (!startedClimbing) { lemming.dx *= -1; }
            } else {
                lemming.x = Math.max(0.1, Math.min(COLS - 0.1, nextX));
            }
        }
      } else if (lemming.state === 'CLIMBING') {
          const climbSpeed = 0.04;
          lemming.y -= climbSpeed;
          const wallX = Math.floor(lemming.x + lemming.dx);
          const footY = Math.floor(lemming.y + 1); 
          
          if (footY < ROWS && wallX >= 0 && wallX < COLS && grid[footY][wallX].value === 0) {
               lemming.state = 'FALLING'; lemming.x += lemming.dx * 0.2; 
          } else {
              const targetY = Math.floor(lemming.y); 
              if (lemming.y - targetY < 0.06) { lemming.y = targetY; lemming.x = wallX + 0.5; lemming.state = 'WALKING'; }
          }
      }
      lemming.frame = (lemming.frame + 0.2) % 4; survivingLemmings.push(lemming);
    });
    
    if (killsInCurrentFrameRef.current > 0) { if (gameMode !== GameMode.CAGE) applyKillScore(killsInCurrentFrameRef.current); reportQuestProgress('KILL_TOTAL', killsInCurrentFrameRef.current); }
    lemmingsRef.current = survivingLemmings; 
    
    // Update Counts for State and Audio
    const walking = survivingLemmings.length;
    const trapped = countTrappedLemmings();
    walkingCountRef.current = walking;
    trappedCountRef.current = trapped;
    setActiveLemmingsCount(walking + trapped); 
    
    reportQuestProgress('HAVE_LEMMINGS', survivingLemmings.length, true);
    
    if (isSpawningRef.current && gameState === GameState.PLAYING && !anyLemmingFalling) {
        if (linesToSpawnLemmingsRef.current > 0) { if (lemmingsRef.current.length + (gameMode === GameMode.CAGE ? trapped : 0) < MAX_LEMMINGS) spawnLemming(); linesToSpawnLemmingsRef.current--; } else { isSpawningRef.current = false; spawnPiece(); }
    }
  };

  const killLemming = (lemming: Lemming) => {
    audioController.playSquish();
    killsInCurrentFrameRef.current++;
    setLemmingsKilled(prev => prev + 1);
    createParticleEffect(lemming.x, lemming.y, 'BLOOD', { count: 12, color: '#991b1b' });
  };

  const applyKillScore = (count: number) => {
      const baseVal = Math.floor(1000 * Math.pow(1.3, count) * count);
      if (gameMode === GameMode.SAVE) setScore(s => s - baseVal); else setScore(s => s + baseVal);
  };

  const checkLemmingSquish = (l: Lemming, p: Player): boolean => {
    const lx = Math.floor(l.x); const ly = Math.floor(l.y);
    const { shape } = p.tetromino;
    for (let y = 0; y < shape.length; y++) for (let x = 0; x < shape[y].length; x++) if (shape[y][x] && p.x + x === lx && p.y + y === ly) return true;
    return false;
  };

  const spawnLemming = () => { 
      audioController.playLemmingSpawn(); 
      const x = Math.floor(Math.random() * (COLS - 2)) + 1; 
      createParticleEffect(x + 0.5, 0, 'SMOKE', { count: 5, color: '#e5e7eb' });
      lemmingsRef.current.push({ 
          id: Date.now() + Math.random(), 
          x: x + 0.5, 
          y: 0, 
          dx: Math.random() > 0.5 ? 1 : -1, 
          dy: 0, 
          state: 'FALLING', 
          frame: 0,
          canClimb: Math.random() < 0.15 
      }); 
  };

  const playerDrop = () => { if (!playerRef.current) return; const p = playerRef.current; p.y++; if (!isValidMove(p, gridRef.current)) { p.y--; lockPiece(); } };

  const playerHardDrop = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playDrop(); while(isValidMove({ ...playerRef.current, y: playerRef.current.y + 1 }, gridRef.current)) playerRef.current.y++;
    lockPiece();
  };

  const playerMove = (dir: -1 | 1) => { if (playerRef.current && gameState === GameState.PLAYING && !isSpawningRef.current) { audioController.playMove(); playerRef.current.x += dir; if (!isValidMove(playerRef.current, gridRef.current)) playerRef.current.x -= dir; } };

  const playerRotate = () => {
    if (playerRef.current && gameState === GameState.PLAYING && !isSpawningRef.current) {
        audioController.playRotate(); const p = playerRef.current; const original = p.tetromino.shape; p.tetromino.shape = rotateMatrix(p.tetromino.shape);
        if (!isValidMove(p, gridRef.current)) { if (p.x < 0) p.x++; else if (p.x > COLS - 3) p.x--; if (!isValidMove(p, gridRef.current)) p.tetromino.shape = original; }
    }
  };

  const lockPiece = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING) return;
    audioController.playLand(); const { x, y, tetromino } = playerRef.current; const grid = gridRef.current;
    if (y < 0) { triggerGameOver(); return; }
    const placed: {x: number, y: number}[] = []; let gameOver = false;
    
    // Impact effect
    tetromino.shape.forEach((row, dy) => row.forEach((val, dx) => { 
        if (val) {
            const gy = y + dy; const gx = x + dx; 
            if (gy >= 0 && gy < ROWS) placed.push({x: gx, y: gy}); else if (gy < 0) gameOver = true; 
            if (isValidMove({ ...playerRef.current!, y: y + 1 }, grid)) return; 
             // Bottom blocks create sparks/dust
             if (row[dx] && (dy === tetromino.shape.length - 1 || !tetromino.shape[dy+1][dx])) {
                 createParticleEffect(gx + 0.5, gy + 1, 'SPARK', { count: 2, color: '#fbbf24' });
                 createParticleEffect(gx + 0.5, gy + 1, 'SMOKE', { count: 1, size: 2, color: '#d1d5db' });
             }
        } 
    }));

    if (gameOver) { triggerGameOver(); return; }
    placed.forEach(p => grid[p.y][p.x] = { value: 1, color: tetromino.color });
    
    // Rozdrcení novým blokem
    let trappedKills = 0; const surviving: Lemming[] = [];
    lemmingsRef.current.forEach(l => {
        const isTrapped = placed.some(b => b.x === Math.floor(l.x) && b.y === Math.floor(l.y));
        if (isTrapped) { if (gameMode === GameMode.CAGE) { grid[Math.floor(l.y)][Math.floor(l.x)].hasLemming = true; } else { trappedKills++; killLemming(l); } } else surviving.push(l);
    });
    lemmingsRef.current = surviving;
    
    if (trappedKills > 0) { if (gameMode !== GameMode.CAGE) applyKillScore(trappedKills); reportQuestProgress('KILL_MULTI', trappedKills); reportQuestProgress('KILL_TOTAL', trappedKills); }
    
    let lines = 0; let totalSold = 0;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(c => c.value !== 0)) {
        if (gameMode === GameMode.CAGE) grid[r].forEach((c, ci) => { if (c.hasLemming) { totalSold++; setLemmingsKilled(prev => prev + 1); createParticleEffect(ci, r, 'MONEY', { text: '$' }); } });
        lines++; 
        
        // Explosion Effect for the line
        grid[r].forEach((cell, ci) => {
             createParticleEffect(ci + 0.5, r + 0.5, 'DEBRIS', { count: 4, color: cell.color });
        });

        // Zabití Lemmingů v odmazávaném řádku (propadnou se do prázdna)
        const inThisRow: Lemming[] = [];
        const afterRowClear: Lemming[] = [];
        lemmingsRef.current.forEach(l => {
            if (Math.floor(l.y) === r) inThisRow.push(l);
            else afterRowClear.push(l);
        });
        inThisRow.forEach(l => killLemming(l));
        
        // Posun ostatních dolů
        afterRowClear.forEach(l => { if (l.y < r) l.y += 1; });
        lemmingsRef.current = afterRowClear;
        
        grid.splice(r, 1); grid.unshift(Array.from({length: COLS}, () => ({ value: 0, color: '' })));
        
        // Shift particles
        particlesRef.current.forEach(p => { if (p.y < r) p.y += 1; });
      }
    }
    
    checkSquashAfterShift();
    
    if (lines > 0) {
        audioController.playLineClear(lines >= 4); reportQuestProgress('CLEAR_LINES', lines); reportQuestProgress('LINE_CLEAR_EVENT', lines);
        if (gameMode === GameMode.CAGE) { reportQuestProgress('SELL_BATCH', totalSold); reportQuestProgress('SELL_TOTAL', totalSold); }
        setScore(prev => prev + (lines * 100 + (totalSold * 500))); linesToSpawnLemmingsRef.current += lines; isSpawningRef.current = true; playerRef.current = null;
    } else spawnPiece();
  };

  const checkSquashAfterShift = () => {
    const surviving: Lemming[] = [];
    const grid = gridRef.current;
    lemmingsRef.current.forEach(l => {
        const gx = Math.floor(l.x); const gy = Math.floor(l.y);
        if (gx >= 0 && gx < COLS && gy >= 0 && gy < ROWS && grid[gy][gx].value !== 0) {
            killLemming(l);
        } else {
            surviving.push(l);
        }
    });
    lemmingsRef.current = surviving;
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    ctx.fillStyle = '#0a0a0a'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / (COLS * BLOCK_SIZE); ctx.save(); ctx.scale(scale, scale);
    gridRef.current.forEach((row, y) => row.forEach((cell, x) => {
      if (cell.value) drawBlock(ctx, x, y, cell.color, false, cell.hasLemming); else { ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.1; ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); }
    }));
    
    // Draw Particles
    particlesRef.current.forEach(p => {
        const cx = p.x * BLOCK_SIZE; 
        const cy = p.y * BLOCK_SIZE;
        const opacity = p.life / p.maxLife;
        
        ctx.save();
        ctx.translate(cx, cy);
        if (p.rotation) ctx.rotate(p.rotation);
        
        if (p.type === 'BLOOD') {
            ctx.fillStyle = p.color;
            ctx.globalAlpha = opacity;
            ctx.beginPath(); ctx.arc(0, 0, p.radius * opacity, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'DEBRIS') {
             ctx.fillStyle = p.color;
             ctx.globalAlpha = opacity;
             ctx.fillRect(-p.radius/2, -p.radius/2, p.radius, p.radius);
        } else if (p.type === 'SMOKE') {
             ctx.fillStyle = p.color;
             ctx.globalAlpha = opacity * 0.5;
             ctx.beginPath(); ctx.arc(0, 0, p.radius, 0, Math.PI * 2); ctx.fill();
        } else if (p.type === 'SPARK') {
             ctx.fillStyle = p.color;
             ctx.globalAlpha = opacity;
             ctx.fillRect(-1, -1, 2, 2);
        } else if (p.type === 'TEXT' || p.type === 'MONEY') {
             ctx.fillStyle = p.color; 
             ctx.globalAlpha = opacity;
             ctx.font = `bold ${p.radius}px "Press Start 2P"`; 
             ctx.textAlign = 'center'; 
             ctx.textBaseline = 'middle';
             ctx.fillText(p.text || '', 0, 0); 
        }
        ctx.restore();

        // Update Particle Physics
        p.x += p.vx;
        p.y += p.vy;
        p.vx *= p.friction || 1;
        p.vy *= p.friction || 1;
        if (p.gravity) p.vy += p.gravity;
        if (p.rotSpeed) p.rotation = (p.rotation || 0) + p.rotSpeed;
        p.life--;
    });
    
    // Clean dead particles
    particlesRef.current = particlesRef.current.filter(p => p.life > 0);
    
    if (playerRef.current && !isSpawningRef.current) {
        const ghostY = getGhostY(playerRef.current, gridRef.current);
        playerRef.current.tetromino.shape.forEach((row, dy) => row.forEach((val, dx) => { if (val) drawBlock(ctx, playerRef.current!.x + dx, ghostY + dy, playerRef.current!.tetromino.color, false, false, true); }));
    }
    if (playerRef.current) playerRef.current.tetromino.shape.forEach((row, dy) => row.forEach((val, dx) => { if (val) drawBlock(ctx, playerRef.current!.x + dx, playerRef.current!.y + dy, playerRef.current!.tetromino.color, true); }));
    lemmingsRef.current.forEach(lemming => drawLemming(ctx, lemming));
    ctx.restore();
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, active = false, hasLemming = false, isGhost = false) => {
    const px = x * BLOCK_SIZE; const py = y * BLOCK_SIZE;
    if (isGhost) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4); ctx.fillStyle = color; ctx.globalAlpha = 0.15; ctx.fillRect(px + 4, py + 4, BLOCK_SIZE - 8, BLOCK_SIZE - 8); ctx.globalAlpha = 1; return; }
    ctx.fillStyle = color; ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE); ctx.strokeStyle = 'rgba(0,0,0,0.3)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.2)'; ctx.fillRect(px, py, BLOCK_SIZE, 5); ctx.fillRect(px, py, 5, BLOCK_SIZE);
    if (hasLemming) { const eyeSize = 4; const eyeX = px + 10; const eyeY = py + 15; ctx.fillStyle = 'white'; ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(eyeX + 10, eyeY, eyeSize, 0, Math.PI*2); ctx.fill(); ctx.fillStyle = 'black'; ctx.beginPath(); ctx.arc(eyeX + Math.random(), eyeY, eyeSize/2, 0, Math.PI*2); ctx.fill(); ctx.beginPath(); ctx.arc(eyeX + 10 + Math.random(), eyeY, eyeSize/2, 0, Math.PI*2); ctx.fill(); }
  };

  const drawLemming = (ctx: CanvasRenderingContext2D, lemming: Lemming) => {
    const px = (lemming.x - 0.5) * BLOCK_SIZE; 
    const py = lemming.y * BLOCK_SIZE; 
    const size = BLOCK_SIZE;
    
    // Body
    ctx.fillStyle = '#4ade80'; // Green Hair
    ctx.fillRect(px + size*0.25, py + size*0.1, size*0.5, size*0.3); 
    
    ctx.fillStyle = '#3b82f6'; // Blue Shirt
    ctx.fillRect(px + size*0.3, py + size*0.4, size*0.4, size*0.4);

    // Eyes
    ctx.fillStyle = '#fff'; 
    const eye1X = px + size*0.4; 
    const eye2X = px + size*0.6; 
    const eyeY = py + size*0.25; 
    const eyeSize = size * 0.12; 
    ctx.beginPath(); ctx.arc(eye1X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.arc(eye2X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
    
    // Pupils
    let pupX = 0; let pupY = 0; 
    if (lemming.state === 'CLIMBING') {
        pupY = -1.5; // Look up when climbing
    } else if (playerRef.current) { 
        const angle = Math.atan2((playerRef.current.y + 1.5) * BLOCK_SIZE - eyeY, (playerRef.current.x + 1.5) * BLOCK_SIZE - (eye1X + eye2X)/2); 
        pupX = Math.cos(angle) * 1.5; pupY = Math.sin(angle) * 1.5; 
    }
    ctx.fillStyle = '#000'; 
    ctx.beginPath(); ctx.arc(eye1X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill(); 
    ctx.beginPath(); ctx.arc(eye2X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill();

    // Legs / Arms based on state
    ctx.fillStyle = '#fca5a5'; 
    
    if (lemming.state === 'WALKING') { 
        const leg = Math.sin(lemming.frame * Math.PI) * 5; 
        ctx.fillRect(px + size*0.35 + leg, py + size*0.8, size*0.1, size*0.2); 
        ctx.fillRect(px + size*0.55 - leg, py + size*0.8, size*0.1, size*0.2); 
    } else if (lemming.state === 'CLIMBING') {
        // Climbing animation: Hands up/down
        const armOffset = Math.sin(lemming.frame * Math.PI) * 3;
        // Arms reaching up/pulling
        ctx.fillRect(px + size*0.2, py + size*0.3 + armOffset, size*0.15, size*0.3); 
        ctx.fillRect(px + size*0.65, py + size*0.3 - armOffset, size*0.15, size*0.3);
        // Legs dangling/kicking
        const legOffset = Math.cos(lemming.frame * Math.PI) * 2;
        ctx.fillRect(px + size*0.35, py + size*0.8 + legOffset, size*0.1, size*0.2); 
        ctx.fillRect(px + size*0.55, py + size*0.8 - legOffset, size*0.1, size*0.2); 
    } else { 
        // Falling
        ctx.fillRect(px + size*0.35, py + size*0.7, size*0.1, size*0.2); 
        ctx.fillRect(px + size*0.55, py + size*0.7, size*0.1, size*0.2); 
        // Parachute/Hands up panic
        ctx.fillStyle = '#fff'; 
        ctx.fillRect(px + size*0.1, py + size*0.3, size*0.8, size*0.1); 
    }
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => { if (gameState === GameState.MENU && e.key === 'Enter') initGame(); else if (gameState === GameState.PLAYING) switch(e.key) { case 'ArrowLeft': playerMove(-1); break; case 'ArrowRight': playerMove(1); break; case 'ArrowDown': playerDrop(); break; case 'ArrowUp': playerRotate(); break; case ' ': playerHardDrop(); break; case 'p': case 'P': setGameState(GameState.PAUSED); audioController.stopMusic(); break; } else if (gameState === GameState.PAUSED && !showSettings && (e.key === 'p' || e.key === 'P')) { setGameState(GameState.PLAYING); audioController.startMusic(); } };
    window.addEventListener('keydown', handleKeyDown); return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, initGame, showSettings]);

  useEffect(() => { requestRef.current = requestAnimationFrame(update); return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); }; }, [gameState, difficulty, gameMode, currentSpeed, activeLemmingsCount]); 

  const handleTouchStart = (e: React.TouchEvent) => { if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING) return; const touch = e.touches[0]; touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() }; touchLastPosRef.current = { x: touch.clientX, y: touch.clientY }; touchAxisRef.current = 'none'; if (softDropIntervalRef.current) clearInterval(softDropIntervalRef.current); softDropIntervalRef.current = window.setInterval(() => { if (touchStartRef.current && Date.now() - touchStartRef.current.time > 200) playerDrop(); }, 50); };
  const handleTouchMove = (e: React.TouchEvent) => { if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchLastPosRef.current || !touchStartRef.current) return; const touch = e.touches[0]; const deltaX = touch.clientX - touchLastPosRef.current.x; if (touchAxisRef.current === 'none') { if (Math.abs(touch.clientX - touchStartRef.current.x) > 15) touchAxisRef.current = 'x'; else if (Math.abs(touch.clientY - touchStartRef.current.y) > 15) touchAxisRef.current = 'y'; } if (touchAxisRef.current === 'x' && Math.abs(deltaX) > 30) { if (softDropIntervalRef.current) { clearInterval(softDropIntervalRef.current); softDropIntervalRef.current = null; } const steps = Math.floor(Math.abs(deltaX) / 30); for(let i=0; i<steps; i++) playerMove(deltaX > 0 ? 1 : -1); touchLastPosRef.current.x = touch.clientX; } touchLastPosRef.current.y = touch.clientY; };
  const handleTouchEnd = (e: React.TouchEvent) => { if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchStartRef.current) return; if (softDropIntervalRef.current) { clearInterval(softDropIntervalRef.current); softDropIntervalRef.current = null; } const touch = e.changedTouches[0]; const deltaY = touch.clientY - touchStartRef.current.y; const deltaX = touch.clientX - touchStartRef.current.x; if (Date.now() - touchStartRef.current.time < 300) { if (Math.abs(deltaY) > Math.abs(deltaX)) { if (Math.abs(deltaY) > 60) { if (deltaY > 0) playerHardDrop(); else playerRotate(); } } else if (Math.abs(deltaX) < 15 && Math.abs(deltaY) < 15) playerRotate(); } touchStartRef.current = null; touchLastPosRef.current = null; touchAxisRef.current = 'none'; };

  const saveHighScore = async () => { if (!playerName.trim()) return; const scoreData = { name: playerName, score, date: new Date().toLocaleDateString(), difficulty, mode: gameMode, saved: lemmingsSaved, killed: lemmingsKilled, quests: questsCompletedRef.current }; saveScore(scoreData); await saveScoreRemote(scoreData); if (lemmingsKilled > 0) { const killerData = { name: playerName, kills: lemmingsKilled, date: new Date().toLocaleDateString(), difficulty, mode: gameMode }; saveKiller(killerData); await saveKillerRemote(killerData); } setGameState(GameState.MENU); };

  const renderNextPiece = (size: number = 10) => ( <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${nextPieceState.shape[0].length}, ${size}px)` }}> {nextPieceState.shape.map((row, y) => row.map((val, x) => ( <div key={`${x}-${y}`} className={`w-${size/4} h-${size/4}`} style={{ width: size, height: size, backgroundColor: val ? nextPieceState.color : 'transparent' }} /> )))} </div> );

  return (
    <div className="relative w-full h-[100dvh] bg-gray-950 text-white flex flex-col items-center justify-between overflow-hidden p-2 md:p-4" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd} >
      <div className="w-full max-w-lg flex items-start justify-between z-10 gap-2 mb-1 pointer-events-none">
          <div className="flex flex-col gap-1.5 pointer-events-auto">
            <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl min-w-[90px] backdrop-blur-sm">
                <div className="text-[8px] text-gray-400 uppercase">Skóre</div>
                <div className={`font-retro text-xs md:text-base ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div>
                <div className="mt-0.5 flex items-center gap-1 text-[7px] md:text-[9px] text-gray-500"><span>SPD:</span><span className="text-cyan-400 font-retro">{Math.round((1000 - currentSpeed) / 5)}%</span></div>
            </div>
            <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl min-w-[90px] backdrop-blur-sm">
                <div className="text-[8px] text-gray-400 uppercase">{gameMode === GameMode.SAVE ? 'Saved' : gameMode === GameMode.CAGE ? 'Sold' : 'Kills'}</div>
                <div className={`font-retro text-xs ${gameMode === GameMode.SAVE ? 'text-green-400' : gameMode === GameMode.CAGE ? 'text-yellow-400' : 'text-red-400'}`}>{gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}</div>
            </div>
          </div>
          <div className="flex-1 flex justify-center pointer-events-auto mt-1"><div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl text-center backdrop-blur-sm"><div className="text-[8px] text-gray-500 uppercase mb-0.5">Příště</div><div className="flex justify-center scale-[0.6] md:scale-90 origin-top">{renderNextPiece(8)}</div></div></div>
          <div className="flex flex-col gap-1.5 items-end pointer-events-auto">
             <div className="flex gap-1.5">
                <button onClick={() => { setGameState(GameState.PAUSED); audioController.stopMusic(); setShowSettings(true); }} className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl hover:bg-gray-800 active:bg-gray-700"><GearIcon /></button>
                <button className="bg-gray-800/80 p-1.5 rounded hover:bg-gray-700 active:bg-gray-600 border border-gray-600" onClick={() => { if (gameState === GameState.PLAYING) { setGameState(GameState.PAUSED); audioController.stopMusic(); } else { setGameState(GameState.PLAYING); audioController.startMusic(); } }}><PauseIcon /></button>
             </div>
             <div className="bg-gray-900/80 p-1.5 rounded border border-gray-700 shadow-xl text-center hidden md:block backdrop-blur-sm"><div className="text-[8px] text-gray-500 uppercase mb-0.5">Pop: {activeLemmingsCount}</div><div className="w-20 h-1.5 bg-gray-800 rounded-full overflow-hidden"><div className="h-full bg-green-500 transition-all duration-300" style={{ width: `${(activeLemmingsCount / MAX_LEMMINGS) * 100}%` }} /></div></div>
          </div>
      </div>
      <div className="flex-1 w-full flex flex-col md:flex-row items-center justify-center gap-2 overflow-hidden relative">
          <div className="hidden lg:flex flex-col gap-3 w-40">{quest && ( <div className="bg-blue-900/20 p-2.5 rounded border border-blue-500/30 backdrop-blur-md"><div className="text-[8px] text-blue-300 uppercase mb-2">Úkol Lv.{quest.level}</div><div className="flex flex-col gap-2.5">{quest.objectives.map((obj, i) => ( <div key={i} className="flex flex-col"><div className={`text-[8px] font-retro leading-tight ${obj.isCompleted ? 'text-green-400 line-through opacity-50' : 'text-white'}`}>{obj.description}</div><div className="w-full h-1 bg-gray-800 rounded-full overflow-hidden mt-1"><div className={`h-full bg-blue-500`} style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }} /></div></div> ))}</div></div> )}</div>
          <div className="relative flex-1 max-h-full flex items-center justify-center overflow-hidden"><canvas ref={canvasRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} className="border-2 border-gray-800 bg-black shadow-[0_0_50px_rgba(0,0,0,0.5)] h-full max-h-[calc(100dvh-180px)] md:max-h-[85vh] object-contain touch-none" /></div>
          <div className="w-full lg:hidden flex flex-col items-center gap-1.5 pointer-events-none mb-1">{quest && ( <div className="w-full max-w-[280px] bg-blue-900/20 p-1.5 rounded border border-blue-500/20 pointer-events-auto backdrop-blur-sm"><div className="flex flex-wrap justify-center gap-x-3 gap-y-0.5">{quest.objectives.map((obj, i) => ( <div key={i} className="flex items-center gap-1.5"><div className={`text-[7px] font-retro ${obj.isCompleted ? 'text-green-400 line-through' : 'text-blue-200'}`}>{obj.description}</div><div className="w-8 h-1 bg-gray-800 rounded-full overflow-hidden"><div className={`h-full bg-blue-500`} style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }} /></div></div> ))}</div></div> )}</div>
      </div>
      {gameState === GameState.PLAYING && controlScheme === 'BUTTONS' && (
          <div className="w-full max-w-sm flex flex-col gap-2 pb-safe z-20 md:hidden pointer-events-auto mb-2"><div className="flex justify-between w-full px-4"><div className="flex gap-3"><button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerMove(-1)}><LeftIcon /></button><button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerMove(1)}><RightIcon /></button></div><div className="flex gap-3"><button className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center backdrop-blur-md active:bg-white/20 border border-white/10" onClick={() => playerDrop()}><DownIcon /></button><button className="w-12 h-12 bg-red-500/10 rounded-full flex items-center justify-center backdrop-blur-md active:bg-red-500/30 border-2 border-red-500/30" onClick={() => playerRotate()}><RotateIcon /></button></div></div></div>
      )}
      {gameState === GameState.MENU && !showSettings && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-start z-50 p-6 overflow-y-auto"><div className="pt-10 flex flex-col items-center w-full"><h1 className="font-retro text-4xl md:text-6xl text-cyan-500 mb-2 text-center drop-shadow-[0_0_15px_rgba(6,182,212,0.5)]">LEMRIS 2</h1><p className="text-[8px] text-gray-500 mb-6 tracking-[0.3em] uppercase">Save or Slaughter. You decide.</p><div className="flex flex-wrap justify-center gap-2 mb-6 bg-gray-900 p-1 rounded-xl border border-gray-800"><button onClick={() => setGameMode(GameMode.SAVE)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.SAVE ? 'bg-green-600 text-white shadow-[0_0_10px_rgba(34,197,94,0.4)]' : 'text-gray-500 hover:text-white'}`}>ZACHRAŇ</button><button onClick={() => setGameMode(GameMode.KILL)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.KILL ? 'bg-red-600 text-white shadow-[0_0_10px_rgba(220,38,38,0.4)]' : 'text-gray-500 hover:text-white'}`}>ZABÍJEJ</button><button onClick={() => setGameMode(GameMode.CAGE)} className={`px-4 py-2 rounded-lg font-retro text-[8px] transition-all ${gameMode === GameMode.CAGE ? 'bg-yellow-500 text-black shadow-[0_0_10px_rgba(234,179,8,0.4)]' : 'text-gray-500 hover:text-white'}`}>LOV</button></div><div className="flex gap-4 mb-8">{Object.values(Difficulty).map(d => ( <button key={d} onClick={() => setDifficulty(d)} className={`px-3 py-1.5 rounded-lg font-retro text-[8px] border-2 transition-all ${difficulty === d ? 'bg-cyan-700 border-cyan-400 text-white' : 'border-gray-800 text-gray-600'}`}>{d}</button> ))}</div><button onClick={initGame} className={`px-10 py-5 text-white font-retro text-lg rounded-2xl shadow-[0_4px_0_rgba(0,0,0,0.5)] active:translate-y-1 active:shadow-none transition-all mb-10 w-full max-w-xs ${ gameMode === GameMode.SAVE ? 'bg-green-600' : gameMode === GameMode.KILL ? 'bg-red-700' : 'bg-yellow-600' }`}>SPUSTIT HRU</button><div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full max-w-4xl text-[9px] mb-10"><div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 backdrop-blur-md"><h3 className="font-retro text-yellow-500 mb-4 text-center tracking-widest uppercase">Globální Skóre</h3><table className="w-full text-left"><thead><tr className="text-gray-600 border-b border-gray-800"><th>Hráč</th><th className="text-right">Úkoly</th><th className="text-right">Body</th></tr></thead><tbody>{topScores.map((s, i) => ( <tr key={i} className="border-b border-gray-800/30"><td className="py-2 max-w-[70px] truncate text-gray-300 font-bold">{s.name}</td><td className="text-right text-gray-500">{s.quests || 0}</td><td className="text-right text-yellow-400 font-retro text-[7px]">{s.score}</td></tr> ))}</tbody></table></div><div className="bg-gray-900/60 p-4 rounded-2xl border border-gray-800 backdrop-blur-md"><h3 className="font-retro text-red-600 mb-4 text-center tracking-widest uppercase">Největší Vrazi</h3><table className="w-full text-left"><thead><tr className="text-gray-600 border-b border-gray-800"><th>Hráč</th><th className="text-right">Mrtvol</th></tr></thead><tbody>{topKillers.map((k, i) => ( <tr key={i} className="border-b border-gray-800/30"><td className="py-2 max-w-[90px] truncate text-gray-300 font-bold">{k.name}</td><td className="text-right text-red-500 font-retro text-[7px]">{k.kills}</td></tr> ))}</tbody></table></div></div></div></div>
      )}
      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-950/95 flex flex-col items-center justify-center z-50 p-6 overflow-y-auto"><h2 className="font-retro text-4xl text-white mb-6 text-center drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]">KONEC HRY</h2><div className="bg-black/60 p-6 rounded-3xl text-center mb-8 w-full max-w-sm border border-red-800/50 backdrop-blur-md"><div className="mb-2 text-gray-500 text-[9px] uppercase tracking-widest">Dosažené skóre</div><div className={`font-retro text-3xl mb-6 ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div><div className="grid grid-cols-2 gap-3 mb-6"><div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800"><div className="text-[7px] text-gray-600 mb-1 uppercase">ÚKOLY</div><div className="font-retro text-base text-cyan-400">{questsCompleted}</div></div><div className="bg-gray-950/80 p-3 rounded-2xl border border-gray-800"><div className="text-[7px] text-gray-600 mb-1 uppercase">{gameMode === GameMode.SAVE ? 'SAVED' : 'KILLS'}</div><div className={`font-retro text-base ${gameMode === GameMode.SAVE ? 'text-green-500' : 'text-red-500'}`}>{gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}</div></div></div><div className="flex flex-col gap-2 text-left"><label className="text-[9px] uppercase text-gray-500 tracking-widest ml-1">Tvé jméno:</label><input type="text" maxLength={12} placeholder="Hráč" className="bg-black border border-gray-800 text-white p-4 rounded-xl font-retro text-[10px] text-center focus:border-cyan-600 outline-none transition-all" value={playerName} onChange={(e) => setPlayerName(e.target.value)} autoFocus /></div></div><button onClick={saveHighScore} className="px-10 py-5 bg-green-700 hover:bg-green-600 text-white font-retro rounded-2xl shadow-xl active:translate-y-1 transition-all w-full max-xs">ULOŽIT VÝSLEDEK</button></div>
      )}
      {showSettings && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-xl flex flex-col items-center justify-center z-50 p-6"><h2 className="font-retro text-2xl text-cyan-400 mb-8 tracking-[0.2em]">NASTAVENÍ</h2><div className="w-full max-w-sm bg-gray-900 p-6 rounded-3xl border border-gray-800 shadow-2xl"><div className="mb-8"><label className="block text-gray-500 text-[9px] uppercase mb-4 tracking-widest">Metoda ovládání</label><div className="flex bg-black rounded-xl p-1 gap-1 border border-gray-800"><button className={`flex-1 py-3 text-[9px] font-retro rounded-lg transition-all ${controlScheme === 'BUTTONS' ? 'bg-cyan-700 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('BUTTONS')}>TLAČÍTKA</button><button className={`flex-1 py-3 text-[9px] font-retro rounded-lg transition-all ${controlScheme === 'SWIPE' ? 'bg-cyan-700 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('SWIPE')}>SWIPE</button></div></div><div className="space-y-6"><div><div className="flex justify-between mb-2"><label className="text-gray-500 text-[9px] uppercase tracking-widest">Hudba</label><span className="text-[10px] text-cyan-400 font-retro">{Math.round(musicVol * 100)}%</span></div><input type="range" min="0" max="1" step="0.1" value={musicVol} onChange={handleMusicVolChange} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" /></div><div><div className="flex justify-between mb-2"><label className="text-gray-500 text-[9px] uppercase tracking-widest">Zvuky</label><span className="text-[10px] text-cyan-400 font-retro">{Math.round(sfxVol * 100)}%</span></div><input type="range" min="0" max="1" step="0.1" value={sfxVol} onChange={handleSfxVolChange} className="w-full h-1.5 bg-gray-800 rounded-lg appearance-none cursor-pointer accent-cyan-500" /></div></div></div><button onClick={() => setShowSettings(false)} className="mt-10 px-12 py-4 bg-green-600 text-white font-retro rounded-xl shadow-lg active:scale-95 transition-all">ZAVŘÍT</button></div>
      )}
      {gameState === GameState.PAUSED && !showSettings && (
          <div className="absolute inset-0 bg-black/80 backdrop-blur-md flex flex-col items-center justify-center z-50"><h2 className="font-retro text-3xl text-white mb-10 tracking-[0.2em] animate-pulse">PAUZA</h2><button onClick={() => { setGameState(GameState.PLAYING); audioController.startMusic(); }} className="px-10 py-4 bg-cyan-700 text-white font-retro rounded-xl mb-4 w-64 shadow-xl active:translate-y-1 transition-all">POKRAČOVAT</button><button onClick={() => setGameState(GameState.MENU)} className="px-10 py-4 bg-red-800 text-white font-retro rounded-xl w-64 shadow-xl active:translate-y-1 transition-all">MENU</button></div>
      )}
    </div>
  );
}