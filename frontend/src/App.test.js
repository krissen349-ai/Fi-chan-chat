import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import GamesLobby from './GamesLobby';

test('shows the existing games and the two new multiplayer games', () => {
  render(<GamesLobby onClose={jest.fn()} onInvite={jest.fn()} onQuickPlay={jest.fn()} />);

  expect(screen.getByText('Tic-Tac-Toe')).toBeInTheDocument();
  expect(screen.getByText('Tank Battle')).toBeInTheDocument();
  expect(screen.getByText('Red Light, Green Light')).toBeInTheDocument();
  expect(screen.getByText('Glass Bridge')).toBeInTheDocument();
});

test('invites the selected game', () => {
  const onInvite = jest.fn();
  render(<GamesLobby onClose={jest.fn()} onInvite={onInvite} onQuickPlay={jest.fn()} />);

  const card = screen.getByText('Glass Bridge').closest('article');
  fireEvent.click(within(card).getByRole('button', { name: 'Invite / Play' }));

  expect(onInvite).toHaveBeenCalledWith(expect.objectContaining({ id: 'glass-bridge', name: 'Glass Bridge' }));
});
