/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';

type DiffSelectionHandler = (changeIds: string[]) => void;

const DiffSelectionContext = createContext<DiffSelectionHandler | undefined>(undefined);

export function DiffSelectionProvider({
  onSelect,
  children,
}: {
  onSelect?: DiffSelectionHandler;
  children: ReactNode;
}) {
  return (
    <DiffSelectionContext.Provider value={onSelect}>
      {children}
    </DiffSelectionContext.Provider>
  );
}

export function useDiffSelection(): DiffSelectionHandler | undefined {
  return useContext(DiffSelectionContext);
}
