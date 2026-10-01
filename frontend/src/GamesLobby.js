import React from 'react';
import './GameModal.css';

const GAMES = [
  { id: 'tic-tac-toe', icon: '⭕', name: 'Tic-Tac-Toe', description: 'Classic three-in-a-row duel' },
  { id: 'connect-four', icon: '🔴', name: 'Connect Four', description: 'Drop four discs in a row' },
  { id: 'rock-paper-scissors', icon: '✊', name: 'Rock Paper Scissors', description: 'Quick best-of-three battle' },
  { id: 'quiz-battle', icon: '🧠', name: 'Quiz Battle', description: 'Race to the right answers' },
  { id: 'word-chain', icon: '🔤', name: 'Word Chain', description: 'Keep the word game going' }
];

const GamesLobby = ({ onClose, onInvite, onQuickPlay }) => (
  <div className="modal-overlay">
    <div className="games-lobby-card animate-pop-in">
      <div className="games-lobby-header">
        <div>
          <span className="games-lobby-eyebrow">PLAY TOGETHER</span>
          <h3>🎮 Games Lobby</h3>
          <p>Choose a game and challenge your chat partner.</p>
        </div>
        <button className="close-game-btn" onClick={onClose} aria-label="Close games lobby">✕</button>
      </div>

      <div className="games-grid">
        {GAMES.map((game) => (
          <article className="game-choice-card" key={game.id}>
            <div className="game-choice-icon">{game.icon}</div>
            <div className="game-choice-copy">
              <h4>{game.name}</h4>
              <p>{game.description}</p>
            </div>
            <button className="game-invite-btn" onClick={() => onInvite(game)}>
              Invite / Play
            </button>
          </article>
        ))}
      </div>

      <div className="games-lobby-footer">
        <button className="quick-play-btn" onClick={onQuickPlay}>⚡ Quick Play</button>
        <button className="lobby-close-btn" onClick={onClose}>Close</button>
      </div>
    </div>
  </div>
);

export default GamesLobby;
