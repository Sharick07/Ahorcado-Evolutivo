import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { GoogleGenAI } from '@google/genai';
import { auth, signIn, logOut, db, signInEmail, signUpEmail } from './firebase';
import { onAuthStateChanged, User } from 'firebase/auth';
import { 
  doc, 
  setDoc, 
  onSnapshot, 
  updateDoc, 
  collection, 
  query, 
  where, 
  getDocs,
  serverTimestamp,
  getDoc
} from 'firebase/firestore';
import { GameMode, GameStatus, GameState, SCENARIOS, COLORS, Difficulty } from './types';
import Scenario from './components/Scenario';
import Narrative from './components/Narrative';
import Keyboard from './components/Keyboard';
import PowerBar from './components/PowerBar';
import Hangman from './components/Hangman';
import { LogOut, LogIn, RefreshCw, Trophy, Skull, Sparkles, Brain, Sword, BookOpen, ChevronLeft, Info, Users, Plus, Play, Mail, Lock } from 'lucide-react';

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY || '' });

const normalize = (c: string) => {
  return c.toUpperCase()
    .replace(/[ÁÀÄÂ]/g, 'A')
    .replace(/[ÉÈËÊ]/g, 'E')
    .replace(/[ÍÌÏÎ]/g, 'I')
    .replace(/[ÓÒÖÔ]/g, 'O')
    .replace(/[ÚÙÜÛ]/g, 'U');
};

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [game, setGame] = useState<GameState | null>(null);
  const [status, setStatus] = useState<GameStatus>(GameStatus.IDLE);
  const [isLoadingNarrative, setIsLoadingNarrative] = useState(false);
  const [isAuthReady, setIsAuthReady] = useState(false);
  const [showHowTo, setShowHowTo] = useState(false);
  const [roomCode, setRoomCode] = useState('');
  const [lobbyError, setLobbyError] = useState<string | null>(null);
  const [customWord, setCustomWord] = useState('');
  const [customHint, setCustomHint] = useState('');
  const [selectedScenarioId, setSelectedScenarioId] = useState(SCENARIOS[0].id);
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPass, setLoginPass] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  // Auth Listener
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setIsAuthReady(true);
    });
    return unsubscribe;
  }, []);

  // Multiplayer Sync
  useEffect(() => {
    if (game?.roomId && game.mode === GameMode.VS) {
      const unsubscribe = onSnapshot(doc(db, 'rooms', game.roomId), (docSnap) => {
        if (docSnap.exists()) {
          const data = docSnap.data() as GameState;
          setGame(data);
          setStatus(data.status);
        }
      });
      return unsubscribe;
    }
  }, [game?.roomId, game?.mode]);

  // Initialize Game
  const generateRandomWord = async () => {
    if (!process.env.GEMINI_API_KEY) return { word: 'ERROR', hint: 'API Key missing' };
    try {
      const prompt = `Genera una palabra aleatoria para un juego de ahorcado y una pista misteriosa. 
      La palabra debe ser en español, de entre 5 y 10 letras, sustantivo común.
      Responde SOLO en formato JSON: {"word": "PALABRA", "hint": "Pista poética"}`;
      
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
        config: { responseMimeType: 'application/json' }
      });
      
      return JSON.parse(response.text);
    } catch (error) {
      console.error('Error generating word:', error);
      return { word: 'MENTE', hint: 'Donde todo reside' };
    }
  };

  const startNewGame = useCallback(async (mode: GameMode = GameMode.SOLO) => {
    if (mode === GameMode.VS) {
      if (!user) {
        signIn();
        return;
      }
      
      if (game?.roomId) {
        if (game.leaderId === user.uid) {
          // Leader resets the room
          const resetGame: Partial<GameState> = {
            word: '',
            hint: '',
            revealed: [],
            guessed: [],
            errors: 0,
            guesserEnergy: 0,
            setterEnergy: 0,
            status: GameStatus.LOBBY,
            lastNarrative: 'El ciclo comienza de nuevo...'
          };
          await updateDoc(doc(db, 'rooms', game.roomId), resetGame);
        }
        // Guesser just waits for the onSnapshot to trigger
      } else {
        setStatus(GameStatus.LOBBY);
      }
      return;
    }

    setIsLoadingNarrative(true);
    const { word, hint } = await generateRandomWord();
    const scenario = SCENARIOS[Math.floor(Math.random() * SCENARIOS.length)];
    
    const newGame: GameState = {
      mode,
      word: word.toUpperCase(),
      hint,
      revealed: word.split('').map(() => false),
      guessed: [],
      errors: 0,
      maxErrors: 6,
      guesserEnergy: 0,
      setterEnergy: 0,
      status: GameStatus.PLAYING,
      scenarioId: scenario.id,
      createdAt: Date.now(),
      leaderId: user?.uid || 'guest',
      players: user ? [{ uid: user.uid, displayName: user.displayName || 'Anónimo', photoURL: user.photoURL || '', role: 'guesser' }] : [],
      lastNarrative: 'El primer fragmento. Todo comenzó aquí.'
    };
    setGame(newGame);
    setStatus(GameStatus.PLAYING);
    generateNarrative(newGame, 'inicio');
    setIsLoadingNarrative(false);
  }, [user]);

  // Multiplayer Actions
  const createRoom = async () => {
    if (!user) return;
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newGame: GameState = {
      roomId,
      mode: GameMode.VS,
      word: '',
      hint: '',
      revealed: [],
      guessed: [],
      errors: 0,
      maxErrors: 6,
      guesserEnergy: 0,
      setterEnergy: 0,
      status: GameStatus.LOBBY,
      scenarioId: SCENARIOS[0].id,
      createdAt: Date.now(),
      leaderId: user.uid,
      players: [{ uid: user.uid, displayName: user.displayName || 'Anónimo', photoURL: user.photoURL || '', role: 'setter' }],
      lastNarrative: 'Esperando a que los fragmentos se unan...'
    };
    await setDoc(doc(db, 'rooms', roomId), newGame);
    setGame(newGame);
    setStatus(GameStatus.LOBBY);
  };

  const goToWordEntry = async () => {
    if (!game?.roomId) return;
    await updateDoc(doc(db, 'rooms', game.roomId), { status: GameStatus.WORD_ENTRY });
  };

  const joinRoom = async (code: string) => {
    if (!user || !code) return;
    setLobbyError(null);
    const roomRef = doc(db, 'rooms', code.toUpperCase());
    const docSnap = await getDoc(roomRef);
    if (docSnap.exists()) {
      const data = docSnap.data() as GameState;
      const alreadyJoined = data.players.some(p => p.uid === user.uid);
      if (!alreadyJoined) {
        const updatedPlayers = [...data.players, { uid: user.uid, displayName: user.displayName || 'Anónimo', photoURL: user.photoURL || '', role: 'guesser' as const }];
        await updateDoc(roomRef, { players: updatedPlayers });
      }
      setGame(data);
      setStatus(data.status);
    } else {
      setLobbyError('Sala no encontrada o código incorrecto.');
    }
  };

  const submitWord = async () => {
    if (!game?.roomId || !customWord) return;
    const word = customWord.toUpperCase();
    const updatedGame = {
      ...game,
      word,
      hint: customHint || 'Sin pista...',
      revealed: word.split('').map(() => false),
      status: GameStatus.PLAYING,
      scenarioId: selectedScenarioId,
      lastNarrative: 'El recuerdo ha sido implantado. Comienza la reconstrucción.'
    };
    await updateDoc(doc(db, 'rooms', game.roomId), updatedGame);
    setGame(updatedGame);
    setStatus(GameStatus.PLAYING);
  };

  // AI Narration
  const generateNarrative = async (gameState: GameState, event: string) => {
    if (!process.env.GEMINI_API_KEY) return;
    setIsLoadingNarrative(true);
    try {
      const scenario = SCENARIOS.find(s => s.id === gameState.scenarioId);
      const prompt = `
        Eres el Narrador de "Ahorcado Evolutivo". El escenario muestra ${scenario?.description}.
        La palabra tiene ${gameState.word.length} letras. 
        Estado: "${gameState.word.split('').map((l, i) => gameState.revealed[i] ? l : '_').join(' ')}". 
        Errores: ${gameState.errors}/${gameState.maxErrors}.
        Evento: ${event}.
        Escribe UNA oración poética (máx. 20 palabras) sobre el mundo en español. No expliques el juego.
      `;

      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });

      setGame(prev => prev ? { ...prev, lastNarrative: response.text } : null);
    } catch (error) {
      console.error('Narrative error:', error);
    } finally {
      setIsLoadingNarrative(false);
    }
  };

  // Game Actions
  const handleKey = async (key: string) => {
    if (!game || status !== GameStatus.PLAYING) return;

    // In VS mode, only guessers can guess
    if (game.mode === GameMode.VS) {
      const currentPlayer = game.players.find(p => p.uid === user?.uid);
      if (currentPlayer?.role !== 'guesser') return;
    }

    const normalizedKey = normalize(key);
    const isCorrect = game.word.split('').some(l => normalize(l) === normalizedKey);
    const newGuessed = [...game.guessed, key];
    let newRevealed = [...game.revealed];
    let newErrors = game.errors;
    let newEnergy = game.guesserEnergy;

    if (isCorrect) {
      game.word.split('').forEach((l, i) => {
        if (normalize(l) === normalizedKey) newRevealed[i] = true;
      });
      newEnergy += 10;
    } else {
      newErrors += 1;
    }

    const isWon = newRevealed.every(r => r);
    const isLost = newErrors >= game.maxErrors;
    const newGameStatus = isWon ? GameStatus.WON : (isLost ? GameStatus.LOST : GameStatus.PLAYING);

    const updatedGame = {
      ...game,
      guessed: newGuessed,
      revealed: newRevealed,
      errors: newErrors,
      guesserEnergy: newEnergy,
      status: newGameStatus
    };

    if (game.roomId && game.mode === GameMode.VS) {
      await updateDoc(doc(db, 'rooms', game.roomId), updatedGame);
    } else {
      setGame(updatedGame);
      generateNarrative(updatedGame, isCorrect ? 'acierto' : 'error');
    }

    if (newGameStatus !== GameStatus.PLAYING) {
      setTimeout(async () => {
        if (game.roomId && game.mode === GameMode.VS) {
          await updateDoc(doc(db, 'rooms', game.roomId), { status: GameStatus.RESULTS });
        } else {
          setStatus(GameStatus.RESULTS);
        }
      }, 2000);
      handleGameOver(updatedGame);
    }
  };

  const handleGameOver = async (finalState: GameState) => {
    if (!process.env.GEMINI_API_KEY) return;
    setIsLoadingNarrative(true);
    try {
      const prompt = `
        El jugador ${finalState.status === GameStatus.WON ? 'GANÓ' : 'PERDIÓ'}. La palabra era "${finalState.word}".
        Cometió ${finalState.errors} errores de ${finalState.maxErrors} permitidos.
        Escribe UN párrafo final poético en español (2-3 oraciones, máx. 40 palabras) sobre el destino del recuerdo.
      `;
      const response = await ai.models.generateContent({
        model: 'gemini-3-flash-preview',
        contents: prompt,
      });
      
      if (finalState.roomId && finalState.mode === GameMode.VS) {
        await updateDoc(doc(db, 'rooms', finalState.roomId), { lastNarrative: response.text });
      } else {
        setGame(prev => prev ? { ...prev, lastNarrative: response.text } : null);
      }
    } catch (error) {
      console.error('Final narrative error:', error);
    } finally {
      setIsLoadingNarrative(false);
    }
  };

  const handlePower = async (powerId: string) => {
    if (!game || status !== GameStatus.PLAYING) return;

    // In VS mode, only guessers can use powers
    if (game.mode === GameMode.VS) {
      const currentPlayer = game.players.find(p => p.uid === user?.uid);
      if (currentPlayer?.role !== 'guesser') return;
    }

    if (powerId === 'reveal') {
      const unrevealedIndices = game.revealed.map((r, i) => r ? -1 : i).filter(i => i !== -1);
      if (unrevealedIndices.length > 0) {
        const randomIndex = unrevealedIndices[Math.floor(Math.random() * unrevealedIndices.length)];
        const newRevealed = [...game.revealed];
        newRevealed[randomIndex] = true;
        const isWon = newRevealed.every(r => r);
        const updatedGame = {
          ...game,
          revealed: newRevealed,
          guesserEnergy: game.guesserEnergy - 30,
          status: isWon ? GameStatus.WON : GameStatus.PLAYING
        };
        
        if (game.roomId && game.mode === GameMode.VS) {
          await updateDoc(doc(db, 'rooms', game.roomId), updatedGame);
        } else {
          setGame(updatedGame);
          generateNarrative(updatedGame, 'poder: revelar');
        }

        if (isWon) {
          setTimeout(async () => {
            if (game.roomId && game.mode === GameMode.VS) {
              await updateDoc(doc(db, 'rooms', game.roomId), { status: GameStatus.RESULTS });
            } else {
              setStatus(GameStatus.RESULTS);
            }
          }, 2000);
          handleGameOver(updatedGame);
        }
      }
    } else if (powerId === 'hint') {
      setIsLoadingNarrative(true);
      try {
        const prompt = `
          Eres el oráculo de "Ahorcado Evolutivo". La palabra es "${game.word}".
          Pista original: "${game.hint}"
          Da UNA pista adicional, diferente, poética y misteriosa en español (máx. 15 palabras).
          No menciones la palabra.
        `;
        const response = await ai.models.generateContent({
          model: 'gemini-3-flash-preview',
          contents: prompt,
        });

        if (game.roomId && game.mode === GameMode.VS) {
          await updateDoc(doc(db, 'rooms', game.roomId), { 
            lastNarrative: response.text, 
            guesserEnergy: game.guesserEnergy - 20 
          });
        } else {
          setGame(prev => prev ? { ...prev, lastNarrative: response.text, guesserEnergy: prev.guesserEnergy - 20 } : null);
        }
      } catch (error) {
        console.error('Hint error:', error);
      } finally {
        setIsLoadingNarrative(false);
      }
    }
  };

  const handleEmailAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setAuthError(null);
    try {
      if (isSignUp) {
        await signUpEmail(loginEmail, loginPass);
      } else {
        await signInEmail(loginEmail, loginPass);
      }
    } catch (error: any) {
      setAuthError(error.message);
    }
  };

  const handleSceneClick = async () => {
    if (!game || status !== GameStatus.PLAYING) return;
    
    // In VS mode, only guessers can gain energy by clicking
    if (game.mode === GameMode.VS) {
      const currentPlayer = game.players.find(p => p.uid === user?.uid);
      if (currentPlayer?.role !== 'guesser') return;
    }

    if (game.roomId && game.mode === GameMode.VS) {
      await updateDoc(doc(db, 'rooms', game.roomId), { guesserEnergy: game.guesserEnergy + 5 });
    } else {
      setGame(prev => prev ? { ...prev, guesserEnergy: prev.guesserEnergy + 5 } : null);
    }
  };

  if (!isAuthReady) return <div className="min-h-screen bg-[#0A0608] flex items-center justify-center text-white font-serif">Cargando mente...</div>;

  // PANTALLA 1 — Inicio de Sesión
  if (!user) {
    return (
      <div className="min-h-screen bg-[#0A0608] text-white font-sans flex flex-col items-center justify-center p-6 relative overflow-hidden">
        {/* Subtle Background Glow */}
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-accent/10 rounded-full blur-[120px] pointer-events-none" />
        
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="w-full max-w-md bg-white/5 p-12 rounded-[3rem] border border-white/10 backdrop-blur-2xl shadow-2xl relative z-10"
        >
          <div className="flex justify-center mb-12">
            <motion.div 
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 6, repeat: Infinity }}
              className="w-20 h-20 bg-gradient-to-br from-accent to-purple flex items-center justify-center rounded-3xl shadow-2xl shadow-accent/20"
            >
              <Brain size={40} className="text-white" />
            </motion.div>
          </div>
          
          <h1 className="text-3xl font-serif font-bold text-center mb-2 tracking-tight text-white">CONEXIÓN</h1>
          <p className="text-gray-500 text-center text-[10px] uppercase tracking-[0.5em] mb-12">Accede a tu conciencia</p>
          
          <form onSubmit={handleEmailAuth} className="space-y-4">
            <div className="relative group">
              <Mail className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="email" 
                placeholder="EMAIL" 
                value={loginEmail}
                onChange={(e) => setLoginEmail(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-6 focus:border-accent/50 focus:bg-black/60 outline-none transition-all placeholder:text-gray-700 text-sm"
                required
              />
            </div>
            <div className="relative group">
              <Lock className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600 group-focus-within:text-accent transition-colors" size={18} />
              <input 
                type="password" 
                placeholder="CONTRASEÑA" 
                value={loginPass}
                onChange={(e) => setLoginPass(e.target.value)}
                className="w-full bg-black/40 border border-white/5 rounded-2xl py-4 pl-12 pr-6 focus:border-accent/50 focus:bg-black/60 outline-none transition-all placeholder:text-gray-700 text-sm"
                required
              />
            </div>

            {authError && (
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-danger text-[10px] text-center uppercase tracking-widest pt-2"
              >
                {authError}
              </motion.p>
            )}

            <button 
              type="submit"
              className="w-full py-4 bg-accent text-white font-bold rounded-2xl hover:bg-accent/80 transition-all active:scale-[0.98] shadow-lg shadow-accent/20 mt-4"
            >
              {isSignUp ? 'CREAR CUENTA' : 'ENTRAR'}
            </button>
          </form>

          <div className="relative py-10">
            <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-white/5"></div></div>
            <div className="relative flex justify-center text-[9px] uppercase tracking-[0.3em]"><span className="bg-[#0A0608] px-4 text-gray-600">Otras vías</span></div>
          </div>

          <button 
            onClick={signIn}
            className="w-full py-4 bg-white/5 border border-white/10 text-white font-bold rounded-2xl flex items-center justify-center gap-3 hover:bg-white/10 transition-all active:scale-[0.98]"
          >
            <img src="https://www.google.com/favicon.ico" alt="" className="w-5 h-5 opacity-80" />
            GOOGLE
          </button>

          <p className="mt-12 text-center text-[11px] text-gray-600 tracking-wide">
            {isSignUp ? '¿Ya posees un registro?' : '¿Aún no tienes registro?'}
            <button 
              onClick={() => setIsSignUp(!isSignUp)}
              className="ml-2 text-accent font-bold hover:text-white transition-colors"
            >
              {isSignUp ? 'Inicia Sesión' : 'Regístrate'}
            </button>
          </p>
        </motion.div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A0608] text-white font-sans selection:bg-teal-500/30 relative overflow-hidden">
      {/* Particle Background */}
      <div className="absolute inset-0 pointer-events-none opacity-20">
        {[...Array(30)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-1 h-1 bg-white rounded-full"
            initial={{ 
              x: Math.random() * 100 + '%', 
              y: Math.random() * 100 + '%',
              opacity: Math.random()
            }}
            animate={{ 
              y: [null, '-10%'],
              opacity: [0, 1, 0]
            }}
            transition={{ 
              duration: Math.random() * 5 + 5, 
              repeat: Infinity,
              delay: Math.random() * 5
            }}
          />
        ))}
      </div>

      {/* Persistent User Header */}
      <header className="fixed top-0 left-0 right-0 z-[60] px-8 py-6 pointer-events-none">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center gap-4 cursor-pointer pointer-events-auto" onClick={() => setStatus(GameStatus.IDLE)}>
            <div className="w-12 h-12 bg-accent rounded-2xl flex items-center justify-center shadow-2xl shadow-accent/40 rotate-12">
              <Sparkles className="text-white -rotate-12" size={24} />
            </div>
            <div className="hidden md:block">
              <h1 className="text-xl font-serif font-bold tracking-tighter text-accent leading-none">Ahorcado</h1>
              <span className="text-[10px] uppercase tracking-[0.3em] text-gold opacity-70">Evolutivo</span>
            </div>
          </div>
          
          <div className="flex items-center gap-4 pointer-events-auto">
            <div className="flex items-center gap-3 bg-white/5 backdrop-blur-md px-4 py-2 rounded-2xl border border-white/10 shadow-2xl hover:bg-white/10 transition-all">
              <div className="relative">
                <img 
                  src={user.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${user.uid}`} 
                  alt="" 
                  className="w-10 h-10 rounded-xl border-2 border-accent/50 object-cover shadow-lg" 
                />
                <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-teal-500 border-2 border-[#0A0608] rounded-full shadow-sm" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-bold tracking-tight text-white leading-none mb-1">{user.displayName || user.email?.split('@')[0]}</span>
                <span className="text-[9px] uppercase tracking-[0.2em] text-accent font-bold">Nivel 1</span>
              </div>
              <div className="w-px h-8 bg-white/10 mx-2" />
              <button 
                onClick={logOut} 
                className="p-2 hover:bg-danger/20 hover:text-danger rounded-xl transition-all group"
                title="Cerrar Sesión"
              >
                <LogOut size={20} className="group-hover:scale-110 transition-transform" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <AnimatePresence mode="wait">
        {status === GameStatus.IDLE && (
          <motion.div 
            key="home"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center text-center px-6 relative z-10"
          >
            <motion.div
              initial={{ y: 20, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              transition={{ delay: 0.2 }}
            >
              <h1 className="text-6xl md:text-9xl font-serif font-bold mb-20 tracking-tighter bg-gradient-to-r from-gold via-accent to-purple bg-clip-text text-transparent">
                AHORCADO EVOLUTIVO
              </h1>
              
              <div className="flex flex-col gap-6 items-center">
                <button 
                  onClick={() => setStatus(GameStatus.SELECTING_MODE)}
                  className="w-80 py-6 bg-accent text-white font-bold tracking-[0.5em] rounded-2xl transition-all hover:scale-105 active:scale-95 shadow-2xl shadow-accent/40 flex items-center justify-center gap-4 text-xl"
                >
                  <Play size={28} fill="currentColor" /> COMENZAR
                </button>
                <button 
                  onClick={() => setShowHowTo(true)}
                  className="w-80 py-4 border border-white/10 bg-white/5 hover:bg-white/10 text-gray-400 text-[11px] font-bold tracking-[0.4em] rounded-2xl transition-all flex items-center justify-center gap-3 uppercase"
                >
                  <Info size={18} /> MANUAL DE JUEGO
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}

        {status === GameStatus.SELECTING_MODE && (
          <motion.div 
            key="mode-select"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 1.1 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 pt-20"
          >
            <h2 className="text-3xl font-serif text-gold mb-12 tracking-[0.3em] uppercase">Elige tu experiencia</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-6xl w-full">
              {[
                { 
                  id: GameMode.SOLO, 
                  name: 'SOLO — IA NARRATIVA', 
                  desc: 'Adivina palabras generadas por IA. Cada error deteriora el mundo. Cada acierto lo reconstruye.', 
                  icon: <Brain className="text-pink-400" size={40} />,
                  btn: 'VS IA',
                  color: 'border-pink-500/30'
                },
                { 
                  id: GameMode.VS, 
                  name: '1 VS 1 — DUELO', 
                  desc: 'Un jugador elige la palabra y puede saboteador. El otro intenta reconstruir el recuerdo.', 
                  icon: <Sword className="text-purple-400" size={40} />,
                  btn: 'MULTIJUGADOR',
                  color: 'border-purple-500/30'
                },
                { 
                  id: GameMode.STORY, 
                  name: 'HISTORIA — CAPÍTULOS', 
                  desc: 'Viaja por recuerdos interconectados. Las derrotas acumulan deterioro. La narrativa evoluciona.', 
                  icon: <BookOpen className="text-gold" size={40} />,
                  btn: 'CAMPAÑA',
                  color: 'border-gold/30'
                }
              ].map((m) => (
                <motion.div
                  key={m.id}
                  whileHover={{ y: -10, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  className={`p-8 rounded-3xl border ${m.color} bg-white/5 flex flex-col items-center text-center gap-6 transition-all`}
                >
                  <div className="mb-2">{m.icon}</div>
                  <h3 className="text-xl font-serif font-bold tracking-tighter">{m.name}</h3>
                  <p className="text-gray-400 text-sm leading-relaxed">{m.desc}</p>
                  <button 
                    onClick={() => startNewGame(m.id)}
                    className="mt-auto px-8 py-2 border border-accent/50 text-accent text-xs font-bold tracking-widest rounded hover:bg-accent hover:text-white transition-all"
                  >
                    {m.btn}
                  </button>
                </motion.div>
              ))}
            </div>

            <button 
              onClick={() => setStatus(GameStatus.IDLE)}
              className="mt-12 flex items-center gap-2 text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-xs"
            >
              <ChevronLeft size={16} /> Volver
            </button>
          </motion.div>
        )}

        {status === GameStatus.LOBBY && game && (
          <motion.div 
            key="lobby-active"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 pt-20"
          >
            <div className="max-w-2xl w-full bg-white/5 p-10 rounded-3xl border border-accent/30 flex flex-col gap-8">
              <div className="text-center">
                <h2 className="text-3xl font-serif text-gold mb-2 uppercase tracking-widest">Sala de Espera</h2>
                <div className="inline-block bg-accent/10 px-6 py-2 rounded-full border border-accent/30 mt-2">
                  <p className="text-xs text-gray-400 uppercase tracking-widest mb-1">Código de Acceso</p>
                  <p className="text-3xl font-mono font-bold text-accent tracking-[0.5em]">{game.roomId}</p>
                </div>
              </div>

              <div className="space-y-4">
                <h3 className="text-xs uppercase tracking-widest text-gray-500 font-bold">Mentes Conectadas ({game.players.length})</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {game.players.map((p) => (
                    <div key={p.uid} className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/10">
                      <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} alt="" className="w-10 h-10 rounded-full border border-gold/30" />
                      <div className="flex flex-col">
                        <span className="text-sm font-bold">{p.displayName}</span>
                        <span className={`text-[10px] uppercase tracking-widest ${p.role === 'setter' ? 'text-accent' : 'text-teal-400'}`}>
                          {p.role === 'setter' ? 'Líder (Crea)' : 'Buscador (Adivina)'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {game.leaderId === user?.uid ? (
                <button 
                  onClick={goToWordEntry}
                  disabled={game.players.length < 2}
                  className="w-full py-4 bg-accent text-white font-bold rounded-xl hover:bg-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play size={20} /> DEFINIR RECUERDO
                </button>
              ) : (
                <div className="text-center py-4">
                  <p className="text-gray-500 animate-pulse italic font-serif">Esperando a que el líder inicie la conexión...</p>
                </div>
              )}
            </div>

            <button 
              onClick={() => setStatus(GameStatus.SELECTING_MODE)}
              className="mt-12 flex items-center gap-2 text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-xs"
            >
              <ChevronLeft size={16} /> Salir de la Sala
            </button>
          </motion.div>
        )}

        {status === GameStatus.LOBBY && !game && (
          <motion.div 
            key="lobby-join"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 pt-20"
          >
            <h2 className="text-3xl font-serif text-gold mb-12 tracking-[0.3em] uppercase">Sala de Duelo</h2>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl w-full">
              <div className="p-8 rounded-3xl border border-accent/30 bg-white/5 flex flex-col items-center text-center gap-6">
                <Plus size={48} className="text-accent" />
                <h3 className="text-xl font-serif font-bold">Crear Nueva Sala</h3>
                <p className="text-gray-400 text-sm">Tú eliges la palabra y el escenario. Otros intentarán adivinar.</p>
                <button 
                  onClick={createRoom}
                  className="mt-auto w-full py-3 bg-accent text-white font-bold rounded-lg hover:bg-accent/80 transition-all"
                >
                  CREAR SALA
                </button>
              </div>

              <div className="p-8 rounded-3xl border border-purple-500/30 bg-white/5 flex flex-col items-center text-center gap-6">
                <Users size={48} className="text-purple-400" />
                <h3 className="text-xl font-serif font-bold">Unirse a Sala</h3>
                <p className="text-gray-400 text-sm">Ingresa el código de 6 dígitos para entrar al duelo.</p>
                <input 
                  type="text" 
                  value={roomCode}
                  onChange={(e) => {
                    setRoomCode(e.target.value.toUpperCase());
                    setLobbyError(null);
                  }}
                  placeholder="CÓDIGO"
                  className="w-full bg-black/40 border border-white/10 rounded-lg py-3 px-4 text-center text-xl font-mono tracking-[0.5em] focus:border-purple-500 outline-none"
                  maxLength={6}
                />
                {lobbyError && <p className="text-danger text-xs font-serif italic">{lobbyError}</p>}
                <button 
                  onClick={() => joinRoom(roomCode)}
                  className="w-full py-3 bg-purple-600 text-white font-bold rounded-lg hover:bg-purple-500 transition-all"
                >
                  UNIRSE
                </button>
              </div>
            </div>

            <button 
              onClick={() => setStatus(GameStatus.SELECTING_MODE)}
              className="mt-12 flex items-center gap-2 text-gray-500 hover:text-white transition-colors uppercase tracking-widest text-xs"
            >
              <ChevronLeft size={16} /> Volver
            </button>
          </motion.div>
        )}

        {status === GameStatus.WORD_ENTRY && game && (
          <motion.div 
            key="word-entry"
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 pt-20"
          >
            {game.leaderId === user?.uid ? (
              <div className="max-w-xl w-full bg-white/5 p-10 rounded-3xl border border-accent/30 flex flex-col gap-8">
                <div className="text-center">
                  <h2 className="text-3xl font-serif text-gold mb-2 uppercase tracking-widest">Prepara el Recuerdo</h2>
                  <p className="text-gray-500 text-sm mb-4">Código de Sala: <span className="text-accent font-mono font-bold tracking-widest">{game.roomId}</span></p>
                  
                  <div className="flex flex-wrap justify-center gap-2 mb-2">
                    {game.players.map(p => (
                      <div key={p.uid} className="flex items-center gap-2 bg-white/5 p-1.5 rounded-full border border-white/10">
                        <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} alt="" className="w-5 h-5 rounded-full" />
                        <span className="text-[9px] font-bold pr-2">{p.displayName}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="space-y-6">
                  <div>
                    <div className="flex justify-between items-center mb-2">
                      <label className="block text-xs uppercase tracking-widest text-gray-500">Palabra Secreta</label>
                      <button 
                        onClick={async () => {
                          setIsLoadingNarrative(true);
                          const { word, hint } = await generateRandomWord();
                          setCustomWord(word.toUpperCase());
                          setCustomHint(hint);
                          setIsLoadingNarrative(false);
                        }}
                        className="text-[9px] uppercase tracking-widest text-accent font-bold flex items-center gap-1 hover:text-white transition-colors"
                      >
                        <Sparkles size={12} /> Sugerencia IA
                      </button>
                    </div>
                    <input 
                      type="text" 
                      value={customWord}
                      onChange={(e) => setCustomWord(e.target.value.toUpperCase().replace(/[^A-Z]/g, ''))}
                      placeholder="EJ: LIBERTAD"
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-6 text-2xl font-mono tracking-[0.3em] focus:border-accent outline-none"
                      maxLength={15}
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Pista Mística</label>
                    <textarea 
                      value={customHint}
                      onChange={(e) => setCustomHint(e.target.value)}
                      placeholder="Una breve frase que guíe pero no revele..."
                      className="w-full bg-black/40 border border-white/10 rounded-lg py-4 px-6 h-24 focus:border-accent outline-none resize-none"
                      maxLength={100}
                    />
                  </div>

                  <div>
                    <label className="block text-xs uppercase tracking-widest text-gray-500 mb-2">Escenario Visual</label>
                    <div className="grid grid-cols-3 gap-3">
                      {SCENARIOS.slice(0, 6).map(s => (
                        <button
                          key={s.id}
                          onClick={() => setSelectedScenarioId(s.id)}
                          className={`p-3 rounded-xl border text-[10px] uppercase tracking-tighter transition-all ${selectedScenarioId === s.id ? 'border-gold bg-gold/10 text-gold' : 'border-white/10 bg-white/5 text-gray-500'}`}
                        >
                          {s.id}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <button 
                  onClick={submitWord}
                  disabled={!customWord}
                  className="w-full py-4 bg-accent text-white font-bold rounded-xl hover:bg-accent/80 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <Play size={20} /> IMPLANTAR RECUERDO
                </button>
              </div>
            ) : (
              <div className="text-center space-y-8">
                <div className="relative inline-block">
                  <motion.div 
                    animate={{ rotate: 360 }}
                    transition={{ duration: 10, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 border-2 border-dashed border-accent/20 rounded-full scale-150"
                  />
                  <Brain size={80} className="text-accent animate-pulse" />
                </div>
                <h2 className="text-4xl font-serif text-gold tracking-widest uppercase">Esperando al Líder</h2>
                <p className="text-gray-500 font-serif italic">El recuerdo está siendo implantado en la red...</p>
                <div className="bg-white/5 p-4 rounded-xl border border-white/10 inline-block">
                  <p className="text-xs text-gray-600 uppercase tracking-widest mb-1">Código de Sala</p>
                  <p className="text-2xl font-mono font-bold text-accent tracking-widest">{game.roomId}</p>
                </div>
              </div>
            )}
          </motion.div>
        )}

        {status === GameStatus.PLAYING && game && (
          <motion.div 
            key="playing"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="pt-24 pb-12 px-6 max-w-6xl mx-auto flex flex-col gap-8"
          >
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
              {/* Left Column: Scenario & Narrative */}
              <div className="lg:col-span-8 flex flex-col gap-6">
                <div onClick={handleSceneClick} className="cursor-pointer active:scale-[0.99] transition-transform relative group">
                  <Scenario 
                    scenarioId={game.scenarioId}
                    errors={game.errors}
                    maxErrors={game.maxErrors}
                    revealedCount={game.revealed.filter(r => r).length}
                    totalLetters={game.word.length}
                    status={game.status}
                  />
                  {/* Overlay Hangman - Minimalist */}
                  <div className="absolute top-4 right-4 w-32 h-32 pointer-events-none opacity-80">
                    <Hangman errors={game.errors} />
                  </div>
                </div>
                
                <Narrative text={game.lastNarrative || ''} isLoading={isLoadingNarrative} />
                
                <div className="flex justify-center flex-wrap gap-3 py-6">
                  {game.word.split('').map((letter, i) => (
                    <motion.div
                      key={i}
                      initial={{ scale: 0.8, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      className={`
                        w-10 h-14 sm:w-14 sm:h-20 flex items-center justify-center text-3xl sm:text-4xl font-bold border-b-4 rounded-t-2xl transition-all
                        ${game.revealed[i] ? 'border-teal-500 text-teal-400 bg-teal-500/10 shadow-[0_0_20px_rgba(20,184,166,0.1)]' : 'border-white/10 text-transparent bg-white/5'}
                      `}
                    >
                      {game.revealed[i] ? letter : ''}
                    </motion.div>
                  ))}
                </div>
              </div>

              {/* Right Column: Controls & Info */}
              <div className="lg:col-span-4 flex flex-col gap-6">
                {/* Player List (Multiplayer) */}
                {game.mode === GameMode.VS && (
                  <div className="bg-white/5 p-5 rounded-3xl border border-white/10 backdrop-blur-md">
                    <h3 className="text-[10px] uppercase tracking-[0.3em] text-gray-500 font-bold mb-4 px-1">Mentes en Duelo</h3>
                    <div className="flex flex-wrap gap-2">
                      {game.players.map(p => (
                        <div key={p.uid} className="flex items-center gap-2 bg-black/40 p-2 rounded-xl border border-white/5">
                          <img src={p.photoURL || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.uid}`} alt="" className="w-7 h-7 rounded-lg border border-white/10" />
                          <span className="text-[10px] font-bold truncate max-w-[80px]">{p.displayName}</span>
                          <div className={`w-1.5 h-1.5 rounded-full ${p.role === 'setter' ? 'bg-accent' : 'bg-teal-400'} shadow-sm`} />
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="bg-white/5 p-8 rounded-[2.5rem] border border-white/10 backdrop-blur-md flex flex-col gap-8">
                  {game.roomId && (
                    <div className="flex justify-between items-center bg-accent/5 p-4 rounded-2xl border border-accent/20">
                      <span className="text-[9px] uppercase tracking-[0.4em] text-accent font-bold">SALA</span>
                      <span className="text-xl font-mono font-bold text-white tracking-widest">{game.roomId}</span>
                    </div>
                  )}
                  
                  <div className="space-y-4">
                    <div className="flex justify-between items-center">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500">Integridad</span>
                      <div className="flex gap-1.5">
                        {[...Array(game.maxErrors)].map((_, i) => (
                          <motion.div 
                            key={i} 
                            animate={{ 
                              scale: i < game.errors ? [1, 1.2, 1] : 1,
                              backgroundColor: i < game.errors ? '#C84A4A' : 'rgba(255,255,255,0.1)'
                            }}
                            className="w-3.5 h-3.5 rounded-full" 
                          />
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-4 border-t border-white/5">
                      <span className="text-[10px] font-bold uppercase tracking-[0.3em] text-gray-500 block mb-3">Pista</span>
                      <p className="text-xl font-serif italic text-gold leading-relaxed">"{game.hint}"</p>
                    </div>
                  </div>
                  
                  <PowerBar 
                    energy={game.guesserEnergy} 
                    onPower={handlePower}
                    disabled={status !== GameStatus.PLAYING}
                  />
                </div>

                <div className="bg-white/5 p-4 rounded-[2rem] border border-white/10 backdrop-blur-md">
                  <Keyboard 
                    onKey={handleKey} 
                    guessed={game.guessed} 
                    disabled={status !== GameStatus.PLAYING}
                  />
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {status === GameStatus.RESULTS && game && (
          <motion.div 
            key="results"
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="min-h-screen flex flex-col items-center justify-center px-6 text-center"
          >
            <motion.h2 
              initial={{ scale: 0.5, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              className={`text-6xl md:text-8xl font-serif font-bold mb-8 tracking-tighter ${game.status === GameStatus.WON ? 'text-gold drop-shadow-[0_0_20px_rgba(212,168,67,0.5)]' : 'text-danger drop-shadow-[0_0_20px_rgba(200,74,74,0.5)]'}`}
            >
              {game.status === GameStatus.WON ? '¡FELICITACIONES!' : '¡HAS PERDIDO!'}
            </motion.h2>

            <div className="mb-8 flex justify-center items-center gap-4">
              <div className="text-6xl">{game.status === GameStatus.WON ? '🐘' : '🌑'}</div>
              <Sparkles className="text-gold animate-pulse" size={48} />
            </div>

            <div className="max-w-2xl mx-auto mb-12">
              <p className="text-gray-400 font-serif italic text-lg leading-relaxed">
                {game.lastNarrative}
              </p>
            </div>

            <div className="mb-12">
              <p className="text-gray-500 text-xs tracking-[0.3em] uppercase mb-4">La palabra era</p>
              <div className="px-12 py-4 border border-accent/30 bg-accent/5 rounded-xl inline-block">
                <span className="text-4xl font-mono font-bold tracking-[0.5em] text-accent">{game.word}</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-12 mb-16 max-w-md mx-auto">
              <div>
                <p className="text-3xl font-bold text-white">{game.revealed.filter(r => r).length}</p>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase mt-1">Letras Correctas</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{game.errors}</p>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase mt-1">Errores</p>
              </div>
              <div>
                <p className="text-3xl font-bold text-white">{game.guesserEnergy}</p>
                <p className="text-[10px] text-gray-500 tracking-widest uppercase mt-1">Energía Acumulada</p>
              </div>
            </div>

            <div className="flex gap-4">
              {game.mode === GameMode.VS && game.leaderId !== user?.uid ? (
                <div className="px-12 py-4 bg-white/5 border border-white/10 text-gray-400 font-bold tracking-widest rounded-lg flex items-center gap-2">
                  <RefreshCw className="animate-spin" size={18} /> ESPERANDO AL LÍDER...
                </div>
              ) : (
                <button 
                  onClick={() => startNewGame(game.mode)}
                  className="px-12 py-4 bg-accent/10 border border-accent/50 text-gold font-bold tracking-widest rounded-lg hover:bg-accent hover:text-white transition-all flex items-center gap-2"
                >
                  <span className="text-lg">✧</span> {game.mode === GameMode.VS ? 'REINICIAR SALA' : 'JUGAR DE NUEVO'}
                </button>
              )}
              <button 
                onClick={() => setStatus(GameStatus.IDLE)}
                className="px-12 py-4 bg-white/5 border border-white/10 text-gray-400 font-bold tracking-widest rounded-lg hover:bg-white/10 transition-all"
              >
                INICIO
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* How to Play Modal */}
      <AnimatePresence>
        {showHowTo && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex items-center justify-center p-6 bg-black/90 backdrop-blur-sm"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-[#151214] border border-white/10 p-12 rounded-3xl max-w-2xl w-full relative"
            >
              <button 
                onClick={() => setShowHowTo(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
              >
                <RefreshCw className="rotate-45" size={24} />
              </button>
              <h2 className="text-3xl font-serif text-gold mb-8 flex items-center gap-3">
                <Info className="text-accent" /> Cómo reconstruir el recuerdo
              </h2>
              <div className="space-y-6 text-gray-400 leading-relaxed">
                <p>1. <span className="text-white">Adivina las letras</span> para reconstruir el escenario visual. Cada acierto libera el recuerdo.</p>
                <p>2. <span className="text-white">Gana energía</span> haciendo clic en el escenario o adivinando letras correctamente.</p>
                <p>3. <span className="text-white">Usa poderes</span> para revelar letras difíciles o pedir pistas místicas al oráculo.</p>
                <p>4. <span className="text-danger">Evita los errores</span>. Cada fallo agrieta la mente y oscurece el mundo. Tienes 6 intentos antes del colapso total.</p>
              </div>
              <button 
                onClick={() => setShowHowTo(false)}
                className="mt-12 w-full py-4 bg-accent text-white font-bold rounded-xl"
              >
                ENTENDIDO
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Footer / Credits */}
      <footer className="fixed bottom-0 left-0 right-0 py-8 text-center text-gray-600 text-[10px] uppercase tracking-[0.5em] pointer-events-none">
        {/* Removed text as per request */}
      </footer>
    </div>
  );
}
