'use client';

import React, { useEffect, useRef } from 'react';
import { Provider } from 'react-redux';
import { store } from './store';
import { checkAuth } from './slices/authSlice';

export default function ReduxProvider({ children }: { children: React.ReactNode }) {
  const initialized = useRef(false);

  useEffect(() => {
    if (!initialized.current) {
      initialized.current = true;
      store.dispatch(checkAuth());
    }
  }, []);

  return <Provider store={store}>{children}</Provider>;
}
