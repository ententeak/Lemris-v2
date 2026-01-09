import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GameState, Difficulty, GridCell, Player, Lemming, BloodSplat, GameMode, Tetromino, Quest, QuestObjective, QuestObjectiveType } from './types';
import { COLS, ROWS, BLOCK_SIZE, RANDOM_TETROMINO, DIFFICULTY_SPEEDS, MAX_LEMMINGS, TETROMINOS } from './constants';
import { getTopScores, getTopKillers, saveScore, saveKiller } from './services/storageService';

// --- Icons ---
const PauseIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 16 16"><path d="M5.5 3.5A1.5 1.5 0 0 1 7 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5zm5 0A1.5 1.5 0 0 1 12 5v6a1.5 1.5 0 0 1-3 0V5a1.5 1.5 0 0 1 1.5-1.5z"/></svg>;
const RotateIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21.5 2v6h-6M21.34 5.5A10 10 0 1 0 22 17.8"/></svg>;
const DownIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"></line><polyline points="19 12 12 19 5 12"></polyline></svg>;
const LeftIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="19" y1="12" x2="5" y2="12"></line><polyline points="12 19 5 12 12 5"></polyline></svg>;
const RightIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"></line><polyline points="12 5 19 12 12 19"></polyline></svg>;
const DropIcon = () => <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="7 13 12 18 17 13"></polyline><polyline points="7 6 12 11 17 6"></polyline></svg>;

export default function App() {
  // --- Game State ---
  const [gameState, setGameState] = useState<GameState>(GameState.MENU);
  const [gameMode, setGameMode] = useState<GameMode>(GameMode.SAVE);
  const [difficulty, setDifficulty] = useState<Difficulty>(Difficulty.MEDIUM);
  const [score, setScore] = useState(0);
  const [lemmingsKilled, setLemmingsKilled] = useState(0); // Tracks deaths/sold
  const [lemmingsSaved, setLemmingsSaved] = useState(0); // Tracks rescued (Save mode only)
  const [playerName, setPlayerName] = useState('');
  const [activeLemmingsCount, setActiveLemmingsCount] = useState(0);
  const [nextPieceState, setNextPieceState] = useState(RANDOM_TETROMINO());
  const [quest, setQuest] = useState<Quest | null>(null);

  // --- Refs for Game Loop & Canvas ---
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const requestRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number>(0);
  const dropCounterRef = useRef<number>(0);
  const lemmingMoveCounterRef = useRef<number>(0);
  
  // Game Logic Refs (Mutable state for performance)
  const gridRef = useRef<GridCell[][]>([]);
  const playerRef = useRef<Player | null>(null);
  const lemmingsRef = useRef<Lemming[]>([]);
  const bloodRef = useRef<BloodSplat[]>([]); // Used for particles (Blood, Money, Text)
  const isSpawningRef = useRef<boolean>(false);
  const linesToSpawnLemmingsRef = useRef<number>(0);
  const killsInCurrentFrameRef = useRef<number>(0);
  const nextPieceRef = useRef<Tetromino>(RANDOM_TETROMINO());
  const questRef = useRef<Quest | null>(null); // Ref to keep quest sync inside loop

  // --- Initialization ---
  const initGame = useCallback(() => {
    // Empty grid
    const newGrid: GridCell[][] = Array.from({ length: ROWS }, () =>
      Array.from({ length: COLS }, () => ({ value: 0, color: '' }))
    );
    gridRef.current = newGrid;
    
    // Initialize pieces
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
    setActiveLemmingsCount(0);
    isSpawningRef.current = false;
    linesToSpawnLemmingsRef.current = 0;
    
    generateQuest(1, gameMode);

    setGameState(GameState.PLAYING);
    lastTimeRef.current = performance.now();
  }, [gameMode]);

  const generateQuest = (level: number, mode: GameMode) => {
      const objectives: QuestObjective[] = [];
      const numObjectives = Math.min(3, 1 + Math.floor(level / 3)); // 1 to 3 objectives based on level

      // Helper to check if type exists
      const hasType = (t: QuestObjectiveType) => objectives.some(o => o.type === t);

      for (let i = 0; i < numObjectives; i++) {
          const r = Math.random();
          let obj: QuestObjective | null = null;

          // SAVE MODE QUESTS
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
          // KILL MODE QUESTS
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
          // CAGE MODE QUESTS
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

      // Fallback if empty (shouldn't happen but safety first)
      if (objectives.length === 0) {
          objectives.push({ type: 'CLEAR_LINES', target: 3, current: 0, description: 'Smaž 3 linky', isCompleted: false });
      }

      const newQuest: Quest = { objectives, level };
      setQuest(newQuest);
      questRef.current = newQuest;
  };

  const reportQuestProgress = (type: QuestObjectiveType, amount: number, isAbsolute: boolean = false) => {
      if (!questRef.current) return;
      
      let changed = false;
      let allCompleted = true;

      const newObjectives = questRef.current.objectives.map(obj => {
          if (obj.type === type) {
              let newCurrent = obj.current;
              
              if (isAbsolute) {
                  // For state-based quests (e.g., Have 5 Lemmings), the current value fluctuates
                  newCurrent = amount; 
              } else {
                  // For cumulative quests (e.g., Kill 5), we just add
                  // For High-Score events (e.g. Kill 5 at once), we check if new amount > current best
                  if (type === 'KILL_MULTI' || type === 'SELL_BATCH') {
                       if (amount > newCurrent) newCurrent = amount;
                  } else {
                       newCurrent += amount;
                  }
              }

              // Cap at target for UI cleanliness (unless it's 'Have Lemmings' which can fluctuate)
              const isNowCompleted = newCurrent >= obj.target;
              
              if (obj.current !== newCurrent || obj.isCompleted !== isNowCompleted) {
                  changed = true;
                  return { ...obj, current: newCurrent, isCompleted: isNowCompleted };
              }
          }
          return obj;
      });

      // Check global completion
      allCompleted = newObjectives.every(o => o.current >= o.target);

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
      const q = questRef.current;
      
      // Base reward
      let bonusPoints = 1000 * q.level;
      let color = '#fbbf24';

      if (gameMode === GameMode.SAVE) {
          // Special Escape Mechanic for Save Mode
          const lemmingCount = lemmingsRef.current.length;
          bonusPoints += lemmingCount * 500 * q.level;
          
          lemmingsRef.current.forEach(l => {
             bloodRef.current.push({
                 x: l.x,
                 y: l.y,
                 alpha: 1.5,
                 radius: 10,
                 type: 'TEXT',
                 text: `+${500 * q.level}`,
                 color: '#4ade80'
             });
          });
          setLemmingsSaved(prev => prev + lemmingCount); // Only place where saved count increments
          lemmingsRef.current = []; // Clear board (they escaped)
          setActiveLemmingsCount(0);
      } else {
          // Just Bonus Points for Kill/Cage
          bloodRef.current.push({
              x: COLS / 2 - 0.5,
              y: ROWS / 2 + 2.5,
              alpha: 2,
              radius: 20,
              type: 'TEXT',
              text: `+${bonusPoints}`,
              color: '#fbbf24'
          });
      }
      
      setScore(s => s + bonusPoints);
      
      // Visual feedback central - Split into two lines for better visibility
      bloodRef.current.push({
          x: COLS / 2 - 0.5,
          y: ROWS / 2 - 1,
          alpha: 2,
          radius: 24,
          type: 'TEXT',
          text: 'ÚKOL',
          color: color
      });

      bloodRef.current.push({
          x: COLS / 2 - 0.5,
          y: ROWS / 2 + 1,
          alpha: 2,
          radius: 24,
          type: 'TEXT',
          text: 'SPLNĚN!',
          color: color
      });

      // Next Quest
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

  // --- Collision Detection ---
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

  const rotateMatrix = (matrix: number[][]) => {
    return matrix[0].map((val, index) => matrix.map(row => row[index]).reverse());
  };

  const spawnPiece = () => {
    const nextP = nextPieceRef.current;
    
    // Deep copy to prevent mutation of the template
    const pShape = nextP.shape.map(row => [...row]);
    const p: Player = {
        x: Math.floor(COLS / 2) - 1,
        y: 0,
        tetromino: { ...nextP, shape: pShape },
        rotation: 0,
    };

    playerRef.current = p;

    // Generate new next piece
    const nextTemplate = RANDOM_TETROMINO();
    const nextShape = nextTemplate.shape.map(row => [...row]);
    const nextPiece = { ...nextTemplate, shape: nextShape };
    
    nextPieceRef.current = nextPiece;
    setNextPieceState(nextPiece);

    if (!isValidMove(p, gridRef.current)) {
        setGameState(GameState.GAME_OVER);
    }
  };

  // --- Game Loop Update ---
  const update = (time: number) => {
    if (gameState !== GameState.PLAYING) return;
    const deltaTime = time - lastTimeRef.current;
    lastTimeRef.current = time;

    const speed = DIFFICULTY_SPEEDS[difficulty];

    // 1. Drop Player Piece
    if (!isSpawningRef.current && playerRef.current) {
      dropCounterRef.current += deltaTime;
      if (dropCounterRef.current > speed) {
        playerDrop();
        dropCounterRef.current = 0;
      }
    }

    // 2. Update Lemmings
    // Move lemmings at 30fps independent of block speed
    lemmingMoveCounterRef.current += deltaTime;
    if (lemmingMoveCounterRef.current > 33) { // approx 30fps
        updateLemmings();
        lemmingMoveCounterRef.current = 0;
    }

    // 3. Render
    draw();

    requestRef.current = requestAnimationFrame(update);
  };

  // --- Lemming Logic ---
  const updateLemmings = () => {
    const grid = gridRef.current;
    const lemmings = lemmingsRef.current;
    const player = playerRef.current;
    let anyLemmingFalling = false;
    killsInCurrentFrameRef.current = 0;

    // Filter out dead lemmings
    const survivingLemmings: Lemming[] = [];

    lemmings.forEach(lemming => {
      // 1. Check direct collision with ACTIVE falling piece (Squish by moving block)
      if (player && checkLemmingSquish(lemming, player)) {
        handleLemmingContact(lemming, Math.floor(lemming.x), Math.floor(lemming.y));
        return; 
      }

      // 2. Movement Logic
      if (lemming.state === 'FALLING') {
        anyLemmingFalling = true;
        
        const fallSpeed = 0.8;
        const nextY = lemming.y + fallSpeed;
        const checkY = Math.floor(nextY + 0.9); // Look ahead for ground
        
        // Ground Collision Check
        if (checkY >= ROWS || (checkY >= 0 && grid[checkY][Math.floor(lemming.x)].value !== 0)) {
           lemming.state = 'WALKING';
           lemming.y = Math.floor(lemming.y); 
           // Snap to top of block
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
        // A. Check for Hole (Gravity) - Priority over walking
        const groundY = Math.floor(lemming.y + 1);
        const centerXInt = Math.floor(lemming.x + 0.5);
        
        // FIX: Teleportation Glitch & Crash Prevention
        const isHoleBelow = groundY < ROWS && 
                            centerXInt >= 0 && centerXInt < COLS && 
                            grid[groundY] && grid[groundY][centerXInt] && 
                            grid[groundY][centerXInt].value === 0;

        const currentY = Math.floor(lemming.y);
        const isPathToHoleClear = currentY >= 0 && currentY < ROWS && 
                                  centerXInt >= 0 && centerXInt < COLS &&
                                  grid[currentY] && grid[currentY][centerXInt] &&
                                  grid[currentY][centerXInt].value === 0;

        if (isHoleBelow && isPathToHoleClear) {
            lemming.state = 'FALLING';
            // Snap horizontal position to center of tile for clean fall
            lemming.x = centerXInt + 0.5; 
        } else {
            // B. Walk
            const walkSpeed = 0.05;
            const nextX = lemming.x + (lemming.dx * walkSpeed);
            
            // Wall Detection
            // Look slightly ahead of the direction we are going
            const lookAhead = lemming.dx > 0 ? 0.9 : 0.1;
            const checkWallX = Math.floor(nextX + lookAhead);
            const checkWallY = Math.floor(lemming.y);

            if (checkWallX < 0 || checkWallX >= COLS || grid[checkWallY][checkWallX].value !== 0) {
                // Hit wall - Turn around
                lemming.dx *= -1;
            } else {
                // Clear path
                lemming.x = nextX;
            }
        }
      }
      
      lemming.frame = (lemming.frame + 0.2) % 4;
      survivingLemmings.push(lemming);
    });

    // Handle Scoring/Penalties for kills in normal update loop (e.g. squish by falling block)
    if (killsInCurrentFrameRef.current > 0) {
        if (gameMode !== GameMode.CAGE) {
             applyKillScore(killsInCurrentFrameRef.current);
        }
        
        // Update Quest: Total Kills
        reportQuestProgress('KILL_TOTAL', killsInCurrentFrameRef.current);
    }

    lemmingsRef.current = survivingLemmings;
    
    // Update Counts (Active + Trapped) for Spawn Logic
    const trapped = countTrappedLemmings();
    setActiveLemmingsCount(survivingLemmings.length + trapped);

    // Update Quest: Active Lemming Count
    reportQuestProgress('HAVE_LEMMINGS', survivingLemmings.length, true);

    // Spawning Logic Handling
    if (isSpawningRef.current) {
        if (!anyLemmingFalling) {
            if (linesToSpawnLemmingsRef.current > 0) {
                const totalLemmings = lemmingsRef.current.length + (gameMode === GameMode.CAGE ? countTrappedLemmings() : 0);
                if (totalLemmings < MAX_LEMMINGS) {
                    spawnLemming();
                }
                linesToSpawnLemmingsRef.current--;
            } else {
                isSpawningRef.current = false;
                spawnPiece();
            }
        }
    }
  };

  const handleLemmingContact = (lemming: Lemming, cellX: number, cellY: number) => {
      // In CAGE mode, active squish (mid-air) is fatal.
      killLemming(lemming);
  };

  const killLemming = (lemming: Lemming) => {
    killsInCurrentFrameRef.current++;
    setLemmingsKilled(prev => prev + 1); // Tracks death/sold count
    bloodRef.current.push({
        x: lemming.x,
        y: lemming.y + 1,
        alpha: 1,
        radius: Math.random() * 10 + 10,
        type: 'BLOOD'
    });
  };

  const applyKillScore = (count: number) => {
      // Formula: Count * 1000 * (1.3 ^ count)
      const baseVal = Math.floor(1000 * Math.pow(1.3, count) * count);
      
      if (gameMode === GameMode.SAVE) {
          setScore(s => s - baseVal);
      } else {
          setScore(s => s + baseVal);
      }
  };

  const checkLemmingSquish = (l: Lemming, p: Player): boolean => {
    const lx = Math.floor(l.x + 0.5); // Use center
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
    const x = Math.floor(Math.random() * (COLS - 2)) + 1;
    lemmingsRef.current.push({
        id: Date.now() + Math.random(),
        x: x + 0.5,
        y: 0,
        dx: Math.random() > 0.5 ? 1 : -1,
        dy: 0,
        state: 'FALLING',
        frame: 0
    });
  };

  // --- Player Actions ---
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
    
    // Loop until collision
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
    const p = playerRef.current;
    p.x += dir;
    if (!isValidMove(p, gridRef.current)) {
      p.x -= dir;
    }
  };

  const playerRotate = () => {
    if (!playerRef.current || gameState !== GameState.PLAYING || isSpawningRef.current) return;
    const p = playerRef.current;
    const originalShape = p.tetromino.shape;
    p.tetromino.shape = rotateMatrix(p.tetromino.shape);
    if (!isValidMove(p, gridRef.current)) {
        if (p.x < 0) p.x++;
        else if (p.x > COLS - 3) p.x--;
        if (!isValidMove(p, gridRef.current)) {
             p.tetromino.shape = originalShape;
        }
    }
  };

  const lockPiece = () => {
    if (!playerRef.current) return;
    const { x, y, tetromino } = playerRef.current;
    const grid = gridRef.current;

    if (y < 0) {
        setGameState(GameState.GAME_OVER);
        return;
    }

    // 0. Identify valid placements first
    const placedBlocks: {x: number, y: number}[] = [];
    let gameOver = false;

    tetromino.shape.forEach((row, dy) => {
      row.forEach((value, dx) => {
        if (value) {
            const gy = y + dy;
            const gx = x + dx;
            if (gy >= 0 && gy < ROWS) {
               placedBlocks.push({x: gx, y: gy});
            } else {
               gameOver = true;
            }
        }
      });
    });

    if (gameOver) {
        setGameState(GameState.GAME_OVER);
        return;
    }

    // 1A. Update Grid with Block
    placedBlocks.forEach(pos => {
        grid[pos.y][pos.x] = { value: 1, color: tetromino.color };
    });

    // 1B. Precise Trap/Kill Logic
    let trappedKills = 0;
    const survivingLemmings: Lemming[] = [];
    
    lemmingsRef.current.forEach(l => {
        const cx = Math.floor(l.x + 0.5);
        const cy = Math.floor(l.y + 0.5);
        
        // Check if lemming is inside one of the newly placed blocks
        const isTrapped = placedBlocks.some(b => b.x === cx && b.y === cy);

        if (isTrapped) {
            if (gameMode === GameMode.CAGE) {
                // TRAP: Modify the grid cell to hold the lemming
                // Ensure we are modifying the cell that now contains the block
                if (grid[cy][cx].value !== 0) {
                    grid[cy][cx].hasLemming = true;
                }
            } else {
                // KILL: Splat
                trappedKills++;
                setLemmingsKilled(prev => prev + 1);
                bloodRef.current.push({
                    x: l.x,
                    y: l.y + 1,
                    alpha: 1,
                    radius: Math.random() * 10 + 10,
                    type: 'BLOOD'
                });
            }
        } else {
            survivingLemmings.push(l);
        }
    });
    lemmingsRef.current = survivingLemmings;
    
    if (trappedKills > 0) {
        if (gameMode !== GameMode.CAGE) {
            applyKillScore(trappedKills);
        }
        
        // Quest Progress: Kill Multi
        reportQuestProgress('KILL_MULTI', trappedKills);
        reportQuestProgress('KILL_TOTAL', trappedKills);
    }


    // 2. Check Lines
    let linesCleared = 0;
    let totalCashMoney = 0;

    for (let r = 0; r < ROWS; r++) {
      if (grid[r].every(cell => cell.value !== 0)) {
        
        // Logic for CAGE mode line clearing
        if (gameMode === GameMode.CAGE) {
            grid[r].forEach((cell, colIndex) => {
                if (cell.hasLemming) {
                    totalCashMoney++;
                    setLemmingsKilled(prev => prev + 1); // Sold count
                    bloodRef.current.push({
                        x: colIndex,
                        y: r,
                        alpha: 1.5,
                        radius: 20,
                        type: 'MONEY',
                        text: '$'
                    });
                }
            });
        }

        linesCleared++;
        grid.splice(r, 1);
        grid.unshift(Array(COLS).fill({ value: 0, color: '' }));

        // Adjust Lemmings positions: Move down lemmings that were above the cleared line
        lemmingsRef.current.forEach(l => {
            if (l.y < r) {
                l.y += 1;
            }
        });
        
        // Adjust particles similarly
        bloodRef.current.forEach(p => {
             if (p.y < r) {
                 p.y += 1;
             }
        });
      }
    }

    if (linesCleared > 0) {
        // Quest Update: Lines
        reportQuestProgress('CLEAR_LINES', linesCleared);
        if (linesCleared === 2) reportQuestProgress('CLEAR_DOUBLE', 1);
        if (linesCleared === 3) reportQuestProgress('CLEAR_TRIPLE', 1);
        if (linesCleared >= 4) reportQuestProgress('CLEAR_TETRIS', 1);

        // Quest Update: Sell (Cage Mode)
        if (gameMode === GameMode.CAGE) {
             reportQuestProgress('SELL_BATCH', totalCashMoney);
             reportQuestProgress('SELL_TOTAL', totalCashMoney);
        }

        // Scoring Logic based on Mode
        const activeLemmings = lemmingsRef.current.length;
        let points = 0;

        if (gameMode === GameMode.SAVE) {
            const multiplier = 1 + (activeLemmings * 0.2);
            points = Math.floor(linesCleared * 100 * multiplier);
        } else if (gameMode === GameMode.KILL) {
            points = linesCleared * 100;
        } else if (gameMode === GameMode.CAGE) {
            points = linesCleared * 100;
            if (totalCashMoney > 0) {
                points += (totalCashMoney * 500); 
            }
        }
        
        setScore(prev => prev + points);

        linesToSpawnLemmingsRef.current += linesCleared;
        isSpawningRef.current = true;
        playerRef.current = null;
    } else {
        spawnPiece();
    }
  };

  // --- Drawing ---
  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    const scale = canvas.width / (COLS * BLOCK_SIZE);
    ctx.save();
    ctx.scale(scale, scale);

    // Draw Grid
    gridRef.current.forEach((row, y) => {
      row.forEach((cell, x) => {
        if (cell.value) {
            drawBlock(ctx, x, y, cell.color, false, cell.hasLemming);
        } else {
            // Enhanced Grid Visibility
            ctx.strokeStyle = '#333';
            ctx.lineWidth = 0.08; 
            ctx.strokeRect(x * BLOCK_SIZE, y * BLOCK_SIZE, BLOCK_SIZE, BLOCK_SIZE);
        }
      });
    });

    // Draw Particles (Blood / Money / Text)
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
            ctx.font = `bold ${p.radius}px sans-serif`;
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text || '$', cx, cy - (1.5 - p.alpha) * 30);
        } else if (p.type === 'TEXT') {
            ctx.fillStyle = p.color || '#fff';
            ctx.globalAlpha = p.alpha > 1 ? 1 : p.alpha;
            ctx.font = `bold ${p.radius}px "Press Start 2P"`; // Use retro font
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(p.text || '', cx, cy);
            ctx.globalAlpha = 1;
        }
        
        p.alpha -= 0.01; 
    });
    bloodRef.current = bloodRef.current.filter(b => b.alpha > 0);

    // Draw Active Piece
    if (playerRef.current) {
        const { x, y, tetromino } = playerRef.current;
        tetromino.shape.forEach((row, dy) => {
            row.forEach((val, dx) => {
                if (val) {
                    drawBlock(ctx, x + dx, y + dy, tetromino.color, true);
                }
            });
        });
    }

    // Draw Lemmings
    lemmingsRef.current.forEach(lemming => {
        drawLemming(ctx, lemming);
    });

    ctx.restore();
  };

  const drawBlock = (ctx: CanvasRenderingContext2D, x: number, y: number, color: string, active = false, hasLemming = false) => {
    const px = x * BLOCK_SIZE;
    const py = y * BLOCK_SIZE;
    
    // Base Block
    ctx.fillStyle = color;
    ctx.fillRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    
    // Standard Bevel
    ctx.strokeStyle = 'rgba(0,0,0,0.3)';
    ctx.lineWidth = 2;
    ctx.strokeRect(px, py, BLOCK_SIZE, BLOCK_SIZE);
    
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.2)';
    ctx.fillRect(px, py, BLOCK_SIZE, 5);
    ctx.fillRect(px, py, 5, BLOCK_SIZE);

    // Render Trapped Lemming Eyes (No Cage Bars)
    if (hasLemming) {
        const eyeSize = 4;
        const eyeX = px + 10;
        const eyeY = py + 15;
        
        // Whites
        ctx.fillStyle = 'white';
        ctx.beginPath(); ctx.arc(eyeX, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
        ctx.beginPath(); ctx.arc(eyeX + 10, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
        
        // Pupils (looking scared/shaking)
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
    
    // Hair
    ctx.fillStyle = '#4ade80';
    ctx.fillRect(px + size*0.25, py + size*0.1, size*0.5, size*0.3);
    
    // Body
    ctx.fillStyle = '#3b82f6';
    ctx.fillRect(px + size*0.3, py + size*0.4, size*0.4, size*0.4);

    // Eyes Logic
    ctx.fillStyle = '#fff';
    // Eye positions relative to lemming top-left
    const eye1X = px + size*0.4; 
    const eye2X = px + size*0.6;
    const eyeY = py + size*0.25;
    const eyeSize = size * 0.12;

    ctx.beginPath(); ctx.arc(eye1X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eye2X, eyeY, eyeSize, 0, Math.PI*2); ctx.fill();

    // Pupils - tracking active piece
    let pupX = 0; 
    let pupY = 0;
    
    if (playerRef.current) {
        const targetX = (playerRef.current.x + 1.5) * BLOCK_SIZE; // Approximate center of piece
        const targetY = (playerRef.current.y + 1.5) * BLOCK_SIZE;
        const angle = Math.atan2(targetY - eyeY, targetX - (eye1X + eye2X)/2);
        const pupilDist = 1.5;
        pupX = Math.cos(angle) * pupilDist;
        pupY = Math.sin(angle) * pupilDist;
    }

    ctx.fillStyle = '#000';
    ctx.beginPath(); ctx.arc(eye1X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eye2X + pupX, eyeY + pupY, eyeSize/2, 0, Math.PI*2); ctx.fill();


    // Legs
    ctx.fillStyle = '#fca5a5';
    if (lemming.state === 'WALKING') {
        const legOffset = Math.sin(lemming.frame * Math.PI) * 5;
        ctx.fillRect(px + size*0.35 + legOffset, py + size*0.8, size*0.1, size*0.2);
        ctx.fillRect(px + size*0.55 - legOffset, py + size*0.8, size*0.1, size*0.2);
    } else {
        ctx.fillRect(px + size*0.35, py + size*0.7, size*0.1, size*0.2);
        ctx.fillRect(px + size*0.55, py + size*0.7, size*0.1, size*0.2);
        ctx.fillStyle = '#fff';
        ctx.fillRect(px + size*0.1, py + size*0.3, size*0.8, size*0.1); 
    }
  };

  // --- Input Handling ---
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
                case ' ': playerHardDrop(); break; // Spacebar hard drop
                case 'p': case 'P': setGameState(GameState.PAUSED); break;
            }
        } else if (gameState === GameState.PAUSED) {
            if (e.key === 'p' || e.key === 'P') setGameState(GameState.PLAYING);
        }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [gameState, initGame]);

  useEffect(() => {
    requestRef.current = requestAnimationFrame(update);
    return () => {
        if (requestRef.current) cancelAnimationFrame(requestRef.current);
    };
  }, [gameState, difficulty, gameMode]); // Added gameMode dependency

  // --- Render Helpers ---
  const saveHighScore = () => {
    if (!playerName.trim()) return;
    saveScore({ 
        name: playerName, 
        score, 
        date: new Date().toLocaleDateString(), 
        difficulty, 
        mode: gameMode,
        saved: lemmingsSaved,
        killed: lemmingsKilled
    });
    if (lemmingsKilled > 0) {
        saveKiller({ name: playerName, kills: lemmingsKilled, date: new Date().toLocaleDateString(), difficulty, mode: gameMode });
    }
    setGameState(GameState.MENU);
  };

  const renderNextPiece = () => {
      const p = nextPieceState.shape;
      return (
          <div className="grid gap-px" style={{ gridTemplateColumns: `repeat(${p[0].length}, 10px)` }}>
              {p.map((row, y) => row.map((val, x) => (
                  <div key={`${x}-${y}`} className={`w-2.5 h-2.5 ${val ? '' : 'bg-transparent'}`} style={{ backgroundColor: val ? nextPieceState.color : 'transparent' }} />
              )))}
          </div>
      );
  };

  return (
    <div className="relative w-full h-full bg-gray-900 text-white flex flex-col items-center justify-center overflow-hidden">
      
      {/* --- HUD --- */}
      <div className="absolute top-0 left-0 w-full p-2 flex justify-between items-start z-10 pointer-events-none">
          <div className="flex flex-col gap-2">
            {/* Score */}
            <div className="bg-gray-800 p-2 rounded border border-gray-600 shadow-lg">
                <div className="text-xs text-gray-400 uppercase">Skóre</div>
                <div className={`font-retro text-lg ${score < 0 ? 'text-red-500' : 'text-yellow-400'}`}>{score}</div>
            </div>
            
            {/* Stats (Killed/Sold/Saved) */}
            <div className="bg-gray-800 p-2 rounded border border-gray-600 shadow-lg">
                <div className="text-xs text-gray-400 uppercase">
                    {gameMode === GameMode.SAVE ? 'Zachráněno' : gameMode === GameMode.CAGE ? 'Prodáno' : 'Zabito'}
                </div>
                <div className={`font-retro text-sm ${
                    gameMode === GameMode.SAVE ? 'text-green-400' : 
                    gameMode === GameMode.CAGE ? 'text-yellow-400' : 'text-red-400'
                }`}>
                    {gameMode === GameMode.SAVE ? lemmingsSaved : lemmingsKilled}
                </div>
            </div>

            {/* Next Piece */}
            <div className="bg-gray-800 p-2 rounded border border-gray-600 shadow-lg">
                 <div className="text-xs text-gray-400 uppercase">Další</div>
                 <div className="mt-1 flex justify-center">{renderNextPiece()}</div>
            </div>
          </div>

          <div className="flex flex-col gap-2 items-end">
             {/* Mode Indicator */}
             <div className="bg-gray-800 p-1 px-2 rounded border border-gray-600 shadow-lg inline-block text-center mb-1">
                 <div className={`text-xs font-bold ${
                     gameMode === GameMode.KILL ? 'text-red-500' : 
                     gameMode === GameMode.CAGE ? 'text-yellow-400' : 'text-green-400'
                 }`}>{gameMode}</div>
            </div>

            {/* Quest Display */}
             {quest && (
                 <div className="bg-blue-900/90 p-2 rounded border border-blue-500 shadow-lg w-48 mb-1 pointer-events-auto">
                     <div className="flex justify-between items-center mb-1">
                        <div className="text-[10px] text-blue-200 uppercase">Úkol (Lv.{quest.level})</div>
                     </div>
                     <div className="flex flex-col gap-1.5">
                        {quest.objectives.map((obj, i) => (
                             <div key={i} className="flex flex-col">
                                <div className={`text-[10px] font-retro ${obj.isCompleted ? 'text-green-400 line-through opacity-70' : 'text-white'}`}>
                                    {obj.description}
                                </div>
                                <div className="w-full h-1 bg-gray-700 rounded-full overflow-hidden mt-0.5">
                                    <div 
                                        className={`h-full transition-all duration-300 ${obj.isCompleted ? 'bg-green-500' : 'bg-blue-400'}`}
                                        style={{ width: `${Math.min(100, (obj.current / obj.target) * 100)}%` }} 
                                    />
                                </div>
                             </div>
                        ))}
                     </div>
                 </div>
             )}

             {/* Lemmings Count */}
             <div className="bg-gray-800 p-2 rounded border border-gray-600 shadow-lg w-32">
                <div className="text-xs text-gray-400 uppercase mb-1">Lemmings ({activeLemmingsCount}/{MAX_LEMMINGS})</div>
                <div className="w-full h-3 bg-gray-700 rounded-full overflow-hidden">
                    <div 
                        className="h-full bg-green-500 transition-all duration-300"
                        style={{ width: `${(activeLemmingsCount / MAX_LEMMINGS) * 100}%` }}
                    />
                </div>
             </div>
             
             <button 
                className="pointer-events-auto bg-gray-700 p-2 rounded hover:bg-gray-600 active:bg-gray-500"
                onClick={() => setGameState(g => g === GameState.PLAYING ? GameState.PAUSED : GameState.PLAYING)}
             >
                 <PauseIcon />
             </button>
          </div>
      </div>

      {/* --- Main Canvas --- */}
      <canvas 
        ref={canvasRef} 
        width={COLS * BLOCK_SIZE} 
        height={ROWS * BLOCK_SIZE}
        className="border-4 border-gray-700 bg-black shadow-2xl max-h-[85vh] object-contain"
      />

      {/* --- Mobile Controls (Touch) --- */}
      {gameState === GameState.PLAYING && (
          <div className="absolute bottom-4 left-0 w-full flex flex-col gap-2 px-6 pb-2 z-20 md:hidden pointer-events-none">
              <div className="flex justify-between w-full pointer-events-auto">
                   <div className="flex gap-4">
                        <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-white/30" onClick={() => playerMove(-1)}><LeftIcon /></button>
                        <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-white/30" onClick={() => playerMove(1)}><RightIcon /></button>
                   </div>
                   <div className="flex gap-4">
                        <button className="w-16 h-16 bg-white/10 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-white/30" onClick={() => playerDrop()}><DownIcon /></button>
                        <button className="w-16 h-16 bg-red-500/20 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-red-500/40 border-2 border-red-500/50" onClick={() => playerRotate()}><RotateIcon /></button>
                   </div>
              </div>
              <div className="flex justify-center pointer-events-auto">
                   <button className="w-20 h-12 bg-yellow-500/20 rounded-full flex items-center justify-center backdrop-blur-sm active:bg-yellow-500/40 border border-yellow-500/50" onClick={() => playerHardDrop()}><DropIcon /></button>
              </div>
          </div>
      )}

      {/* --- Overlays --- */}

      {/* 1. Main Menu */}
      {gameState === GameState.MENU && (
        <div className="absolute inset-0 bg-black/90 flex flex-col items-center justify-center z-50 p-4">
            <h1 className="font-retro text-4xl md:text-6xl text-cyan-400 mb-2 text-center">LEMRIS 2</h1>
            
            <div className="flex gap-2 mb-6 bg-gray-800 p-1 rounded-lg">
                <button 
                    onClick={() => setGameMode(GameMode.SAVE)}
                    className={`px-4 py-2 rounded font-retro text-xs transition-colors ${gameMode === GameMode.SAVE ? 'bg-green-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    ZACHRAŇ
                </button>
                <button 
                    onClick={() => setGameMode(GameMode.KILL)}
                    className={`px-4 py-2 rounded font-retro text-xs transition-colors ${gameMode === GameMode.KILL ? 'bg-red-600 text-white' : 'text-gray-400 hover:text-white'}`}
                >
                    ZABÍJEJ
                </button>
                 <button 
                    onClick={() => setGameMode(GameMode.CAGE)}
                    className={`px-4 py-2 rounded font-retro text-xs transition-colors ${gameMode === GameMode.CAGE ? 'bg-yellow-500 text-black' : 'text-gray-400 hover:text-white'}`}
                >
                    LOV
                </button>
            </div>

            <p className="text-gray-400 mb-6 text-center max-w-md text-sm">
                {gameMode === GameMode.SAVE && "Více lemmingů = Více bodů. Plň úkoly pro záchranu! (-1000 bodů za smrt)"}
                {gameMode === GameMode.KILL && "Zabíjení lemmingů ti dává body! (+1000 bodů za smrt). Rozdrť je všechny!"}
                {gameMode === GameMode.CAGE && "Chytej lemmingy do klecí! Po smazání řádku je prodáš za $$$."}
            </p>
            
            <div className="flex gap-4 mb-8">
                {Object.values(Difficulty).map(d => (
                    <button 
                        key={d}
                        onClick={() => setDifficulty(d)}
                        className={`px-4 py-2 rounded font-bold font-retro text-sm border-2 ${difficulty === d ? 'bg-cyan-600 border-cyan-400 text-white' : 'border-gray-600 text-gray-500'}`}
                    >
                        {d}
                    </button>
                ))}
            </div>

            <button 
                onClick={initGame}
                className={`px-8 py-4 text-white font-retro text-xl rounded shadow-[0_4px_0_rgba(0,0,0,0.5)] active:shadow-none active:translate-y-1 transition-all mb-8 ${
                    gameMode === GameMode.SAVE ? 'bg-green-600 hover:bg-green-500' : 
                    gameMode === GameMode.KILL ? 'bg-red-700 hover:bg-red-600' :
                    'bg-yellow-600 hover:bg-yellow-500'
                }`}
            >
                START HRY
            </button>

            {/* Leaderboards Preview */}
            <div className="flex flex-col md:flex-row gap-8 w-full max-w-4xl text-xs md:text-sm">
                <div className="flex-1 bg-gray-800 p-4 rounded border border-gray-700">
                    <h3 className="font-retro text-yellow-400 mb-4 text-center">TOP SKÓRE ({difficulty})</h3>
                    <table className="w-full text-left">
                        <thead><tr className="text-gray-500"><th>Jméno</th><th className="text-right">Body</th></tr></thead>
                        <tbody>
                            {getTopScores(difficulty, gameMode).length === 0 && <tr><td colSpan={2} className="text-center py-2 text-gray-600">Zatím žádné záznamy</td></tr>}
                            {getTopScores(difficulty, gameMode).map((s, i) => (
                                <tr key={i} className="border-b border-gray-700/50">
                                    <td className="py-1">{s.name}</td>
                                    <td className="text-right text-yellow-200">
                                        <div>{s.score}</div>
                                        {s.mode === GameMode.SAVE && (
                                            <div className="text-[10px] text-gray-400">
                                                {s.saved || 0}❤️ / {s.killed || 0}💀
                                            </div>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
                <div className="flex-1 bg-gray-800 p-4 rounded border border-gray-700">
                    <h3 className="font-retro text-red-500 mb-4 text-center">NEJVĚTŠÍ VRAZI ({difficulty})</h3>
                    <table className="w-full text-left">
                        <thead><tr className="text-gray-500"><th>Jméno</th><th className="text-right">Mrtvol</th></tr></thead>
                        <tbody>
                            {getTopKillers(difficulty, gameMode).length === 0 && <tr><td colSpan={2} className="text-center py-2 text-gray-600">Mírumilovní hráči</td></tr>}
                            {getTopKillers(difficulty, gameMode).map((k, i) => (
                                <tr key={i} className="border-b border-gray-700/50">
                                    <td className="py-1">{k.name}</td>
                                    <td className="text-right text-red-300">{k.kills}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
      )}

      {/* 2. Pause Screen */}
      {gameState === GameState.PAUSED && (
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex flex-col items-center justify-center z-50">
              <h2 className="font-retro text-4xl text-white mb-8">PAUZA</h2>
              <button 
                  onClick={() => setGameState(GameState.PLAYING)}
                  className="px-6 py-3 bg-cyan-600 text-white font-retro rounded mb-4"
              >
                  POKRAČOVAT
              </button>
              <button 
                  onClick={() => setGameState(GameState.MENU)}
                  className="px-6 py-3 bg-red-600 text-white font-retro rounded"
              >
                  UKONČIT
              </button>
          </div>
      )}

      {/* 3. Game Over */}
      {gameState === GameState.GAME_OVER && (
          <div className="absolute inset-0 bg-red-900/90 flex flex-col items-center justify-center z-50 p-4">
              <h2 className="font-retro text-5xl text-white mb-4 drop-shadow-[4px_4px_0_#000]">GAME OVER</h2>
              
              <div className="bg-black/50 p-6 rounded-lg text-center mb-6 w-full max-w-md">
                  <div className="mb-2 text-gray-300">Finální skóre</div>
                  <div className={`font-retro text-3xl mb-4 ${score < 0 ? 'text-red-400' : 'text-yellow-400'}`}>{score}</div>
                  
                  {gameMode === GameMode.SAVE ? (
                      <div className="flex gap-6 justify-center">
                          <div className="text-center">
                              <div className="text-xs text-gray-400 mb-1">Zachráněno</div>
                              <div className="text-green-500 font-retro text-xl">{lemmingsSaved} ❤️</div>
                          </div>
                          <div className="text-center">
                               <div className="text-xs text-gray-400 mb-1">Obětováno</div>
                               <div className="text-red-500 font-retro text-xl">{lemmingsKilled} 💀</div>
                          </div>
                      </div>
                  ) : (
                      <>
                        <div className="mb-2 text-gray-300">
                            {gameMode === GameMode.CAGE ? 'Prodáno' : 'Zabito'}
                        </div>
                        <div className={`font-retro text-2xl ${
                            gameMode === GameMode.CAGE ? 'text-yellow-500' : 'text-red-500'
                        }`}>
                            {lemmingsKilled} 
                            {gameMode === GameMode.CAGE ? ' 💰' : ' 💀'}
                        </div>
                      </>
                  )}
              </div>

              <div className="flex flex-col gap-2 w-full max-w-xs mb-6">
                  <label className="text-xs uppercase text-gray-300">Zadej své jméno:</label>
                  <input 
                    type="text" 
                    maxLength={12}
                    placeholder="Bezejmenný hrdina"
                    className="bg-gray-800 border border-gray-600 text-white p-3 rounded font-retro text-center focus:border-cyan-500 outline-none"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                  />
              </div>

              <div className="flex gap-4">
                <button 
                    onClick={saveHighScore}
                    className="px-6 py-3 bg-green-600 hover:bg-green-500 text-white font-retro rounded shadow-[0_4px_0_rgb(20,83,45)] active:translate-y-1 active:shadow-none"
                >
                    ULOŽIT A MENU
                </button>
              </div>
          </div>
      )}

    </div>
  );
}