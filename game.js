const PLAYERS = ['South', 'West', 'North', 'East'];
const SUIT_NAMES = { H: 'Hearts ♥', D: 'Diamonds ♦', C: 'Clubs ♣', S: 'Spades ♠', N: 'No Trump' };

let gameState = {
  phase: 'BIDDING', // 'BIDDING' or 'PLAYING'
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

function initNewMatch() {
  gameState.dealerIndex = 0; // South deals first
  startNewHand();
}

function startNewHand() {
  gameState.phase = 'BIDDING';
  gameState.highBid = { amount: 6, suit: null, playerIndex: -1 };
  gameState.bids = [null, null, null, null];
  gameState.trumpSuit = null;
  
  // West bids first when South is dealer
  gameState.activePlayer = (gameState.dealerIndex + 1) % 4;

  // Clear dialogs
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
    // Human turn: display bidding panel
    document.getElementById('bidding-panel').classList.remove('hidden');
  } else {
    // Computer turn: hide panel and simulate bid after brief delay
    document.getElementById('bidding-panel').classList.add('hidden');
    setTimeout(processAIBid, 600);
  }
}

function processAIBid() {
  const pIndex = gameState.activePlayer;
  
  // Simple AI logic: pass or bid 7
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
  // Check if all 4 players have bid/passed
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
  // Update dealer indicator position
  const dealerBadge = document.getElementById('dealer-indicator');
  dealerBadge.className = `dealer-${gameState.dealerIndex}`;

  // Re-render card containers without removing the bid dialogs
  ['south', 'west', 'north', 'east'].forEach((dir) => {
    const cardContainer = document.querySelector(`#${dir} .cards-container`);
    if (cardContainer) {
      cardContainer.innerHTML = ''; // Safely clears cards only
    }
  });

  // Update scores
  document.getElementById('score-us').textContent = gameState.scores.us;
  document.getElementById('score-them').textContent = gameState.scores.them;
}