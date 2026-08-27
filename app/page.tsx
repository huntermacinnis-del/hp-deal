"use client";
import React, { useEffect, useState } from 'react';
import { supabase } from './supabase';

const ROOM_ID = 'main-room';

function getAccurateCardEffect(name: string, originalEffect?: string) {
  const n = (name || "").toLowerCase();
  if (n.includes("accio")) return "Collect points from players for this color set.";
  if (n.includes("geminio")) return "Draw 2 extra cards from the deck.";
  if (n.includes("alohomora")) return "Collect 2 points from each opponent.";
  if (n.includes("stupefy")) return "Collect 5 points from target opponent.";
  if (n.includes("reparo")) return "Recover any card from the discard pile.";
  if (n.includes("levicorpus")) return "Steal a non-complete item from an opponent.";
  if (n.includes("obliviate")) return "Steal a complete item set from an opponent.";
  if (n.includes("wingardium leviosa")) return "Send an opponent item to the discard pile.";
  if (n.includes("petrificus totalus")) return "Freeze opponent's character ability.";
  if (n.includes("protego")) return "Block an action spell cast against you.";
  if (n.includes("confundo") || n.includes("confundus")) return "Swap one of your items with an opponent's.";
  return originalEffect || "Cast spell effect.";
}

export default function GameBoard() {
  const [allPlayableCards, setAllPlayableCards] = useState<any[]>([]);
  const [allCharacters, setAllCharacters] = useState<any[]>([]);
  
  // Persistent Roles & Score
  const [isGameStarted, setIsGameStarted] = useState<boolean>(false);
  const [myRole, setMyRole] = useState<'player1' | 'player2'>('player1');
  const [hunterWins, setHunterWins] = useState<number>(0);
  const [jessWins, setJessWins] = useState<number>(0);

  // Networked Game State
  const [drawPile, setDrawPile] = useState<any[]>([]);
  const [discardPile, setDiscardPile] = useState<any[]>([]);
  const [activeTurn, setActiveTurn] = useState<'player1' | 'player2'>('player1');
  const [turnPhase, setTurnPhase] = useState<'draw' | 'play'>('draw');
  const [playsRemaining, setPlaysRemaining] = useState<number>(3);
  const [winner, setWinner] = useState<string | null>(null);
  const [winRecorded, setWinRecorded] = useState<boolean>(false);
  const [gameLog, setGameLog] = useState<string[]>(["Welcome to Harry Potter Monopoly Deal!"]);
  
  const [p1Hand, setP1Hand] = useState<any[]>([]);
  const [p1Bank, setP1Bank] = useState<any[]>([]);
  const [p1Properties, setP1Properties] = useState<any[]>([]);
  const [p1Character, setP1Character] = useState<any | null>(null);
  const [p1Frozen, setP1Frozen] = useState<boolean>(false);

  const [p2Hand, setP2Hand] = useState<any[]>([]);
  const [p2Bank, setP2Bank] = useState<any[]>([]);
  const [p2Properties, setP2Properties] = useState<any[]>([]);
  const [p2Character, setP2Character] = useState<any | null>(null);
  const [p2Frozen, setP2Frozen] = useState<boolean>(false);

  const [wildCardColors, setWildCardColors] = useState<{ [id: string]: string }>({});
  const [wildCardRotations, setWildCardRotations] = useState<{ [id: string]: boolean }>({});
  const [harryProtectedColor, setHarryProtectedColor] = useState<string | null>(null);
  
  const [pendingAttack, setPendingAttack] = useState<any | null>(null);

  const [tableActions, setTableActions] = useState<any[]>([]);
  const [draggedCardIndex, setDraggedCardIndex] = useState<number | null>(null);
  const [selectedActionCard, setSelectedActionCard] = useState<any | null>(null);
  const [isMyBankOpen, setIsMyBankOpen] = useState<boolean>(false); 
  const [isPaymentVaultOpen, setIsPaymentVaultOpen] = useState<boolean>(false); 
  const [playerPaymentPrompt, setPlayerPaymentPrompt] = useState<{ amount: number; reason: string } | null>(null);
  const [rentSelectionModal, setRentSelectionModal] = useState<{ validColors: string[]; actionCard: any } | null>(null);
  
  const [playerDefenseWindow, setPlayerDefenseWindow] = useState<{ 
    attackName: string; 
    attackDescription: string;
    timeLeft: number; 
    onAccept: () => void;
    onCounterProtego: () => void;
  } | null>(null);

  const [isUnfreezeModalOpen, setIsUnfreezeModalOpen] = useState<boolean>(false);
  const [unfreezeSelectedIds, setUnfreezeSelectedIds] = useState<string[]>([]);
  const [isDiscardModalOpen, setIsDiscardModalOpen] = useState<boolean>(false);
  const [targetSelectionModal, setTargetSelectionModal] = useState<{ type: 'levicorpus' | 'wingardium' | 'obliviate'; actionCard: any, cards: any[] } | null>(null);
  const [confundoModal, setConfundoModal] = useState<{ step: 'my'; actionCard: any; chosenMyCard: any | null } | null>(null);
  const [wildcardSelectionModal, setWildcardSelectionModal] = useState<any | null>(null);
  const [tableWildcardEditModal, setTableWildcardEditModal] = useState<any | null>(null);
  const [reparoModal, setReparoModal] = useState<any | null>(null);
  const [cedricChoiceModal, setCedricChoiceModal] = useState<boolean>(false);
  const [isDiscardingExcess, setIsDiscardingExcess] = useState<boolean>(false);
  const [spellAnimation, setSpellAnimation] = useState<{name: string, player: string} | null>(null);

  // Derived state helpers for seamless typing
  const isMyTurn = activeTurn === myRole;
  const myName = myRole === 'player1' ? "Hunter" : "Jess";
  const opponentName = myRole === 'player1' ? "Jess" : "Hunter";

  const myHand = myRole === 'player1' ? p1Hand : p2Hand;
  const myBank = myRole === 'player1' ? p1Bank : p2Bank;
  const myProperties = myRole === 'player1' ? p1Properties : p2Properties;
  const myCharacter = myRole === 'player1' ? p1Character : p2Character;
  const isMyCharacterFrozen = myRole === 'player1' ? p1Frozen : p2Frozen;

  const opponentHand = myRole === 'player1' ? p2Hand : p1Hand;
  const opponentBank = myRole === 'player1' ? p2Bank : p1Bank;
  const opponentProperties = myRole === 'player1' ? p2Properties : p1Properties;
  const opponentCharacter = myRole === 'player1' ? p2Character : p1Character;
  const isOpponentFrozen = myRole === 'player1' ? p2Frozen : p1Frozen;
  const frozenCharacters = [isMyCharacterFrozen ? myCharacter : null, isOpponentFrozen ? opponentCharacter : null].filter(Boolean);

  // Bulletproof Wrapper Setters for TypeScript
  const setMyHand = (updater: any) => {
    const val = typeof updater === 'function' ? updater(myHand) : updater;
    if (myRole === 'player1') setP1Hand(val);
    else setP2Hand(val);
  };
  const setMyBank = (updater: any) => {
    const val = typeof updater === 'function' ? updater(myBank) : updater;
    if (myRole === 'player1') setP1Bank(val);
    else setP2Bank(val);
  };
  const setMyProperties = (updater: any) => {
    const val = typeof updater === 'function' ? updater(myProperties) : updater;
    if (myRole === 'player1') setP1Properties(val);
    else setP2Properties(val);
  };
  const setOpponentProperties = (updater: any) => {
    const val = typeof updater === 'function' ? updater(opponentProperties) : updater;
    if (myRole === 'player1') setP2Properties(val);
    else setP1Properties(val);
  };
  const setOpponentBank = (updater: any) => {
    const val = typeof updater === 'function' ? updater(opponentBank) : updater;
    if (myRole === 'player1') setP2Bank(val);
    else setP1Bank(val);
  };
  const setFrozenCharacters = (updater: any) => {
    const val = typeof updater === 'function' ? updater(isMyCharacterFrozen) : updater;
    if (myRole === 'player1') setP1Frozen(!!val);
    else setP2Frozen(!!val);
  };
  const toggleWildcardColor = (card: any) => {
    const current = getCardColor(card);
    const colors = card.colorSet ? card.colorSet.split("/") : [];
    if (colors.length < 2) return;
    const nextColor = colors[0] === current ? colors[1] : colors[0];
    setWildCardColors(prev => ({ ...prev, [card.runtimeId]: nextColor }));
  };

  // Load Initial Deck
  useEffect(() => {
    async function loadDeck() {
      const { data } = await supabase.from('deck').select('*');
      if (data) {
        const normalizedData = data.map((card: any, idx: number) => ({
          ...card,
          runtimeId: `${card.id}-${idx}-${Math.random().toString(36).substring(2, 9)}`,
          effect: getAccurateCardEffect(card.name, card.effect)
        }));
        setAllCharacters(normalizedData.filter((card: any) => card.type === 'character'));
        setAllPlayableCards(normalizedData.filter((card: any) => card.type !== 'character'));
      }
    }
    loadDeck();
  }, []);

  // Supabase Real-time Sync
  useEffect(() => {
    async function fetchRoom() {
      const { data } = await supabase.from('game_rooms').select('*').eq('id', ROOM_ID).single();
      if (data) applyRemoteState(data);
    }
    fetchRoom();

    const channel = supabase
      .channel('realtime_game_room')
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_rooms' }, (payload: any) => {
        applyRemoteState(payload.new);
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  const applyRemoteState = (data: any) => {
    if (data.player1_state) {
      setP1Hand(data.player1_state.hand || []);
      setP1Bank(data.player1_state.bank || []);
      setP1Properties(data.player1_state.properties || []);
      setP1Character(data.player1_state.character || null);
      setP1Frozen(!!data.player1_state.isFrozen);
    }
    if (data.player2_state) {
      setP2Hand(data.player2_state.hand || []);
      setP2Bank(data.player2_state.bank || []);
      setP2Properties(data.player2_state.properties || []);
      setP2Character(data.player2_state.character || null);
      setP2Frozen(!!data.player2_state.isFrozen);
    }
    if (data.board_state) {
      setDrawPile(data.board_state.drawPile || []);
      setDiscardPile(data.board_state.discardPile || []);
      setActiveTurn(data.board_state.activeTurn || 'player1');
      setTurnPhase(data.board_state.turnPhase || 'draw');
      setPlaysRemaining(data.board_state.playsRemaining ?? 3);
      setWinner(data.board_state.winner || null);
      setWinRecorded(data.board_state.winRecorded || false);
      setGameLog(data.board_state.gameLog || ["Welcome to Harry Potter Monopoly Deal!"]);
      setHarryProtectedColor(data.board_state.harryProtectedColor || null);
      setWildCardColors(data.board_state.wildCardColors || {});
      setPendingAttack(data.board_state.pendingAttack || null);
      
      if (data.board_state.hunterWins !== undefined) setHunterWins(data.board_state.hunterWins);
      if (data.board_state.jessWins !== undefined) setJessWins(data.board_state.jessWins);
      if (data.board_state.isGameStarted) setIsGameStarted(true);

      if (data.board_state.lastSpellCast && data.board_state.lastSpellCastId !== spellAnimation?.name) {
          triggerSpellAnimation(data.board_state.lastSpellCast.name, data.board_state.lastSpellCast.player);
      }
    }
  };

  const syncGameState = async (updates: any) => {
    await supabase.from('game_rooms').update(updates).eq('id', ROOM_ID);
  };

  const myAvatar = myRole === 'player1' ? '/hunter.jpg' : '/jess.jpg';
  const myFallbackAvatar = myRole === 'player1' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hunter' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jess';
  const oppAvatar = myRole === 'player1' ? '/jess.jpg' : '/hunter.jpg';
  const oppFallbackAvatar = myRole === 'player1' ? 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jess' : 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hunter';

  const shuffleArray = (array: any[]) => {
    const newArray = [...array];
    for (let i = newArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [newArray[i], newArray[j]] = [newArray[j], newArray[i]];
    }
    return newArray;
  };

  const handleHostStartGame = async () => {
    if (allPlayableCards.length === 0 || allCharacters.length === 0) return;

    const shuffledChars = shuffleArray(allCharacters);
    const p1Char = shuffledChars[0];
    const p2Char = shuffledChars[1] || shuffledChars[0];

    const shuffledDeck = shuffleArray(allPlayableCards);
    const p1StartingHand = shuffledDeck.slice(0, 5);
    const p2StartingHand = shuffledDeck.slice(5, 10);
    const remainingDeck = shuffledDeck.slice(10);

    const initialP1 = { hand: p1StartingHand, bank: [], properties: [], character: p1Char, isFrozen: false };
    const initialP2 = { hand: p2StartingHand, bank: [], properties: [], character: p2Char, isFrozen: false };

    const initialBoard = {
      drawPile: remainingDeck,
      discardPile: [],
      activeTurn: 'player1',
      turnPhase: 'draw',
      playsRemaining: p1Char.name === 'Hermione Granger' ? 4 : 3,
      winner: null,
      winRecorded: false,
      harryProtectedColor: null,
      wildCardColors: {},
      pendingAttack: null,
      hunterWins: hunterWins,
      jessWins: jessWins,
      gameLog: [`Game started! Hunter (${p1Char.name}) vs Jess (${p2Char.name}).`],
      isGameStarted: true
    };

    setIsGameStarted(true);
    await syncGameState({ player1_state: initialP1, player2_state: initialP2, board_state: initialBoard });
  };

  const getCardColor = (card: any) => {
    if (card.type === 'wildcard') {
      return wildCardColors[card.runtimeId] || (card.colorSet?.includes('/') ? card.colorSet.split('/')[0] : card.colorSet);
    }
    return card.colorSet;
  };

  const getSetMax = (color: string) => {
    const setCounts: { [key: string]: number } = {
      "Brown": 2, "Dark Blue": 2, "Light Green": 2, "Pink": 3, 
      "Orange": 3, "Yellow": 3, "Red": 3, "Light Blue": 3, 
      "Dark Green": 3, "Black": 4
    };
    return setCounts[color] || 3;
  };

  const isCompleteSet = (color: string, properties: any[]) => {
    const required = getSetMax(color);
    const cardsInSet = properties.filter((c: any) => getCardColor(c) === color);
    if (cardsInSet.length < required) return false;
    const allAny = cardsInSet.every((c: any) => c.type === 'wildcard' && (c.colorSet?.includes("Any") || c.name.toLowerCase().includes("wild any")));
    return !allAny;
  };

  const isSetFull = (color: string, properties: any[]) => {
    const count = properties.filter((c: any) => getCardColor(c) === color).length;
    return count >= getSetMax(color);
  };

  const countCompleteSets = (properties: any[]) => {
    const allColors = ["Brown", "Dark Blue", "Light Green", "Pink", "Orange", "Yellow", "Red", "Light Blue", "Dark Green", "Black"];
    return allColors.filter(col => isCompleteSet(col, properties)).length;
  };

  useEffect(() => {
    const checkVictory = async () => {
        if (countCompleteSets(myProperties) >= 3 && !winRecorded && isMyTurn) {
            setWinner(myName);
            const newHunterWins = myRole === 'player1' ? hunterWins + 1 : hunterWins;
            const newJessWins = myRole === 'player2' ? jessWins + 1 : jessWins;
            
            await syncGameState({
                board_state: {
                    drawPile, discardPile, activeTurn, turnPhase, playsRemaining, harryProtectedColor, wildCardColors,
                    winner: myName,
                    winRecorded: true,
                    hunterWins: newHunterWins,
                    jessWins: newJessWins,
                    gameLog: [`🏆 VICTORY! ${myName} completed 3 sets and won the game!`, ...gameLog],
                    isGameStarted: true
                }
            });
        }
    };
    checkVictory();
  }, [myProperties]);

  const triggerSpellAnimation = (spellName: string, casterName: string) => {
    setSpellAnimation({ name: spellName, player: casterName });
    setTimeout(() => setSpellAnimation(null), 1800);
  };

  const addLogAndSync = async (message: string, extraBoardUpdates = {}, extraMyStateUpdates = {}, extraOppStateUpdates = {}) => {
    const newLog = [message, ...gameLog];
    setGameLog(newLog);
    
    await syncGameState({
      board_state: { drawPile, discardPile, activeTurn, turnPhase, playsRemaining, winner, winRecorded, harryProtectedColor, wildCardColors, hunterWins, jessWins, isGameStarted, pendingAttack, gameLog: newLog, ...extraBoardUpdates },
      ...(Object.keys(extraMyStateUpdates).length > 0 ? { [myRole === 'player1' ? 'player1_state' : 'player2_state']: extraMyStateUpdates } : {}),
      ...(Object.keys(extraOppStateUpdates).length > 0 ? { [myRole === 'player1' ? 'player2_state' : 'player1_state']: extraOppStateUpdates } : {})
    });
  };

  const startTurnDraw = async () => {
    if (!isMyTurn || turnPhase !== 'draw') return;

    if (!isMyCharacterFrozen && myCharacter?.name === "Cedric Diggory" && discardPile.length >= 2) {
      setCedricChoiceModal(true);
      return;
    }

    await executeNormalDraw();
  };

  const executeNormalDraw = async () => {
    let drawCount = 2;
    if (myHand.length === 0) drawCount = 5;
    else if (!isMyCharacterFrozen && myCharacter?.name === "Luna Lovegood") drawCount = 3;

    let currentDeck = [...drawPile];
    let currentDiscard = [...discardPile];

    if (currentDeck.length < drawCount) {
      const shuffled = shuffleArray(currentDiscard);
      currentDeck = [...currentDeck, ...shuffled];
      currentDiscard = [];
    }

    const actualCount = Math.min(drawCount, currentDeck.length);
    const drawn = currentDeck.splice(0, actualCount);
    const newHand = [...myHand, ...drawn];
    const plays = (!isMyCharacterFrozen && myCharacter?.name === "Hermione Granger") ? 4 : 3;

    setMyHand(newHand);
    setDrawPile(currentDeck);
    setDiscardPile(currentDiscard);
    setTurnPhase('play');
    setPlaysRemaining(plays);

    await addLogAndSync(
        `${myName} drew ${actualCount} cards.`, 
        { drawPile: currentDeck, discardPile: currentDiscard, turnPhase: 'play', playsRemaining: plays }, 
        { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen }
    );
  };

  const executeCedricDrawFromDiscard = async () => {
    setCedricChoiceModal(false);
    const card1 = discardPile[0];
    const card2 = discardPile[1];
    const remainingDiscard = discardPile.slice(2);
    const newHand = [...myHand, card1, card2];
    const plays = (!isMyCharacterFrozen && myCharacter?.name === "Hermione Granger") ? 4 : 3;

    setDiscardPile(remainingDiscard);
    setMyHand(newHand);
    setTurnPhase('play');
    setPlaysRemaining(plays);

    await addLogAndSync(
        `Cedric Diggory ability: ${myName} drew 2 cards from the discard pile.`, 
        { discardPile: remainingDiscard, turnPhase: 'play', playsRemaining: plays }, 
        { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen }
    );
  };

  const handleEndTurn = async () => {
    if (!isMyTurn || turnPhase !== 'play') return;
    if (myHand.length > 7) {
      setIsDiscardingExcess(true);
      return;
    }

    const nextRole = myRole === 'player1' ? 'player2' : 'player1';
    setTurnPhase('draw');
    setPlaysRemaining(0);

    await addLogAndSync(
        `${myName} ended their turn.`, 
        { activeTurn: nextRole, turnPhase: 'draw', playsRemaining: 3 }
    );
  };

  useEffect(() => {
     if (pendingAttack && pendingAttack.target === myRole) {
         const { actionCard, description, type, amount, reason } = pendingAttack;
         
         const hasProtegoInHand = myHand.some((c: any) => c.name.toLowerCase().includes("protego"));
         const hasProtegoOnTable = tableActions.some((c: any) => c.name.toLowerCase().includes("protego"));
         const hasProtego = hasProtegoInHand || hasProtegoOnTable;

         setPlayerDefenseWindow({
             attackName: `${opponentName} played ${actionCard.name}!`,
             attackDescription: description,
             timeLeft: 15,
             onAccept: async () => {
                 setPlayerDefenseWindow(null);
                 if (type === 'payment') {
                     setPlayerPaymentPrompt({ amount, reason });
                     await syncGameState({ board_state: { drawPile, discardPile, activeTurn, turnPhase, playsRemaining, winner, winRecorded, harryProtectedColor, wildCardColors, hunterWins, jessWins, isGameStarted, pendingAttack: null, gameLog } });
                 } else if (type === 'steal_card' || type === 'discard_card') {
                     const targetCard = pendingAttack.targetCard;
                     const newMyProps = myProperties.filter((c: any) => c.runtimeId !== targetCard.runtimeId);
                     let extraBoard: any = { pendingAttack: null };
                     let extraOpp: any = {};
                     if (type === 'steal_card') {
                         extraOpp = { properties: [...opponentProperties, targetCard], hand: opponentHand, bank: opponentBank, character: opponentCharacter, isFrozen: isOpponentFrozen };
                     } else {
                         extraBoard = { ...extraBoard, discardPile: [targetCard, ...discardPile] };
                     }
                     await addLogAndSync(`The attack succeeded on ${targetCard.name}.`, extraBoard, { properties: newMyProps, hand: myHand, bank: myBank, character: myCharacter, isFrozen: isMyCharacterFrozen }, extraOpp);
                 } else if (type === 'steal_set') {
                     const tCol = pendingAttack.targetColor;
                     const cardsToSteal = myProperties.filter((c: any) => getCardColor(c) === tCol);
                     const newMyProps = myProperties.filter((c: any) => getCardColor(c) !== tCol);
                     await addLogAndSync(`The attack succeeded! ${opponentName} stole your ${tCol} set.`, { pendingAttack: null }, { properties: newMyProps, hand: myHand, bank: myBank, character: myCharacter, isFrozen: isMyCharacterFrozen }, { properties: [...opponentProperties, ...cardsToSteal], hand: opponentHand, bank: opponentBank, character: opponentCharacter, isFrozen: isOpponentFrozen });
                 } else if (type === 'freeze') {
                     await addLogAndSync(`The curse hit! ${myName} is frozen.`, { pendingAttack: null }, { isFrozen: true, properties: myProperties, hand: myHand, bank: myBank, character: myCharacter }, {});
                 }
             },
             onCounterProtego: async () => {
                 if (!hasProtego) {
                     alert("You do not have a Protego card!");
                     return;
                 }
                 const protegoCard = myHand.find((c: any) => c.name.toLowerCase().includes("protego")) || tableActions.find((c: any) => c.name.toLowerCase().includes("protego"));
                 const newHand = myHand.filter((c: any) => c.runtimeId !== protegoCard.runtimeId);
                 
                 setPlayerDefenseWindow(null);
                 triggerSpellAnimation("PROTEGO", myName);
                 await addLogAndSync(
                     `🛡️ ${myName} blocked the attack with Protego!`, 
                     { discardPile: [protegoCard, actionCard, ...discardPile], pendingAttack: null },
                     { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen }
                 );
             }
         });
     }
  }, [pendingAttack]);

  const triggerNetworkAttack = async (attackCard: any, description: string, attackData: any) => {
      triggerSpellAnimation(attackCard.name.toUpperCase(), myName);
      const attackPayload = {
          ...attackData,
          actionCard: attackCard,
          description,
          attacker: myRole,
          target: myRole === 'player1' ? 'player2' : 'player1'
      };
      
      const newDiscard = [attackCard, ...discardPile];
      setDiscardPile(newDiscard);
      setPendingAttack(attackPayload);
      
      await addLogAndSync(
          `${myName} cast ${attackCard.name}!`,
          { discardPile: newDiscard, pendingAttack: attackPayload, lastSpellCast: { name: attackCard.name.toUpperCase(), player: myName, id: Math.random() } }
      );
  };

  const resolveActionChoice = async (choice: 'bank' | 'action') => {
    if (!selectedActionCard) return;

    const cardInHand = myHand.find((c: any) => c.runtimeId === selectedActionCard.runtimeId);
    let newHand = [...myHand];
    let newTableActions = [...tableActions];

    if (cardInHand) newHand = newHand.filter((c: any) => c.runtimeId !== selectedActionCard.runtimeId);
    else newTableActions = newTableActions.filter((c: any) => c.runtimeId !== selectedActionCard.runtimeId);
    
    const newPlays = playsRemaining - 1;
    setMyHand(newHand);
    setTableActions(newTableActions);
    setPlaysRemaining(newPlays);

    if (choice === 'bank') {
      const newBank = [...myBank, selectedActionCard];
      setMyBank(newBank);
      setSelectedActionCard(null);
      await addLogAndSync(`Added an action card to Bank.`, { playsRemaining: newPlays }, { hand: newHand, bank: newBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
    } else {
      const actionCard = selectedActionCard;
      setSelectedActionCard(null);
      const actionName = (actionCard.name || "").toLowerCase();

      triggerSpellAnimation(actionCard.name.toUpperCase(), myName);

      if (actionName.includes("accio") || actionName.includes("rent")) {
        let targetColors: string[] = [];
        if (actionCard.colorSet && actionCard.colorSet.includes("/")) {
          targetColors = actionCard.colorSet.split("/");
        } else if (actionName.includes("wild any color") || actionName.includes("wild rent") || actionCard.colorSet?.includes("Any")) {
          const ownedColors = new Set<string>();
          myProperties.forEach((c: any) => ownedColors.add(getCardColor(c)));
          targetColors = Array.from(ownedColors);
        } else {
          targetColors = [actionCard.colorSet];
        }

        const validColors = targetColors.filter(col => {
          const count = myProperties.filter((c: any) => getCardColor(c) === col).length;
          return count > 0;
        });

        if (validColors.length === 0) {
          alert("You don't own any items in those colors to collect points for!");
          await addLogAndSync(`Played ${actionCard.name}, but you don't own items in those colors.`, { playsRemaining: newPlays, discardPile: [actionCard, ...discardPile] }, { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
        } else if (validColors.length === 1) {
          const ptsAmt = calculatePointsForColor(validColors[0]);
          await triggerNetworkAttack(actionCard, `Charging ${ptsAmt} points for their ${validColors[0]} set!`, { type: 'payment', amount: ptsAmt, reason: `Points for ${validColors[0]} Set` });
        } else {
          setRentSelectionModal({ validColors, actionCard });
        }
      } 
      else if (actionName.includes("alohomora")) {
        await triggerNetworkAttack(actionCard, "Demanding 2 points from you!", { type: 'payment', amount: 2, reason: "Alohomora Spell Fee" });
      }
      else if (actionName.includes("confundo") || actionName.includes("confundus")) {
        setConfundoModal({ step: 'my', actionCard: actionCard, chosenMyCard: null });
      }
      else if (actionName.includes("geminio")) {
        let currentDeck = [...drawPile];
        let currentDiscard = [...discardPile];
        if (currentDeck.length < 2) {
          const shuffled = shuffleArray(currentDiscard);
          currentDeck = [...currentDeck, ...shuffled];
          currentDiscard = [];
        }
        const actualDraw = Math.min(2, currentDeck.length);
        const drawn = currentDeck.splice(0, actualDraw);
        const finalHand = [...newHand, ...drawn];
        
        await addLogAndSync(`Cast Geminio: drew ${actualDraw} extra cards!`, { drawPile: currentDeck, discardPile: currentDiscard, playsRemaining: newPlays, lastSpellCast: { name: "GEMINIO", player: myName, id: Math.random() } }, { hand: finalHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
      } 
      else if (actionName.includes("levicorpus")) {
        const isDraco = myCharacter?.name === "Draco Malfoy" && !isMyCharacterFrozen;
        const eligibleCards = opponentProperties.filter((c: any) => {
           const col = getCardColor(c);
           if (col === harryProtectedColor) return false;
           if (!isDraco && isCompleteSet(col, opponentProperties)) return false;
           return true;
        });
        if (eligibleCards.length === 0) alert("Opponent has no eligible items to steal!");
        else setTargetSelectionModal({ type: 'levicorpus', actionCard, cards: eligibleCards });
      }
      else if (actionName.includes("obliviate")) {
        const completeColors = ["Brown", "Dark Blue", "Light Green", "Pink", "Orange", "Yellow", "Red", "Light Blue", "Dark Green", "Black"]
            .filter(col => isCompleteSet(col, opponentProperties) && col !== harryProtectedColor);
        if (completeColors.length === 0) alert("Opponent has no unprotected complete sets to steal!");
        else {
            const setRepresentations = completeColors.map(col => opponentProperties.find((c: any) => getCardColor(c) === col));
            setTargetSelectionModal({ type: 'obliviate', actionCard, cards: setRepresentations });
        }
      }
      else if (actionName.includes("petrificus totalus")) {
        await triggerNetworkAttack(actionCard, "Trying to freeze your character!", { type: 'freeze' });
      } 
      else if (actionName.includes("reparo")) {
        setReparoModal(actionCard);
      }
      else if (actionName.includes("stupefy")) {
        await triggerNetworkAttack(actionCard, "Demanding 5 points from you!", { type: 'payment', amount: 5, reason: "Stupefy Spell Fee" });
      } 
      else if (actionName.includes("wingardium leviosa")) {
        const isDraco = myCharacter?.name === "Draco Malfoy" && !isMyCharacterFrozen;
        const eligibleCards = opponentProperties.filter((c: any) => {
           const col = getCardColor(c);
           if (col === harryProtectedColor) return false;
           if (!isDraco && isCompleteSet(col, opponentProperties)) return false;
           return true;
        });
        if (eligibleCards.length === 0) alert("Opponent has no eligible items to discard!");
        else setTargetSelectionModal({ type: 'wingardium', actionCard, cards: eligibleCards });
      }
    }
  };

  const handleTargetSelection = async (targetCard: any) => {
    if (!targetSelectionModal) return;
    const { type, actionCard } = targetSelectionModal;
    setTargetSelectionModal(null);

    const targetColor = getCardColor(targetCard);
    
    if (type === 'obliviate') {
        await triggerNetworkAttack(actionCard, `Trying to steal your ${targetColor} set!`, { type: 'steal_set', targetColor: targetColor });
    } else if (type === 'levicorpus') {
        await triggerNetworkAttack(actionCard, `Trying to steal your ${targetCard.name}!`, { type: 'steal_card', targetCard: targetCard });
    } else if (type === 'wingardium') {
        await triggerNetworkAttack(actionCard, `Trying to discard your ${targetCard.name}!`, { type: 'discard_card', targetCard: targetCard });
    }
  };

  const handleConfundoSelectOpponentCard = async (opponentCard: any) => {
    if (!confundoModal || !confundoModal.chosenMyCard) return;
    const myCard = confundoModal.chosenMyCard;
    const actionCard = confundoModal.actionCard;
    setConfundoModal(null);

    triggerSpellAnimation("CONFUNDO", myName);
    
    const newMyProps = [...myProperties.filter((c: any) => c.runtimeId !== myCard.runtimeId), opponentCard];
    const newOppProps = [...opponentProperties.filter((c: any) => c.runtimeId !== opponentCard.runtimeId), myCard];
    
    await addLogAndSync(
        `Confundo successful!`, 
        { discardPile: [actionCard, ...discardPile], lastSpellCast: { name: "CONFUNDO", player: myName, id: Math.random() } }, 
        { properties: newMyProps, hand: myHand, bank: myBank, character: myCharacter, isFrozen: isMyCharacterFrozen },
        { properties: newOppProps, hand: opponentHand, bank: opponentBank, character: opponentCharacter, isFrozen: isOpponentFrozen }
    );
  };

  const handleReparoSelection = async (card: any) => {
    if (!reparoModal) return;
    const actionCard = reparoModal;
    setReparoModal(null);

    const newDiscard = discardPile.filter((c: any) => c.runtimeId !== card.runtimeId);
    newDiscard.unshift(actionCard); 
    
    let newHand = myHand;
    let newProps = myProperties;
    let newBank = myBank;
    let newTableActions = tableActions;

    if (card.type === 'property') newProps = [...myProperties, card];
    else if (card.type === 'wildcard') { setWildcardSelectionModal(card); return; }
    else if (card.type === 'money') newBank = [...myBank, card];
    else if (card.type === 'action') newTableActions = [...tableActions, card]; 
    else newHand = [...myHand, card];

    setTableActions(newTableActions);

    await addLogAndSync(
        `${myName} cast Reparo and recovered ${card.name}!`, 
        { discardPile: newDiscard }, 
        { hand: newHand, properties: newProps, bank: newBank, character: myCharacter, isFrozen: isMyCharacterFrozen }
    );
  };

  const handleColorSelectionForRent = async (chosenColor: string) => {
    if (!rentSelectionModal) return;
    const { actionCard } = rentSelectionModal;
    setRentSelectionModal(null);
    const ptsAmt = calculatePointsForColor(chosenColor);
    await triggerNetworkAttack(actionCard, `Charging ${ptsAmt} points for their ${chosenColor} set!`, { type: 'payment', amount: ptsAmt, reason: `Points for ${chosenColor} Set` });
  };

  const handleCardClick = async (card: any) => {
    if (!isMyTurn || turnPhase !== 'play' || playsRemaining <= 0) return;

    if (isDiscardingExcess) {
      const newHand = myHand.filter((c: any) => c.runtimeId !== card.runtimeId);
      const newDiscard = [card, ...discardPile];
      
      if (newHand.length <= 7) {
        setIsDiscardingExcess(false);
        const nextRole = myRole === 'player1' ? 'player2' : 'player1';
        setTurnPhase('draw');
        setPlaysRemaining(0);
        await addLogAndSync(`${myName} discarded excess cards and ended turn.`, { discardPile: newDiscard, activeTurn: nextRole, turnPhase: 'draw', playsRemaining: 3 }, { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
      } else {
        setMyHand(newHand);
        setDiscardPile(newDiscard);
        await addLogAndSync(`Discarded excess card.`, { discardPile: newDiscard }, { hand: newHand, bank: myBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
      }
      return;
    }

    const newHand = myHand.filter((c: any) => c.runtimeId !== card.runtimeId);
    const newPlays = playsRemaining - 1;

    if (card.type === 'property') {
      const newProps = [...myProperties, card];
      await addLogAndSync(`Played item: ${card.name}`, { playsRemaining: newPlays, winner: countCompleteSets(newProps) >= 3 ? myName : winner }, { hand: newHand, properties: newProps, bank: myBank, character: myCharacter, isFrozen: isMyCharacterFrozen });
    } else if (card.type === 'wildcard') {
      const isAny = card.colorSet?.includes("Any") || card.name.toLowerCase().includes("wild any");
      if (isAny && myProperties.length === 0) {
        alert("You cannot play an 'Every-Color Wild' card by itself. You must have at least one other item on the table first.");
        return; 
      }
      setMyHand(newHand);
      setWildcardSelectionModal(card);
    } else if (card.type === 'money') {
      const newBank = [...myBank, card];
      await addLogAndSync(`Added points to Bank.`, { playsRemaining: newPlays }, { hand: newHand, bank: newBank, properties: myProperties, character: myCharacter, isFrozen: isMyCharacterFrozen });
    } else if (card.type === 'action') {
      setSelectedActionCard(card);
    }
  };

  const playTableAction = (tableCard: any) => {
    if (!isMyTurn || turnPhase !== 'play' || playsRemaining <= 0) return;
    setTableActions(tableActions.filter((c: any) => c.runtimeId !== tableCard.runtimeId));
    setSelectedActionCard(tableCard);
  };

  const calculatePointsForColor = (color: string) => {
    const matchingProps = myProperties.filter((card: any) => getCardColor(card) === color);
    if (matchingProps.length === 0) return 0;
    const sampleCard = myProperties.find((c: any) => c.type === 'property' && c.colorSet === color && c.rentValues);
    if (!sampleCard || !sampleCard.rentValues) return 1; 
    const index = Math.min(matchingProps.length - 1, sampleCard.rentValues.length - 1);
    return sampleCard.rentValues[index];
  };

  const handlePlayerPayToOpponent = async (cardToPay: any, source: 'bank' | 'property') => {
    let newMyBank = myBank;
    let newMyProps = myProperties;
    let newOppBank = opponentBank;
    let newOppProps = opponentProperties;
    let logMsg = "";

    if (source === 'property') {
        newMyProps = myProperties.filter((c: any) => c.runtimeId !== cardToPay.runtimeId);
        newOppProps = [...opponentProperties, cardToPay];
        logMsg = `${myName} surrendered item: ${cardToPay.name}`;
    } else {
        newMyBank = myBank.filter((c: any) => c.runtimeId !== cardToPay.runtimeId);
        newOppBank = [...opponentBank, cardToPay];
        logMsg = `${myName} paid ${cardToPay.value} points from bank.`;
    }
    
    if (playerPaymentPrompt) {
      const cardValue = Number(cardToPay.value) || 1;
      const remaining = playerPaymentPrompt.amount - cardValue;
      const remainingAssets = newMyBank.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0) + 
                              newMyProps.filter((c: any) => getCardColor(c) !== harryProtectedColor).reduce((sum: number, c: any) => sum + (Number(c.value) || 1), 0);

      if (remaining <= 0 || remainingAssets === 0) {
        setPlayerPaymentPrompt(null);
        await addLogAndSync(`${logMsg} Payment complete.`, {}, { hand: myHand, bank: newMyBank, properties: newMyProps, character: myCharacter, isFrozen: isMyCharacterFrozen }, { bank: newOppBank, properties: newOppProps, hand: opponentHand, character: opponentCharacter, isFrozen: isOpponentFrozen });
      } else {
        setPlayerPaymentPrompt({ ...playerPaymentPrompt, amount: remaining });
        await addLogAndSync(`${logMsg}`, {}, { hand: myHand, bank: newMyBank, properties: newMyProps, character: myCharacter, isFrozen: isMyCharacterFrozen }, { bank: newOppBank, properties: newOppProps, hand: opponentHand, character: opponentCharacter, isFrozen: isOpponentFrozen });
      }
    }
  };

  const unfreezeSelectedCardsArray = [...myBank, ...myProperties].filter((c: any) => unfreezeSelectedIds.includes(c.runtimeId));
  const unfreezeTotalPoints = unfreezeSelectedCardsArray.reduce((sum: number, c: any) => sum + (Number(c.value) || 1), 0);

  const toggleUnfreezeSelection = (cardId: string) => {
    setUnfreezeSelectedIds(prev => prev.includes(cardId) ? prev.filter(id => id !== cardId) : [...prev, cardId]);
  };

  const confirmUnfreeze = async () => {
    const discarded = unfreezeSelectedCardsArray;
    const newMyBank = myBank.filter((c: any) => !unfreezeSelectedIds.includes(c.runtimeId));
    const newMyProps = myProperties.filter((c: any) => !unfreezeSelectedIds.includes(c.runtimeId));
    const newDiscard = [...discarded, ...discardPile];
    
    setIsUnfreezeModalOpen(false);
    setUnfreezeSelectedIds([]);
    
    await addLogAndSync(
        `${myName} discarded ${unfreezeTotalPoints} points to lift Petrificus Totalus!`, 
        { discardPile: newDiscard }, 
        { hand: myHand, bank: newMyBank, properties: newMyProps, character: myCharacter, isFrozen: false }
    );
  };

  const cancelUnfreeze = () => { setIsUnfreezeModalOpen(false); setUnfreezeSelectedIds([]); };
  const myBankTotal = myBank.reduce((sum: number, card: any) => sum + (Number(card.value) || 0), 0);
  const oppBankTotal = opponentBank.reduce((sum: number, c: any) => sum + (Number(c.value) || 0), 0);

  const groupedMyProperties = myProperties.reduce((acc: any, card: any) => {
    const col = getCardColor(card);
    if (!acc[col]) acc[col] = [];
    acc[col].push(card);
    return acc;
  }, {});

  const groupedOpponentProperties = opponentProperties.reduce((acc: any, card: any) => {
    const col = getCardColor(card);
    if (!acc[col]) acc[col] = [];
    acc[col].push(card);
    return acc;
  }, {});

  if (!isGameStarted) {
    return (
      <main className="min-h-screen bg-green-900 text-white flex flex-col items-center justify-center p-6 font-sans">
        <div className="bg-stone-900 border-4 border-amber-500 rounded-3xl p-8 max-w-md w-full shadow-2xl text-center">
          <h1 className="text-3xl font-serif font-black text-amber-400 mb-1">⚡ Monopoly Deal ⚡</h1>
          <p className="text-stone-300 text-xs mb-6 font-serif italic">Harry Potter Realtime Multiplayer</p>

          <div className="mb-6 flex justify-center gap-6 items-center bg-stone-950 p-4 rounded-xl border border-stone-800 shadow-inner">
             <div className="flex flex-col items-center">
                 <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 bg-stone-800 mb-1 shadow-lg">
                    <img src="/hunter.jpg" alt="Hunter" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hunter'} />
                 </div>
                 <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Hunter</span>
                 <span className="text-xl font-black text-white">{hunterWins}</span>
             </div>
             <div className="text-stone-500 font-serif italic text-sm">VS</div>
             <div className="flex flex-col items-center">
                 <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-amber-500 bg-stone-800 mb-1 shadow-lg">
                    <img src="/jess.jpg" alt="Jess" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jess'} />
                 </div>
                 <span className="text-xs font-bold text-amber-400 uppercase tracking-widest">Jess</span>
                 <span className="text-xl font-black text-white">{jessWins}</span>
             </div>
          </div>

          <div className="space-y-4 text-left border-t border-stone-800 pt-4">
            <div>
              <label className="block text-amber-400 text-xs font-bold uppercase tracking-wider mb-2 text-center">Select Your Profile</label>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => setMyRole('player1')}
                  className={`py-3 px-4 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 shadow-lg ${myRole === 'player1' ? 'bg-amber-600 border-amber-400 text-white transform scale-105' : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'}`}
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-current bg-stone-800">
                    <img src="/hunter.jpg" alt="Hunter" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Hunter'} />
                  </div>
                  Hunter (Player 1)
                </button>
                <button
                  type="button"
                  onClick={() => setMyRole('player2')}
                  className={`py-3 px-4 rounded-xl font-bold text-xs border transition flex items-center justify-center gap-2 shadow-lg ${myRole === 'player2' ? 'bg-amber-600 border-amber-400 text-white transform scale-105' : 'bg-stone-800 border-stone-700 text-stone-400 hover:bg-stone-700'}`}
                >
                  <div className="w-6 h-6 rounded-full overflow-hidden border border-current bg-stone-800">
                    <img src="/jess.jpg" alt="Jess" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = 'https://api.dicebear.com/7.x/avataaars/svg?seed=Jess'} />
                  </div>
                  Jess (Player 2)
                </button>
              </div>
            </div>

            {myRole === 'player1' ? (
              <button
                type="button"
                onClick={handleHostStartGame}
                className="w-full mt-4 bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-4 px-6 rounded-xl shadow-lg text-xs transition tracking-wider uppercase border border-emerald-500"
              >
                Deal Cards & Start Realtime Match
              </button>
            ) : (
              <div className="space-y-3">
                <button
                  type="button"
                  onClick={() => setIsGameStarted(true)}
                  className="w-full mt-4 bg-amber-600 hover:bg-amber-500 text-white font-bold py-4 px-6 rounded-xl shadow-lg text-xs transition tracking-wider uppercase border border-amber-400"
                >
                  Join Active Game Room
                </button>
                <p className="text-center text-[10px] text-stone-400 italic">Make sure Hunter has dealt the cards first!</p>
              </div>
            )}
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-green-900 text-white flex flex-col justify-between pt-14 p-4 sm:p-8 font-sans overflow-hidden relative">
      
      <style jsx global>{`
        @keyframes drawPlayer { 0% { transform: translate(0, -300px) scale(0.5); opacity: 0; } 100% { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes drawOpponent { 0% { transform: translate(0, 300px) scale(0.5); opacity: 0; } 100% { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes playPlayer { 0% { transform: translate(0, 150px) scale(1.1); opacity: 0; } 100% { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes playOpponent { 0% { transform: translate(0, -150px) scale(1.1); opacity: 0; } 100% { transform: translate(0, 0) scale(1); opacity: 1; } }
        @keyframes flashLight { 0% { background-color: rgba(255, 255, 255, 0); } 10% { background-color: rgba(255, 255, 255, 0.5); } 100% { background-color: rgba(255, 255, 255, 0); } }
        @keyframes spellPop { 0% { transform: scale(0.5); opacity: 0; text-shadow: 0 0 20px #fff; } 20% { transform: scale(1.2); opacity: 1; text-shadow: 0 0 50px #fff, 0 0 100px #f59e0b; } 80% { transform: scale(1); opacity: 1; text-shadow: 0 0 20px #fff, 0 0 40px #f59e0b; } 100% { transform: scale(1.5); opacity: 0; } }
        .animate-draw-player { animation: drawPlayer 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-draw-opponent { animation: drawOpponent 0.4s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-play-player { animation: playPlayer 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-play-opponent { animation: playOpponent 0.35s cubic-bezier(0.2, 0.8, 0.2, 1) forwards; }
        .animate-flash { animation: flashLight 1.8s ease-out forwards; }
        .animate-spell-pop { animation: spellPop 1.8s ease-out forwards; }
      `}</style>

      {spellAnimation && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center pointer-events-none animate-flash">
            <div className="text-center animate-spell-pop">
                <h2 className="text-6xl md:text-8xl font-serif font-black text-amber-400 uppercase tracking-widest drop-shadow-2xl">{spellAnimation.name}</h2>
                <p className="text-xl md:text-3xl font-bold text-white mt-4 drop-shadow-lg">Cast by {spellAnimation.player}</p>
            </div>
        </div>
      )}

      <div className="absolute top-4 left-4 flex gap-4 z-40 items-start pointer-events-none">
          {winner && (
            <div className="bg-stone-900 border-4 border-amber-500 rounded-3xl p-6 shadow-2xl z-50 animate-play-player max-w-sm pointer-events-auto">
              <div className="absolute -top-4 -left-4 text-4xl animate-pulse">✨</div>
              <div className="absolute -bottom-4 -right-4 text-4xl animate-pulse delay-75">✨</div>
              <div className="absolute top-1/2 -right-6 text-3xl animate-pulse delay-150">🪄</div>
              <h2 className="text-3xl font-serif font-black text-amber-400 mb-2 drop-shadow-[0_0_10px_rgba(251,191,36,0.8)]">🏆 {winner} WINS! 🏆</h2>
              <p className="text-stone-300 text-sm mb-4">Successfully completed 3 sets!</p>
              {myRole === 'player1' && (
                  <button onClick={handleHostStartGame} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-6 rounded-full shadow-lg text-sm transition">Reset & Redeal</button>
              )}
            </div>
          )}
          
          {!winner && (
              <div className={`bg-stone-900 border-2 ${isMyTurn ? 'border-emerald-500 shadow-[0_0_15px_rgba(16,185,129,0.5)]' : 'border-amber-500'} rounded-2xl p-3 shadow-2xl flex items-center gap-3 bg-opacity-95 backdrop-blur`}>
                <div className={`w-8 h-8 rounded-full overflow-hidden border-2 ${isMyTurn ? 'border-emerald-400' : 'border-amber-500'} bg-stone-800 shadow-inner`}>
                  <img src={isMyTurn ? myAvatar : oppAvatar} alt="Turn Avatar" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = isMyTurn ? myFallbackAvatar : oppFallbackAvatar} />
                </div>
                <div>
                    <h3 className={`font-serif font-black text-sm uppercase tracking-widest ${isMyTurn ? 'text-emerald-400' : 'text-amber-400'}`}>{isMyTurn ? `Your Turn (${myName})` : `${opponentName}'s Turn`}</h3>
                </div>
              </div>
          )}
      </div>

      {isDiscardingExcess && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 bg-yellow-950 border-2 border-yellow-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 animate-bounce text-center">
          <h4 className="font-bold text-sm text-yellow-400">Hand Limit Exceeded ({myHand.length}/7 cards)</h4>
          <p className="text-xs text-stone-300">Click cards in your hand to discard until you have 7 left.</p>
        </div>
      )}

      {playerDefenseWindow && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-blue-950 border-2 border-blue-400 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-6 animate-bounce">
          <div>
            <h4 className="font-bold text-sm text-blue-300">⚠️ {playerDefenseWindow.attackName}</h4>
            <p className="text-xs text-amber-400 font-bold mb-1">{playerDefenseWindow.attackDescription}</p>
            <p className="text-[10px] text-stone-300">Time to react: <span className="font-bold text-white text-xs">{playerDefenseWindow.timeLeft}s</span>.</p>
          </div>
          <div className="flex gap-2 shrink-0">
             <button onClick={playerDefenseWindow.onCounterProtego} className="bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition">🛡️ Play Protego</button>
             <button onClick={playerDefenseWindow.onAccept} className="bg-red-700 hover:bg-red-600 text-white text-xs font-bold px-4 py-2 rounded-xl shadow transition">💥 Take Hit</button>
          </div>
        </div>
      )}

      {isUnfreezeModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-blue-500 rounded-2xl p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-blue-400 font-serif font-bold text-lg">Lift Petrificus Totalus</h3>
                <p className="text-stone-400 text-xs">Select cards from your Bank or Items to discard (Must total exactly or just over 10 points).</p>
              </div>
              <div className="flex items-center gap-4">
                <div className="text-right">
                  <span className="block text-[10px] text-stone-400 uppercase tracking-widest font-bold">Selected Points</span>
                  <span className={`text-xl font-black ${unfreezeTotalPoints >= 10 ? 'text-emerald-400' : 'text-amber-400'}`}>{unfreezeTotalPoints} / 10</span>
                </div>
                <button onClick={confirmUnfreeze} disabled={unfreezeTotalPoints < 10} className={`font-bold py-2 px-6 rounded-xl shadow transition text-sm ${unfreezeTotalPoints >= 10 ? 'bg-emerald-600 hover:bg-emerald-500 text-white' : 'bg-stone-700 text-stone-500 cursor-not-allowed'}`}>Confirm Discard</button>
                <button onClick={cancelUnfreeze} className="bg-stone-800 hover:bg-stone-700 text-white px-4 py-2 rounded-xl text-sm font-bold transition">Cancel</button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto space-y-6 p-2">
              <div>
                <h4 className="text-xs uppercase font-bold tracking-widest text-amber-500 mb-3">Available Bank Cards</h4>
                <div className="grid grid-cols-5 gap-4">
                  {myBank.map((card: any) => {
                    const isSelected = unfreezeSelectedIds.includes(card.runtimeId);
                    return (
                      <div key={card.runtimeId} onClick={() => toggleUnfreezeSelection(card.runtimeId)} className={`flex flex-col items-center cursor-pointer transition transform hover:scale-105 ${isSelected ? 'ring-4 ring-blue-500 rounded-xl scale-105 opacity-50' : ''}`}>
                        <PlayingCard name={card.name} type={card.type} value={card.value} effect={card.effect} isBank={true} />
                      </div>
                    );
                  })}
                  {myBank.length === 0 && <span className="text-stone-500 italic text-xs col-span-5">Your bank is empty</span>}
                </div>
              </div>

              <div className="border-t border-stone-800 pt-6">
                <h4 className="text-xs uppercase font-bold tracking-widest text-emerald-400 mb-3">Available Items</h4>
                <div className="grid grid-cols-5 gap-4">
                  {myProperties.map((card: any) => {
                    const isSelected = unfreezeSelectedIds.includes(card.runtimeId);
                    return (
                      <div key={card.runtimeId} onClick={() => toggleUnfreezeSelection(card.runtimeId)} className={`flex flex-col items-center cursor-pointer transition transform hover:scale-105 ${isSelected ? 'ring-4 ring-blue-500 rounded-xl scale-105 opacity-50' : ''}`}>
                        <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} activeWildColor={wildCardColors[card.runtimeId]} isRotated={wildCardRotations[card.runtimeId]} />
                      </div>
                    );
                  })}
                  {myProperties.length === 0 && <span className="text-stone-500 italic text-xs col-span-5">No items available</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {cedricChoiceModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-yellow-500 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <h3 className="text-yellow-400 font-serif font-bold text-lg mb-2">Cedric Diggory's Ability</h3>
            <p className="text-stone-300 text-xs mb-6">Choose where to draw your 2 turn cards from (both must come from the same pile):</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => { setCedricChoiceModal(false); executeNormalDraw(); }} className="bg-emerald-700 hover:bg-emerald-600 text-white font-bold py-3 px-4 rounded-xl shadow transition text-xs uppercase">Draw 2 Cards from Draw Pile</button>
              <button onClick={executeCedricDrawFromDiscard} className="bg-yellow-600 hover:bg-yellow-500 text-stone-950 font-bold py-3 px-4 rounded-xl shadow transition text-xs uppercase">Draw 2 Top Cards from Discard Pile ({discardPile.length} available)</button>
            </div>
          </div>
        </div>
      )}

      {wildcardSelectionModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Choose Wildcard Color</h3>
            <p className="text-stone-300 text-xs mb-4">Select which color this wildcard represents on your table:</p>
            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
              {(() => {
                const card = wildcardSelectionModal;
                const isAny = card.colorSet?.includes("Any") || card.name.toLowerCase().includes("wild any");
                let finalColors: string[] = [];
                if (isAny) {
                    const ownedColors = Array.from(new Set(myProperties.map((c: any) => getCardColor(c))));
                    finalColors = ["Brown", "Dark Blue", "Light Green", "Pink", "Orange", "Yellow", "Red", "Light Blue", "Dark Green", "Black"].filter(col => ownedColors.includes(col) && !isSetFull(col, myProperties));
                } else {
                    finalColors = card.colorSet ? card.colorSet.split("/") : [];
                    finalColors = finalColors.filter(col => !isSetFull(col, myProperties));
                }

                if (finalColors.length === 0 && !isAny) finalColors = card.colorSet ? card.colorSet.split("/") : [];

                return finalColors.map((col: string) => {
                  const colorClass = getPropertyColorClass(col);
                  return (
                    <button key={col} onClick={async () => {
                        const newColors = { ...wildCardColors, [card.runtimeId]: col };
                        const newProps = [...myProperties, card];
                        setWildCardColors(newColors);
                        setMyProperties(newProps);
                        setPlaysRemaining((prev: number) => prev - 1);
                        setWildcardSelectionModal(null);
                        
                        await addLogAndSync(`Played wildcard as ${col}.`, { wildCardColors: newColors, playsRemaining: playsRemaining - 1 }, { hand: myHand, properties: newProps, bank: myBank, character: myCharacter, isFrozen: isMyCharacterFrozen });
                      }}
                      className={`${colorClass} hover:opacity-90 font-bold py-3 px-4 rounded-xl shadow transition text-xs uppercase tracking-wider flex justify-between items-center`}
                    >
                      <span>Play as {col}</span><span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Select</span>
                    </button>
                  );
                });
              })()}
            </div>
            <button onClick={() => { setMyHand((prev: any[]) => [...prev, wildcardSelectionModal]); setWildcardSelectionModal(null); }} className="mt-4 bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 px-4 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {tableWildcardEditModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm w-full shadow-2xl text-center">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Change Wildcard Color</h3>
            <p className="text-stone-300 text-xs mb-4">Select a new color for this wildcard:</p>
            <div className="flex flex-col gap-2.5 max-h-60 overflow-y-auto">
              {(() => {
                const card = tableWildcardEditModal;
                const isAny = card.colorSet?.includes("Any") || card.name.toLowerCase().includes("wild any");
                let finalColors: string[] = isAny ? ["Brown", "Dark Blue", "Light Green", "Pink", "Orange", "Yellow", "Red", "Light Blue", "Dark Green", "Black"] : (card.colorSet ? card.colorSet.split("/") : []);

                return finalColors.map((col: string) => {
                  const colorClass = getPropertyColorClass(col);
                  return (
                    <button key={col} onClick={async () => {
                        const newColors = { ...wildCardColors, [card.runtimeId]: col };
                        setWildCardColors(newColors);
                        setTableWildcardEditModal(null);
                        await addLogAndSync(`Changed wildcard color to ${col}.`, { wildCardColors: newColors });
                      }}
                      className={`${colorClass} hover:opacity-90 font-bold py-3 px-4 rounded-xl shadow transition text-xs uppercase tracking-wider flex justify-between items-center`}
                    >
                      <span>Change to {col}</span><span className="bg-black/30 px-2 py-0.5 rounded text-[10px]">Select</span>
                    </button>
                  );
                });
              })()}
            </div>
            <button onClick={() => setTableWildcardEditModal(null)} className="mt-4 bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 px-4 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {confundoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-xl w-full shadow-2xl text-center">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Confundo: Choose Your Item to Swap</h3>
            <p className="text-stone-300 text-xs mb-4">Click one of your items on the table to trade away:</p>
            <div className="flex justify-center gap-4 flex-wrap mb-6 max-h-60 overflow-y-auto">
              {myProperties.map((card: any) => (
                <div key={card.runtimeId} className="flex flex-col items-center cursor-pointer hover:scale-105 transition"
                  onClick={() => {
                      setConfundoModal({ ...confundoModal, chosenMyCard: card });
                      const eligibleOppCards = opponentProperties.filter((c: any) => getCardColor(c) !== harryProtectedColor);
                      setTargetSelectionModal({ type: 'levicorpus', actionCard: confundoModal.actionCard, cards: eligibleOppCards });
                  }}>
                  <div className="pointer-events-none">
                     <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} />
                  </div>
                </div>
              ))}
              {myProperties.length === 0 && <p className="text-stone-500 italic text-xs">You have no items played.</p>}
            </div>
            <button onClick={() => setConfundoModal(null)} className="bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 px-4 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {targetSelectionModal && confundoModal === null && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-xl w-full shadow-2xl text-center">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Select Target</h3>
            <p className="text-stone-300 text-xs mb-4">Click a target from {opponentName}'s items:</p>
            <div className="flex justify-center gap-4 flex-wrap mb-6 max-h-60 overflow-y-auto">
              {targetSelectionModal.cards.map((card: any) => (
                <div key={card.runtimeId || card.colorSet} className="flex flex-col items-center">
                  {targetSelectionModal.type === 'obliviate' ? (
                     <div className="relative cursor-pointer hover:scale-105 transition-transform" onClick={() => handleTargetSelection(card)}>
                        <div className="pointer-events-none"><PlayingCard name={`${card.colorSet} Set`} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} /></div>
                        <div className="absolute inset-0 bg-black/50 border-4 border-amber-500 flex items-center justify-center rounded-xl pointer-events-none">
                            <span className="text-white font-bold uppercase tracking-widest rotate-[-15deg] shadow-2xl text-lg">FULL SET</span>
                        </div>
                     </div>
                  ) : (
                     <div className="cursor-pointer hover:scale-105 transition" onClick={() => {
                        if (confundoModal && confundoModal.chosenMyCard) handleConfundoSelectOpponentCard(card);
                        else handleTargetSelection(card);
                     }}>
                        <div className="pointer-events-none"><PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} /></div>
                     </div>
                  )}
                </div>
              ))}
            </div>
            <button onClick={() => setTargetSelectionModal(null)} className="bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 px-4 rounded-lg">Cancel</button>
          </div>
        </div>
      )}

      {isDiscardModalOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-emerald-500 rounded-2xl p-6 max-w-4xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-emerald-400 font-serif font-bold text-lg">Discard Pile</h3>
                <p className="text-stone-400 text-xs">Total Cards: <span className="text-white font-bold">{discardPile.length}</span></p>
              </div>
              <button onClick={() => setIsDiscardModalOpen(false)} className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-1 rounded-lg text-xs font-bold">Close</button>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              <div className="flex flex-wrap justify-center gap-4">
                {discardPile.map((card: any, idx: number) => (
                  <div key={`${card.runtimeId}-${idx}`} className="pointer-events-none">
                    <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} effect={card.effect} />
                  </div>
                ))}
                {discardPile.length === 0 && <span className="text-stone-500 italic text-xs w-full text-center">Discard pile is empty</span>}
              </div>
            </div>
          </div>
        </div>
      )}

      {reparoModal && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-purple-500 rounded-2xl p-6 max-w-4xl w-full shadow-2xl text-center flex flex-col max-h-[85vh]">
            <div className="mb-4 shrink-0 flex justify-between items-center">
               <div className="text-left">
                   <h3 className="text-purple-400 font-serif font-bold text-lg mb-1">Reparo: Discard Pile Recovery</h3>
                   <p className="text-stone-300 text-xs">Click any card from the discard pile to recover it to your hand/table.</p>
               </div>
               <button onClick={() => setReparoModal(null)} className="bg-stone-700 hover:bg-stone-600 text-white text-xs py-2 px-4 rounded-lg">Cancel</button>
            </div>
            <div className="flex-1 overflow-y-auto mb-4 bg-stone-950 p-4 rounded-xl border border-stone-800">
               <div className="flex justify-center gap-4 flex-wrap">
                 {discardPile.map((card: any, idx: number) => (
                   <div key={`${card.runtimeId}-${idx}`} onClick={() => handleReparoSelection(card)} className="cursor-pointer hover:scale-105 transition">
                     <div className="pointer-events-none"><PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} effect={card.effect} /></div>
                   </div>
                 ))}
                 {discardPile.length === 0 && <p className="text-stone-500 italic text-xs w-full text-center">Discard pile is empty.</p>}
               </div>
            </div>
          </div>
        </div>
      )}

      {rentSelectionModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Select Color for Points</h3>
            <p className="text-stone-300 text-xs mb-4">You own items in multiple eligible colors. Which set would you like to collect points for?</p>
            <div className="flex flex-col gap-3">
              {rentSelectionModal.validColors.map((col: string) => {
                const colorClass = getPropertyColorClass(col);
                return (
                  <button key={col} onClick={() => handleColorSelectionForRent(col)} className={`${colorClass} hover:opacity-90 font-bold py-3 px-4 rounded-xl shadow-lg transition flex justify-between items-center`}>
                    <span>Charge Points for {col}</span><span className="bg-black/40 px-2 py-0.5 rounded text-xs font-black">{calculatePointsForColor(col)} pts</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {playerPaymentPrompt && (
        <div className="absolute bottom-8 left-1/2 transform -translate-x-1/2 bg-red-950 border-2 border-red-500 text-white px-6 py-3 rounded-2xl shadow-2xl z-50 flex items-center gap-4 animate-bounce">
          <div>
            <h4 className="font-bold text-sm text-red-400">Payment Due: {playerPaymentPrompt.reason}</h4>
            <p className="text-xs text-stone-300">Amount Due: <span className="font-bold text-amber-400">{playerPaymentPrompt.amount} points</span>. Open your Bank to pay.</p>
          </div>
          <button onClick={() => setIsMyBankOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold px-4 py-2 rounded-xl shadow">Open My Bank</button>
        </div>
      )}

      {selectedActionCard && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-sm text-center shadow-2xl">
            <h3 className="text-amber-400 font-serif font-bold text-lg mb-2">Play Action Card</h3>
            <p className="text-stone-300 text-xs mb-6">How would you like to play <span className="text-white font-bold">{selectedActionCard.name}</span>?</p>
            <div className="flex flex-col gap-3">
              <button onClick={() => resolveActionChoice('action')} className="bg-purple-700 hover:bg-purple-600 text-white font-bold py-2.5 px-4 rounded-xl shadow transition">Play as Spell Effect</button>
              <button onClick={() => resolveActionChoice('bank')} className="bg-amber-600 hover:bg-amber-500 text-white font-bold py-2.5 px-4 rounded-xl shadow transition">Send to Bank ({selectedActionCard.value} Pts)</button>
              <button onClick={() => setSelectedActionCard(null)} className="bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs py-2 rounded-lg mt-2">Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* MY BANK VAULT MODAL */}
      {isMyBankOpen && (
        <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-6">
          <div className="bg-stone-900 border-2 border-amber-500 rounded-2xl p-6 max-w-3xl w-full shadow-2xl flex flex-col max-h-[85vh]">
            <div className="flex justify-between items-center mb-4 border-b border-stone-800 pb-3">
              <div>
                <h3 className="text-amber-400 font-serif font-bold text-lg">My Bank</h3>
                <p className="text-stone-400 text-xs">Total Bank Points: <span className="text-white font-bold">{myBankTotal} points</span></p>
                {playerPaymentPrompt && (<span className="block mt-1 text-red-400 font-bold text-xs animate-pulse">Click a card to surrender it as payment. (Owed: {playerPaymentPrompt.amount} points)</span>)}
              </div>
              <button onClick={() => setIsMyBankOpen(false)} className="bg-stone-800 hover:bg-stone-700 text-white px-3 py-1 rounded-lg text-xs font-bold">Close</button>
            </div>

            <div className="flex-1 overflow-y-auto space-y-4 p-2">
              <div>
                <h4 className="text-xs uppercase font-bold tracking-widest text-amber-500 mb-2">My Bank Cards</h4>
                <div className="grid grid-cols-4 gap-4">
                  {myBank.map((card: any) => (
                    <div key={card.runtimeId} className={`flex flex-col items-center ${playerPaymentPrompt ? 'cursor-pointer hover:scale-105 transition' : ''}`} onClick={() => { if (playerPaymentPrompt) handlePlayerPayToOpponent(card, 'bank'); }}>
                      <div className={playerPaymentPrompt ? 'pointer-events-none' : ''}><PlayingCard name={card.name} type={card.type} value={card.value} effect={card.effect} isBank={true} /></div>
                    </div>
                  ))}
                  {myBank.length === 0 && <span className="text-stone-500 italic text-xs col-span-4">Your bank is empty</span>}
                </div>
              </div>

              <div className="border-t border-stone-800 pt-4">
                <h4 className="text-xs uppercase font-bold tracking-widest text-emerald-400 mb-2">My Items</h4>
                <div className="grid grid-cols-4 gap-4">
                  {myProperties.map((card: any) => (
                    <div key={card.runtimeId} className={`flex flex-col items-center ${playerPaymentPrompt ? 'cursor-pointer hover:scale-105 transition' : ''}`} onClick={() => { if (playerPaymentPrompt && getCardColor(card) !== harryProtectedColor) handlePlayerPayToOpponent(card, 'property'); }}>
                      <div className={playerPaymentPrompt ? 'pointer-events-none' : ''}>
                        <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} activeWildColor={wildCardColors[card.runtimeId]} isRotated={wildCardRotations[card.runtimeId]} onFlip={(e: any) => {
                            if (!playerPaymentPrompt) {
                               if (e) e.stopPropagation();
                               if (card.colorSet?.includes("/")) toggleWildcardColor(card);
                               else setTableWildcardEditModal(card);
                            }
                          }}
                        />
                      </div>
                    </div>
                  ))}
                  {myProperties.length === 0 && <span className="text-stone-500 italic text-xs col-span-4">No items played</span>}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN LAYOUT */}
      <div className="flex flex-row gap-6 flex-1 overflow-hidden">
        
        <div className="flex-1 flex flex-col justify-between overflow-y-auto pr-2">
          
          {/* TOP: Opponent Area */}
          <section className="flex flex-col justify-start mb-2 border-b-2 border-green-800/50 pb-2">
            <div className="flex justify-between items-center px-4 mb-1">
              <div className="flex items-center gap-2">
                  <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${!isMyTurn ? 'border-amber-400' : 'border-stone-700'}`}>
                     <img src={oppAvatar} alt="Opponent" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = oppFallbackAvatar} />
                  </div>
                  <h2 className="text-green-300/50 uppercase tracking-widest text-xs">{opponentName}'s Area</h2>
              </div>
            </div>
            
            <div className="flex justify-center gap-2 mb-2">
              {winner ? (
                  opponentHand.map((card: any, idx: number) => (
                      <div key={`${card.runtimeId}-${idx}`} className="animate-draw-opponent"><PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} effect={card.effect} /></div>
                  ))
              ) : opponentHand.length > 0 ? (
                opponentHand.map((_: any, i: number) => (
                  <div key={`opp-hand-${i}`} className="animate-draw-opponent"><PlayingCard name="HP DEAL" type="back" /></div>
                ))
              ) : (
                <div className="h-24 flex items-center text-green-700/50 italic font-semibold">Hand is empty.</div>
              )}
            </div>

            <div className="flex justify-between items-end w-full px-4 mt-2">
              <div className="shrink-0">
                {opponentCharacter ? (
                  <div className="relative animate-deal">
                    <PlayingCard name={opponentCharacter.name} type="character" effect={opponentCharacter.effect} />
                    {isOpponentFrozen && (
                      <div className="absolute inset-0 bg-blue-500/30 border-4 border-blue-400 rounded-xl flex items-center justify-center backdrop-blur-[1px]">
                        <span className="text-xs font-bold bg-blue-900 text-white px-2 py-1 rounded shadow">FROZEN ❄️</span>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-28 h-40 border-2 border-dashed border-green-700/50 rounded-lg flex items-center justify-center text-center text-green-700/50 text-xs font-bold p-2 bg-stone-900/40">
                    {opponentName} Character
                  </div>
                )}
              </div>
              
              <div className="flex-1 flex justify-center gap-4 overflow-x-auto mx-4 px-4 min-w-0 scrollbar-thin scrollbar-thumb-green-700">
                  {Object.keys(groupedOpponentProperties).length > 0 ? (
                    Object.keys(groupedOpponentProperties).map((colorKey) => {
                      const setCards = groupedOpponentProperties[colorKey];
                      const isWinningSet = winner && isCompleteSet(colorKey, opponentProperties);
                      
                      const sortedSetCards = [...setCards].sort((a: any, b: any) => {
                          const aIsAny = a.colorSet?.includes("Any") || a.name.toLowerCase().includes("wild any");
                          const bIsAny = b.colorSet?.includes("Any") || b.name.toLowerCase().includes("wild any");
                          if (aIsAny && !bIsAny) return -1;
                          if (!aIsAny && bIsAny) return 1;
                          return 0;
                      });

                      return (
                        <div key={colorKey} className={`relative flex flex-col items-center group shrink-0 animate-play-opponent ${isWinningSet ? 'ring-4 ring-amber-400 rounded-xl p-1 bg-amber-400/20' : ''}`}>
                          {harryProtectedColor === colorKey && (
                             <div className="absolute -top-4 right-0 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-20 border border-blue-300 flex items-center gap-1">⚡ PROTECTED</div>
                          )}
                          <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">{colorKey}</span>
                          <div className="relative w-28" style={{ height: `calc(10rem + ${(sortedSetCards.length - 1) * 1.5}rem)` }}>
                            {sortedSetCards.map((card: any, idx: number) => (
                              <div key={card.runtimeId} className="absolute transition-all duration-300" style={{ top: `${idx * 24}px`, zIndex: idx }}>
                                <div className="scale-90 origin-top-left shadow-2xl">
                                  <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-green-700/40 text-xs uppercase tracking-widest italic my-auto">No Items Played</span>
                  )}
              </div>

              <div className="relative w-28 h-40 bg-amber-950/40 border-2 border-amber-800/60 rounded-xl flex flex-col items-center justify-center p-2 shrink-0 animate-play-opponent">
                  <span className="text-[10px] text-amber-400 uppercase tracking-widest font-bold mb-1">Bank Stack</span>
                  <div className="text-xl font-serif font-bold text-amber-200">{oppBankTotal} pts</div>
              </div>
            </div>
          </section>

          {/* MIDDLE: Center Table & Turn Controls */}
          <section className="h-36 flex items-center justify-center gap-10 my-1 bg-green-950/40 rounded-2xl p-3 shadow-inner relative">
            <div className="flex flex-col items-center bg-stone-900/80 border border-amber-500/50 rounded-xl p-2.5 shadow">
              <span className="text-[10px] font-bold text-amber-400 uppercase tracking-widest mb-1">Turn Control</span>
              <span className="text-xs font-bold text-white mb-2">Plays: {isMyTurn ? playsRemaining : 0}</span>
              
              {isMyTurn && turnPhase === 'draw' ? (
                <div className="text-[10px] text-emerald-400 font-bold mb-1 animate-pulse">Click Draw Pile</div>
              ) : isMyTurn ? (
                <button onClick={handleEndTurn} className="bg-red-700 hover:bg-red-600 text-white font-bold text-xs py-1.5 px-4 rounded-lg shadow">End Turn</button>
              ) : (
                <span className="text-[10px] text-stone-400 italic font-bold">Waiting...</span>
              )}
            </div>

            <div className={`flex flex-col items-center cursor-pointer transition transform hover:scale-105 ${isMyTurn && turnPhase === 'draw' ? 'ring-4 ring-emerald-500 rounded-xl p-1' : ''}`} onClick={() => { if (isMyTurn && turnPhase === 'draw') startTurnDraw(); }}>
              <h3 className="text-green-400/70 text-[10px] uppercase mb-1 font-bold tracking-widest">Draw Pile</h3>
              <PlayingCard name={`${drawPile.length} CARDS`} type="back" />
            </div>

            <div className="flex flex-col items-center cursor-pointer hover:scale-105 transition transform" onClick={() => { if (!reparoModal) setIsDiscardModalOpen(true); }}>
              <h3 className="text-green-400/70 text-[10px] uppercase mb-1 font-bold tracking-widest flex gap-1 items-center">Discard Pile</h3>
              {discardPile.length > 0 ? (
                <div className="relative animate-play-player">
                  <div className="pointer-events-none"><PlayingCard name={discardPile[0].name} type={discardPile[0].type} value={discardPile[0].value} effect={discardPile[0].effect} /></div>
                  <span className="absolute -top-2 -right-2 bg-stone-900 text-amber-400 text-[10px] font-bold px-1.5 py-0.5 rounded-full border border-amber-500">{discardPile.length}</span>
                </div>
              ) : (
                <div className="w-28 h-40 border-2 border-dashed border-green-700/50 rounded-lg flex items-center justify-center bg-stone-900/40 text-[10px] text-green-700/50 italic">Empty</div>
              )}
            </div>
          </section>

          {/* BOTTOM: My Area */}
          <section className="flex flex-col justify-end mt-1 border-t-2 border-green-800/50 pt-3">
            <div className="flex justify-between items-end w-full px-4 mb-3">
              <div className="shrink-0">
                {myCharacter ? (
                  <div className="relative animate-play-player">
                    <PlayingCard name={myCharacter.name} type="character" effect={myCharacter.effect} />
                    {isMyCharacterFrozen && (
                      <div className="absolute inset-0 bg-blue-500/30 border-4 border-blue-400 rounded-xl flex flex-col items-center justify-center p-2 backdrop-blur-[1px]">
                        <span className="text-[10px] font-bold bg-blue-900 text-white px-2 py-0.5 rounded shadow mb-2">FROZEN ❄️</span>
                        {isMyTurn && (<button onClick={() => setIsUnfreezeModalOpen(true)} className="bg-amber-600 hover:bg-amber-500 text-white text-[9px] font-bold px-2 py-1 rounded shadow mt-2">Lift Curse (10 pts)</button>)}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="w-28 h-40 border-2 border-dashed border-green-700/50 rounded-lg flex items-center justify-center text-center text-green-700/50 text-xs font-bold p-2 bg-stone-900/40">{myName} Character</div>
                )}
              </div>

              <div className="flex-1 flex justify-center gap-4 overflow-x-auto mx-4 px-4 min-w-0 scrollbar-thin scrollbar-thumb-green-700">
                  {Object.keys(groupedMyProperties).length > 0 ? (
                    Object.keys(groupedMyProperties).map((colorKey) => {
                      const setCards = groupedMyProperties[colorKey];
                      const isWinningSet = winner && isCompleteSet(colorKey, myProperties);

                      const sortedSetCards = [...setCards].sort((a: any, b: any) => {
                          const aIsAny = a.colorSet?.includes("Any") || a.name.toLowerCase().includes("wild any");
                          const bIsAny = b.colorSet?.includes("Any") || b.name.toLowerCase().includes("wild any");
                          if (aIsAny && !bIsAny) return -1;
                          if (!aIsAny && bIsAny) return 1;
                          return 0;
                      });

                      return (
                        <div key={colorKey} className={`relative flex flex-col items-center group shrink-0 animate-play-player ${isWinningSet ? 'ring-4 ring-amber-400 rounded-xl p-1 bg-amber-400/20' : ''}`}>
                          {harryProtectedColor === colorKey && (
                             <div className="absolute -top-4 right-0 bg-blue-600 text-white text-[8px] font-bold px-1.5 py-0.5 rounded-full shadow z-20 border border-blue-300 flex items-center gap-1">⚡ PROTECTED</div>
                          )}
                          <span className="text-[9px] font-bold text-amber-300 uppercase tracking-wider mb-0.5">{colorKey}</span>
                          <div className="relative w-28" style={{ height: `calc(10rem + ${(sortedSetCards.length - 1) * 1.5}rem)` }}>
                            {sortedSetCards.map((card: any, idx: number) => (
                              <div key={card.runtimeId} className="absolute transition-all duration-300 cursor-pointer" style={{ top: `${idx * 24}px`, zIndex: idx }}
                                onClick={() => {
                                  if (card.type === 'wildcard') {
                                    if (card.colorSet?.includes("/")) toggleWildcardColor(card);
                                    else setTableWildcardEditModal(card);
                                  }
                                }}
                              >
                                <div className="scale-90 origin-top-left shadow-2xl">
                                  <PlayingCard 
                                    name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} activeWildColor={wildCardColors[card.runtimeId]} isRotated={wildCardRotations[card.runtimeId]} inHand={false}
                                    onFlip={(e: any) => {
                                      if (e) e.stopPropagation();
                                      if (card.colorSet?.includes("/")) toggleWildcardColor(card);
                                      else setTableWildcardEditModal(card);
                                    }}
                                  />
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <span className="text-green-700/40 text-xs uppercase tracking-widest italic my-auto">No Items Played</span>
                  )}

                  {tableActions.length > 0 && (
                    <div className="flex flex-col items-center gap-2 bg-purple-950/60 border border-purple-500/50 rounded-xl p-2 shrink-0 my-auto animate-play-player">
                      <span className="text-[9px] text-purple-300 uppercase font-bold tracking-widest">Table Actions</span>
                      <div className="flex gap-2">
                        {tableActions.map((card: any) => (
                          <div key={card.runtimeId} onClick={() => playTableAction(card)} className="scale-75 origin-center cursor-pointer hover:scale-80 transition"><PlayingCard name={card.name} type={card.type} value={card.value} effect={card.effect} /></div>
                        ))}
                      </div>
                    </div>
                  )}
              </div>

              <div onClick={() => setIsMyBankOpen(true)} className="relative w-28 h-40 bg-stone-900 border-2 border-amber-500/80 rounded-xl flex flex-col items-center justify-between p-3 shadow-2xl cursor-pointer transform transition hover:scale-105 shrink-0 animate-play-player">
                  <div className="absolute -top-3 bg-amber-600 text-stone-950 font-black text-[10px] px-2 py-0.5 rounded-full uppercase tracking-wider shadow border border-amber-300">Bank</div>
                  <div className="flex flex-col items-center justify-center flex-1 w-full">
                    <span className="text-xs text-amber-400 font-serif font-bold uppercase tracking-widest">Total</span>
                    <span className="text-2xl font-black text-white">{myBankTotal}</span>
                    <span className="text-[9px] text-stone-400">points</span>
                  </div>
                  <div className="w-full bg-amber-600/25 hover:bg-amber-600/40 border border-amber-500/40 rounded-lg py-1 text-center transition">
                    <span className="text-[9px] text-amber-300 font-bold uppercase tracking-wider">{myBank.length} Cards</span>
                  </div>
              </div>
            </div>
            
            <div className="flex items-center justify-center gap-2 mb-1">
                 <div className={`w-6 h-6 rounded-full overflow-hidden border-2 ${isMyTurn ? 'border-amber-400' : 'border-stone-700'}`}>
                    <img src={myAvatar} alt="Me" className="w-full h-full object-cover" onError={(e: any) => e.currentTarget.src = myFallbackAvatar} />
                 </div>
                 <h2 className="text-green-300/50 uppercase tracking-widest text-xs">{isDiscardingExcess ? "Select Excess Cards to Discard (Max 7)" : `${myName}'s Hand (Click card to play - Drag to rearrange)`}</h2>
            </div>
            <div className="flex justify-center gap-3 h-40">
              {myHand.length > 0 ? (
                myHand.map((card: any, idx: number) => (
                  <div key={card.runtimeId} className="animate-draw-player cursor-grab active:cursor-grabbing" draggable onDragStart={(e: any) => { setDraggedCardIndex(idx); e.dataTransfer.effectAllowed = 'move'; }} onDragOver={(e: any) => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; }} onDrop={(e: any) => { e.preventDefault(); if (draggedCardIndex === null || draggedCardIndex === idx) return; const newHand = [...myHand]; const [draggedCard] = newHand.splice(draggedCardIndex, 1); newHand.splice(idx, 0, draggedCard); setMyHand(newHand); setDraggedCardIndex(null); }} onClick={() => handleCardClick(card)}>
                    <PlayingCard name={card.name} type={card.type} colorSet={card.colorSet} value={card.value} rentValues={card.rentValues} effect={card.effect} activeWildColor={wildCardColors[card.runtimeId]} inHand={true} />
                  </div>
                ))
              ) : (
                <div className="h-36 flex items-center text-green-700/50 italic font-semibold">Hand is empty! Use Draw Pile to start your turn.</div>
              )}
            </div>
          </section>

        </div>

        {/* Play-by-Play Log */}
        <aside className="w-80 bg-stone-950/85 border-2 border-amber-600/60 rounded-2xl p-4 flex flex-col h-[88vh] my-auto shadow-2xl shrink-0">
          <div className="flex justify-between items-center mb-3 border-b border-stone-800 pb-2">
            <h3 className="text-amber-400 font-serif font-bold text-xs uppercase tracking-widest">📜 Game Log</h3>
            <span className="text-[9px] bg-amber-600/20 text-amber-300 px-2 py-0.5 rounded border border-amber-500/30 font-mono">LIVE</span>
          </div>
          <div className="flex-1 overflow-y-auto space-y-2 pr-1 text-xs text-stone-300">
            {gameLog.map((logEntry: string, idx: number) => (
              <div key={idx} className="bg-stone-900/90 p-2 rounded-lg border border-stone-800 leading-snug font-sans text-[11px] shadow-sm animate-play-player">
                <span className="text-amber-500 font-mono text-[9px] block mb-0.5">#{gameLog.length - idx}</span>
                {logEntry}
              </div>
            ))}
          </div>
        </aside>

      </div>
    </main>
  );
}

function getPropertyColorClass(colorName: string) {
  const set = colorName?.trim() || "Black";
  if (set.includes("Brown")) return "bg-amber-800 text-white";
  if (set.includes("Dark Blue")) return "bg-blue-900 text-white";
  if (set.includes("Light Green")) return "bg-emerald-500 text-white";
  if (set.includes("Pink")) return "bg-pink-500 text-white";
  if (set.includes("Orange")) return "bg-orange-600 text-white";
  if (set.includes("Yellow")) return "bg-yellow-400 text-stone-900 font-bold";
  if (set.includes("Red")) return "bg-red-600 text-white";
  if (set.includes("Light Blue")) return "bg-sky-400 text-stone-900 font-bold";
  if (set.includes("Dark Green")) return "bg-emerald-900 text-white";
  if (set.includes("Black")) return "bg-stone-900 text-white";
  if (set.includes("Any")) return "bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white";
  return "bg-stone-700 text-white";
}

function PlayingCard({ 
  name, type, colorSet, value, rentValues, effect, activeWildColor, isRotated, onFlip, isBank, inHand = true
}: { 
  name: string; type: string; colorSet?: string; value?: number; rentValues?: number[]; effect?: string; activeWildColor?: string; isRotated?: boolean; onFlip?: (e?: React.MouseEvent) => void; isBank?: boolean; inHand?: boolean;
}) {
  if (type === "back") {
    return (
      <div className="w-28 h-40 rounded-xl shadow-2xl bg-stone-950 border-2 border-amber-600/60 flex flex-col items-center justify-center p-2 transform transition hover:-translate-y-2 cursor-pointer">
        <div className="w-full h-full border border-dashed border-amber-500/40 rounded-lg flex flex-col items-center justify-center text-center bg-stone-900/50">
          <span className="text-[12px] text-amber-500 font-serif tracking-widest font-black uppercase">Monopoly</span>
          <span className="text-[16px] font-black text-white tracking-widest uppercase mb-2">Deal</span>
          <span className="text-3xl text-amber-400 mt-1">⚡</span>
        </div>
      </div>
    );
  }

  if (isBank) {
    let moneyBg = "bg-amber-100 text-stone-900";
    if (value === 1) moneyBg = "bg-slate-300 text-stone-900";
    else if (value === 2) moneyBg = "bg-red-600 text-white";
    else if (value === 3) moneyBg = "bg-sky-300 text-stone-900";
    else if (value === 4) moneyBg = "bg-emerald-600 text-white";
    else if (value === 5) moneyBg = "bg-amber-500 text-stone-950";
    else if (value === 10) moneyBg = "bg-yellow-100 text-stone-900";

    return (
      <div className={`w-28 h-40 rounded-xl shadow-xl border-2 border-stone-800 flex flex-col justify-between p-3 overflow-hidden transform transition hover:-translate-y-2 cursor-pointer ${moneyBg} relative`}>
        <div className="flex justify-between items-start">
          {value !== undefined && <span className="w-6 h-6 bg-stone-900 text-amber-400 font-black text-xs rounded-full flex items-center justify-center shadow border border-amber-500">{value}</span>}
          <span className="text-[7px] uppercase tracking-widest font-bold opacity-70">POINT CARD</span>
        </div>
        <div className="text-center my-auto"><span className="text-7xl font-black font-serif tracking-tighter drop-shadow">{value || 1}</span></div>
        <div className="h-6"></div>
      </div>
    );
  }

  if (type === "character") {
    let headerBg = "bg-stone-300 text-stone-900";
    let houseBorder = "border-amber-700";
    let houseSymbol = "";
    if (name === "Harry Potter" || name === "Hermione Granger") { headerBg = "bg-red-800 text-yellow-400 border-b-2 border-yellow-500"; houseBorder = "border-red-900"; houseSymbol = "🦁"; }
    else if (name === "Draco Malfoy") { headerBg = "bg-emerald-950 text-slate-200 border-b-2 border-slate-400"; houseBorder = "border-emerald-900"; houseSymbol = "🐍"; }
    else if (name === "Cedric Diggory") { headerBg = "bg-yellow-500 text-stone-950 border-b-2 border-stone-900"; houseBorder = "border-yellow-600"; houseSymbol = "🦡"; }
    else if (name === "Luna Lovegood") { headerBg = "bg-blue-900 text-amber-300 border-b-2 border-amber-600"; houseBorder = "border-blue-950"; houseSymbol = "🦅"; }

    return (
      <div className={`w-28 h-40 rounded-xl shadow-xl border-2 ${houseBorder} flex flex-col overflow-hidden transform transition hover:-translate-y-2 cursor-pointer bg-amber-50/95 text-stone-900`}>
        <div className={`h-6 ${headerBg} flex items-center justify-center px-1 text-[9px] font-bold uppercase tracking-widest`}>Character</div>
        <div className="flex-1 flex flex-col items-center justify-between p-2 text-center">
          <div className="flex items-center gap-1"><span className="text-base">{houseSymbol}</span><span className="text-[11px] font-serif font-bold leading-tight">{name}</span></div>
          <div className="bg-white/80 border border-stone-300 rounded p-1 w-full"><p className="text-[8px] text-stone-700 leading-tight italic line-clamp-4">{effect || "Character ability."}</p></div>
        </div>
      </div>
    );
  }

  const isAnyColor = (colorSet && colorSet.includes("Any")) || (name && name.toLowerCase().includes("wild any"));
  if (type === 'wildcard' && isAnyColor) {
    return (
      <div className="w-28 h-40 rounded-xl shadow-xl border border-stone-400 flex flex-col justify-between p-3 bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 text-white relative transform transition hover:-translate-y-2 cursor-pointer group">
        <div className="flex justify-between items-start z-10">
          {value !== undefined && value > 0 && <span className="w-6 h-6 bg-stone-900 text-amber-400 font-black text-xs rounded-full flex items-center justify-center shadow border border-amber-500">{value}</span>}
          <span className="text-[7px] uppercase tracking-widest font-bold opacity-90">WILD ITEM</span>
        </div>
        <div className="text-center my-auto z-10 space-y-0.5">
          <span className="text-2xl font-black font-serif tracking-widest uppercase drop-shadow-lg block">WILD</span>
          <span className="text-[7.5px] font-sans font-semibold uppercase tracking-tight block leading-tight">{activeWildColor ? `AS ${activeWildColor}` : 'ANY COLOR'}</span>
        </div>
        <div className="text-center border-t border-white/20 pt-1 z-10"><span className="text-[7px] font-serif uppercase tracking-wider">CLICK TO CHANGE</span></div>
      </div>
    );
  }

  if (type === "action") {
    let actionBg = "bg-purple-600 text-white";
    let pointBgClass = "bg-stone-900 text-purple-300 border-purple-500";

    if (value === 1) { actionBg = "bg-slate-400 text-stone-900"; pointBgClass = "bg-stone-900 text-stone-300 border-stone-400"; }
    else if (value === 2) { actionBg = "bg-red-600 text-white"; pointBgClass = "bg-stone-900 text-red-300 border-red-500"; }
    else if (value === 3) { actionBg = "bg-blue-600 text-white"; pointBgClass = "bg-stone-900 text-blue-300 border-blue-500"; }
    else if (value === 4) { actionBg = "bg-emerald-600 text-white"; pointBgClass = "bg-stone-900 text-emerald-300 border-emerald-500"; }
    else if (value === 5) { actionBg = "bg-amber-600 text-white"; pointBgClass = "bg-stone-900 text-amber-300 border-amber-500"; }

    const isAccio = name.toLowerCase().includes("accio");
    const isAccioAny = isAccio && (name.toLowerCase().includes("any") || !colorSet || colorSet.includes("Any"));
    const isAccioDual = !isAccioAny && isAccio && colorSet && colorSet.includes("/");
    let col1 = ""; let col2 = "";
    if (isAccioDual) {
      const parts = colorSet.split("/");
      col1 = getPropertyColorClass(parts[0]).split(" ")[0];
      col2 = getPropertyColorClass(parts[1]).split(" ")[0];
    }

    return (
      <div className={`w-28 h-40 rounded-xl shadow-xl border-2 border-stone-900 flex flex-col justify-between p-2 overflow-hidden cursor-pointer transform transition hover:-translate-y-2 ${actionBg} relative`}>
        <div className="flex justify-between items-center z-10">
          {value !== undefined && <span className={`w-6 h-6 ${pointBgClass} font-black text-xs rounded-full flex items-center justify-center shadow-md border`}>{value}</span>}
          <span className="text-[8px] uppercase tracking-widest font-bold opacity-80">SPELL CARD</span>
        </div>

        <div className="flex flex-col items-center justify-center my-auto z-10 px-1 space-y-1.5">
          {isAccioAny ? (
            <div className={`w-9 h-9 rounded-full bg-gradient-to-r from-purple-600 via-pink-500 to-amber-500 flex items-center justify-center border-2 border-amber-200 shadow-md`}></div>
          ) : isAccioDual ? (
            <div className="w-9 h-9 rounded-full overflow-hidden flex border-2 border-amber-200 shadow-md">
              <div className={`w-1/2 h-full ${col1}`}></div>
              <div className={`w-1/2 h-full ${col2}`}></div>
            </div>
          ) : isAccio && colorSet ? (
            <div className={`w-9 h-9 rounded-full ${getPropertyColorClass(colorSet)} flex items-center justify-center border-2 border-amber-200 shadow-md`}>
              <span className="text-[7px] font-bold text-white uppercase">{colorSet}</span>
            </div>
          ) : null}

          <div className="w-5/6 bg-amber-100 text-stone-950 font-serif font-black text-[8.5px] uppercase tracking-tight py-1 px-1 text-center shadow-md border-y border-amber-600 rotate-[-2deg] leading-tight break-words">
            {isAccio ? "ACCIO" : name}
          </div>
        </div>

        <div className="bg-black/40 rounded-lg p-1.5 backdrop-blur-[1px] z-10">
          <p className="text-[7.5px] leading-tight text-stone-100 font-medium line-clamp-3 text-center italic">
            {isAccioAny ? "Collect points from each player for every item in a color" : (effect || "Cast spell effect.")}
          </p>
        </div>
      </div>
    );
  }

  // Property / Wildcard fallback return
  const set = colorSet || "Black";
  let topColorName = set;
  let bottomColorName = "";

  if (set.includes("/")) {
    const parts = set.split("/");
    topColorName = parts[0];
    bottomColorName = parts[1];
  }

  if (bottomColorName) {
    const activeColor = activeWildColor || topColorName;
    const isBottomActive = activeColor === bottomColorName;

    const topClass = getPropertyColorClass(topColorName);
    const bottomClass = getPropertyColorClass(bottomColorName);

    const getSetRentValues = (col: string) => {
      if (col.includes("Brown") || col.includes("Dark Blue")) return [1, 2];
      if (col.includes("Black")) return [1, 2, 3, 4];
      return [1, 3, 5];
    };

    const topRents = getSetRentValues(topColorName);
    const bottomRents = getSetRentValues(bottomColorName);

    return (
      <div className="w-28 h-40 rounded-xl shadow-xl border border-stone-400 flex flex-col overflow-hidden bg-stone-50 text-stone-900 relative group transform transition hover:-translate-y-2 cursor-pointer">
        <div className={`transition-transform duration-500 flex flex-col w-full h-full justify-between ${isBottomActive ? 'rotate-180' : 'rotate-0'}`}>
          <div className={`h-8 ${topClass} w-full flex items-center ${value ? 'justify-end pr-1' : 'justify-center'} px-1 text-center shrink-0 relative`} onClick={(e: any) => { if(onFlip) onFlip(e); }}>
            {value !== undefined && value > 0 && <span className="absolute left-1 top-1.5 w-5 h-5 bg-stone-900 text-amber-400 font-bold text-[10px] rounded-full flex items-center justify-center shadow border border-amber-500/50 z-10">{value}</span>}
            <span className={`text-[9px] font-black uppercase tracking-widest text-center ${value ? 'w-[75%]' : 'w-full'}`}>WILD</span>
          </div>

          <div className="flex-1 flex items-stretch relative text-[7.5px] overflow-hidden">
            <div className="w-1/2 flex flex-col justify-around p-1 border-r border-stone-300">
              {topRents.map((rent: number, idx: number) => {
                const count = idx + 1;
                return (
                  <div key={idx} className="flex justify-between items-center px-1 font-semibold">
                    <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                      {count === 1 && <div className={`w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} flex items-center justify-center text-[6px] font-bold text-white`}>1</div>}
                      {count === 2 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-0 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} flex items-center justify-center text-[6px] font-bold text-white z-10`}>2</div></div>}
                      {count === 3 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-12`}></div><div className={`absolute left-1 top-0.5 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-6`}></div><div className={`absolute left-2 top-0 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} flex items-center justify-center text-[5.5px] font-bold text-white z-10`}>3</div></div>}
                      {count === 4 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-12`}></div><div className={`absolute left-0.5 top-1 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-3`}></div><div className={`absolute left-1.5 top-0 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} flex items-center justify-center text-[5px] font-bold text-white z-10`}>4</div></div>}
                    </div>
                    <span className="font-bold text-xs">{rent}</span>
                  </div>
                );
              })}
            </div>
            <div className="absolute inset-x-0 top-0 bottom-0 flex items-center justify-center pointer-events-none z-10">
              <div className="w-2 h-full flex flex-col justify-between items-center py-1"><div className={`w-1.5 flex-1 ${topClass} rounded-full`}></div><div className={`w-1.5 flex-1 ${bottomClass} rounded-full`}></div></div>
            </div>
            <div className="w-1/2 flex flex-col justify-around p-1 rotate-180 bg-stone-100/50">
              {bottomRents.map((rent: number, idx: number) => {
                const count = idx + 1;
                return (
                  <div key={idx} className="flex justify-between items-center px-1 font-semibold">
                    <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                      {count === 1 && <div className={`w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${bottomClass} flex items-center justify-center text-[6px] font-bold text-white`}>1</div>}
                      {count === 2 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-0 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${bottomClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${bottomClass} flex items-center justify-center text-[6px] font-bold text-white z-10`}>2</div></div>}
                      {count === 3 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} transform -rotate-12`}></div><div className={`absolute left-1 top-0.5 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} transform -rotate-6`}></div><div className={`absolute left-2 top-0 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} flex items-center justify-center text-[5.5px] font-bold text-white z-10`}>3</div></div>}
                      {count === 4 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} transform -rotate-12`}></div><div className={`absolute left-0.5 top-1 w-3 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} transform -rotate-3`}></div><div className={`absolute left-1.5 top-0 w-3 h-2.5 rounded-[2px] border border-stone-800 ${bottomClass} flex items-center justify-center text-[5px] font-bold text-white z-10`}>4</div></div>}
                    </div>
                    <span className="font-bold text-xs">{rent}</span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className={`h-8 ${bottomClass} w-full flex items-center ${value ? 'justify-end pr-1' : 'justify-center'} px-1 text-center rotate-180 shrink-0 relative`} onClick={(e: any) => { if(onFlip) onFlip(e); }}>
            {value !== undefined && value > 0 && <span className="absolute left-1 top-1.5 w-5 h-5 bg-stone-900 text-amber-400 font-bold text-[10px] rounded-full flex items-center justify-center shadow border border-amber-500/50 z-10">{value}</span>}
            <span className={`text-[9px] font-black uppercase tracking-widest text-center ${value ? 'w-[75%]' : 'w-full'}`}>WILD</span>
          </div>
        </div>

        {!inHand && (
            <div className="absolute inset-0 bg-black/40 hover:bg-black/60 text-white font-bold text-[10px] flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity z-30 backdrop-blur-[1px] pointer-events-none">
              🔄 Click to Rotate
            </div>
        )}
      </div>
    );
  }

  const topClass = getPropertyColorClass(topColorName);
  const setCounts: { [key: string]: number } = {
    "Brown": 2, "Dark Blue": 2, "Light Green": 2, "Pink": 3, 
    "Orange": 3, "Yellow": 3, "Red": 3, "Light Blue": 3, 
    "Dark Green": 3, "Black": 4
  };
  const maxItems = setCounts[topColorName] || 3;
  const resolvedRentValues = rentValues || (maxItems === 2 ? [1, 2] : maxItems === 4 ? [1, 2, 3, 4] : [1, 3, 5]);

  return (
    <div className="w-28 h-40 rounded-xl shadow-xl border border-stone-400 flex flex-col overflow-hidden bg-stone-50 text-stone-900 transform transition hover:-translate-y-2 cursor-pointer">
      <div className="relative">
        {value !== undefined && value > 0 && <span className="absolute left-1 top-1.5 w-5 h-5 bg-stone-900 text-amber-400 font-bold text-[10px] rounded-full flex items-center justify-center shadow z-10 border border-amber-500/50">{value}</span>}
        <div className={`h-8 ${topClass} w-full flex items-center ${value ? 'justify-end pr-2' : 'justify-center'} px-1 border-b border-stone-400 shadow-sm relative`}>
          <span className={`${name.length > 12 ? 'text-[6px] leading-[1.1]' : 'text-[7.5px] leading-tight'} font-bold uppercase tracking-tight break-words line-clamp-2 text-center ${value ? 'w-[75%]' : 'w-full'}`}>{name}</span>
        </div>
      </div>

      <div className="flex-1 flex flex-col px-1.5 pt-1 pb-1 justify-between text-[8px] overflow-hidden">
        <div className="grid grid-cols-2 text-center font-bold text-stone-500 border-b border-stone-200 pb-0.5 shrink-0">
          <span>ITEMS OWNED</span>
          <span>POINTS</span>
        </div>
        <div className="flex-1 flex flex-col justify-around px-1 min-h-0">
          {resolvedRentValues.map((rent: number, idx: number) => {
            const count = idx + 1;
            return (
              <div key={idx} className="flex justify-between items-center text-stone-800 font-semibold border-b border-stone-100 last:border-0 py-[1.5px]">
                <div className="relative w-5 h-5 flex items-center justify-center shrink-0">
                  {count === 1 && <div className={`w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} flex items-center justify-center text-[6px] font-bold text-white`}>1</div>}
                  {count === 2 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-0 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-4 h-3 rounded-[2px] border border-stone-800 shadow-sm ${topClass} flex items-center justify-center text-[6px] font-bold text-white z-10`}>2</div></div>}
                  {count === 3 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-12`}></div><div className={`absolute left-1 top-0.5 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-6`}></div><div className={`absolute left-2 top-0 w-3.5 h-2.5 rounded-[2px] border border-stone-800 ${topClass} flex items-center justify-center text-[5.5px] font-bold text-white z-10`}>3</div></div>}
                  {count === 4 && <div className="relative w-5 h-4"><div className={`absolute left-0 top-1.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-12`}></div><div className={`absolute left-0.5 top-1 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-6`}></div><div className={`absolute left-1 top-0.5 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} transform -rotate-3`}></div><div className={`absolute left-1.5 top-0 w-3 h-2.5 rounded-[2px] border border-stone-800 ${topClass} flex items-center justify-center text-[5px] font-bold text-white z-10`}>4</div></div>}
                </div>
                <span className="font-bold text-xs text-stone-900">{rent}</span>
              </div>
            );
          })}
        </div>
        <div className="text-center text-[6px] font-bold uppercase tracking-wider text-stone-500 shrink-0 pt-0.5">
          Complete Set ({maxItems} Items)
        </div>
      </div>
    </div>
  );
}