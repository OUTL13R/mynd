import { useContext } from 'react';
import { NotesContext, NotesContextType } from '../context/NotesContext';

export const useNotes = (): NotesContextType => {
  const context = useContext(NotesContext);
  if (!context) {
    throw new Error('useNotes must be used within a NotesProvider');
  }
  return context;
};
