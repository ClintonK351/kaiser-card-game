const SUITS = ['Hearts', 'Diamonds', 'Spades', 'Clubs'];
const SUIT_SYMBOLS = { 'Hearts': '♥', 'Diamonds': '♦', 'Spades': '♠', 'Clubs': '♣' };
const RANKS = ['7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];

const RANK_VALUE = {
    '3': 7, '5': 7, '7': 7, '8': 8, '9': 9, '10': 10, 
    'Jack': 11, 'Queen': 12, 'King': 13, 'Ace': 14
};

let gameState = {
    phase: 'BIDDING', // 'BIDDING' | 'PLAYING' | 'HAND_OVER'
    activePlayer: 1, // whose turn it is during bidding (0 = South/human)
    currentBid: 0, // 0 = no bid yet; opening minimum is 7
    deck: [],
    hands: [[], [], [], []], // 0: South, 1: West, 2: North, 3: East
    dealerIndex: 0,
    currentPlayer: 0,
    bidding: {
        currentBid: 0,
        highBidder: null,
        trumpSuit: null,
        activePlayer: 1,
        biddingComplete: false,
        history: []
    },
    trick: {
        cards: [],
        leadSuit: null,
        count: 0
    },
    scores: {
        team1: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 },
        team2: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 }
    },
    matchScore: {
        team1: 0,
        team2: 0
    }
};

let timerHandles = { autoBid: null, autoPlay: null };

function clearAllTimers() {
    if (timerHandles.autoBid) { clearTimeout(timerHandles.autoBid); timerHandles.autoBid = null; }
    if (timerHandles.autoPlay) { clearTimeout(timerHandles.autoPlay); timerHandles.autoPlay = null; }
}

/**
 * Initialize and shuffle the Kaiser deck
 */
function createDeck() {
    let deck = [];
    let idCounter = 0;
    SUITS.forEach(suit => {
        RANKS.forEach(rank => {
            let finalRank = rank;
            let value = 0;

            if (suit === 'Hearts' && rank === '7') finalRank = '5';
            if (suit === 'Spades' && rank === '7') finalRank = '3';

            if (suit === 'Hearts' && finalRank === '5') value = 5;
            if (suit === 'Spades' && finalRank === '3') value = -3;

            deck.push({ id: idCounter++, suit, rank: finalRank, value });
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
    // Sort human hand by suit and rank
    gameState.hands[0].sort((a, b) => {
        if (a.suit !== b.suit) return SUITS.indexOf(a.suit) - SUITS.indexOf(b.suit);
        const rankOrder = ['3', '5', '7', '8', '9', '10', 'Jack', 'Queen', 'King', 'Ace'];
        return rankOrder.indexOf(a.rank) - rankOrder.indexOf(b.rank);
    });

    initBidding();
}

function hideBiddingPanel() {
    const panel = document.getElementById('bidding-panel');
    if (panel) panel.classList.add('hidden');
}

function hideAllBidDialogs() {
    const ids = ['bid-dialog-south', 'bid-dialog-west', 'bid-dialog-north', 'bid-dialog-east'];
    ids.forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
}

function showBidDialog(playerIdx, amount, suit, isCurrent) {
    const pNames = ['South (You)', 'West', 'North (Partner)', 'East'];
    const dialogIds = ['bid-dialog-south', 'bid-dialog-west', 'bid-dialog-north', 'bid-dialog-east'];
    const dialog = document.getElementById(dialogIds[playerIdx]);
    if (!dialog) return;
    dialog.classList.remove('hidden');
    dialog.innerHTML = `
        <span class="player-name">${pNames[playerIdx].replace(' (You)', '')}:</span>
        <span class="bid-value">${amount}</span>
        <span class="suit">${suit === 'No-Trump' ? '🚀' : SUIT_SYMBOLS[suit] || ''}</span>
    `;
}

function setBiddingTurn(playerIdx) {
    gameState.activePlayer = playerIdx;
    gameState.bidding.activePlayer = playerIdx;
}

function setCurrentBid(amount) {
    gameState.currentBid = amount;
    gameState.bidding.currentBid = amount;
}

function initBidding() {
    gameState.phase = 'BIDDING';
    setCurrentBid(0);
    const firstBidder = (gameState.dealerIndex === 0) ? 0 : (gameState.dealerIndex + 1) % 4;
    setBiddingTurn(firstBidder);
    gameState.bidding = {
        currentBid: gameState.currentBid,
        highBidder: null,
        trumpSuit: null,
        activePlayer: gameState.activePlayer,
        biddingComplete: false,
        history: []
    };
    hideBiddingPanel();
    updateUI();
    checkAutoBid();
}

function checkBiddingComplete() {
    const bids = gameState.bidding.history.filter(h => h.action === 'bid' || h.action === 'take');
    return bids.length >= 3 || gameState.bidding.history.length >= 4;
}

function finishBidding() {
    const b = gameState.bidding;
    if (b.highBidder === null) {
        b.highBidder = gameState.dealerIndex;
        setCurrentBid(7);
        b.trumpSuit = 'No-Trump';
    }
    b.biddingComplete = true;
    gameState.phase = 'PLAYING';
    hideBiddingPanel();
    hideAllBidDialogs();
    
    gameState.currentPlayer = gameState.bidding.highBidder;
    gameState.trick = { cards: [], leadSuit: null, count: 0 };
    gameState.scores = {
        team1: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 },
        team2: { tricks: 0, bonus: 0, totalPoints: 0, finalHandScore: 0 }
    };

    updateUI();
    checkAutoPlay();
}

function checkAutoBid() {
    if (gameState.phase !== 'BIDDING' || gameState.bidding.biddingComplete) return;
    
    if (gameState.activePlayer !== 0) {
        timerHandles.autoBid = setTimeout(() => {
            const aiBid = getAIBid(gameState.activePlayer, gameState.currentBid);
            if (aiBid) {
                placeBid(gameState.activePlayer, aiBid.amount, aiBid.suit);
            } else {
                passBid(gameState.activePlayer);
            }
        }, 1000);
    }
}

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

    const minBid = Math.max(7, currentBid + 1);
    let bidAmount = minBid;

    if (maxScore >= 13) bidAmount = Math.max(bidAmount, 10);
    else if (maxScore >= 11) bidAmount = Math.max(bidAmount, 9);
    else if (maxScore >= 9) bidAmount = Math.max(bidAmount, 8);
    else if (maxScore >= 7) bidAmount = Math.max(bidAmount, 7);

    if (bidAmount > currentBid) {
        return { amount: bidAmount, suit: bestSuit };
    }

    return null;
}

function placeBid(playerIdx, amount, suit) {
    hideBiddingPanel();
    const b = gameState.bidding;
    if (gameState.phase !== 'BIDDING' || b.biddingComplete || playerIdx !== gameState.activePlayer) return;

    if (gameState.currentBid === 0 && amount < 7) return;
    if (amount <= gameState.currentBid) return;

    setCurrentBid(amount);
    b.highBidder = playerIdx;
    b.trumpSuit = suit;
    b.history.push({ player: playerIdx, amount, suit, action: 'bid' });

    if (checkBiddingComplete()) {
        gameState.phase = 'PLAYING';
        finishBidding();
    } else {
        gameState.phase = 'BIDDING';
        nextBidder();
    }
    updateUI();
}

function passBid(playerIdx) {
    hideBiddingPanel();
    const b = gameState.bidding;
    if (gameState.phase !== 'BIDDING' || b.biddingComplete || playerIdx !== gameState.activePlayer) return;

    b.history.push({ player: playerIdx, action: 'pass' });

    if (checkBiddingComplete()) {
        gameState.phase = 'PLAYING';
        finishBidding();
    } else {
        gameState.phase = 'BIDDING';
        nextBidder();
    }
    updateUI();
}

function nextBidder() {
    gameState.phase = 'BIDDING';
    setBiddingTurn((gameState.activePlayer + 1) % 4);
    hideBiddingPanel();
    updateUI();
    checkAutoBid();
}

function isValidPlay(playerIdx, card) {
    const hand = gameState.hands[playerIdx];
    const leadSuit = gameState.trick.leadSuit;

    if (!leadSuit) return true;
    if (card.suit === leadSuit) return true;

    const hasLeadSuit = hand.some(c => c.suit === leadSuit);
    return !hasLeadSuit;
}

function playCard(playerIdx, card) {
    if (gameState.phase !== 'PLAYING') {
        document.getElementById('status-bar').innerText = "Not playing — bidding isn't finished.";
        return;
    }
    if (!gameState.bidding.biddingComplete) {
        document.getElementById('status-bar').innerText = "Bidding not complete yet.";
        return;
    }
    if (playerIdx !== gameState.currentPlayer) {
        document.getElementById('status-bar').innerText = "Not your turn — current player is Player " + (gameState.currentPlayer + 1);
        return;
    }
    if (gameState.trick.cards.length >= 4) return;

    if (!isValidPlay(playerIdx, card)) {
        if (playerIdx === 0) alert("You must follow suit!");
        return;
    }

    const cardIdx = gameState.hands[playerIdx].findIndex(c => c.id === card.id);
    if (cardIdx === -1) {
        console.error("Card not found in hand:", card, "hand:", gameState.hands[playerIdx]);
        return;
    }
    
    const [playedCard] = gameState.hands[playerIdx].splice(cardIdx, 1);

    if (gameState.trick.cards.length === 0) {
        gameState.trick.leadSuit = playedCard.suit;
    }

    gameState.trick.cards.push({ player: playerIdx, card: playedCard });
    
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

    gameState.matchScore.team1 += s.team1.finalHandScore;
    gameState.matchScore.team2 += s.team2.finalHandScore;

    showHandResult();
}

function showHandResult() {
    gameState.phase = 'HAND_OVER';
    const overlay = document.getElementById('overlay');
    const title = document.getElementById('overlay-title');
    const msg = document.getElementById('overlay-msg');
    const btn = document.getElementById('overlay-btn');
    const s = gameState.scores;

    if (gameState.matchScore.team1 >= 52 || gameState.matchScore.team2 >= 52) {
        const winner = gameState.matchScore.team1 >= 52 ? "Team South/North" : "Team West/East";
        title.innerText = "Match Over!";
        msg.innerHTML = `<h3>${winner} Wins!</h3><p>Final Score: S/N ${gameState.matchScore.team1} - W/E ${gameState.matchScore.team2}</p>`;
        btn.innerText = "New Match";
        btn.onclick = initNewMatch;
    } else {
        title.innerText = "Hand Finished";
        msg.innerHTML = `
            Team 1 (S/N) Hand: ${s.team1.finalHandScore} | Total: ${gameState.matchScore.team1}<br>
            Team 2 (W/E) Hand: ${s.team2.finalHandScore} | Total: ${gameState.matchScore.team2}
        `;
        btn.innerText = "Next Hand";
        btn.onclick = () => {
            gameState.dealerIndex = (gameState.dealerIndex + 1) % 4;
            gameState.phase = 'BIDDING';
            overlay.classList.add('hidden');
            document.getElementById('overlay').classList.remove('visible');
            deal();
        };
    }
    overlay.classList.remove('hidden');
    overlay.classList.add('visible');
    hideBiddingPanel();
}

function initNewMatch() {
    clearAllTimers();
    hideBiddingPanel();
    document.getElementById('overlay').classList.add('hidden');
    document.getElementById('overlay').classList.remove('visible');

    gameState.phase = 'BIDDING';
    gameState.matchScore = { team1: 0, team2: 0 };
    gameState.dealerIndex = 0;
    gameState.currentPlayer = 0;
    setCurrentBid(0);
    setBiddingTurn(1);

    deal();
}

function checkAutoPlay() {
    if (gameState.phase !== 'PLAYING') return;
    if (gameState.currentPlayer === 0) return;

    timerHandles.autoPlay = setTimeout(() => {
        const hand = gameState.hands[gameState.currentPlayer];
        const cardToPlay = chooseAICard(gameState.currentPlayer, hand);
        playCard(gameState.currentPlayer, cardToPlay);
    }, 1000);
}

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
            cardEl.addEventListener('click', (e) => {
                e.stopPropagation();
                onClick(card);
            });
        }
    }
    
    return cardEl;
}

function updateUI() {
    const b = gameState.bidding;
    const s = gameState.scores;
    const m = gameState.matchScore;
    const status = document.getElementById('status-bar');
    const bidPanel = document.getElementById('bidding-panel');
    const bidOptions = document.getElementById('bid-options');
    const centerArea = document.getElementById('played-cards');
    
    // Status Bar
    let statusText = `Match: S/N ${m.team1} - W/E ${m.team2} | `;
    
    if (gameState.phase === 'BIDDING') {
        const pNames = ['South (You)', 'West', 'North (Partner)', 'East'];
        statusText += `Bidding: ${pNames[gameState.activePlayer]}'s turn. Current Bid: ${gameState.currentBid === 0 ? 'None' : gameState.currentBid + ' ' + (b.trumpSuit || '')}`;
    } else if (gameState.phase === 'PLAYING') {
        statusText += `Contract: ${gameState.currentBid} ${b.trumpSuit} by Player ${b.highBidder + 1}. Team 1: ${s.team1.tricks + s.team1.bonus} | Team 2: ${s.team2.tricks + s.team2.bonus}`;
    }
    status.innerText = statusText;
    
    // Update bid dialog boxes during bidding
    if (gameState.phase === 'BIDDING' && b.currentBid > 0) {
        for (let i = 0; i < 4; i++) {
            if (i === gameState.activePlayer) {
                showBidDialog(i, b.currentBid, b.trumpSuit, true);
            } else if (i === b.highBidder) {
                showBidDialog(i, b.currentBid, b.trumpSuit, false);
            } else {
                const el = document.getElementById(['bid-dialog-south','bid-dialog-west','bid-dialog-north','bid-dialog-east'][i]);
                if (el) el.classList.add('hidden');
            }
        }
    } else {
        hideAllBidDialogs();
    }
    
    // Render Hands
    const playerIds = ['south', 'west', 'north', 'east'];
    playerIds.forEach((id, idx) => {
        const container = document.getElementById(id);
        container.innerHTML = '';
        const isHuman = idx === 0;
        
        gameState.hands[idx].forEach(card => {
            const isMyTurn = (gameState.phase === 'PLAYING' && gameState.currentPlayer === 0);
            const onClick = (selectedCard) => {
                if (gameState.phase !== 'PLAYING') {
                    document.getElementById('status-bar').innerText = 'Not playing! Wait for bidding to end.';
                    return;
                }
                if (gameState.currentPlayer !== 0) {
                    document.getElementById('status-bar').innerText = 'Not your turn! It is Player ' + (gameState.currentPlayer + 1) + '\'s turn.';
                    return;
                }
                playCard(0, selectedCard);
            };
            const cardEl = renderCard(card, !isHuman, isHuman ? onClick : null);
            container.appendChild(cardEl);
        });
    });

    // Render Trick in Center
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

    // Bidding UI
    bidPanel.classList.add('hidden');
    if (gameState.phase === 'BIDDING' && gameState.activePlayer === 0) {
        bidPanel.classList.remove('hidden');
        bidOptions.innerHTML = '';

        const minBid = Math.max(7, gameState.currentBid + 1);
        for (let i = minBid; i <= 12; i++) {
            SUITS.concat(['No-Trump']).forEach(s => {
                const btn = document.createElement('button');
                btn.className = 'bid-btn';
                btn.innerText = `${i} ${s}`;
                btn.onclick = () => {
                    bidPanel.classList.add('hidden');
                    placeBid(0, i, s);
                };
                bidOptions.appendChild(btn);
            });
            bidOptions.appendChild(document.createElement('br'));
        }

        const passBtn = document.createElement('button');
        passBtn.className = 'bid-btn';
        passBtn.innerText = 'Pass';
        passBtn.onclick = () => {
            bidPanel.classList.add('hidden');
            passBid(0);
        };
        bidOptions.appendChild(passBtn);
    }
}

window.onload = () => {
    document.getElementById('welcome-btn').onclick = () => {
        document.getElementById('welcome-screen').style.display = 'none';
        initNewMatch();
    };
};