const PLAYERS = ['South', 'John', 'Andy', 'Dave'];
const SUIT_NAMES = { H: 'Hearts ♥', D: 'Diamonds ♦', C: 'Clubs ♣', S: 'Spades ♠', N: 'No Trump' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };
const RANK_ORDER = { '3': 3, '5': 5, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

let gameState = {
  phase: 'BIDDING',
  dealerIndex: 0,
  activePlayer: 1,
  highBid: { amount: 6, suit: null, playerIndex: -1 },
  bids: [null, null, null, null],
  scores: { us: 0, them: 0 },
  tricksWon: { us: 0, them: 0 },
  handPoints: { us: 0, them: 0 },
  trumpSuit: null,
  hands: [[], [], [], []],
  currentTrick: [],
  leadSuit: null,
  isStuckDealer: false
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-start-game').addEventListener('click', startNewMatch);
  document.getElementById('btn-restart-game').addEventListener('click', startNewMatch);
  document.getElementById('btn-submit-bid').addEventListener('click', handleHumanBid);
  document.getElementById('btn-pass').addEventListener('click', handleHumanPass);
});

function createDeck() {
  const suits = ['H', 'D', 'C', 'S'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];

  suits.forEach(suit => {
    ranks.forEach(rank => {
      if ((suit === 'H' && rank === '7') || (suit === 'S' && rank === '7')) return;
      deck.push({ suit, rank });
    });
  });

  deck.push({ suit: 'S', rank: '3' }); // Low card (-3 pts)
  deck.push({ suit: 'H', rank: '5' }); // High card (+5 pts)
  return deck;
}

function shuffleDeck(deck) {
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  return deck;
}

function dealCards() {
  const deck = shuffleDeck(createDeck());
  gameState.hands = [[], [], [], []];

  for (let i = 0; i < deck.length; i++) {
    gameState.hands[i % 4].push(deck[i]);
  }

  const suitOrder = { H: 0, D: 1, C: 2, S: 3 };

  gameState.hands[0].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return RANK_ORDER[a.rank] - RANK_ORDER[b.rank];
  });
}

function startNewMatch() {
  document.getElementById('welcome-modal').classList.add('hidden');
  document.getElementById('gameover-modal').classList.add('hidden');
  gameState.scores = { us: 0, them: 0 };
  gameState.dealerIndex = 0;
  startNewHand();
}

function startNewHand() {
  gameState.phase = 'BIDDING';
  gameState.highBid = { amount: 6, suit: null, playerIndex: -1 };
  gameState.bids = [null, null, null, null];
  gameState.trumpSuit = null;
  gameState.currentTrick = [];
  gameState.leadSuit = null;
  gameState.tricksWon = { us: 0, them: 0 };
  gameState.handPoints = { us: 0, them: 0 };
  gameState.isStuckDealer = false;

  dealCards();
  gameState.activePlayer = (gameState.dealerIndex + 1) % 4;

  for (let i = 0; i < 4; i++) {
    const dialog = document.getElementById(`bid-dialog-${i}`);
    if (dialog) {
      dialog.textContent = '';
      dialog.classList.add('hidden');
    }
  }

  updateUI();
  checkAutoBid();
}

function checkAutoBid() {
  if (gameState.phase !== 'BIDDING') return;

  if (gameState.activePlayer === 0) {
    setupHumanBiddingUI();
  } else {
    document.getElementById('bidding-panel').classList.add('hidden');
    setTimeout(processAIBid, 600);
  }
}

function setupHumanBiddingUI() {
  const panel = document.getElementById('bidding-panel');
  const btnPass = document.getElementById('btn-pass');
  const amountSelect = document.getElementById('bid-amount');
  const header = document.getElementById('bidding-header');
  const amountLabel = document.getElementById('lbl-bid-amount');

  if (gameState.isStuckDealer) {
    header.textContent = "You are Stuck Dealer (Forced Bid 7)";
    btnPass.classList.add('hidden');
    amountSelect.classList.add('hidden');
    amountLabel.classList.add('hidden');
  } else {
    header.textContent = "Your Bid";
    btnPass.classList.remove('hidden');
    amountSelect.classList.remove('hidden');
    amountLabel.classList.remove('hidden');
  }

  panel.classList.remove('hidden');
}

/* ==========================================
   ENHANCED HEURISTIC AI BIDDING EVALUATION
   ========================================== */
function evaluateHandForBidding(pIndex) {
  const hand = gameState.hands[pIndex];
  const suits = ['H', 'D', 'C', 'S'];
  let bestSuit = 'H';
  let bestScore = -1;
  let bestEstimatedTricks = 0;

  const hasFiveHearts = hand.some(c => c.suit === 'H' && c.rank === '5');
  const hasThreeSpades = hand.some(c => c.suit === 'S' && c.rank === '3');

  suits.forEach(suit => {
    let suitCards = hand.filter(c => c.suit === suit);
    let topTrumps = suitCards.filter(c => RANK_ORDER[c.rank] >= 11).length; // J, Q, K, A
    let highOffSuitAces = hand.filter(c => c.suit !== suit && c.rank === 'A').length;

    // Base trick estimation
    let estTricks = suitCards.length * 0.85 + topTrumps * 1.1 + highOffSuitAces * 1.0;

    // Heavy weight boost for holding 5♥ (+5 pts)
    if (hasFiveHearts) {
      estTricks += 2.0; 
    }

    // Minor penalty for holding 3♠ (-3 pts)
    if (hasThreeSpades) {
      estTricks -= 0.5;
    }

    if (estTricks > bestScore) {
      bestScore = estTricks;
      bestSuit = suit;
      bestEstimatedTricks = Math.floor(estTricks);
    }
  });

  // Evaluate No Trump capability
  let highCardsCount = hand.filter(c => RANK_ORDER[c.rank] >= 12).length; // Q, K, A
  let noTrumpTricks = highCardsCount * 1.1 + (hasFiveHearts ? 1.5 : 0);

  if (noTrumpTricks >= 7 && noTrumpTricks > bestEstimatedTricks) {
    return { suit: 'N', estimatedTricks: Math.min(12, Math.floor(noTrumpTricks)) };
  }

  return { suit: bestSuit, estimatedTricks: Math.min(12, bestEstimatedTricks) };
}

function processAIBid() {
  const pIndex = gameState.activePlayer;

  if (gameState.isStuckDealer) {
    const evalResult = evaluateHandForBidding(pIndex);
    recordBid(pIndex, 7, evalResult.suit);
    advanceBidding();
    return;
  }

  const evalResult = evaluateHandForBidding(pIndex);
  const minRequiredBid = gameState.highBid.amount + 1;

  if (evalResult.estimatedTricks >= minRequiredBid && minRequiredBid <= 12) {
    recordBid(pIndex, minRequiredBid, evalResult.suit);
  } else {
    recordBid(pIndex, 0, 'PASS');
  }

  advanceBidding();
}

function handleHumanBid() {
  const suit = document.getElementById('bid-suit').value;

  if (gameState.isStuckDealer) {
    recordBid(0, 7, suit);
  } else {
    const amount = parseInt(document.getElementById('bid-amount').value, 10);
    if (amount <= gameState.highBid.amount) {
      alert(`Bid must be higher than ${gameState.highBid.amount}`);
      return;
    }
    recordBid(0, amount, suit);
  }

  document.getElementById('bidding-panel').classList.add('hidden');
  advanceBidding();
}

function handleHumanPass() {
  recordBid(0, 0, 'PASS');
  document.getElementById('bidding-panel').classList.add('hidden');
  advanceBidding();
}

function recordBid(playerIndex, amount, suit) {
  const dialog = document.getElementById(`bid-dialog-${playerIndex}`);

  if (suit === 'PASS' || amount === 0) {
    gameState.bids[playerIndex] = 'Pass';
    if (dialog) dialog.textContent = 'Pass';
  } else {
    gameState.highBid = { amount, suit, playerIndex };
    const label = `${amount} ${SUIT_NAMES[suit] || suit}`;
    gameState.bids[playerIndex] = label;
    if (dialog) dialog.textContent = label;
  }

  if (dialog) dialog.classList.remove('hidden');
}

function advanceBidding() {
  const totalBids = gameState.bids.filter(b => b !== null).length;

  if (totalBids < 4) {
    gameState.activePlayer = (gameState.activePlayer + 1) % 4;
    checkAutoBid();
    return;
  }

  // Check if all players passed
  const allPassed = gameState.bids.every(b => b === 'Pass');
  if (allPassed && !gameState.isStuckDealer) {
    gameState.isStuckDealer = true;
    gameState.activePlayer = gameState.dealerIndex; // Forced dealer bid
    gameState.bids[gameState.dealerIndex] = null; // Reset dealer's bid slot for prompt
    checkAutoBid();
    return;
  }

  finishBidding();
}

function finishBidding() {
  gameState.phase = 'PLAYING';
  if (gameState.highBid.playerIndex !== -1) {
    gameState.trumpSuit = gameState.highBid.suit;
    document.getElementById('trump-suit').textContent = SUIT_NAMES[gameState.trumpSuit] || 'None';
    gameState.activePlayer = gameState.highBid.playerIndex;
  } else {
    document.getElementById('trump-suit').textContent = 'No Bid';
    gameState.activePlayer = (gameState.dealerIndex + 1) % 4;
  }

  updateUI();
  processPlayTurn();
}

function processPlayTurn() {
  if (gameState.phase !== 'PLAYING') return;

  if (gameState.activePlayer !== 0) {
    setTimeout(playAICard, 700);
  }
}

/* ==========================================
   HIGH-PRIORITY 5♥ & 3♠ AI PLAY LOGIC
   ========================================== */
function playAICard() {
  const pIndex = gameState.activePlayer;
  const hand = gameState.hands[pIndex];
  if (!hand || hand.length === 0) return;

  let legalCards = hand;
  if (gameState.leadSuit) {
    const matching = hand.filter(c => c.suit === gameState.leadSuit);
    if (matching.length > 0) legalCards = matching;
  }

  let chosenCard = null;
  const partnerIndex = (pIndex + 2) % 4;

  const fiveHearts = legalCards.find(c => c.suit === 'H' && c.rank === '5');
  const threeSpades = legalCards.find(c => c.suit === 'S' && c.rank === '3');

  // -------------------------------------------------------------
  // SCENARIO 1: LEADING A TRICK
  // -------------------------------------------------------------
  if (gameState.currentTrick.length === 0) {
    // Priority A: Lead high Aces/Trumps to sweep the 5♥ safely into team's pile if possible
    const aces = legalCards.filter(c => c.rank === 'A');
    if (aces.length > 0) {
      chosenCard = aces[0];
    } else {
      // Avoid leading 5♥ or 3♠ directly when starting a trick
      const safeLeads = legalCards.filter(c => !(c.suit === 'H' && c.rank === '5') && !(c.suit === 'S' && c.rank === '3'));
      chosenCard = safeLeads.length > 0 ? safeLeads[0] : legalCards[0];
    }
  } 
  // -------------------------------------------------------------
  // SCENARIO 2: FOLLOWING / DEFENDING TRICK
  // -------------------------------------------------------------
  else {
    let currentWinner = getCurrentTrickWinner();
    let isPartnerWinning = currentWinner && currentWinner.playerIndex === partnerIndex;
    
    // Check if 5♥ or 3♠ are currently in the trick on the table
    const isFiveHeartsPlayed = gameState.currentTrick.some(p => p.card.suit === 'H' && p.card.rank === '5');
    const isThreeSpadesPlayed = gameState.currentTrick.some(p => p.card.suit === 'S' && p.card.rank === '3');

    // --- CASE 2A: PARTNER IS CURRENTLY WINNING THE TRICK ---
    if (isPartnerWinning) {
      // MAXIMUM PRIORITY: Slough 5♥ onto partner's winning trick!
      if (fiveHearts) {
        chosenCard = fiveHearts;
      } 
      // Do NOT throw 3♠ (-3 pts) onto partner's trick unless forced
      else {
        const nonThreeSpades = legalCards.filter(c => !(c.suit === 'S' && c.rank === '3'));
        if (nonThreeSpades.length > 0) {
          // Play lowest safe card
          nonThreeSpades.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
          chosenCard = nonThreeSpades[0];
        } else {
          chosenCard = threeSpades;
        }
      }
    } 
    // --- CASE 2B: OPPONENT IS CURRENTLY WINNING THE TRICK ---
    else {
      // PRIORITY 1: 5♥ IS ON THE TABLE! MUST TRY TO WIN THIS TRICK AT ALL COSTS!
      if (isFiveHeartsPlayed) {
        let winningCards = legalCards.filter(c => beatsCurrentBest(c, currentWinner.card));
        if (winningCards.length > 0) {
          // Play highest winning trump/card to secure the 5♥
          winningCards.sort((a, b) => RANK_ORDER[b.rank] - RANK_ORDER[a.rank]);
          chosenCard = winningCards[0];
        }
      }

      // PRIORITY 2: OPPONENT IS WINNING AND WE CAN'T OVERTAKE -> DUMP 3♠ ON OPPONENTS
      if (!chosenCard && threeSpades) {
        let winningCards = legalCards.filter(c => beatsCurrentBest(c, currentWinner.card));
        // If we can't beat opponent's card OR if 3♠ is legal to drop
        if (winningCards.length === 0 || gameState.leadSuit === 'S') {
          chosenCard = threeSpades;
        }
      }

      // PRIORITY 3: STANDARD DEFENSIVE WINNING / SLOUGHING
      if (!chosenCard) {
        let winningCards = legalCards.filter(c => beatsCurrentBest(c, currentWinner.card));
        if (winningCards.length > 0) {
          // Win trick with lowest necessary card
          winningCards.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
          chosenCard = winningCards[0];
        } else {
          // Lose trick: slough lowest card, preserving trumps/Aces
          const safeLosses = legalCards.filter(c => !(c.suit === 'H' && c.rank === '5'));
          if (safeLosses.length > 0) {
            safeLosses.sort((a, b) => RANK_ORDER[a.rank] - RANK_ORDER[b.rank]);
            chosenCard = safeLosses[0];
          } else {
            chosenCard = legalCards[0];
          }
        }
      }
    }
  }

  if (!chosenCard) chosenCard = legalCards[0];
  playCard(pIndex, chosenCard);
}

function getCurrentTrickWinner() {
  if (gameState.currentTrick.length === 0) return null;
  let winnerObj = gameState.currentTrick[0];

  for (let i = 1; i < gameState.currentTrick.length; i++) {
    const play = gameState.currentTrick[i];
    if (beatsCurrentBest(play.card, winnerObj.card)) {
      winnerObj = play;
    }
  }
  return winnerObj;
}

function beatsCurrentBest(cardCandidate, bestCard) {
  if (cardCandidate.suit === gameState.trumpSuit && bestCard.suit !== gameState.trumpSuit) {
    return true;
  }
  if (cardCandidate.suit === bestCard.suit) {
    return RANK_ORDER[cardCandidate.rank] > RANK_ORDER[bestCard.rank];
  }
  return false;
}

function handleHumanCardClick(cardIndex) {
  if (gameState.phase !== 'PLAYING' || gameState.activePlayer !== 0) return;

  const hand = gameState.hands[0];
  const chosenCard = hand[cardIndex];

  if (gameState.leadSuit && chosenCard.suit !== gameState.leadSuit) {
    const hasLeadSuit = hand.some(c => c.suit === gameState.leadSuit);
    if (hasLeadSuit) {
      alert(`You must follow suit (${SUIT_NAMES[gameState.leadSuit]})!`);
      return;
    }
  }

  playCard(0, chosenCard);
}

function playCard(playerIndex, card) {
  const hand = gameState.hands[playerIndex];
  const cardIdx = hand.findIndex(c => c.suit === card.suit && c.rank === card.rank);
  if (cardIdx !== -1) hand.splice(cardIdx, 1);

  if (gameState.currentTrick.length === 0) {
    gameState.leadSuit = card.suit;
  }

  gameState.currentTrick.push({ card, playerIndex });
  updateUI();

  if (gameState.currentTrick.length === 4) {
    setTimeout(resolveTrick, 1200);
  } else {
    gameState.activePlayer = (gameState.activePlayer + 1) % 4;
    processPlayTurn();
  }
}

function resolveTrick() {
  let winnerObj = getCurrentTrickWinner();
  const winnerTeam = (winnerObj.playerIndex === 0 || winnerObj.playerIndex === 2) ? 'us' : 'them';
  
  gameState.tricksWon[winnerTeam]++;

  // Score base trick (+1 pt), 5♥ (+5 pts), and 3♠ (-3 pts)
  let trickPoints = 1;
  gameState.currentTrick.forEach(play => {
    if (play.card.suit === 'H' && play.card.rank === '5') trickPoints += 5;
    if (play.card.suit === 'S' && play.card.rank === '3') trickPoints -= 3;
  });

  gameState.handPoints[winnerTeam] += trickPoints;

  gameState.activePlayer = winnerObj.playerIndex;
  gameState.currentTrick = [];
  gameState.leadSuit = null;

  updateUI();

  if (gameState.hands[0].length === 0) {
    evaluateHandScore();
  } else {
    processPlayTurn();
  }
}

function evaluateHandScore() {
  const biddingTeam = (gameState.highBid.playerIndex === 0 || gameState.highBid.playerIndex === 2) ? 'us' : 'them';
  const defenderTeam = biddingTeam === 'us' ? 'them' : 'us';
  const bidAmount = gameState.highBid.amount;
  const isNoTrump = (gameState.trumpSuit === 'N');

  let handResultMsg = isNoTrump ? `Hand Complete (NO TRUMP - Standard Points)!\n\n` : `Hand Complete!\n\n`;

  // Bidding team score evaluation (No Trump doubling disabled per rules)
  if (gameState.handPoints[biddingTeam] >= bidAmount) {
    const gained = gameState.handPoints[biddingTeam];
    gameState.scores[biddingTeam] += gained;
    handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) made their bid of ${bidAmount} (took ${gameState.handPoints[biddingTeam]} pts) and scored +${gained} points.\n`;
  } else {
    const penalty = bidAmount;
    gameState.scores[biddingTeam] -= penalty;
    handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) set! Failed bid of ${bidAmount}. Lost -${penalty} points.\n`;
  }

  // Defending team score evaluation
  const defenderGained = gameState.handPoints[defenderTeam];
  gameState.scores[defenderTeam] += defenderGained;
  handResultMsg += `Defenders (${defenderTeam.toUpperCase()}) scored +${defenderGained} points.`;

  alert(handResultMsg);

  // Check Game Over Conditions (Win at 52, Lose at -52)
  if (checkMatchEnding()) return;

  gameState.dealerIndex = (gameState.dealerIndex + 1) % 4;
  startNewHand();
}

function checkMatchEnding() {
  const us = gameState.scores.us;
  const them = gameState.scores.them;
  let gameOver = false;
  let title = "";
  let msg = "";

  if (us >= 52) {
    title = "Congratulations! You Won!";
    msg = `Your team reached ${us} points!`;
    gameOver = true;
  } else if (them >= 52) {
    title = "Game Over - Opponents Won";
    msg = `Opponents reached ${them} points.`;
    gameOver = true;
  } else if (us <= -52) {
    title = "Game Over - Defeat";
    msg = `Your team dropped to ${us} points (-52 threshold reached).`;
    gameOver = true;
  } else if (them <= -52) {
    title = "Victory!";
    msg = `Opponents dropped to ${them} points (-52 threshold reached).`;
    gameOver = true;
  }

  if (gameOver) {
    document.getElementById('gameover-title').textContent = title;
    document.getElementById('gameover-message').textContent = msg;
    document.getElementById('gameover-modal').classList.remove('hidden');
    return true;
  }
  return false;
}

function updateUI() {
  const dealerBadge = document.getElementById('dealer-indicator');
  if (dealerBadge) {
    dealerBadge.className = `dealer-${gameState.dealerIndex}`;
  }

  const dirs = ['south', 'west', 'north', 'east'];
  dirs.forEach((dir) => {
    const cardContainer = document.querySelector(`#${dir} .cards-container`);
    if (cardContainer) cardContainer.innerHTML = '';
  });

  // South hand
  const southContainer = document.querySelector('#south .cards-container');
  if (southContainer && gameState.hands[0]) {
    gameState.hands[0].forEach((card, index) => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.suit === 'H' || card.suit === 'D' ? 'red' : 'black'}`;
      cardEl.textContent = `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
      cardEl.style.cursor = 'pointer';
      cardEl.addEventListener('click', () => handleHumanCardClick(index));
      southContainer.appendChild(cardEl);
    });
  }

  // AI hands face-down
  [1, 2, 3].forEach(playerIdx => {
    const dir = dirs[playerIdx];
    const container = document.querySelector(`#${dir} .cards-container`);
    if (container && gameState.hands[playerIdx]) {
      gameState.hands[playerIdx].forEach(() => {
        const cardEl = document.createElement('div');
        cardEl.className = 'card back';
        cardEl.textContent = '🂠';
        container.appendChild(cardEl);
      });
    }
  });

  // Spatial Trick Area Rendering
  const trickArea = document.getElementById('trick-area');
  if (trickArea) {
    trickArea.innerHTML = '';
    gameState.currentTrick.forEach(play => {
      const cardEl = document.createElement('div');
      cardEl.className = `card trick-card played-${play.playerIndex} ${play.card.suit === 'H' || play.card.suit === 'D' ? 'red' : 'black'}`;
      cardEl.textContent = `${play.card.rank}${SUIT_SYMBOLS[play.card.suit]}`;
      trickArea.appendChild(cardEl);
    });
  }

  // Scoreboard updates
  document.getElementById('score-us').textContent = gameState.scores.us;
  document.getElementById('score-them').textContent = gameState.scores.them;
  document.getElementById('tricks-us-count').textContent = gameState.tricksWon.us;
  document.getElementById('tricks-them-count').textContent = gameState.tricksWon.them;
}