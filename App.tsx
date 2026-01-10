
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Difficulty, GridCell, Player, Lemming, BloodSplat, GameMode, Tetromino, Quest, QuestObjective, QuestObjectiveType, ControlScheme } from './types';
import { COLS, ROWS, BLOCK_SIZE, RANDOM_TETROMINO, DIFFICULTY_SPEEDS, MAX_LEMMINGS, TETROMINOS } from './constants';
import { saveScore, getSettings, saveSettings } from './services/storageService';
import { saveScoreRemote } from './services/databaseService';
import { audioController } from './services/audioService';

// --- Icons ---
const RotateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A10 10 0 1 0 22 17.8"/></svg>;
const DownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>;
const LeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const RightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>;
const SettingsIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" fill="currentColor" viewBox="0 0 16 16"><path d="M9.405 1.05c-.413-1.4-2.397-1.4-2.81 0l-.1.34a1.464 1.464 0 0 1-2.105.872l-.31-.17c-1.283-.698-2.686.705-1.987 1.987l.169.311c.446.82.023 1.841-.872 2.105l-.34.1c-1.4.413-1.4 2.397 0 2.81l.34.1a1.464 1.464 0 0 1 .872 2.105l-.17.31c-.698 1.283.705 2.686 1.987 1.987l.311-.169a1.464 1.464 0 0 1 2.105.872l.1.34c.413 1.4 2.397 1.4 2.81 0l.1-.34a1.464 1.464 0 0 1 2.105-.872l.31.17c1.283.698 2.686-.705 1.987-1.987l-.169-.311a1.464 1.464 0 0 1 .872-2.105l.34-.1c1.4-.413 1.4-2.397 0-2.81l-.34-.1a1.464 1.464 0 0 1-.872-2.105l.17-.31c.698-1.283-.705-2.686-1.987-1.987l-.311.169a1.464 1.464 0 0 1-2.105-.872l-.1-.34zM8 10.93a2.929 2.929 0 1 1 0-5.86 2.929 2.929 0 0 1 0 5.86z"/></svg>;

export default function App() {
  const savedSettings = getSettings();
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
  const [controlScheme, setControlScheme] = useState<ControlScheme>(savedSettings.controlScheme);
  const [musicVol, setMusicVol] = useState(savedSettings.musicVol);
  const [sfxVol, setSfxVol] = useState(savedSettings.sfxVol);
  const [showSettingsInPause, setShowSettingsInPause] = useState(false);

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
  const nextPieceRef = useRef<Tetromino>(RANDOM_TETROMINO());
  const questRef = useRef<Quest | null>(null);
  const questsCompletedRef = useRef<number>(0); 
  const touchStartRef = useRef<{ x: number, y: number, time: number } | null>(null);
  const touchLastPosRef = useRef<{ x: number, y: number } | null>(null);
  
  const gameStateRef = useRef<GameState>(gameState);
  useEffect(() => { gameStateRef.current = gameState; }, [gameState]);

  useEffect(() => {
    saveSettings({ musicVol, sfxVol, controlScheme });
  }, [musicVol, sfxVol, controlScheme]);

  // --- Keyboard Control ---
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
        if (gameStateRef.current === GameState.MENU || gameStateRef.current === GameState.GAME_OVER) return;
        
        if (e.key === 'p' || e.key === 'P' || e.key === 'Escape') {
            setGameState(prev => {
                if (prev === GameState.PLAYING) {
                    audioController.stopMusic();
                    return GameState.PAUSED;
                } else if (prev === GameState.PAUSED) {
                    audioController.startMusic();
                    setShowSettingsInPause(false);
                    return GameState.PLAYING;
                }
                return prev;
            });
            return;
        }

        if (gameStateRef.current !== GameState.PLAYING || isSpawningRef.current) return;

        switch (e.key) {
            case 'ArrowLeft': playerMove(-1); break;
            case 'ArrowRight': playerMove(1); break;
            case 'ArrowDown': playerDrop(); break;
            case 'ArrowUp': playerRotate(); break;
            case ' ': e.preventDefault(); playerHardDrop(); break;
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  // --- Game Loop ---
  useEffect(() => {
    const loop = (time: number) => {
      if (gameStateRef.current === GameState.PLAYING) {
        update(time);
        requestRef.current = requestAnimationFrame(loop);
      }
    };
    if (gameState === GameState.PLAYING) {
      lastTimeRef.current = performance.now();
      requestRef.current = requestAnimationFrame(loop);
    }
    return () => { if (requestRef.current) cancelAnimationFrame(requestRef.current); };
  }, [gameState]);

  const initGame = useCallback(() => {
    audioController.init();
    audioController.setMusicVolume(musicVol);
    audioController.setSfxVolume(sfxVol);
    audioController.startMusic();
    gridRef.current = Array.from({ length: ROWS }, () => Array.from({ length: COLS }, () => ({ value: 0, color: '' })));
    
    const startPiece = RANDOM_TETROMINO();
    const nextP = RANDOM_TETROMINO();
    playerRef.current = { x: Math.floor(COLS / 2) - 1, y: 0, tetromino: { ...startPiece, shape: startPiece.shape.map(r => [...r]) }, rotation: 0 };
    nextPieceRef.current = { ...nextP, shape: nextP.shape.map(r => [...r]) };
    setNextPieceState(nextPieceRef.current);
    
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
  }, [gameMode, difficulty, musicVol, sfxVol]);

  const generateQuest = (level: number, mode: GameMode) => {
      const objectives: QuestObjective[] = [];
      const numObjectives = Math.min(3, 1 + Math.floor(level / 3)); 
      for (let i = 0; i < numObjectives; i++) {
          const r = Math.random();
          let obj: QuestObjective | null = null;
          if (mode === GameMode.SAVE) {
              if (r < 0.5) obj = { type: 'CLEAR_LINES', target: 1 + level, current: 0, description: `Smaž ${1 + level} linek`, isCompleted: false };
              else obj = { type: 'HAVE_LEMMINGS', target: Math.min(MAX_LEMMINGS - 2, 2 + level), current: 0, description: `Měj ${Math.min(MAX_LEMMINGS - 2, 2 + level)} Lemm.`, isCompleted: false };
          } else {
              if (r < 0.5) obj = { type: 'KILL_TOTAL', target: 3 + (level * 2), current: 0, description: `Zabij ${3 + (level * 2)} Lemm.`, isCompleted: false };
              else obj = { type: 'CLEAR_LINES', target: 1 + level, current: 0, description: `Smaž ${1 + level} linek`, isCompleted: false };
          }
          if (obj) objectives.push(obj);
      }
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
              if (obj.current !== newCurrent || obj.isCompleted !== isNowCompleted) { changed = true; return { ...obj, current: newCurrent, isCompleted: isNowCompleted }; }
          }
          return obj;
      });
      if (changed) {
          const updatedQuest = { ...questRef.current, objectives: newObjectives };
          questRef.current = updatedQuest;
          setQuest(updatedQuest);
          if (newObjectives.every(o => o.isCompleted)) { 
            audioController.playQuestComplete(); 
            questsCompletedRef.current++;
            setQuestsCompleted(questsCompletedRef.current); 
            setScore(s => s + 500 * updatedQuest.level); 
            generateQuest(updatedQuest.level + 1, gameMode); 
          }
      }
  };

  const gameOverTrigger = () => {
      setGameState(GameState.GAME_OVER);
      audioController.stopAll();
      audioController.playGameOver();
  };

  const spawnPiece = () => {
    if (gameStateRef.current === GameState.GAME_OVER) return;
    const nextP = nextPieceRef.current;
    const p: Player = { x: Math.floor(COLS / 2) - 1, y: 0, tetromino: { ...nextP, shape: nextP.shape.map(r => [...r]) }, rotation: 0 };
    playerRef.current = p;
    const nextTemplate = RANDOM_TETROMINO();
    nextPieceRef.current = { ...nextTemplate, shape: nextTemplate.shape.map(r => [...r]) };
    setNextPieceState(nextPieceRef.current);
    if (!isValidMove(p, gridRef.current)) gameOverTrigger();
  };

  const update = (time: number) => {
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;
    audioController.updateMusicState(activeLemmingsCount, currentSpeed);
    
    if (!isSpawningRef.current && playerRef.current) {
      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > currentSpeed) { playerDrop(); dropCounterRef.current = 0; }
    }
    
    lemmingMoveCounterRef.current += deltaTime;
    if (lemmingMoveCounterRef.current > 33) { updateLemmings(); lemmingMoveCounterRef.current = 0; }
    
    draw();
  };

  const updateLemmings = () => {
    const grid = gridRef.current;
    const lemmings = lemmingsRef.current;
    const survivingLemmings: Lemming[] = [];
    
    lemmings.forEach(l => {
      if (playerRef.current && checkLemmingSquish(l, playerRef.current)) { killLemming(l); return; }
      if (l.state === 'FALLING') {
        const nextY = l.y + 0.15;
        const checkY = Math.floor(nextY + 0.95);
        if (checkY >= ROWS || (checkY >= 0 && grid[checkY][Math.floor(l.x)].value !== 0)) { 
            l.state = 'WALKING'; l.y = Math.floor(l.y); 
        } else l.y = nextY;
      } else {
        const groundY = Math.floor(l.y + 1);
        const centerXInt = Math.floor(l.x);
        if (groundY < ROWS && grid[groundY][centerXInt].value === 0) { l.state = 'FALLING'; } 
        else {
            const nextX = l.x + (l.dx * 0.04);
            const checkWallX = Math.floor(nextX + (l.dx > 0 ? 0.3 : -0.3));
            if (checkWallX < 0 || checkWallX >= COLS || grid[Math.floor(l.y)][checkWallX].value !== 0) l.dx *= -1;
            else l.x = nextX;
        }
      }
      l.frame = (l.frame + 0.2) % 4;
      survivingLemmings.push(l);
    });
    
    lemmingsRef.current = survivingLemmings;
    setActiveLemmingsCount(survivingLemmings.length);
    reportQuestProgress('HAVE_LEMMINGS', survivingLemmings.length, true);
    
    if (isSpawningRef.current && lemmingsRef.current.every(l => l.state !== 'FALLING')) {
        if (linesToSpawnLemmingsRef.current > 0) { spawnLemming(); linesToSpawnLemmingsRef.current--; }
        else { isSpawningRef.current = false; spawnPiece(); }
    }
  };

  const killLemming = (l: Lemming) => {
    audioController.playSquish();
    setLemmingsKilled(prev => prev + 1);
    reportQuestProgress('KILL_TOTAL', 1);
    bloodRef.current.push({ x: l.x, y: l.y + 1, alpha: 1, radius: 15, type: 'BLOOD' });
  };

  const checkLemmingSquish = (l: Lemming, p: Player): boolean => {
    const lx = Math.floor(l.x); const ly = Math.floor(l.y);
    return p.tetromino.shape.some((row, y) => row.some((val, x) => val && p.x + x === lx && p.y + y === ly));
  };

  const spawnLemming = () => { 
    audioController.playLemmingSpawn(); 
    lemmingsRef.current.push({ id: Date.now() + Math.random(), x: Math.floor(Math.random() * (COLS - 2)) + 0.5, y: 0, dx: Math.random() > 0.5 ? 1 : -1, dy: 0, state: 'FALLING', frame: 0 }); 
  };

  const playerDrop = () => { if (!playerRef.current) return; playerRef.current.y++; if (!isValidMove(playerRef.current, gridRef.current)) { playerRef.current.y--; lockPiece(); } };
  const playerHardDrop = () => { if (!playerRef.current || isSpawningRef.current) return; audioController.playDrop(); while(isValidMove({ ...playerRef.current, y: playerRef.current.y + 1 }, gridRef.current)) playerRef.current.y++; lockPiece(); };
  const playerMove = (dir: -1 | 1) => { if (!playerRef.current || isSpawningRef.current) return; audioController.playMove(); playerRef.current.x += dir; if (!isValidMove(playerRef.current, gridRef.current)) playerRef.current.x -= dir; };
  const playerRotate = () => { if (!playerRef.current || isSpawningRef.current) return; audioController.playRotate(); const p = playerRef.current; const old = p.tetromino.shape; p.tetromino.shape = rotateMatrix(p.tetromino.shape); if (!isValidMove(p, gridRef.current)) p.tetromino.shape = old; };

  const lockPiece = () => {
    if (!playerRef.current) return;
    audioController.playLand();
    const { x, y, tetromino } = playerRef.current;
    if (y < 0) { gameOverTrigger(); return; }
    tetromino.shape.forEach((row, dy) => row.forEach((val, dx) => { if (val && y + dy >= 0) gridRef.current[y + dy][x + dx] = { value: 1, color: tetromino.color }; }));
    
    let cleared = 0;
    for (let r = 0; r < ROWS; r++) { 
        if (gridRef.current[r].every(c => c.value !== 0)) { 
            cleared++; 
            gridRef.current.splice(r, 1); 
            gridRef.current.unshift(Array(COLS).fill({ value: 0, color: '' })); 
        } 
    }
    
    if (cleared > 0) { 
        audioController.playLineClear(cleared >= 4); 
        reportQuestProgress('CLEAR_LINES', cleared); 
        setScore(s => s + (cleared * 100)); 
        linesToSpawnLemmingsRef.current += cleared; 
        isSpawningRef.current = true; 
        playerRef.current = null; 
    } else {
        spawnPiece();
    }
  };

  const isValidMove = (p: Player, grid: GridCell[][]) => p.tetromino.shape.every((row, y) => row.every((val, x) => !val || (x + p.x >= 0 && x + p.x < COLS && y + p.y < ROWS && (y + p.y < 0 || grid[y + p.y][x + p.x].value === 0))));
  const getGhostY = (p: Player, grid: GridCell[][]) => { let gy = p.y; while (isValidMove({ ...p, y: gy + 1 }, grid)) gy++; return gy; };
  const rotateMatrix = (m: number[][]) => m[0].map((_, i) => m.map(r => r[i]).reverse());

  const saveHighScore = () => {
    if (!playerName.trim()) return;
    const entry = { name: playerName, score, date: new Date().toLocaleDateString(), difficulty, mode: gameMode, saved: lemmingsSaved, killed: lemmingsKilled, quests: questsCompleted };
    saveScore(entry);
    saveScoreRemote(entry).catch(() => {});
    setGameState(GameState.MENU);
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, isGhost = false) => {
    const px = x * BLOCK_SIZE; const py = y * BLOCK_SIZE;
    if (isGhost) { 
        ctx.strokeStyle = color; ctx.lineWidth = 1; 
        ctx.strokeRect(px + 2, py + 2, BLOCK_SIZE - 4, BLOCK_SIZE - 4); 
    } else {
        ctx.fillStyle = color; ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
        ctx.strokeStyle = 'rgba(0,0,0,0.4)'; ctx.lineWidth = 1; ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; ctx.fillRect(px, py, BLOCK_SIZE, 3); ctx.fillRect(px, py, 3, BLOCK_SIZE);
    }
  };

  const draw = () => {
    const canvas = canvasRef.current; if (!canvas) return; const ctx = canvas.getContext('2d'); if (!ctx) return;
    
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.fillStyle = '#050505'; ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    ctx.strokeStyle = '#151515'; ctx.lineWidth = 0.5;
    for(let y=0; y<ROWS; y++) {
      for(let x=0; x<COLS; x++) {
        ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
      }
    }
    
    gridRef.current.forEach((row, y) => row.forEach((cell, x) => {
        if (cell.value) drawBlock(ctx, x, y, cell.color);
    }));
    
    bloodRef.current.forEach(p => { 
        ctx.globalAlpha = p.alpha; ctx.fillStyle = 'red'; 
        ctx.beginPath(); ctx.arc(p.x * BLOCK_SIZE, p.y * BLOCK_SIZE, p.radius, 0, Math.PI*2); ctx.fill(); 
        p.alpha -= 0.02; 
    });
    bloodRef.current = bloodRef.current.filter(b => b.alpha > 0);
    ctx.globalAlpha = 1;

    if (playerRef.current && !isSpawningRef.current) {
        const gy = getGhostY(playerRef.current, gridRef.current);
        playerRef.current.tetromino.shape.forEach((r, dy) => r.forEach((v, dx) => { 
            if (v) {
                drawBlock(ctx, playerRef.current!.x + dx, gy + dy, playerRef.current!.tetromino.color, true);
                drawBlock(ctx, playerRef.current!.x + dx, playerRef.current!.y + dy, playerRef.current!.tetromino.color);
            }
        }));
    }
    
    // --- Grounded & Cute Lemmings Rendering ---
    lemmingsRef.current.forEach(l => {
      const px = l.x * BLOCK_SIZE;
      const py = (l.y + 1) * BLOCK_SIZE; // Use +1 to align bottom of feet to block edge
      const bob = l.state === 'WALKING' ? Math.sin(l.frame * Math.PI) * 2 : 0;
      
      ctx.save();
      ctx.translate(px, py + bob);
      if (l.dx < 0) ctx.scale(-1, 1);

      // Body Parts relative to bottom center
      // 1. Hair (Bright Green)
      ctx.fillStyle = '#4ade80';
      ctx.beginPath();
      ctx.arc(0, -22, 6, Math.PI, 0);
      ctx.fill();
      ctx.fillRect(-6, -22, 12, 4);
      
      // 2. Face (Pale Pink)
      ctx.fillStyle = '#ffdbac';
      ctx.fillRect(-4, -18, 8, 6);
      
      // 3. Eyes (Simple dots)
      ctx.fillStyle = '#000';
      ctx.fillRect(1, -16, 1.5, 1.5);
      
      // 4. Body (Blue suit)
      ctx.fillStyle = '#3b82f6';
      ctx.fillRect(-5, -12, 10, 10);
      
      // 5. Hands/Feet
      ctx.fillStyle = '#ffdbac';
      const step = Math.cos(l.frame * Math.PI) * 3;
      ctx.fillRect(-3 + step, -2, 3, 2); // Foot
      ctx.fillRect(3 + step, -5, 3, 2); // Hand

      ctx.restore();
    });
  };

  const handleTouchStart = (e: React.TouchEvent) => { 
    if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING) return; 
    const t = e.touches[0]; 
    touchStartRef.current = { x: t.clientX, y: t.clientY, time: Date.now() }; 
    touchLastPosRef.current = { x: t.clientX, y: t.clientY }; 
  };

  const handleTouchMove = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchLastPosRef.current) return;
      const t = e.touches[0]; const dx = t.clientX - touchLastPosRef.current.x; const dy = t.clientY - touchLastPosRef.current.y;
      if (Math.abs(dx) > 35 && Math.abs(dx) > Math.abs(dy) * 2) { 
          playerMove(dx > 0 ? 1 : -1); touchLastPosRef.current = { x: t.clientX, y: t.clientY }; 
      }
      if (dy > 30 && Math.abs(dy) > Math.abs(dx)) { playerDrop(); touchLastPosRef.current.y = t.clientY; }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
      if (controlScheme !== 'SWIPE' || gameState !== GameState.PLAYING || !touchStartRef.current) return;
      const t = e.changedTouches[0]; const dx = t.clientX - touchStartRef.current.x; const dy = t.clientY - touchStartRef.current.y;
      if (Date.now() - touchStartRef.current.time < 220 && Math.abs(dx) < 25 && Math.abs(dy) < 25) playerRotate();
      else if (dy > 70 && Math.abs(dy) > Math.abs(dx) * 2.5) playerHardDrop();
      touchStartRef.current = null; touchLastPosRef.current = null;
  };

  return (
    <div className="relative w-full h-full bg-[#050505] text-white flex flex-col items-center overflow-hidden touch-none font-sans" onTouchStart={handleTouchStart} onTouchMove={handleTouchMove} onTouchEnd={handleTouchEnd}>
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none" style={{ backgroundImage: 'radial-gradient(#fff 1px, transparent 1px)', backgroundSize: '40px 40px' }} />
      
      {/* HUD - Compact */}
      <div className="w-full max-w-[600px] z-50 p-2 sm:p-4">
          <div className="flex justify-between items-center bg-gray-900/95 backdrop-blur-3xl p-3 sm:p-4 rounded-[2rem] border border-white/5 shadow-2xl">
              <div className="flex gap-4 sm:gap-10">
                  <div><div className="text-[8px] text-gray-500 uppercase font-retro mb-1">Score</div><div className="font-retro text-sm sm:text-xl text-yellow-400">{score}</div></div>
                  <div><div className="text-[8px] text-gray-500 uppercase font-retro mb-1">Kills</div><div className="font-retro text-sm sm:text-xl text-red-500">{lemmingsKilled}</div></div>
              </div>
              <div className="flex items-center gap-4">
                  <div className="hidden sm:flex flex-col items-center">
                    <div className="text-[7px] text-gray-600 font-retro mb-1">NEXT</div>
                    <div className="bg-black/40 p-1.5 rounded-lg border border-white/5">
                        {nextPieceState.shape.map((row, y) => (
                          <div key={y} className="flex">
                            {row.map((val, x) => (
                              <div key={x} className="w-2 h-2 m-[1px] rounded-[1px]" style={{ backgroundColor: val ? nextPieceState.color : 'transparent' }} />
                            ))}
                          </div>
                        ))}
                    </div>
                  </div>
                  <button onClick={() => { setGameState(GameState.PAUSED); audioController.stopMusic(); }} className="p-4 bg-gray-800 hover:bg-gray-700 rounded-2xl border border-gray-600 active:scale-90 transition-all shadow-lg"><PauseIcon /></button>
              </div>
          </div>
          
          {quest && gameState === GameState.PLAYING && (
              <div className="mt-2 bg-blue-900/20 backdrop-blur p-2 rounded-2xl border border-blue-500/10 flex flex-wrap justify-center gap-2">
                    {quest.objectives.map((o, i) => (
                        <div key={i} className={`text-[8px] font-retro px-4 py-2 rounded-xl bg-black/50 border ${o.isCompleted ? 'text-green-500 border-green-500/30 line-through opacity-40' : 'text-white border-white/5'}`}>
                          {o.description} <span className="text-yellow-500 ml-2">[{o.current}/{o.target}]</span>
                        </div>
                    ))}
              </div>
          )}
      </div>

      {/* THE WELL - PC Scale optimized */}
      <div className="flex-1 flex flex-col items-center justify-center w-full min-h-0 py-2 sm:py-6">
          <div className="relative bg-black rounded-2xl shadow-[0_0_100px_rgba(0,0,0,1)] border-[5px] border-gray-800/80 overflow-hidden" 
               style={{ 
                 width: 'clamp(300px, 90vh / 2, 95vw)', 
                 height: 'clamp(600px, 90vh, 95vh)', 
                 aspectRatio: '1/2' 
               }}>
              <canvas ref={canvasRef} width={300} height={600} className="w-full h-full block object-contain" />
          </div>
          
          <div className="w-full max-w-[400px] mt-4 px-6">
              <div className="flex justify-between text-[9px] text-gray-500 font-retro mb-2 uppercase tracking-widest">
                <span>Lemmings Pop.</span>
                <span className={activeLemmingsCount > MAX_LEMMINGS * 0.8 ? 'text-red-500 animate-pulse' : 'text-gray-400'}>{activeLemmingsCount}/{MAX_LEMMINGS}</span>
              </div>
              <div className="h-3 bg-gray-900 rounded-full border border-white/5 overflow-hidden p-0.5">
                  <div className="h-full bg-green-500 rounded-full transition-all duration-500 shadow-[0_0_15px_rgba(34,197,94,0.3)]" style={{ width: `${Math.min(100, (activeLemmingsCount / MAX_LEMMINGS) * 100)}%` }} />
              </div>
          </div>
      </div>

      {/* CONTROLS - Only on mobile/tablet */}
      <div className="w-full h-32 flex items-center justify-center pb-6 sm:hidden">
          {controlScheme === 'BUTTONS' && gameState === GameState.PLAYING && (
              <div className="flex gap-4">
                  <button className="w-16 h-16 bg-gray-800/90 rounded-2xl flex items-center justify-center active:bg-gray-700 active:scale-90 transition-all border border-gray-600" onClick={() => playerMove(-1)}><LeftIcon /></button>
                  <button className="w-16 h-16 bg-gray-800/90 rounded-2xl flex items-center justify-center active:bg-gray-700 active:scale-90 transition-all border border-gray-600" onClick={() => playerMove(1)}><RightIcon /></button>
                  <button className="w-16 h-16 bg-gray-800/90 rounded-2xl flex items-center justify-center active:bg-gray-700 active:scale-90 transition-all border border-gray-600" onClick={() => playerDrop()}><DownIcon /></button>
                  <button className="w-16 h-16 bg-red-900/50 border border-red-500/20 rounded-2xl flex items-center justify-center active:scale-90 transition-all" onClick={() => playerRotate()}><RotateIcon /></button>
              </div>
          )}
      </div>

      {/* OVERLAYS */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/98 z-[100] flex flex-col items-center justify-center p-8 text-center backdrop-blur-xl">
            <h1 className="font-retro text-6xl sm:text-8xl text-cyan-400 mb-20 tracking-tighter drop-shadow-[0_0_30px_rgba(34,211,238,0.3)]">LEMRIS 2</h1>
            <div className="flex flex-col gap-8 mb-20 w-full max-w-sm">
              <div className="text-[10px] font-retro text-gray-500 uppercase tracking-widest">Zvolit Režim</div>
              <div className="flex gap-3 bg-gray-900/50 p-2.5 rounded-3xl border border-white/5">
                  {Object.values(GameMode).map(m => (
                    <button key={m} onClick={() => setGameMode(m)} className={`flex-1 py-5 rounded-2xl font-retro text-[9px] transition-all ${gameMode === m ? 'bg-cyan-600 text-white shadow-2xl' : 'text-gray-500 hover:text-gray-300'}`}>{m}</button>
                  ))}
              </div>
            </div>
            <button onClick={initGame} className="px-32 py-12 bg-red-600 hover:bg-red-500 text-white font-retro text-4xl rounded-[50px] shadow-[0_15px_0_rgb(153,27,27)] active:translate-y-2 active:shadow-none transition-all">START</button>
        </div>
      )}

      {gameState === GameState.PAUSED && (
          <div className="absolute inset-0 bg-black/95 backdrop-blur-3xl z-[200] flex flex-col items-center justify-center p-8">
              {!showSettingsInPause ? (
                  <>
                    <h2 className="font-retro text-5xl text-yellow-400 mb-16 tracking-[10px]">PAUZA</h2>
                    <div className="flex flex-col gap-6 w-full max-w-sm">
                        <button onClick={() => { setGameState(GameState.PLAYING); audioController.startMusic(); }} className="py-10 bg-green-600 text-white font-retro text-xl rounded-[40px] shadow-2xl active:scale-95 transition-all">POKRAČOVAT</button>
                        <button onClick={() => setShowSettingsInPause(true)} className="py-7 bg-gray-800 text-white flex items-center justify-center gap-4 font-retro text-sm rounded-[40px] border border-gray-700 active:scale-95 transition-all"><SettingsIcon /> NASTAVENÍ</button>
                        <div className="h-px bg-white/5 my-6"></div>
                        <button onClick={() => { setGameState(GameState.MENU); audioController.stopAll(); }} className="py-6 bg-red-900/20 text-red-400 font-retro text-xs rounded-[40px] border border-red-500/10 active:scale-95 transition-all">DO MENU</button>
                    </div>
                  </>
              ) : (
                  <div className="w-full max-w-sm bg-gray-900/90 p-10 rounded-[50px] border border-white/10 space-y-10 animate-in fade-in zoom-in duration-300">
                      <div className="flex justify-between items-center mb-6">
                        <h3 className="font-retro text-sm text-cyan-400 uppercase">Nastavení</h3>
                        <button onClick={() => setShowSettingsInPause(false)} className="text-gray-500 hover:text-white font-retro text-[10px]">Zpět</button>
                      </div>
                      <div className="space-y-4">
                          <label className="block text-gray-500 text-[10px] font-retro uppercase">Ovládání</label>
                          <div className="flex bg-black p-2 rounded-2xl border border-gray-800">
                              <button className={`flex-1 py-5 text-[9px] font-retro rounded-xl transition-all ${controlScheme === 'BUTTONS' ? 'bg-gray-800 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('BUTTONS')}>TLAČÍTKA</button>
                              <button className={`flex-1 py-5 text-[9px] font-retro rounded-xl transition-all ${controlScheme === 'SWIPE' ? 'bg-gray-800 text-white' : 'text-gray-600'}`} onClick={() => setControlScheme('SWIPE')}>GESTY</button>
                          </div>
                      </div>
                      <div className="space-y-5">
                          <label className="text-[10px] font-retro text-gray-400 uppercase">Hudba</label>
                          <input type="range" min="0" max="1" step="0.1" value={musicVol} onChange={e => { const v = parseFloat(e.target.value); setMusicVol(v); audioController.setMusicVolume(v); }} className="w-full h-2 bg-black rounded-lg appearance-none accent-cyan-500" />
                      </div>
                      <div className="space-y-5">
                          <label className="text-[10px] font-retro text-gray-400 uppercase">Efekty</label>
                          <input type="range" min="0" max="1" step="0.1" value={sfxVol} onChange={e => { const v = parseFloat(e.target.value); setSfxVol(v); audioController.setSfxVolume(v); }} className="w-full h-2 bg-black rounded-lg appearance-none accent-cyan-500" />
                      </div>
                      <button onClick={() => setShowSettingsInPause(false)} className="w-full py-6 bg-cyan-600 text-white font-retro text-xs rounded-[30px] active:scale-95 transition-all">HOTOVO</button>
                  </div>
              )}
          </div>
      )}

      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-950/98 z-[300] flex flex-col items-center justify-center p-8 backdrop-blur-md">
              <h2 className="font-retro text-7xl text-white mb-14 text-center animate-pulse tracking-tighter">KOUPEL KRVE</h2>
              <div className="bg-black/90 p-12 rounded-[60px] w-full max-w-sm border border-white/10 mb-14 text-center shadow-2xl">
                  <div className="text-[12px] font-retro text-gray-500 mb-6">SKÓRE</div>
                  <div className="font-retro text-6xl text-yellow-400 mb-14">{score}</div>
                  <input type="text" maxLength={10} placeholder="JMÉNO" className="w-full bg-gray-900 p-6 rounded-3xl font-retro text-center border border-gray-700 outline-none focus:border-cyan-500 transition-all text-white text-lg" value={playerName} onChange={e => setPlayerName(e.target.value)} />
              </div>
              <button onClick={saveHighScore} className="px-24 py-10 bg-green-600 text-white font-retro text-2xl rounded-[50px] shadow-[0_12px_0_rgb(20,83,45)] active:translate-y-1 active:shadow-none transition-all">ULOŽIT</button>
          </div>
      )}
    </div>
  );
}
