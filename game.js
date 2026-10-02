const PLAYERS = ['South', 'West', 'North', 'East'];
const SUIT_NAMES = { H: 'Hearts ♥', D: 'Diamonds ♦', C: 'Clubs ♣', S: 'Spades ♠', N: 'No Trump' };
const SUIT_SYMBOLS = { H: '♥', D: '♦', C: '♣', S: '♠' };

let gameState = {
  phase: 'BIDDING',
  dealerIndex: 0,
  activePlayer: 1,
  highBid: { amount: 6, suit: null, playerIndex: -1 },
  bids: [null, null, null, null],
  scores: { us: 0, them: 0 },
  trumpSuit: null,
  hands: [[], [], [], []]
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

  // Standard 32-card Kaiser deck construction
  suits.forEach(suit => {
    ranks.forEach(rank => {
      // Exclude 7 of Clubs and 7 of Hearts to allow 3 of Clubs and 5 of Hearts
      if ((suit === 'C' && rank === '7') || (suit === 'H' && rank === '7')) return;
      deck.push({ suit, rank });
    });
  });

  deck.push({ suit: 'C', rank: '3' }); // Low card (-3 pts)
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

  // Sort South's hand by suit and rank for easy viewing
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
  gameState.dealerIndex = 0; // South deals first
  startNewHand();
}

function startNewHand() {
  gameState.phase = 'BIDDING';
  gameState.highBid = { amount: 6, suit: null, playerIndex: -1 };
  gameState.bids = [null, null, null, null];
  gameState.trumpSuit = null;

  // 1. Deal cards to all players first
  dealCards();

  // 2. West bids first when South is dealer
  gameState.activePlayer = (gameState.dealerIndex + 1) % 4;

  // Clear dialogs
  for (let i = 0; i < 4; i++) {
    const dialog = document.getElementById(`bid-dialog-${i}`);
    if (dialog) {
      dialog.textContent = '';
      dialog.classList.add('hidden');
    }
  }

  // 3. Render cards on table so player can see their hand
  updateUI();

  // 4. Trigger bidding sequence
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
  } else {
    document.getElementById('trump-suit').textContent = 'No Bid';
  }

  updateUI();
}

function updateUI() {
  const dealerBadge = document.getElementById('dealer-indicator');
  if (dealerBadge) {
    dealerBadge.className = `dealer-${gameState.dealerIndex}`;
  }

  // Clear player hands DOM
  const dirs = ['south', 'west', 'north', 'east'];
  dirs.forEach((dir) => {
    const cardContainer = document.querySelector(`#${dir} .cards-container`);
    if (cardContainer) cardContainer.innerHTML = '';
  });

  // Render South (human) face-up cards
  const southContainer = document.querySelector('#south .cards-container');
  if (southContainer && gameState.hands[0]) {
    gameState.hands[0].forEach(card => {
      const cardEl = document.createElement('div');
      cardEl.className = `card ${card.suit === 'H' || card.suit === 'D' ? 'red' : 'black'}`;
      cardEl.textContent = `${card.rank}${SUIT_SYMBOLS[card.suit]}`;
      southContainer.appendChild(cardEl);
    });
  }

  // Render face-down cards for AI opponents (West, North, East)
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

  // Update scores
  document.getElementById('score-us').textContent = gameState.scores.us;
  document.getElementById('score-them').textContent = gameState.scores.them;
}