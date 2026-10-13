import type { nav as en } from '../en/nav';
import type { Translation } from '../../types';

export const nav: Translation<typeof en> = {
  back: 'वापस',
  tabs: {
    home: 'होम',
    history: 'हिस्ट्री',
    exercises: 'एक्सरसाइज़',
    progress: 'प्रोग्रेस',
    settings: 'सेटिंग',
  },
  titles: {
    addExercise: 'एक्सरसाइज़ जोड़ें',
    newExercise: 'नई एक्सरसाइज़',
    routines: 'रूटीन',
    routine: 'रूटीन',
    backup: 'बैकअप और डेटा',
    driveHistory: 'पुराने वर्कआउट',
    weekPlan: 'हफ़्ते का प्लान',
    gymProfile: 'मेरा जिम',
  },
};
