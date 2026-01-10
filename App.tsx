
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Difficulty, GridCell, Player, Lemming, BloodSplat, GameMode, Tetromino, Quest, QuestObjective, QuestObjectiveType, ControlScheme } from './types';
import { COLS, ROWS, BLOCK_SIZE, RANDOM_TETROMINO, DIFFICULTY_SPEEDS, MAX_LEMMINGS, TETROMINOS } from './constants';
import { getTopScores, getTopKillers, saveScore, saveKiller, getSettings, saveSettings } from './services/storageService';
import { saveScoreRemote, saveKillerRemote } from './services/databaseService';
import { audioController } from './services/audioService';

// --- Icons ---
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>;
const RotateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A10 10 0 1 0 22 17.8"/></svg>;
const DownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>;
const LeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const RightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;
const GearIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.86z"/></svg>;

export default function App() {
  // --- Persisted Settings Load ---
  const savedSettings = getSettings();

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

  // Settings State
  const [controlScheme, setControlScheme] = useState<ControlScheme>(savedSettings.controlScheme);
  const [showSettings, setShowSettings] = useState(false);
  const [musicVol, setMusicVol] = useState(savedSettings.musicVol);
  const [sfxVol, setSfxVol] = useState(savedSettings.sfxVol);

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

  // Perzistence nastavení
  useEffect(() => {
    saveSettings({ musicVol, sfxVol, controlScheme });
  }, [musicVol, sfxVol, controlScheme]);

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
      const numObjectives = Math.min(2, 1 + Math.floor(level / 5)); 
      const hasType = (t: QuestObjectiveType) => objectives.some(o => o.type === t);

      for (let i = 0; i < numObjectives; i++) {
          const r = Math.random();
          let obj: QuestObjective | null = null;
          if (mode === GameMode.SAVE) {
              if (r < 0.5 && !hasType('CLEAR_LINES')) {
                   const target = 2 + Math.floor(level);
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
              } else if (!hasType('HAVE_LEMMINGS')) {
                   const target = Math.min(MAX_LEMMINGS - 5, 2 + Math.floor(level / 2));
                   obj = { type: 'HAVE_LEMMINGS', target, current: 0, description: `Měj ${target} Lemmingů`, isCompleted: false };
              }
          } else if (mode === GameMode.KILL) {
              if (r < 0.5 && !hasType('KILL_TOTAL')) {
                   const target = 5 + (level * 2);
                   obj = { type: 'KILL_TOTAL', target, current: 0, description: `Zabij ${target} Lemmingů`, isCompleted: false };
              } else if (!hasType('CLEAR_LINES')) {
                   const target = 2 + level;
                   obj = { type: 'CLEAR_LINES', target, current: 0, description: `Smaž ${target} linek`, isCompleted: false };
              }
          } else if (mode === GameMode.CAGE) {
              const target = 5 + level;
              obj = { type: 'SELL_TOTAL', target, current: 0, description: `Prodej ${target} Lemmingů`, isCompleted: false };
          }
          if (obj) objectives.push(obj);
      }
      if (objectives.length === 0) objectives.push({ type: 'CLEAR_LINES', target: 3, current: 0, description: 'Smaž 3 linky', isCompleted: false });
      const newQuest: Quest = { objectives, level };
      setQuest(newQuest);
      questRef.current = newQuest;
  };

  const reportQuestProgress = (type: QuestObjectiveType, amount: number, isAbsolute: boolean = false) => {
      if (!questRef.current) return;
      let changed = false;
      const newObjectives = questRef.current.objectives.map(obj => {
          if (obj.type === type) {
              let newCurrent = isAbsolute ? amount : obj.current + amount;
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
      if (allCompleted) completeQuest();
  };

  const completeQuest = () => {
      if (!questRef.current) return;
      audioController.playQuestComplete();
      const q = questRef.current;
      const newTotal = questsCompletedRef.current + 1;
      questsCompletedRef.current = newTotal;
      setQuestsCompleted(newTotal);
      let bonusPoints = 1000 * q.level;
      setScore(s => s + bonusPoints);
      bloodRef.current.push({ x: COLS / 2 - 0.5, y: ROWS / 2, alpha: 2, radius: 24, type: 'TEXT', text: 'SPLNĚNO!', color: '#fbbf24' });
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
    while (isValidMove({ ...p, y: ghostY + 1 }, grid)) ghostY++;
    return ghostY;
  };

  const rotateMatrix = (matrix: number[][]) => matrix[0].map((_, index) => matrix.map(row => row[index]).reverse());

  const gameOverTrigger = () => {
      setGameState(GameState.GAME_OVER);
      playerRef.current = null;
      isSpawningRef.current = false;
      linesToSpawnLemmingsRef.current = 0;
      audioController.stopMusic();
      audioController.playGameOver();
  };

  const spawnPiece = () => {
    if (gameState === GameState.GAME_OVER) return;
    const nextP = nextPieceRef.current;
    const p: Player = { x: Math.floor(COLS / 2) - 1, y: 0, tetromino: { ...nextP, shape: nextP.shape.map(r => [...r]) }, rotation: 0 };
    playerRef.current = p;
    const nextTemplate = RANDOM_TETROMINO();
    nextPieceRef.current = { ...nextTemplate, shape: nextTemplate.shape.map(r => [...r]) };
    setNextPieceState(nextPieceRef.current);
    if (!isValidMove(p, gridRef.current)) gameOverTrigger();
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
    if (gameState === GameState.GAME_OVER) return;
    const grid = gridRef.current;
    const lemmings = lemmingsRef.current;
    const player = playerRef.current;
    let anyLemmingFalling = false;
    killsInCurrentFrameRef.current = 0;
    const survivingLemmings: Lemming[] = [];
    
    lemmings.forEach(lemming => {
      if (player && checkLemmingSquish(lemming, player)) {
        killLemming(lemming);
        return; 
      }
      if (lemming.state === 'FALLING') {
        anyLemmingFalling = true;
        const nextY = lemming.y + 0.8;
        const checkY = Math.floor(nextY + 0.9);
        if (checkY >= ROWS || (checkY >= 0 && grid[checkY][Math.floor(lemming.x)].value !== 0)) {
           lemming.state = 'WALKING';
           lemming.y = checkY >= ROWS ? ROWS - 1 : checkY - 1;
        } else lemming.y = nextY;
      } else if (lemming.state === 'WALKING') {
        const groundY = Math.floor(lemming.y + 1);
        const centerXInt = Math.floor(lemming.x + 0.5);
        if (groundY < ROWS && grid[groundY][centerXInt].value === 0) {
            lemming.state = 'FALLING';
            lemming.x = centerXInt + 0.5; 
        } else {
            const nextX = lemming.x + (lemming.dx * 0.05);
            const checkWallX = Math.floor(nextX + (lemming.dx > 0 ? 0.9 : 0.1));
            const checkWallY = Math.floor(lemming.y);
            if (checkWallX < 0 || checkWallX >= COLS || grid[checkWallY][checkWallX].value !== 0) lemming.dx *= -1;
            else lemming.x = nextX;
        }
      }
      lemming.frame = (lemming.frame + 0.2) % 4;
      survivingLemmings.push(lemming);
    });

    if (killsInCurrentFrameRef.current > 0) {
        const baseVal = Math.floor(1000 * Math.pow(1.3, killsInCurrentFrameRef.current) * killsInCurrentFrameRef.current);
        setScore(s => gameMode === GameMode.SAVE ? s - baseVal : s + baseVal);
        reportQuestProgress('KILL_TOTAL', killsInCurrentFrameRef.current);
    }
    lemmingsRef.current = survivingLemmings;
    setActiveLemmingsCount(survivingLemmings.length + countTrappedLemmings());
    
    if (isSpawningRef.current && !anyLemmingFalling) {
        if (linesToSpawnLemmingsRef.current > 0) {
            spawnLemming();
            linesToSpawnLemmingsRef.current--;
        } else {
            isSpawningRef.current = false;
            spawnPiece();
        }
    }
  };

  const killLemming = (lemming: Lemming) => {
    audioController.playSquish();
    killsInCurrentFrameRef.current++;
    setLemmingsKilled(prev => prev + 1);
    bloodRef.current.push({ x: lemming.x, y: lemming.y + 1, alpha: 1, radius: Math.random() * 10 + 10, type: 'BLOOD' });
  };

  const checkLemmingSquish = (l: Lemming, p: Player): boolean => {
    const lx = Math.floor(l.x + 0.5);
    const ly = Math.floor(l.y + 0.5);
    return p.tetromino.shape.some((row, y) => row.some((val, x) => val && p.x + x === lx && p.y + y === ly));
  };

  const spawnLemming = () => {
    audioController.playLemmingSpawn();
    const x = Math.floor(Math.random() * (COLS - 2)) + 1;
    lemmingsRef.current.push({ id: Date.now() + Math.random(), x: x + 0.5, y: 0, dx: Math.random() > 0.5 ? 1 : -1, dy: 0, state: 'FALLING', frame: 0 });
  };

  const playerDrop = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING) return;
    const p = playerRef.current;
    p.y++;
    if (!isValidMove(p, gridRef.current)) { p.y--; lockPiece(); }
  };

  const playerHardDrop = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playDrop();
    while(isValidMove({ ...playerRef.current, y: playerRef.current.y + 1 }, gridRef.current)) playerRef.current.y++;
    lockPiece();
  };

  const playerMove = (dir: -1 | 1) => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playMove();
    playerRef.current.x += dir;
    if (!isValidMove(playerRef.current, gridRef.current)) playerRef.current.x -= dir;
  };

  const playerRotate = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    audioController.playRotate();
    const p = playerRef.current;
    const old = p.tetromino.shape;
    p.tetromino.shape = rotateMatrix(p.tetromino.shape);
    if (!isValidMove(p, gridRef.current)) p.tetromino.shape = old;
  };

  const lockPiece = () => {
    if (!playerRef.current) return;
    audioController.playLand();
    const { x, y, tetromino } = playerRef.current;
    const grid = gridRef.current;
    if (y < 0) { gameOverTrigger(); return; }

    tetromino.shape.forEach((row, dy) => row.forEach((val, dx) => {
        if (val && y + dy >= 0) grid[y + dy][x + dx] = { value: 1, color: tetromino.color };
    }));

    let linesCleared = 0;
    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(cell => cell.value !== 0)) {
        linesCleared++;
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill({ value: 0, color: '' }));
      }
    }

    if (linesCleared > 0) {
        audioController.playLineClear(linesCleared >= 4);
        reportQuestProgress('CLEAR_LINES', linesCleared);
        setScore(prev => prev + (linesCleared * 100));
        linesToSpawnLemmingsRef.current += linesCleared;
        isSpawningRef.current = true;
        playerRef.current = null;
    } else spawnPiece();
  };

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.fillStyle = '#080808';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    const scale = canvas.width / (COLS * BLOCK_SIZE);
    ctx.save();
    ctx.scale(scale, scale);
    
    gridRef.current.forEach((row, y) => row.forEach((cell, x) => {
        if (cell.value) drawBlock(ctx, x, y, cell.color, false, cell.hasLemming);
        else { ctx.strokeStyle = '#1a1a1a'; ctx.lineWidth = 0.1; ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE); }
    }));

    bloodRef.current.forEach(p => {
        const cx = p.x * BLOCK_SIZE + BLOCK_SIZE/2;
        const cy = p.y * BLOCK_SIZE + BLOCK_SIZE/2;
        ctx.globalAlpha = Math.min(1, p.alpha);
        if (p.type === 'BLOOD') { ctx.fillStyle = `rgba(180, 0, 0, 1)`; ctx.beginPath(); ctx.arc(cx, cy, p.radius, 0, Math.PI*2); ctx.fill(); }
        else if (p.type === 'TEXT') { ctx.fillStyle = p.color || '#fff'; ctx.font = `bold ${p.radius}px "Press Start 2P"`; ctx.textAlign = 'center'; ctx.fillText(p.text || '', cx, cy); }
        p.alpha -= 0.02;
    });
    bloodRef.current = bloodRef.current.filter(b => b.alpha > 0);

    if (playerRef.current && !isSpawningRef.current) {
        const gY = getGhostY(playerRef.current, gridRef.current);
        playerRef.current.tetromino.shape.forEach((r, dy) => r.forEach((v, dx) => { if (v) drawBlock(ctx, playerRef.current!.x + dx, gY + dy, playerRef.current!.tetromino.color, false, false, true); }));
        playerRef.current.tetromino.shape.forEach((r, dy) => r.forEach((v, dx) => { if (v) drawBlock(ctx, playerRef.current!.x + dx, playerRef.current!.y + dy, playerRef.current!.tetromino.color, true); }));
    }
    lemmingsRef.current.forEach(l => drawLemming(ctx, l));
    ctx.restore();
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, active = false, hasLemming = false, isGhost = false) => {
    const px = x * BLOCK_SIZE; const py = y * BLOCK_SIZE;
    if (isGhost) { ctx.strokeStyle = color; ctx.lineWidth = 1; ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4); return; }
    ctx.fillStyle = color; ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 2; ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
  };

  const drawLemming = (ctx: CanvasRenderingContext2D, l: Lemming) => {
    const px = l.x * BLOCK_SIZE; const py = l.y * BLOCK_SIZE; const size = BLOCK_SIZE;
    ctx.fillStyle = '#4ade80'; ctx.fillRect(px + size*0.25, py + size*0.1, size*0.5, size*0.3);
    ctx.fillStyle = '#3b82f6'; ctx.fillRect(px + size*0.3, py + size*0.4, size*0.4, size*0.4);
    ctx.fillStyle = '#fff';
    ctx.beginPath(); ctx.arc(px + size*0.4, py + size*0.25, size*0.1, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(px + size*0.6, py + size*0.25, size*0.1, 0, Math.PI*2); ctx.fill();
  };

  // --- Handlers ---
  const handleTouchStart = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING) return;
      const touch = e.touches[0];
      touchStartRef.current = { x: touch.clientX, y: touch.clientY, time: Date.now() };
      touchLastPosRef.current = { x: touch.clientX, y: touch.clientY };
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchLastPosRef.current) return;
      const touch = e.touches[0];
      const deltaX = touch.clientX - touchLastPosRef.current.x;
      const deltaY = touch.clientY - touchLastPosRef.current.y;
      
      const HORIZ_MOVE_THRESHOLD = 25; 
      if (Math.abs(deltaX) > HORIZ_MOVE_THRESHOLD && Math.abs(deltaX) > Math.abs(deltaY) * 1.5) {
          playerMove(deltaX > 0 ? 1 : -1);
          touchLastPosRef.current = { x: touch.clientX, y: touch.clientY };
      }
      
      const VERT_MOVE_THRESHOLD = 30;
      if (deltaY > VERT_MOVE_THRESHOLD) { playerDrop(); touchLastPosRef.current.y = touch.clientY; }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchStartRef.current) return;
      const touch = e.changedTouches[0];
      const deltaY = touch.clientY - touchStartRef.current.y;
      const deltaX = touch.clientX - touchStartRef.current.x;
      const timeDiff = Date.now() - touchStartRef.current.time;
      
      if (timeDiff < 250 && Math.abs(deltaX) < 20 && Math.abs(deltaY) < 20) playerRotate();
      else if (deltaY > 60 && Math.abs(deltaY) > Math.abs(deltaX) * 2) playerHardDrop();
      
      touchStartRef.current = null;
      touchLastPosRef.current = null;
  };

  const saveHighScore = () => {
    if (!playerName.trim()) return;
    const scoreData = { name: playerName, score, date: new Date().toLocaleDateString(), difficulty, mode: gameMode, saved: lemmingsSaved, killed: lemmingsKilled, quests: questsCompletedRef.current };
    saveScore(scoreData); saveScoreRemote(scoreData); 
    if (lemmingsKilled > 0) { const k = { name: playerName, kills: lemmingsKilled, date: new Date().toLocaleDateString(), difficulty, mode: gameMode }; saveKiller(k); saveKillerRemote(k); }
    setGameState(GameState.MENU);
  };

  // --- Render Next Piece Function ---
  const renderNextPiece = () => {
    if (!nextPieceState) return null;
    const { shape, color } = nextPieceState;
    return (
      <div className="flex flex-col items-center justify-center p-1 bg-black/40 rounded-lg">
        {shape.map((row, y) => (
          <div key={y} className="flex">
            {row.map((val, x) => (
              <div
                key={x}
                className="w-1.5 h-1.5 m-[1px] rounded-[1px]"
                style={{
                  backgroundColor: val ? color : 'transparent',
                  opacity: val ? 1 : 0
                }}
              />
            ))}
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="relative w-full h-full bg-[#050505] text-white flex flex-col items-center justify-start overflow-hidden touch-none font-sans" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      
      {/* Background Decor */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '20px 20px' }} />

      {/* Main HUD */}
      <div className="w-full max-w-[500px] z-50 flex flex-col gap-1 p-3">
          <div className="flex justify-between items-center bg-gray-900/60 backdrop-blur-md p-3 rounded-2xl border border-white/5 shadow-2xl">
              <div className="flex gap-4">
                  <div>
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">Skóre</div>
                      <div className={`font-retro text-sm ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div>
                  </div>
                  <div>
                      <div className="text-[9px] text-gray-500 uppercase font-bold mb-0.5">{gameMode}</div>
                      <div className={`font-retro text-xs ${gameMode === GameMode.SAVE ? 'text-green-400' : 'text-red-400'}`}>{gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}</div>
                  </div>
              </div>
              <div className="flex items-center gap-3">
                  <div className="flex flex-col items-center">
                      <div className="text-[8px] text-gray-600 font-bold uppercase mb-1">Další</div>
                      {renderNextPiece()}
                  </div>
                  <button onClick={() => { setGameState(GameState.PAUSED); audioController.stopMusic(); setShowSettings(true); }} className="p-2 bg-gray-800 rounded-xl border border-gray-700 active:scale-90 transition-transform"><GearIcon /></button>
              </div>
          </div>
          
          {quest && gameState === GameState.PLAYING && (
              <div className="bg-blue-900/40 backdrop-blur-sm p-2 px-4 rounded-xl border border-blue-500/20 flex justify-between items-center animate-in fade-in slide-in-from-top-2">
                  <div className="text-[10px] text-blue-200 font-bold uppercase">Úkol Lvl.{quest.level}</div>
                  <div className="flex gap-3">
                      {quest.objectives.map((o, i) => (
                          <div key={i} className={`text-[8px] font-retro ${o.isCompleted ? 'text-green-400 line-through opacity-50' : 'text-white'}`}>{o.description} ({o.current}/{o.target})</div>
                      ))}
                  </div>
              </div>
          )}
      </div>

      {/* Game Area */}
      <div className="relative flex-1 flex flex-col items-center justify-center w-full min-h-0">
          <div className="relative border-4 border-gray-800 bg-black rounded-lg shadow-[0_0_50px_rgba(0,0,0,0.8)] overflow-hidden">
              <canvas ref={canvasRef} width={COLS * BLOCK_SIZE} height={ROWS * BLOCK_SIZE} className="h-[60vh] sm:h-[70vh] md:h-[75vh] w-auto block object-contain" />
          </div>
          
          <div className="w-full max-w-[300px] mt-4 p-2 bg-gray-900/40 rounded-full border border-white/5">
              <div className="flex justify-between items-center text-[8px] text-gray-500 uppercase font-bold mb-1 px-2">
                  <span>Lemmings</span>
                  <span className="text-gray-300">{activeLemmingsCount}/{MAX_LEMMINGS}</span>
              </div>
              <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden mx-1">
                  <div className="h-full bg-green-500 transition-all duration-500" style={{ width: `${(activeLemmingsCount / MAX_LEMMINGS) * 100}%` }} />
              </div>
          </div>
      </div>

      {/* Interaction Area (Invisible swipe catcher) */}
      <div className="w-full h-32 flex flex-col items-center justify-center pointer-events-none opacity-20">
          <div className="font-retro text-[8px] uppercase tracking-widest text-gray-600">{controlScheme === 'SWIPE' ? 'Swipe / Click Zone' : ''}</div>
          {controlScheme === 'BUTTONS' && gameState === GameState.PLAYING && (
              <div className="flex gap-4 pointer-events-auto">
                  <button className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center active:scale-90" onClick={() => playerMove(-1)}><LeftIcon /></button>
                  <button className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center active:scale-90" onClick={() => playerMove(1)}><RightIcon /></button>
                  <button className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center active:scale-90" onClick={() => playerDrop()}><DownIcon /></button>
                  <button className="w-14 h-14 bg-red-900/50 border border-red-500/30 rounded-full flex items-center justify-center active:scale-90" onClick={() => playerRotate()}><RotateIcon /></button>
              </div>
          )}
      </div>

      {/* Menus & Overlays */}
      {gameState === GameState.MENU && !showSettings && (
        <div className="absolute inset-0 bg-black/95 flex flex-col items-center justify-center z-[100] p-6 text-center">
            <h1 className="font-retro text-5xl md:text-7xl text-cyan-400 mb-8 tracking-tighter shadow-cyan-500/20">LEMRIS 2</h1>
            <div className="flex bg-gray-900 p-1.5 rounded-2xl mb-8 border border-white/5">
                {Object.values(GameMode).map(m => (
                    <button key={m} onClick={() => setGameMode(m)} className={`px-6 py-3 rounded-xl font-retro text-[10px] transition-all ${gameMode === m ? 'bg-cyan-600 text-white' : 'text-gray-500'}`}>{m}</button>
                ))}
            </div>
            <div className="flex gap-4 mb-12">
                {Object.values(Difficulty).map(d => (
                    <button key={d} onClick={() => setDifficulty(d)} className={`px-4 py-3 rounded-xl font-retro text-[9px] border-2 transition-all ${difficulty === d ? 'border-cyan-400 bg-cyan-900/20 text-white' : 'border-gray-800 text-gray-600'}`}>{d}</button>
                ))}
            </div>
            <button onClick={initGame} className="px-16 py-6 bg-red-600 hover:bg-red-500 text-white font-retro text-2xl rounded-3xl shadow-[0_8px_0_rgb(153,27,27)] active:translate-y-2 active:shadow-none transition-all mb-12">START</button>
        </div>
      )}

      {showSettings && (
          <div className="absolute inset-0 bg-black/90 backdrop-blur-xl flex flex-col items-center justify-center z-[200] p-8">
              <h2 className="font-retro text-3xl text-cyan-400 mb-10">NASTAVENÍ</h2>
              <div className="w-full max-w-sm bg-gray-900 p-8 rounded-3xl border border-white/5 space-y-8">
                  <div className="space-y-4">
                      <label className="block text-gray-500 text-[10px] font-retro text-center uppercase tracking-widest">Ovládání</label>
                      <div className="flex bg-black p-1 rounded-2xl">
                          <button className={`flex-1 py-3 text-[10px] font-retro rounded-xl transition-all ${controlScheme === 'BUTTONS' ? 'bg-gray-800 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('BUTTONS')}>TLAČÍTKA</button>
                          <button className={`flex-1 py-3 text-[10px] font-retro rounded-xl transition-all ${controlScheme === 'SWIPE' ? 'bg-gray-800 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('SWIPE')}>GESTY</button>
                      </div>
                  </div>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-retro text-gray-400 uppercase">Hudba</label><span className="text-xs text-cyan-500">{Math.round(musicVol*100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.1" value={musicVol} onChange={handleMusicVolChange} className="w-full h-2 bg-black rounded-lg appearance-none accent-cyan-500" />
                  </div>
                  <div className="space-y-4">
                      <div className="flex justify-between items-center"><label className="text-[10px] font-retro text-gray-400 uppercase">Efekty</label><span className="text-xs text-cyan-500">{Math.round(sfxVol*100)}%</span></div>
                      <input type="range" min="0" max="1" step="0.1" value={sfxVol} onChange={handleSfxVolChange} className="w-full h-2 bg-black rounded-lg appearance-none accent-cyan-500" />
                  </div>
              </div>
              <button onClick={() => setShowSettings(false)} className="mt-12 px-12 py-4 bg-green-600 text-white font-retro text-sm rounded-2xl active:scale-95 transition-all">HOTOVO</button>
          </div>
      )}

      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-950/95 z-[300] flex flex-col items-center justify-center p-8 backdrop-blur-sm">
              <h2 className="font-retro text-6xl text-white mb-8 drop-shadow-2xl">KONEC</h2>
              <div className="bg-black/60 p-8 rounded-[40px] w-full max-w-sm border border-white/5 mb-8 text-center">
                  <div className="text-[10px] font-retro text-gray-500 mb-2 uppercase tracking-widest">Skóre</div>
                  <div className="font-retro text-5xl text-yellow-400 mb-8">{score}</div>
                  <input type="text" maxLength={12} placeholder="TVÉ JMÉNO" className="w-full bg-gray-900 p-5 rounded-2xl font-retro text-center border border-gray-800 outline-none focus:border-cyan-500 transition-colors" value={playerName} onChange={e => setPlayerName(e.target.value)} />
              </div>
              <button onClick={saveHighScore} className="px-16 py-6 bg-green-600 text-white font-retro text-xl rounded-3xl shadow-[0_8px_0_rgb(20,83,45)] active:translate-y-2 active:shadow-none transition-all">ULOŽIT</button>
          </div>
      )}
    </div>
  );
}
