import React, { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Trophy, 
  RotateCcw, 
  Hand as HandIcon, 
  Info, 
  ChevronRight,
  User,
  Cpu,
  Layers
} from 'lucide-react';
import confetti from 'canvas-confetti';
import { Card, Suit, Rank, GameStatus, GameState } from './types';
import { createDeck, shuffle, canPlayCard, getSuitColor, getSuitSymbol } from './utils/gameLogic';

const CARD_WIDTH = 80;
const CARD_HEIGHT = 120;

export default function App() {
  const [gameState, setGameState] = useState<GameState>({
    deck: [],
    playerHand: [],
    aiHand: [],
    discardPile: [],
    currentTurn: 'player',
    status: 'idle',
    wildSuit: null,
    winner: null,
  });

  const [message, setMessage] = useState<string>('欢迎来到哈基疯狂 8 点！');
  const [isAiThinking, setIsAiThinking] = useState(false);
  const aiTurnTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Initialize Game
  const initGame = () => {
    const fullDeck = shuffle(createDeck());
    const playerHand = fullDeck.splice(0, 8);
    const aiHand = fullDeck.splice(0, 8);
    
    // Discard pile starts with one card (not an 8)
    let firstDiscardIndex = fullDeck.findIndex(c => c.rank !== Rank.EIGHT);
    if (firstDiscardIndex === -1) firstDiscardIndex = 0;
    const discardPile = fullDeck.splice(firstDiscardIndex, 1);

    setGameState({
      deck: fullDeck,
      playerHand,
      aiHand,
      discardPile,
      currentTurn: 'player',
      status: 'playing',
      wildSuit: null,
      winner: null,
    });
    setMessage('你的回合，请出牌或摸牌。');
  };

  // Player plays a card
  const playCard = (cardId: string) => {
    if (gameState.currentTurn !== 'player' || gameState.status !== 'playing') return;

    const card = gameState.playerHand.find(c => c.id === cardId);
    if (!card) return;

    const topCard = gameState.discardPile[gameState.discardPile.length - 1];
    if (canPlayCard(card, topCard, gameState.wildSuit)) {
      const newPlayerHand = gameState.playerHand.filter(c => c.id !== cardId);
      const newDiscardPile = [...gameState.discardPile, card];

      if (newPlayerHand.length === 0) {
        handleWin('player');
        return;
      }

      if (card.rank === Rank.EIGHT) {
        setGameState(prev => ({
          ...prev,
          playerHand: newPlayerHand,
          discardPile: newDiscardPile,
          status: 'choosing_suit',
        }));
        setMessage('打出了 8！请选择一个新的花色。');
      } else {
        setGameState(prev => ({
          ...prev,
          playerHand: newPlayerHand,
          discardPile: newDiscardPile,
          currentTurn: 'ai',
          wildSuit: null,
        }));
        setMessage('你打出了 ' + card.rank + getSuitSymbol(card.suit) + '。轮到 AI 了。');
      }
    } else {
      setMessage('这张牌不能出哦，请换一张。');
    }
  };

  // Player draws a card
  const drawCard = () => {
    if (gameState.currentTurn !== 'player' || gameState.status !== 'playing') return;

    if (gameState.deck.length === 0) {
      // Reshuffle discard pile into deck
      if (gameState.discardPile.length <= 1) {
        setMessage('摸牌堆和弃牌堆都空了，跳过你的回合。');
        setGameState(prev => ({ ...prev, currentTurn: 'ai' }));
        return;
      }

      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      const restOfDiscard = gameState.discardPile.slice(0, -1);
      const newDeck = shuffle(restOfDiscard);
      const drawnCard = newDeck.pop()!;

      setGameState(prev => ({
        ...prev,
        deck: newDeck,
        discardPile: [topCard],
        playerHand: [...prev.playerHand, drawnCard],
      }));
      setMessage('摸牌堆已重置，你摸了一张牌。');
      return;
    }

    const newDeck = [...gameState.deck];
    const drawnCard = newDeck.pop()!;
    
    setGameState(prev => ({
      ...prev,
      deck: newDeck,
      playerHand: [...prev.playerHand, drawnCard],
    }));
    setMessage('你摸了一张牌。');
  };

  // Select wild suit
  const selectWildSuit = (suit: Suit) => {
    setGameState(prev => ({
      ...prev,
      wildSuit: suit,
      status: 'playing',
      currentTurn: prev.currentTurn === 'player' ? 'ai' : 'player',
    }));
    setMessage(`花色已更改为 ${getSuitSymbol(suit)}。轮到 ${gameState.currentTurn === 'player' ? 'AI' : '你'} 了。`);
  };

  // AI Logic
  const executeAiTurn = useCallback(() => {
    if (gameState.status !== 'playing' || gameState.currentTurn !== 'ai') return;

    setIsAiThinking(true);
    
    aiTurnTimeoutRef.current = setTimeout(() => {
      const topCard = gameState.discardPile[gameState.discardPile.length - 1];
      const playableCards = gameState.aiHand.filter(c => canPlayCard(c, topCard, gameState.wildSuit));

      if (playableCards.length > 0) {
        // AI strategy: play non-8 cards first, then 8s
        const nonEightCards = playableCards.filter(c => c.rank !== Rank.EIGHT);
        const cardToPlay = nonEightCards.length > 0 
          ? nonEightCards[Math.floor(Math.random() * nonEightCards.length)]
          : playableCards[0];

        const newAiHand = gameState.aiHand.filter(c => c.id !== cardToPlay.id);
        const newDiscardPile = [...gameState.discardPile, cardToPlay];

        if (newAiHand.length === 0) {
          handleWin('ai');
          setIsAiThinking(false);
          return;
        }

        if (cardToPlay.rank === Rank.EIGHT) {
          // AI picks the suit it has the most of
          const suitCounts: Record<Suit, number> = {
            [Suit.HEARTS]: 0,
            [Suit.DIAMONDS]: 0,
            [Suit.CLUBS]: 0,
            [Suit.SPADES]: 0,
          };
          newAiHand.forEach(c => suitCounts[c.suit]++);
          const bestSuit = (Object.keys(suitCounts) as Suit[]).reduce((a, b) => suitCounts[a] > suitCounts[b] ? a : b);

          setGameState(prev => ({
            ...prev,
            aiHand: newAiHand,
            discardPile: newDiscardPile,
            wildSuit: bestSuit,
            currentTurn: 'player',
          }));
          setMessage(`AI 打出了 8，并将花色改为 ${getSuitSymbol(bestSuit)}。`);
        } else {
          setGameState(prev => ({
            ...prev,
            aiHand: newAiHand,
            discardPile: newDiscardPile,
            currentTurn: 'player',
            wildSuit: null,
          }));
          setMessage(`AI 打出了 ${cardToPlay.rank}${getSuitSymbol(cardToPlay.suit)}。轮到你了。`);
        }
      } else {
        // AI must draw
        if (gameState.deck.length === 0 && gameState.discardPile.length > 1) {
          // Reshuffle for AI
          const topCard = gameState.discardPile[gameState.discardPile.length - 1];
          const restOfDiscard = gameState.discardPile.slice(0, -1);
          const newDeck = shuffle(restOfDiscard);
          const drawnCard = newDeck.pop()!;
          
          setGameState(prev => ({
            ...prev,
            deck: newDeck,
            discardPile: [topCard],
            aiHand: [...prev.aiHand, drawnCard],
            currentTurn: 'player',
          }));
          setMessage('摸牌堆已重置，AI 摸了一张牌。');
        } else if (gameState.deck.length > 0) {
          const newDeck = [...gameState.deck];
          const drawnCard = newDeck.pop()!;
          
          // AI simple rule: if drawn card is playable (and not an 8 for simplicity), play it
          if (canPlayCard(drawnCard, topCard, gameState.wildSuit) && drawnCard.rank !== Rank.EIGHT) {
            setGameState(prev => ({
              ...prev,
              deck: newDeck,
              discardPile: [...prev.discardPile, drawnCard],
              currentTurn: 'player',
              wildSuit: null,
            }));
            setMessage(`AI 摸了一张牌并打出了 ${drawnCard.rank}${getSuitSymbol(drawnCard.suit)}。`);
          } else {
            setGameState(prev => ({
              ...prev,
              deck: newDeck,
              aiHand: [...prev.aiHand, drawnCard],
              currentTurn: 'player',
            }));
            setMessage('AI 没牌可出，摸了一张牌。');
          }
        } else {
          setMessage('摸牌堆已空，AI 跳过回合。');
          setGameState(prev => ({ ...prev, currentTurn: 'player' }));
        }
      }
      setIsAiThinking(false);
    }, 1500);
  }, [gameState]);

  useEffect(() => {
    if (gameState.currentTurn === 'ai' && gameState.status === 'playing') {
      executeAiTurn();
    }
    return () => {
      if (aiTurnTimeoutRef.current) clearTimeout(aiTurnTimeoutRef.current);
    };
  }, [gameState.currentTurn, gameState.status, executeAiTurn]);

  const handleWin = (winner: 'player' | 'ai') => {
    setGameState(prev => ({ ...prev, status: 'game_over', winner }));
    if (winner === 'player') {
      confetti({
        particleCount: 150,
        spread: 70,
        origin: { y: 0.6 }
      });
      setMessage('恭喜你赢了！');
    } else {
      setMessage('AI 赢了，再接再厉！');
    }
  };

  return (
    <div className="min-h-screen bg-[#1a472a] text-white font-sans selection:bg-emerald-500/30 overflow-hidden flex flex-col">
      {/* Header */}
      <header className="p-4 flex justify-between items-center bg-black/20 backdrop-blur-md border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-emerald-500 rounded-lg flex items-center justify-center shadow-lg shadow-emerald-500/20">
            <Layers className="text-white" size={24} />
          </div>
          <h1 className="text-xl font-bold tracking-tight">哈基疯狂 8 点</h1>
        </div>
        <div className="flex items-center gap-4">
          <button 
            onClick={initGame}
            className="flex items-center gap-2 px-4 py-2 bg-white/10 hover:bg-white/20 rounded-full transition-all text-sm font-medium border border-white/10"
          >
            <RotateCcw size={16} />
            {gameState.status === 'idle' ? '开始游戏' : '重新开始'}
          </button>
        </div>
      </header>

      {/* Main Game Area */}
      <main className="flex-1 relative flex flex-col items-center justify-between p-4 md:p-8 max-w-6xl mx-auto w-full">
        
        {/* AI Hand */}
        <div className="w-full flex flex-col items-center gap-2">
          <div className="flex items-center gap-2 text-white/60 text-sm mb-2">
            <Cpu size={16} />
            <span>AI 对手 ({gameState.aiHand.length} 张)</span>
            {isAiThinking && <motion.span animate={{ opacity: [0.4, 1, 0.4] }} transition={{ repeat: Infinity }}>思考中...</motion.span>}
          </div>
          <div className="flex justify-center -space-x-8 md:-space-x-12 h-32 md:h-40">
            {gameState.aiHand.map((card, index) => (
              <motion.div
                key={card.id}
                initial={{ y: -50, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ delay: index * 0.05 }}
                className="w-20 h-28 md:w-24 md:h-36 bg-emerald-800 rounded-lg border-2 border-white/20 shadow-xl flex items-center justify-center overflow-hidden relative"
              >
                <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-emerald-700 to-emerald-900 opacity-50" />
                <div className="w-12 h-12 md:w-16 md:h-16 border border-white/10 rounded-full flex items-center justify-center">
                   <Layers className="text-white/20" size={24} />
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Center Table */}
        <div className="flex flex-col md:flex-row items-center gap-8 md:gap-16 my-8">
          {/* Draw Pile */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">摸牌堆</span>
            <button
              onClick={drawCard}
              disabled={gameState.currentTurn !== 'player' || gameState.status !== 'playing'}
              className={`group relative w-24 h-36 md:w-28 md:h-40 rounded-xl border-2 border-white/20 bg-emerald-900 shadow-2xl transition-transform active:scale-95 ${gameState.currentTurn === 'player' && gameState.status === 'playing' ? 'cursor-pointer hover:-translate-y-1' : 'cursor-not-allowed opacity-80'}`}
            >
              <div className="absolute inset-2 border border-white/10 rounded-lg flex flex-col items-center justify-center gap-2">
                <Layers className="text-white/30 group-hover:text-white/50 transition-colors" size={32} />
                <span className="text-xl font-bold text-white/30 group-hover:text-white/50">{gameState.deck.length}</span>
              </div>
              {/* Stack effect */}
              <div className="absolute -bottom-1 -right-1 w-full h-full bg-emerald-950 rounded-xl -z-10 border border-white/5" />
              <div className="absolute -bottom-2 -right-2 w-full h-full bg-emerald-950 rounded-xl -z-20 border border-white/5 opacity-50" />
            </button>
          </div>

          {/* Discard Pile */}
          <div className="flex flex-col items-center gap-2">
            <span className="text-xs uppercase tracking-widest text-white/40 font-semibold">弃牌堆</span>
            <div className="relative w-24 h-36 md:w-28 md:h-40">
              <AnimatePresence mode="popLayout">
                {gameState.discardPile.length > 0 && (
                  <motion.div
                    key={gameState.discardPile[gameState.discardPile.length - 1].id}
                    initial={{ scale: 0.8, opacity: 0, rotate: -10, x: -50 }}
                    animate={{ scale: 1, opacity: 1, rotate: 0, x: 0 }}
                    exit={{ opacity: 0, scale: 0.5 }}
                    className={`absolute inset-0 bg-white rounded-xl shadow-2xl flex flex-col p-2 md:p-3 ${getSuitColor(gameState.discardPile[gameState.discardPile.length - 1].suit)}`}
                  >
                    <div className="flex justify-between items-start">
                      <span className="text-xl md:text-2xl font-bold leading-none">
                        {gameState.discardPile[gameState.discardPile.length - 1].rank}
                      </span>
                      <span className="text-lg md:text-xl">
                        {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                      </span>
                    </div>
                    <div className="flex-1 flex items-center justify-center text-4xl md:text-5xl">
                      {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                    </div>
                    <div className="flex justify-between items-end rotate-180">
                      <span className="text-xl md:text-2xl font-bold leading-none">
                        {gameState.discardPile[gameState.discardPile.length - 1].rank}
                      </span>
                      <span className="text-lg md:text-xl">
                        {getSuitSymbol(gameState.discardPile[gameState.discardPile.length - 1].suit)}
                      </span>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
              {/* Wild Suit Indicator */}
              {gameState.wildSuit && (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="absolute -top-10 left-1/2 -translate-x-1/2 bg-white/10 backdrop-blur-md px-3 py-1 rounded-full border border-white/20 flex items-center gap-2 whitespace-nowrap"
                >
                  <span className="text-xs text-white/60">指定花色:</span>
                  <span className={`text-lg font-bold ${getSuitColor(gameState.wildSuit)}`}>
                    {getSuitSymbol(gameState.wildSuit)}
                  </span>
                </motion.div>
              )}
            </div>
          </div>
        </div>

        {/* Player Hand */}
        <div className="w-full flex flex-col items-center gap-4">
          <div className="flex items-center gap-2 text-white/60 text-sm">
            <User size={16} />
            <span>你的手牌 ({gameState.playerHand.length} 张)</span>
          </div>
          <div className="flex justify-center flex-wrap gap-2 md:gap-4 max-w-full px-4 min-h-[140px] md:min-h-[180px]">
            {gameState.playerHand.map((card, index) => {
              const playable = gameState.currentTurn === 'player' && 
                               gameState.status === 'playing' && 
                               canPlayCard(card, gameState.discardPile[gameState.discardPile.length - 1], gameState.wildSuit);
              
              return (
                <motion.button
                  key={card.id}
                  layoutId={card.id}
                  onClick={() => playCard(card.id)}
                  whileHover={playable ? { y: -20, scale: 1.05 } : {}}
                  whileTap={playable ? { scale: 0.95 } : {}}
                  className={`w-20 h-28 md:w-24 md:h-36 bg-white rounded-lg shadow-xl flex flex-col p-2 md:p-3 transition-all relative ${getSuitColor(card.suit)} ${playable ? 'cursor-pointer ring-2 ring-emerald-400 ring-offset-2 ring-offset-[#1a472a]' : 'opacity-60 grayscale-[0.5] cursor-not-allowed'}`}
                >
                  <div className="flex justify-between items-start">
                    <span className="text-lg md:text-xl font-bold leading-none">{card.rank}</span>
                    <span className="text-sm md:text-base">{getSuitSymbol(card.suit)}</span>
                  </div>
                  <div className="flex-1 flex items-center justify-center text-3xl md:text-4xl">
                    {getSuitSymbol(card.suit)}
                  </div>
                  <div className="flex justify-between items-end rotate-180">
                    <span className="text-lg md:text-xl font-bold leading-none">{card.rank}</span>
                    <span className="text-sm md:text-base">{getSuitSymbol(card.suit)}</span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </main>

      {/* Status Bar */}
      <footer className="p-4 bg-black/40 backdrop-blur-xl border-t border-white/10 flex justify-center">
        <div className="flex items-center gap-3 text-sm md:text-base font-medium">
          <div className={`w-2 h-2 rounded-full animate-pulse ${gameState.currentTurn === 'player' ? 'bg-emerald-400' : 'bg-white/40'}`} />
          <p className="text-white/80">{message}</p>
        </div>
      </footer>

      {/* Modals & Overlays */}
      <AnimatePresence>
        {/* Start Screen */}
        {gameState.status === 'idle' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <div className="max-w-md w-full bg-emerald-900/50 border border-white/10 p-8 rounded-3xl shadow-2xl text-center">
              <div className="w-20 h-20 bg-emerald-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-emerald-500/20">
                <Layers className="text-white" size={40} />
              </div>
              <h2 className="text-3xl font-bold mb-4">哈基疯狂 8 点</h2>
              <p className="text-white/60 mb-8 leading-relaxed">
                经典纸牌游戏。打出相同花色或点数的牌。
                <br />
                <span className="text-emerald-400 font-bold">数字 8 是万能牌！</span>
              </p>
              <button 
                onClick={initGame}
                className="w-full py-4 bg-emerald-500 hover:bg-emerald-400 text-white rounded-2xl font-bold text-lg transition-all shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-2 group"
              >
                开始游戏
                <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
            </div>
          </motion.div>
        )}

        {/* Suit Selector */}
        {gameState.status === 'choosing_suit' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 p-8 rounded-3xl shadow-2xl max-w-sm w-full text-center"
            >
              <h3 className="text-xl font-bold mb-6">选择一个新花色</h3>
              <div className="grid grid-cols-2 gap-4">
                {Object.values(Suit).map((suit) => (
                  <button
                    key={suit}
                    onClick={() => selectWildSuit(suit)}
                    className="p-6 bg-white hover:bg-zinc-100 rounded-2xl border border-white/10 flex flex-col items-center gap-2 transition-all group shadow-lg"
                  >
                    <span className={`text-4xl ${getSuitColor(suit)} group-hover:scale-110 transition-transform`}>
                      {getSuitSymbol(suit)}
                    </span>
                    <span className="text-xs uppercase tracking-widest text-zinc-500 font-bold">
                      {suit === Suit.HEARTS ? '红心' : suit === Suit.DIAMONDS ? '方块' : suit === Suit.CLUBS ? '梅花' : '黑桃'}
                    </span>
                  </button>
                ))}
              </div>
            </motion.div>
          </motion.div>
        )}

        {/* Game Over */}
        {gameState.status === 'game_over' && (
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 bg-black/80 backdrop-blur-xl flex items-center justify-center p-6"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="bg-zinc-900 border border-white/10 p-10 rounded-3xl shadow-2xl max-w-md w-full text-center"
            >
              <div className={`w-24 h-24 rounded-full flex items-center justify-center mx-auto mb-6 ${gameState.winner === 'player' ? 'bg-yellow-500/20 text-yellow-500' : 'bg-red-500/20 text-red-500'}`}>
                {gameState.winner === 'player' ? <Trophy size={48} /> : <HandIcon size={48} />}
              </div>
              <h2 className="text-4xl font-black mb-2 italic tracking-tighter">
                {gameState.winner === 'player' ? '你赢了！' : 'AI 赢了'}
              </h2>
              <p className="text-white/40 mb-10">
                {gameState.winner === 'player' ? '精彩的对决，你展现了非凡的智慧！' : '别灰心，AI 这次运气好一点。'}
              </p>
              <button 
                onClick={initGame}
                className="w-full py-4 bg-white text-black hover:bg-zinc-200 rounded-2xl font-bold text-lg transition-all flex items-center justify-center gap-2"
              >
                <RotateCcw size={20} />
                再玩一局
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Instructions Tooltip (Optional) */}
      <div className="fixed bottom-20 right-6 group">
        <div className="absolute bottom-full right-0 mb-4 w-64 p-4 bg-zinc-900 border border-white/10 rounded-2xl shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none text-sm leading-relaxed">
          <h4 className="font-bold mb-2 flex items-center gap-2">
            <Info size={16} className="text-emerald-400" />
            游戏规则
          </h4>
          <ul className="space-y-2 text-white/60">
            <li>• 出牌需匹配弃牌堆的<span className="text-white">花色</span>或<span className="text-white">点数</span>。</li>
            <li>• <span className="text-emerald-400 font-bold">8 是万能牌</span>，可随时打出并更改花色。</li>
            <li>• 无牌可出时必须<span className="text-white">摸一张牌</span>。</li>
            <li>• 最先清空手牌的一方获胜。</li>
          </ul>
        </div>
        <button className="w-12 h-12 bg-white/10 backdrop-blur-md border border-white/10 rounded-full flex items-center justify-center hover:bg-white/20 transition-all shadow-lg">
          <Info size={24} />
        </button>
      </div>
    </div>
  );
}
