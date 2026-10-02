const PLAYERS = ['South', 'John', 'Andy', 'Dave'];
const SUIT_NAMES = { H: 'Hearts ♥', D: 'Diamonds ♦', C: 'Clubs ♣', S: 'Spades ♠', N: 'No Trump' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };

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
  leadSuit: null
};

document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('btn-submit-bid').addEventListener('click', handleHumanBid);
  document.getElementById('btn-pass').addEventListener('click', handleHumanPass);
  initNewMatch();
});

function createDeck() {
  const suits = ['H', 'D', 'C', 'S'];
  const ranks = ['7', '8', '9', '10', 'J', 'Q', 'K', 'A'];
  let deck = [];

  // Exclude 7 of Hearts and 7 of Spades so deck size remains 32 cards
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
  const rankOrder = { '3': 3, '5': 5, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };

  gameState.hands[0].sort((a, b) => {
    if (suitOrder[a.suit] !== suitOrder[b.suit]) {
      return suitOrder[a.suit] - suitOrder[b.suit];
    }
    return rankOrder[a.rank] - rankOrder[b.rank];
  });
}

function initNewMatch() {
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
    document.getElementById('bidding-panel').classList.remove('hidden');
  } else {
    document.getElementById('bidding-panel').classList.add('hidden');
    setTimeout(processAIBid, 600);
  }
}

function processAIBid() {
  const pIndex = gameState.activePlayer;

  if (gameState.highBid.amount < 7) {
    recordBid(pIndex, 7, 'H');
  } else {
    recordBid(pIndex, 0, 'PASS');
  }

  advanceBidding();
}

function handleHumanBid() {
  const amount = parseInt(document.getElementById('bid-amount').value, 10);
  const suit = document.getElementById('bid-suit').value;

  if (amount <= gameState.highBid.amount) {
    alert(`Bid must be higher than ${gameState.highBid.amount}`);
    return;
  }

  recordBid(0, amount, suit);
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

  if (totalBids >= 4) {
    finishBidding();
  } else {
    gameState.activePlayer = (gameState.activePlayer + 1) % 4;
    checkAutoBid();
  }
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

function playAICard() {
  const hand = gameState.hands[gameState.activePlayer];
  if (!hand || hand.length === 0) return;

  let legalCards = hand;
  if (gameState.leadSuit) {
    const matching = hand.filter(c => c.suit === gameState.leadSuit);
    if (matching.length > 0) legalCards = matching;
  }

  const chosenCard = legalCards[0];
  playCard(gameState.activePlayer, chosenCard);
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

function getCardValue(rank) {
  const rankOrder = { '3': 3, '5': 5, '7': 7, '8': 8, '9': 9, '10': 10, 'J': 11, 'Q': 12, 'K': 13, 'A': 14 };
  return rankOrder[rank] || 0;
}

function resolveTrick() {
  let winnerObj = gameState.currentTrick[0];

  for (let i = 1; i < gameState.currentTrick.length; i++) {
    const play = gameState.currentTrick[i];
    const bestCard = winnerObj.card;
    const currentCard = play.card;

    if (currentCard.suit === gameState.trumpSuit && bestCard.suit !== gameState.trumpSuit) {
      winnerObj = play;
    } else if (currentCard.suit === bestCard.suit) {
      if (getCardValue(currentCard.rank) > getCardValue(bestCard.rank)) {
        winnerObj = play;
      }
    }
  }

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

  let handResultMsg = `Hand Complete!\n\n`;

  if (gameState.handPoints[biddingTeam] >= bidAmount) {
    gameState.scores[biddingTeam] += gameState.handPoints[biddingTeam];
    handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) made their bid of ${bidAmount} and scored ${gameState.handPoints[biddingTeam]} points.\n`;
  } else {
    gameState.scores[biddingTeam] -= bidAmount;
    handResultMsg += `Bidding team (${biddingTeam.toUpperCase()}) set! Failed bid of ${bidAmount}. Lost ${bidAmount} points.\n`;
  }

  gameState.scores[defenderTeam] += gameState.handPoints[defenderTeam];
  handResultMsg += `Defenders (${defenderTeam.toUpperCase()}) scored ${gameState.handPoints[defenderTeam]} points.`;

  alert(handResultMsg);

  gameState.dealerIndex = (gameState.dealerIndex + 1) % 4;
  startNewHand();
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

  // Render Trick Area in Compass/Spatial Layout
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