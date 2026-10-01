import React, { useState, useEffect } from 'react';
import './GameModal.css';

const GameModal = ({ socket, activeChat, currentUser, onClose, gameSession }) => {
  const [board, setBoard] = useState(Array(9).fill(null));
  const [isMyTurn, setIsMyTurn] = useState(false);
  const [mySymbol, setMySymbol] = useState('');
  const [statusText, setStatusText] = useState('Waiting for opponent...');
  const [winner, setWinner] = useState(null);
  const [roomGameId, setRoomGameId] = useState(
    gameSession?.gameRoomId || gameSession?.roomGameId || `game_${(currentUser?.username || currentUser?.uid || 'user1')}_${activeChat?.username || activeChat?.id || 'user2'}`
  );

  useEffect(() => {
    if (!socket) return;

    const handleInit = ({ symbol, turn, playerCount, gameRoomId: serverRoomId, roomGameId: legacyRoomId }) => {
      const finalRoomId = serverRoomId || legacyRoomId || roomGameId;
      if (finalRoomId) setRoomGameId(finalRoomId);
      setMySymbol(symbol);
      setIsMyTurn(turn === symbol);

      if (playerCount !== undefined && playerCount < 2) {
        setStatusText('Waiting for opponent to open game...');
      } else {
        setStatusText(turn === symbol ? "Your turn! (Play)" : "Opponent's turn...");
      }
    };

    const handleMoveMade = ({ newBoard, nextTurn, winnerSymbol }) => {
      setBoard(newBoard);

      if (winnerSymbol) {
        if (winnerSymbol === 'DRAW') {
          setWinner('DRAW');
          setStatusText("It's a Draw! 🤝");
        } else {
          setWinner(winnerSymbol);
          setStatusText(winnerSymbol === mySymbol ? "You Won! 🎉" : "Opponent Won! ❌");
        }
        setIsMyTurn(false);
      } else {
        setIsMyTurn(nextTurn === mySymbol);
        setStatusText(nextTurn === mySymbol ? "Your turn!" : "Opponent's turn...");
      }
    };

    const handleGameReset = ({ turn }) => {
      setBoard(Array(9).fill(null));
      setWinner(null);
      setIsMyTurn(turn === mySymbol);
      setStatusText(turn === mySymbol ? "Game Restarted! Your turn!" : "Game Restarted! Opponent's turn...");
    };

    socket.emit('join_game', {
      gameRoomId: roomGameId,
      roomGameId,
      userId: currentUser?.uid || currentUser?.username || currentUser?.id || 'user',
      username: currentUser?.username || 'Guest'
    });

    socket.on('game_started', handleInit);
    socket.on('game_init', handleInit);
    socket.on('move_made', handleMoveMade);
    socket.on('game_reset', handleGameReset);

    return () => {
      socket.off('game_started', handleInit);
      socket.off('game_init', handleInit);
      socket.off('move_made', handleMoveMade);
      socket.off('game_reset', handleGameReset);
    };
  }, [socket, roomGameId, currentUser, mySymbol]);

  const handleClick = (index) => {
    if (!roomGameId || !isMyTurn || board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = mySymbol;

    socket.emit('make_move', {
      gameRoomId: roomGameId,
      roomGameId,
      newBoard,
      symbol: mySymbol
    });
  };

  const handleReset = () => {
    if (!roomGameId) return;
    socket.emit('reset_game', { gameRoomId: roomGameId, roomGameId });
  };

  return (
    <div className="modal-overlay">
      <div className="game-modal-card animate-pop-in">
        <div className="game-header">
          <h3>🎮 Tic-Tac-Toe</h3>
          <button className="close-game-btn" onClick={onClose}>✕</button>
        </div>

        <div className="game-status-bar">
          <p>{statusText}</p>
          {mySymbol && <span className="symbol-badge">You: {mySymbol}</span>}
        </div>

        <div className="tic-tac-toe-board">
          {board.map((cell, index) => (
            <button
              key={index}
              className={`game-cell ${cell ? 'filled' : ''}`}
              onClick={() => handleClick(index)}
              disabled={!isMyTurn || cell || winner}
            >
              {cell}
            </button>
          ))}
        </div>

        <div className="game-footer">
          <button className="reset-game-btn" onClick={handleReset}>Restart Game</button>
        </div>
      </div>
    </div>
  );
};

export default GameModal;