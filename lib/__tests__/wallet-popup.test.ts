import { afterEach, describe, expect, it, vi } from 'vitest';
import { openSelectedWalletPopup } from '../wallet-popup';

function selectWallet(id: string) {
  localStorage.setItem('@StellarWalletsKit/selectedModuleId', id);
  localStorage.setItem('@StellarWalletsKit/activeAddress', 'connected-address');
}

describe('Albedo popup preparation', () => {
  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it('opens the SDK window synchronously and closes it on cleanup', () => {
    selectWallet('albedo');
    const popup = { closed: false, close: vi.fn() };
    const open = vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const result = openSelectedWalletPopup();
    expect(open).toHaveBeenCalledWith(
      'https://albedo.link/confirm',
      'auth.albedo.link',
      expect.any(String)
    );
    expect(() => result?.assertOpen()).not.toThrow();
    result?.close();
    expect(popup.close).toHaveBeenCalledOnce();
  });

  it('does not open Albedo for another wallet or first-time authorization', () => {
    const open = vi.spyOn(window, 'open');
    selectWallet('freighter');
    expect(openSelectedWalletPopup()).toBeUndefined();
    selectWallet('albedo');
    localStorage.removeItem('@StellarWalletsKit/activeAddress');
    expect(openSelectedWalletPopup()).toBeUndefined();
    expect(open).not.toHaveBeenCalled();
  });

  it('reports blocked popups immediately', () => {
    selectWallet('albedo');
    vi.spyOn(window, 'open').mockReturnValue(null);
    expect(openSelectedWalletPopup).toThrow('Allow popups');
  });

  it('does not reopen a wallet the user closed while preparation was pending', () => {
    selectWallet('albedo');
    const popup = { closed: false, close: vi.fn() };
    vi.spyOn(window, 'open').mockReturnValue(popup as unknown as Window);
    const result = openSelectedWalletPopup();
    popup.closed = true;
    expect(() => result?.assertOpen()).toThrow('Albedo was closed');
    result?.close();
    expect(popup.close).not.toHaveBeenCalled();
  });
});
