import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react';

import { ModalProvider, useModal } from '@/contexts/ModalContext';

function ModalProbe() {
  const { openModals, openModal, closeModal, closeAllModals, getModalData, setModalData } = useModal();
  const data = getModalData('addTemplate');
  return (
    <div>
      <div data-testid="open-count">{openModals.size}</div>
      <div data-testid="data">{data ? JSON.stringify(data) : ''}</div>
      <button onClick={() => openModal('addTemplate', { foo: 'bar' })}>open-addTemplate</button>
      <button onClick={() => setModalData('addTemplate', { foo: 'baz' })}>set-data</button>
      <button onClick={() => closeModal('addTemplate')}>close-addTemplate</button>
      <button onClick={() => { openModal('addQueue'); openModal('editQueue'); }}>open-two</button>
      <button onClick={() => closeAllModals()}>close-all</button>
    </div>
  );
}

describe('ModalContext', () => {
  it('manages open/close and modal data lifecycle', () => {
    render(
      <ModalProvider>
        <ModalProbe />
      </ModalProvider>
    );

    expect(screen.getByTestId('open-count').textContent).toBe('0');
    expect(screen.getByTestId('data').textContent).toBe('');

    // Open with data
    fireEvent.click(screen.getByText('open-addTemplate'));
    expect(screen.getByTestId('open-count').textContent).toBe('1');
    expect(screen.getByTestId('data').textContent).toContain('"foo":"bar"');

    // Update data
    fireEvent.click(screen.getByText('set-data'));
    expect(screen.getByTestId('data').textContent).toContain('"foo":"baz"');

    // Close specific modal clears data
    fireEvent.click(screen.getByText('close-addTemplate'));
    expect(screen.getByTestId('open-count').textContent).toBe('0');
    expect(screen.getByTestId('data').textContent).toBe('');

    // Open two different modals then close all
    fireEvent.click(screen.getByText('open-two'));
    expect(screen.getByTestId('open-count').textContent).toBe('2');
    fireEvent.click(screen.getByText('close-all'));
    expect(screen.getByTestId('open-count').textContent).toBe('0');
  });
});
