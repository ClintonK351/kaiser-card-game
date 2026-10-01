const SUITS = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
const SUIT_SYMBOLS = { 'Hearts': '♥', 'Diamonds': '♦', 'Spades': '♠', 'Clubs': '♣' };
const RANKS = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];

const RANK_VALUE = {
    '3': 7, '5': 7, '7': 7, '8': 8, '9': 9, '10': 10, 
    'Jack': 11, 'Queen': 12, 'King': 13, 'Ace': 14
};

let gameState = {
    deck: [],
    hands: [[], [], [], []], // 0: South, 1: West, 2: North, 3: East
    dealerIndex: 0,
    currentPlayer: 0,
    bidding: {
        currentBid: 5,
        highBidder: null,
        trumpSuit: null,
        activePlayer: 1,
        biddingComplete: false,
        history: []
    },
    trick: {
        cards: [], // Array of { player, card }
        leadSuit: null,
        count: 0
    },
    scores: {
        team1: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 }, // South (0) & North (2)
        team2: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 }  // West (1) & East (3)
    },
    matchScore: {
        team1: 0,
        team2: 0
    }
};

/**
 * Initialize and shuffle the Kaiser deck
 */
function createDeck() {
    let deck = [];
    SUITS.forEach(suit => {
        RANKS.forEach(rank => {
            let finalRank = rank;
            let value = 0;

            if (suit === 'Hearts' && rank === '7') finalRank = '5';
            if (suit === 'Spades' && rank === '7') finalRank = '3';

            if (suit === 'Hearts' && finalRank === '5') value = 5;
            if (suit === 'Spades' && finalRank === '3') value = -3;

            deck.push({ suit, rank: finalRank, value });
        });
    });
    return shuffle(deck);
}

function shuffle(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

function deal() {
    gameState.deck = createDeck();
    gameState.hands = [[], [], [], []];
    for (let i = 0; i < 8; i++) {
        for (let p = 0; p < 4; p++) {
            gameState.hands[p].push(gameState.deck.pop());
        }
    }
    // Sort human hand by suit and rank for better UI
    gameState.hands[0].sort((a, b) => {
        if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
        const rankOrder = ['3', '5', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });

    initBidding();
}

function initBidding() {
    gameState.bidding = {
        currentBid: 5,
        highBidder: null,
        trumpSuit: null,
        activePlayer: (gameState.dealerIndex + 1) % 4,
        biddingComplete: false,
        history: []
    };
    updateUI();
    checkAutoBid();
}

function checkAutoBid() {
    if (gameState.bidding.biddingComplete) return;
    
    if (gameState.bidding.activePlayer !== 0) {
        setTimeout(() => {
            const aiBid = getAIBid(gameState.bidding.activePlayer, gameState.bidding.currentBid);
            if (aiBid) {
                placeBid(gameState.bidding.activePlayer, aiBid.amount, aiBid.suit);
            } else {
                passBid(gameState.bidding.activePlayer);
            }
        }, 1000);
    }
}

/**
 * AI Bidding Logic
 */
function getAIBid(playerIdx, currentBid) {
    const hand = gameState.hands[playerIdx];
    let suitScores = { 'Hearts': 0, 'Diamonds': 0, 'Spades': 0, 'Clubs': 0, 'No-Trump': 0 };

    SUITS.forEach(suit => {
        const inSuit = hand.filter(c => c.suit === suit);
        let score = 0;
        
        inSuit.forEach(c => {
            if (c.rank === 'Ace') score += 4;
            else if (c.rank === 'King') score += 3;
            else if (c.rank === 'Queen') score += 2;
            else if (c.rank === 'Jack') score += 1;
            
            if (c.suit === 'Hearts' && c.rank === '5') score += 3;
            if (c.suit === 'Spades' && c.rank === '3') score -= 2;
        });

        if (inSuit.length >= 4) score += 2;
        if (inSuit.length >= 5) score += 2;

        suitScores[suit] = score;
    });

    let ntScore = 0;
    hand.forEach(c => {
        if (c.rank === 'Ace') ntScore += 4;
        if (c.rank === 'King') ntScore += 2;
        if (c.suit === 'Hearts' && c.rank === '5') ntScore += 2;
        if (c.suit === 'Spades' && c.rank === '3') ntScore -= 2;
    });
    suitScores['No-Trump'] = ntScore - 2;

    let bestSuit = 'Hearts';
    let maxScore = -100;
    for (let s in suitScores) {
        if (suitScores[s] > maxScore) {
            maxScore = suitScores[s];
            bestSuit = s;
        }
    }

    let bidAmount = 0;
    if (maxScore >= 13) bidAmount = 10;
    else if (maxScore >= 11) bidAmount = 9;
    else if (maxScore >= 9) bidAmount = 8;
    else if (maxScore >= 7) bidAmount = 7;

    if (playerIdx === gameState.dealerIndex && bidAmount === currentBid && currentBid >= 7) {
        return { amount: currentBid, suit: bestSuit };
    }

    if (bidAmount > currentBid) {
        return { amount: bidAmount, suit: bestSuit };
    }

    return null;
}

function placeBid(playerIdx, amount, suit) {
    const b = gameState.bidding;
    if (b.biddingComplete || playerIdx !== b.activePlayer) return;

    const isDealer = playerIdx === gameState.dealerIndex;
    const isTaking = isDealer && amount === b.currentBid && b.highBidder !== null;

    if (amount > b.currentBid || isTaking) {
        b.currentBid = amount;
        b.highBidder = playerIdx;
        b.trumpSuit = suit;
        b.history.push({ player: playerIdx, amount, suit, action: isTaking ? 'take' : 'bid' });
        
        if (checkBiddingComplete()) finishBidding();
        else nextBidder();
    }
}

function passBid(playerIdx) {
    const b = gameState.bidding;
    if (b.biddingComplete || playerIdx !== b.activePlayer) return;

    b.history.push({ player: playerIdx, action: 'pass' });
    
    if (checkBiddingComplete()) finishBidding();
    else nextBidder();
}

function nextBidder() {
    gameState.bidding.activePlayer = (gameState.bidding.activePlayer + 1) % 4;
    updateUI();
    checkAutoBid();
}

function checkBiddingComplete() {
    return gameState.bidding.history.length >= 4;
}

function finishBidding() {
    const b = gameState.bidding;
    if (b.highBidder === null) {
        b.highBidder = gameState.dealerIndex;
        b.currentBid = 7;
        b.trumpSuit = 'No-Trump';
    }
    b.biddingComplete = true;
    
    // Reset trick-taking state
    gameState.currentPlayer = (gameState.dealerIndex + 1) % 4;
    gameState.trick = { cards: [], leadSuit: null, count: 0 };
    gameState.scores = {
        team1: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 },
        team2: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 }
    };

    updateUI();
    checkAutoPlay();
}

/**
 * Trick Taking Logic
 */

function isValidPlay(playerIdx, card) {
    const hand = gameState.hands[playerIdx];
    const leadSuit = gameState.trick.leadSuit;

    if (!leadSuit) return true;
    if (card.suit === leadSuit) return true;

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
}

function playCard(playerIdx, card) {
    if (!gameState.bidding.biddingComplete) return;
    if (playerIdx !== gameState.currentPlayer) return;
    if (gameState.trick.cards.length >= 4) return;

    if (!isValidPlay(playerIdx, card)) {
        if (playerIdx === 0) alert("You must follow suit!");
        return;
    }

    const cardIdx = gameState.hands[playerIdx].findIndex(c => c.rank === card.rank && c.suit === card.suit);
    gameState.hands[playerIdx].splice(cardIdx, 1);

    if (gameState.trick.cards.length === 0) {
        gameState.trick.leadSuit = card.suit;
    }

    gameState.trick.cards.push({ player: playerIdx, card: card });
    
    updateUI();

    if (gameState.trick.cards.length === 4) {
        setTimeout(evaluateTrick, 1200);
    } else {
        gameState.currentPlayer = (gameState.currentPlayer + 1) % 4;
        checkAutoPlay();
    }
}

function evaluateTrick() {
    const t = gameState.trick;
    const b = gameState.bidding;
    let winner = t.cards[0];

    t.cards.forEach(played => {
        const currentWinnerCard = winner.card;
        const challengerCard = played.card;

        const isTrump = challengerCard.suit === b.trumpSuit;
        const wasTrump = currentWinnerCard.suit === b.trumpSuit;

        if (isTrump && !wasTrump) {
            winner = played;
        } else if (isTrump && wasTrump) {
            if (RANK_VALUE[challengerCard.rank] > RANK_VALUE[currentWinnerCard.rank]) {
                winner = played;
            }
        } else if (!isTrump && !wasTrump && challengerCard.suit === t.leadSuit) {
            if (RANK_VALUE[challengerCard.rank] > RANK_VALUE[currentWinnerCard.rank]) {
                winner = played;
            }
        }
    });

    const team = (winner.player === 0 || winner.player === 2) ? 'team1' : 'team2';
    gameState.scores[team].tricks += 1;

    t.cards.forEach(p => {
        if (p.card.suit === 'Hearts' && p.card.rank === '5') gameState.scores[team].bonus += 5;
        if (p.card.suit === 'Spades' && p.card.rank === '3') gameState.scores[team].bonus -= 3;
    });

    gameState.currentPlayer = winner.player;
    gameState.trick = { cards: [], leadSuit: null, count: gameState.trick.count + 1 };

    if (gameState.trick.count === 8) {
        calculateFinalScore();
    } else {
        updateUI();
        checkAutoPlay();
    }
}

function calculateFinalScore() {
    const s = gameState.scores;
    const b = gameState.bidding;
    
    s.team1.totalPoints = s.team1.tricks + s.team1.bonus;
    s.team2.totalPoints = s.team2.tricks + s.team2.bonus;

    const biddingTeam = (b.highBidder === 0 || b.highBidder === 2) ? 'team1' : 'team2';
    const otherTeam = biddingTeam === 'team1' ? 'team2' : 'team1';

    if (s[biddingTeam].totalPoints < b.currentBid) {
        s[biddingTeam].finalHandScore = -b.currentBid;
    } else {
        s[biddingTeam].finalHandScore = s[biddingTeam].totalPoints;
    }
    s[otherTeam].finalHandScore = s[otherTeam].totalPoints;

    // Update match scores
    gameState.matchScore.team1 += s.team1.finalHandScore;
    gameState.matchScore.team2 += s.team2.finalHandScore;

    showHandResult();
}

function showHandResult() {
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    const msg = document.getElementById('overlay-msg');
    const btn = document.getElementById('overlay-btn');
    const s = gameState.scores;

    overlay.classList.remove('hidden');
    
    // Check match win condition
    if (Math.abs(gameState.matchScore.team1) >= 52 || Math.abs(gameState.matchScore.team2) >= 52) {
        const winner = gameState.matchScore.team1 >= 52 ? "Team South/North" : "Team West/East";
        title.innerText = "Match Over!";
        msg.innerHTML = `<h3>${winner} Wins!</h3><p>Final Score: ${gameState.matchScore.team1} to ${gameState.matchScore.team2}</p>`;
        btn.innerText = "New Match";
        btn.onclick = () => {
            gameState.matchScore = { team1: 0, team2: 0 };
            gameState.dealerIndex = 0;
            overlay.classList.add('hidden');
            deal();
        };
    } else {
        title.innerText = "Hand Finished";
        msg.innerHTML = `
            Team 1 (S/N) Hand: ${s.team1.finalHandScore} | Total: ${gameState.matchScore.team1}<br>
            Team 2 (W/E) Hand: ${s.team2.finalHandScore} | Total: ${gameState.matchScore.team2}
        `;
        btn.innerText = "Next Hand";
        btn.onclick = () => {
            gameState.dealerIndex = (gameState.dealerIndex + 1) % 4;
            overlay.classList.add('hidden');
            deal();
        };
    }
    updateUI();
}

function checkAutoPlay() {
    if (!gameState.bidding.biddingComplete) return;
    if (gameState.currentPlayer === 0) return; 

    setTimeout(() => {
        const hand = gameState.hands[gameState.currentPlayer];
        const cardToPlay = chooseAICard(gameState.currentPlayer, hand);
        playCard(gameState.currentPlayer, cardToPlay);
    }, 1000);
}

/**
 * AI Strategic Play Logic
 */
function chooseAICard(playerIdx, hand) {
    const t = gameState.trick;
    const b = gameState.bidding;
    const validCards = hand.filter(c => isValidPlay(playerIdx, c));

    if (t.cards.length === 0) {
        if (playerIdx === b.highBidder && b.trumpSuit !== 'No-Trump') {
            const trumps = validCards.filter(c => c.suit === b.trumpSuit);
            if (trumps.length > 0) {
                return trumps.reduce((max, c) => RANK_VALUE[c.rank] > RANK_VALUE[max.rank] ? c : max);
            }
        }

        const highCards = validCards.filter(c => c.rank === 'Ace' || c.rank === 'King');
        if (highCards.length > 0) return highCards[0];

        const safeCards = validCards.filter(c => !(c.suit === 'Hearts' && c.rank === '5') && !(c.suit === 'Spades' && c.rank === '3'));
        if (safeCards.length > 0) return safeCards[0];

        return validCards[0];
    }

    const winningPlay = getWinningCard(t.cards, b.trumpSuit, t.leadSuit);
    const partnerIdx = (playerIdx + 2) % 4;
    const isPartnerWinning = winningPlay.player === partnerIdx;

    if (isPartnerWinning) {
        const fiveHearts = validCards.find(c => c.suit === 'Hearts' && c.rank === '5');
        if (fiveHearts) return fiveHearts;
        return validCards.reduce((min, c) => RANK_VALUE[c.rank] < RANK_VALUE[min.rank] ? c : min);
    }

    if (t.leadSuit !== 'Spades') {
        const threeSpades = validCards.find(c => c.suit === 'Spades' && c.rank === '3');
        if (threeSpades && !isPartnerWinning) return threeSpades;
    }

    const winningCard = winningPlay.card;
    const cardsThatBeat = validCards.filter(c => {
        if (c.suit === b.trumpSuit && winningCard.suit !== b.trumpSuit) return true;
        if (c.suit === winningCard.suit && RANK_VALUE[c.rank] > RANK_VALUE[winningCard.rank]) return true;
        return false;
    });

    if (cardsThatBeat.length > 0) {
        return cardsThatBeat.reduce((min, c) => RANK_VALUE[c.rank] < RANK_VALUE[min.rank] ? c : min);
    }

    return validCards.reduce((min, c) => RANK_VALUE[c.rank] < RANK_VALUE[min.rank] ? c : min);
}

function getWinningCard(playedCards, trumpSuit, leadSuit) {
    let winner = playedCards[0];
    playedCards.forEach(played => {
        const currentWinnerCard = winner.card;
        const challengerCard = played.card;

        const isTrump = challengerCard.suit === trumpSuit;
        const wasTrump = currentWinnerCard.suit === trumpSuit;

        if (isTrump && !wasTrump) {
            winner = played;
        } else if (isTrump && wasTrump) {
            if (RANK_VALUE[challengerCard.rank] > RANK_VALUE[currentWinnerCard.rank]) {
                winner = played;
            }
        } else if (!isTrump && !wasTrump && challengerCard.suit === leadSuit) {
            if (RANK_VALUE[challengerCard.rank] > RANK_VALUE[currentWinnerCard.rank]) {
                winner = played;
            }
        }
    });
    return winner;
}

function renderCard(card, isFaceDown, onClick = null) {
    const cardEl = document.createElement('div');
    cardEl.className = 'card' + (isFaceDown ? ' back' : '');
    
    if (!isFaceDown) {
        const isRed = card.suit === 'Hearts' || card.suit === 'Diamonds';
        cardEl.classList.add(isRed ? 'red' : 'black');
        
        const rank = card.rank === '10' ? '10' : card.rank.charAt(0);
        const symbol = SUIT_SYMBOLS[card.suit];
        
        cardEl.innerHTML = `
            <div class="card-rank">${rank}</div>
            <div class="card-suit">${symbol}</div>
            <div class="card-rank" style="transform: rotate(180deg)">${rank}</div>
        `;

        if (onClick) {
            cardEl.onclick = () => onClick(card);
        }
    }
    
    return cardEl;
}

function updateUI() {
    const b = gameState.bidding;
    const s = gameState.scores;
    const m = gameState.matchScore;
    const status = document.getElementById('status-bar');
    
    // Status Bar
    let statusText = `Match: S/N ${m.team1} - W/E ${m.team2} | `;
    
    if (!b.biddingComplete) {
        const pNames = ['South (You)', 'West', 'North (Partner)', 'East'];
        statusText += `Bidding: ${pNames[b.activePlayer]}'s turn. Current Bid: ${b.currentBid === 5 ? 'None' : b.currentBid + ' ' + (b.trumpSuit || '')}`;
    } else {
        statusText += `Contract: ${b.currentBid} ${b.trumpSuit} by Player ${b.highBidder + 1}. Team 1: ${s.team1.tricks + s.team1.bonus} | Team 2: ${s.team2.tricks + s.team2.bonus}`;
    }
    status.innerText = statusText;
    
    // ... remaining UI logic ...

    const playerIds = ['south', 'west', 'north', 'east'];
    playerIds.forEach((id, idx) => {
        const container = document.getElementById(id);
        container.innerHTML = '';
        const isHuman = idx === 0;
        
        gameState.hands[idx].forEach(card => {
            const cardEl = renderCard(card, !isHuman, (isHuman && gameState.currentPlayer === 0) ? (c) => playCard(idx, c) : null);
            container.appendChild(cardEl);
        });
    });

    centerArea.innerHTML = '';
    gameState.trick.cards.forEach((played) => {
        const cardEl = renderCard(played.card, false);
        cardEl.style.position = 'absolute';
        const pos = [
            'bottom: 10px;', // 0: South
            'left: 10px;',   // 1: West
            'top: 10px;',    // 2: North
            'right: 10px;'   // 3: East
        ];
        cardEl.style.cssText += pos[played.player];
        centerArea.appendChild(cardEl);
    });

    if (!b.biddingComplete && b.activePlayer === 0) {
        bidPanel.classList.remove('hidden');
        bidOptions.innerHTML = '';
        
        const min = b.currentBid + 1;
        for (let i = Math.max(6, min); i <= 12; i++) {
            SUITS.concat(['No-Trump']).forEach(s => {
                const btn = document.createElement('button');
                btn.className = 'bid-btn';
                btn.innerText = `${i} ${s}`;
                btn.onclick = () => placeBid(0, i, s);
                bidOptions.appendChild(btn);
            });
            bidOptions.appendChild(document.createElement('br'));
        }

        if (gameState.dealerIndex === 0 && b.currentBid >= 6 && b.highBidder !== 0) {
            const btn = document.createElement('button');
            btn.className = 'bid-btn';
            btn.innerText = `Take ${b.currentBid} ${b.trumpSuit}`;
            btn.onclick = () => placeBid(0, b.currentBid, b.trumpSuit);
            bidOptions.appendChild(btn);
        }

        const passBtn = document.createElement('button');
        passBtn.className = 'bid-btn';
        passBtn.innerText = 'Pass';
        passBtn.onclick = () => passBid(0);
        bidOptions.appendChild(passBtn);
    } else {
        bidPanel.classList.add('hidden');
    }
}

window.onload = () => {
    deal();
};
