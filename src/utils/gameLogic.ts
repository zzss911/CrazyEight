import { Card, Rank, Suit } from '../types';

export const createDeck = (): Card[] => {
  const deck: Card[] = [];
  const suits = [Suit.HEARTS, Suit.DIAMONDS, Suit.CLUBS, Suit.SPADES];
  const ranks = Object.values(Rank);

  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        id: `${rank}-${suit}`,
        suit,
        rank,
      });
    }
  }
  return deck;
};

export const shuffle = (deck: Card[]): Card[] => {
  const newDeck = [...deck];
  for (let i = newDeck.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [newDeck[i], newDeck[j]] = [newDeck[j], newDeck[i]];
  }
  return newDeck;
};

export const canPlayCard = (card: Card, topCard: Card, wildSuit: Suit | null): boolean => {
  if (card.rank === Rank.EIGHT) return true;
  
  const targetSuit = wildSuit || topCard.suit;
  return card.suit === targetSuit || card.rank === topCard.rank;
};

export const getSuitColor = (suit: Suit): string => {
  switch (suit) {
    case Suit.HEARTS:
    case Suit.DIAMONDS:
      return 'text-red-600';
    case Suit.CLUBS:
    case Suit.SPADES:
      return 'text-slate-900';
    default:
      return 'text-gray-900';
  }
};

export const getSuitSymbol = (suit: Suit): string => {
  switch (suit) {
    case Suit.HEARTS: return '♥';
    case Suit.DIAMONDS: return '♦';
    case Suit.CLUBS: return '♣';
    case Suit.SPADES: return '♠';
  }
};
