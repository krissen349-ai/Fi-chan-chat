import React, { useEffect, useState } from 'react';
import './GameModal.css';

const QUIZ_QUESTIONS = [
  { question: 'Which planet is known as the Red Planet?', options: ['Venus', 'Mars', 'Jupiter', 'Mercury'] },
  { question: 'How many sides does a hexagon have?', options: ['Five', 'Six', 'Seven', 'Eight'] },
  { question: 'Which ocean is the largest?', options: ['Atlantic', 'Indian', 'Pacific', 'Arctic'] },
  { question: 'What is the chemical symbol for gold?', options: ['Ag', 'Go', 'Gd', 'Au'] },
  { question: 'How many colors are in a rainbow traditionally?', options: ['Five', 'Six', 'Seven', 'Eight'] }
];

const GAME_DETAILS = {
  'tic-tac-toe': { icon: '⭕', name: 'Tic-Tac-Toe' },
  'connect-four': { icon: '🔴', name: 'Connect Four' },
  'rock-paper-scissors': { icon: '✊', name: 'Rock Paper Scissors' },
  'quiz-battle': { icon: '🧠', name: 'Quiz Battle' },
  'word-chain': { icon: '🔤', name: 'Word Chain' }
};

const CHOICES = [
  { id: 'rock', icon: '✊', label: 'Rock' },
  { id: 'paper', icon: '✋', label: 'Paper' },
  { id: 'scissors', icon: '✌️', label: 'Scissors' }
];

const GameModal = ({ socket, currentUser, activeChat, onClose, gameSession }) => {
  const [gameState, setGameState] = useState(gameSession?.state || null);
  const [wordInput, setWordInput] = useState('');
  const [actionError, setActionError] = useState('');
  const [localChoiceSent, setLocalChoiceSent] = useState(false);

  const gameId = gameSession?.gameId || 'tic-tac-toe';
  const roomId = gameSession?.gameRoomId;
  const playerIndex = Number.isInteger(gameSession?.playerIndex) ? gameSession.playerIndex : (gameSession?.symbol === 'O' ? 1 : 0);
  const mySymbol = gameSession?.symbol || (playerIndex === 0 ? 'X' : 'O');
  const details = GAME_DETAILS[gameId] || GAME_DETAILS['tic-tac-toe'];

  useEffect(() => {
    setGameState(gameSession?.state || null);
    setLocalChoiceSent(false);
    setActionError('');
  }, [gameSession]);

  useEffect(() => {
    if (!socket || !roomId) return undefined;

    const handleGameState = (nextState) => {
      if (nextState.gameRoomId && nextState.gameRoomId !== roomId) return;
      setGameState(nextState);
      setLocalChoiceSent(Boolean(nextState.pending?.[playerIndex] && !nextState.roundComplete));
      setActionError('');
    };
    const handleGameError = (error) => {
      if (error.gameRoomId === roomId) setActionError(error.message || 'Move could not be made.');
    };
    const handleMissingSession = (error) => {
      if (error.gameRoomId === roomId) setActionError('This game session expired. Close this window and send a new invite.');
    };

    socket.on('game_state', handleGameState);
    socket.on('game_action_error', handleGameError);
    socket.on('game_session_missing', handleMissingSession);
    socket.emit('join_game', { gameRoomId: roomId });
    return () => {
      socket.off('game_state', handleGameState);
      socket.off('game_action_error', handleGameError);
      socket.off('game_session_missing', handleMissingSession);
    };
  }, [socket, roomId, playerIndex]);

  const sendAction = (action) => {
    if (!roomId) return;
    setActionError('');
    socket.emit('game_action', { gameRoomId: roomId, action });
  };

  const getStatus = () => {
    if (!gameState) return 'Setting up game...';
    if (gameState.winner === 'DRAW') return 'Draw game! 🤝';
    if (gameState.winner !== null && gameState.winner !== undefined) {
      if (typeof gameState.winner === 'number') return gameState.winner === playerIndex ? 'You won! 🎉' : 'Opponent won!';
      return gameState.winner === mySymbol ? 'You won! 🎉' : 'Opponent won!';
    }
    if (gameId === 'rock-paper-scissors' && gameState.roundComplete) return 'Round complete!';
    if (gameId === 'quiz-battle' && gameState.roundComplete) return 'Answers are in!';
    if (gameId === 'rock-paper-scissors' && localChoiceSent) return 'Waiting for opponent...';
    if (gameId === 'quiz-battle' && gameState.answered?.[playerIndex]) return 'Answer locked. Waiting for opponent...';
    if (gameState.currentPlayer !== undefined) return gameState.currentPlayer === playerIndex ? 'Your turn' : "Opponent's turn";
    return 'Game on!';
  };

  const renderTicTacToe = () => (
    <div className="tic-tac-toe-board">
      {(gameState?.board || Array(9).fill(null)).map((cell, index) => (
        <button
          key={index}
          className={`game-cell ${cell ? 'filled' : ''}`}
          onClick={() => sendAction({ type: 'place', index })}
          disabled={gameState?.currentPlayer !== playerIndex || Boolean(cell) || gameState?.winner !== null}
          aria-label={`Cell ${index + 1}${cell ? ` ${cell}` : ''}`}
        >{cell}</button>
      ))}
    </div>
  );

  const renderConnectFour = () => (
    <div className="connect-four-wrap">
      <div className="connect-four-drop-row">
        {Array.from({ length: 7 }, (_, column) => (
          <button key={column} onClick={() => sendAction({ type: 'drop', column })} disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null} aria-label={`Drop in column ${column + 1}`}>↓</button>
        ))}
      </div>
      <div className="connect-four-grid">
        {(gameState?.board || Array(42).fill(null)).map((cell, index) => (
          <button
            key={index}
            className={`connect-four-cell ${cell === 'X' ? 'disc-x' : ''} ${cell === 'O' ? 'disc-o' : ''}`}
            onClick={() => sendAction({ type: 'drop', column: index % 7 })}
            disabled={gameState?.currentPlayer !== playerIndex || gameState?.winner !== null}
            aria-label={`Row ${Math.floor(index / 7) + 1}, column ${(index % 7) + 1}${cell ? ` ${cell}` : ''}`}
          />
        ))}
      </div>
      <div className="game-score-line"><span>🔴 You: X</span><span>🟡 Opponent: O</span></div>
    </div>
  );

  const renderRps = () => (
    <div className="mini-game-content">
      <p className="game-round-label">Round {gameState?.round || 1} of 3</p>
      <div className="game-score-line"><span>You {gameState?.scores?.[playerIndex] || 0}</span><span>{gameState?.scores?.[1 - playerIndex] || 0} Opponent</span></div>
      {gameState?.roundComplete ? (
        <div className="rps-reveal">
          <p>{CHOICES.find(choice => choice.id === gameState.choices?.[playerIndex])?.icon} You</p>
          <span>VS</span>
          <p>{CHOICES.find(choice => choice.id === gameState.choices?.[1 - playerIndex])?.icon} Opponent</p>
        </div>
      ) : (
        <>
          <p className="game-instruction">Choose secretly. Reveal happens when both players pick.</p>
          <div className="rps-choices">
            {CHOICES.map(choice => (
              <button key={choice.id} onClick={() => sendAction({ type: 'choose', choice: choice.id })} disabled={localChoiceSent} aria-label={choice.label}>
                <span>{choice.icon}</span>{choice.label}
              </button>
            ))}
          </div>
          {localChoiceSent && <p className="game-waiting-note">Choice locked. Waiting for your opponent...</p>}
        </>
      )}
      {gameState?.roundComplete && gameState.winner === null && <button className="reset-game-btn" onClick={() => sendAction({ type: 'next-round' })}>Next Round</button>}
    </div>
  );

  const renderQuiz = () => {
    const question = QUIZ_QUESTIONS[gameState?.questionIndex || 0];
    const myAnswer = gameState?.answers?.[playerIndex];
    return (
      <div className="mini-game-content">
        <p className="game-round-label">Question {(gameState?.questionIndex || 0) + 1} of {QUIZ_QUESTIONS.length}</p>
        <div className="game-score-line"><span>You {gameState?.scores?.[playerIndex] || 0}</span><span>{gameState?.scores?.[1 - playerIndex] || 0} Opponent</span></div>
        <h4 className="quiz-question">{question.question}</h4>
        <div className="quiz-options">
          {question.options.map((option, index) => (
            <button
              key={option}
              className={gameState?.roundComplete && index === gameState.correctAnswer ? 'quiz-correct' : gameState?.roundComplete && index === myAnswer ? 'quiz-incorrect' : ''}
              onClick={() => sendAction({ type: 'answer', answerIndex: index })}
              disabled={Boolean(gameState?.answered?.[playerIndex]) || gameState?.roundComplete || gameState?.winner !== null}
            >{option}</button>
          ))}
        </div>
        {gameState?.roundComplete && gameState.winner === null && <button className="reset-game-btn" onClick={() => sendAction({ type: 'next-question' })}>{gameState.questionIndex === QUIZ_QUESTIONS.length - 1 ? 'Show Result' : 'Next Question'}</button>}
      </div>
    );
  };

  const renderWordChain = () => {
    const lastWord = gameState?.words?.at(-1)?.word;
    const requiredLetter = lastWord?.at(-1)?.toUpperCase();
    const isMyTurn = gameState?.currentPlayer === playerIndex;
    return (
      <div className="mini-game-content">
        <p className="game-instruction">{requiredLetter ? `Your word must start with ${requiredLetter}` : 'Start the chain with any English word.'}</p>
        <div className="word-chain-list">
          {(gameState?.words || []).length === 0 && <p className="game-empty-state">No words yet. Start the chain!</p>}
          {(gameState?.words || []).map((entry, index) => (
            <span className={entry.playerIndex === playerIndex ? 'word-mine' : 'word-theirs'} key={`${entry.word}-${index}`}>{entry.word}</span>
          ))}
        </div>
        <form className="word-chain-form" onSubmit={event => { event.preventDefault(); if (!wordInput.trim()) return; sendAction({ type: 'word', word: wordInput }); setWordInput(''); }}>
          <input value={wordInput} onChange={event => setWordInput(event.target.value)} placeholder={requiredLetter ? `Word starting with ${requiredLetter}` : 'Type a word'} disabled={!isMyTurn} maxLength={24} />
          <button type="submit" disabled={!isMyTurn || !wordInput.trim()}>Play</button>
        </form>
        {!isMyTurn && <p className="game-waiting-note">Opponent is choosing a word...</p>}
      </div>
    );
  };

  const renderGame = () => {
    if (!gameState) return <p className="game-instruction">Waiting for the game session...</p>;
    switch (gameId) {
      case 'connect-four': return renderConnectFour();
      case 'rock-paper-scissors': return renderRps();
      case 'quiz-battle': return renderQuiz();
      case 'word-chain': return renderWordChain();
      default: return renderTicTacToe();
    }
  };

  return (
    <div className="modal-overlay game-overlay">
      <div className={`game-modal-card animate-pop-in game-modal-${gameId}`}>
        <div className="game-header">
          <h3>{details.icon} {details.name}</h3>
          <button className="close-game-btn" onClick={onClose} aria-label="Close game">✕</button>
        </div>

        <div className="game-status-bar">
          <p>{getStatus()}</p>
          <span className="symbol-badge">{gameId === 'quiz-battle' || gameId === 'rock-paper-scissors' ? `You: ${playerIndex === 0 ? 'P1' : 'P2'}` : `You: ${mySymbol}`}</span>
        </div>

        {actionError && <p className="game-action-error" role="alert">{actionError}</p>}
        {renderGame()}

        <div className="game-footer">
          <button className="reset-game-btn" onClick={() => sendAction({ type: 'restart' })}>Restart Game</button>
          <span className="game-opponent-label">Playing with {activeChat?.name || 'your friend'}</span>
        </div>
      </div>
    </div>
  );
};

export default GameModal;