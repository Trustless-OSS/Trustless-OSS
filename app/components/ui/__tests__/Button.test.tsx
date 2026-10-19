import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import Button from '../Button';

vi.mock('next/link', () => ({
  default: ({ href, children, ...props }: React.ComponentProps<'a'>) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}));

afterEach(cleanup);

describe('Button', () => {
  it('renders a solid action button', () => {
    render(<Button>Save</Button>);

    expect(screen.getByRole('button', { name: 'Save' })).toHaveAttribute('data-variant', 'default');
  });

  it('renders an internal link with the outline style', () => {
    render(
      <Button href="/dashboard" variant="outline">
        Dashboard
      </Button>
    );

    const link = screen.getByRole('link', { name: 'Dashboard' });
    expect(link).toHaveAttribute('href', '/dashboard');
    expect(link).toHaveAttribute('data-variant', 'outline');
    expect(link).toHaveClass('border-border');
  });

  it('renders ghost, danger, and warning variants with size classes', () => {
    render(
      <>
        <Button variant="ghost" size="sm">
          Edit
        </Button>
        <Button variant="danger" size="lg">
          Delete
        </Button>
        <Button variant="warning">Withdraw</Button>
      </>
    );

    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass('h-9');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveClass('border-border');
    expect(screen.getByRole('button', { name: 'Edit' })).toHaveAttribute('data-variant', 'ghost');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('h-12');
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveAttribute(
      'data-variant',
      'destructive'
    );
    expect(screen.getByRole('button', { name: 'Delete' })).toHaveClass('bg-red-600');
    expect(screen.getByRole('button', { name: 'Withdraw' })).toHaveClass('bg-amber-500');
  });
});
