import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import AppreciationCard from './AppreciationCard';

describe('AppreciationCard', () => {
  it('renders the modal outside an overflow-hidden footer and closes with Escape', async () => {
    const user = userEvent.setup();

    render(
      <footer style={{ overflow: 'hidden' }}>
        <AppreciationCard mode="button" title="请我喝杯咖啡" />
      </footer>,
    );

    await user.click(screen.getByRole('button', { name: '请我喝杯咖啡' }));

    const dialog = screen.getByRole('dialog', { name: '感谢支持' });
    expect(dialog.closest('footer')).toBeNull();
    expect(document.body.style.overflow).toBe('hidden');

    await user.keyboard('{Escape}');

    expect(screen.queryByRole('dialog', { name: '感谢支持' })).toBeNull();
    expect(document.body.style.overflow).toBe('');
  });
});
