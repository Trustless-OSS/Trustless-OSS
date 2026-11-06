// Call before awaiting: Albedo's SDK reuses this named popup for signing.
export function openSelectedWalletPopup() {
  try {
    if (
      window.localStorage.getItem('@StellarWalletsKit/selectedModuleId') !== 'albedo' ||
      !window.localStorage.getItem('@StellarWalletsKit/activeAddress')
    )
      return;
  } catch {
    return;
  }

  const popup = window.open(
    'https://albedo.link/confirm',
    'auth.albedo.link',
    'width=480,height=600,menubar=0,toolbar=0,location=0,status=0,scrollbars=0'
  );
  if (!popup) {
    throw new Error('Allow popups for this site, then try again to open Albedo.');
  }

  return {
    assertOpen() {
      if (popup.closed) {
        throw new Error('Albedo was closed before signing. Please try again.');
      }
    },
    close() {
      if (!popup.closed) popup.close();
    },
  };
}
