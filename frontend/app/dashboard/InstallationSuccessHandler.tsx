'use client';

import { useEffect } from 'react';

export default function InstallationSuccessHandler() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const installationId = params.get('installation_id');
    const setupAction = params.get('setup_action');

    // If we are in the redirected tab from GitHub
    if (installationId || setupAction === 'install') {
      // 1. Tell the opener (the first tab) to refresh
      if (window.opener) {
        window.opener.postMessage('github-installation-success', '*');
        
        // 2. Close this tab automatically after a brief moment
        setTimeout(() => {
          window.close();
        }, 1000);
      }
    }
  }, []);

  return null;
}
