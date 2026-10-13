import type { progress as en } from '../en/progress';
import type { Translation } from '../../types';

export const progress: Translation<typeof en> = {
  range: { '30': '1 महीना', '90': '3 महीने', '365': '1 साल', all: 'सभी' },
  rangeA11y: {
    '30': 'पिछला 1 महीना',
    '90': 'पिछले 3 महीने',
    '365': 'पिछला 1 साल',
    all: 'अब तक',
  },
  dateRange: 'तारीख की रेंज',
  emptyTitle: 'चार्ट के लिए अभी कुछ नहीं है',
  emptyMessage:
    'एक वर्कआउट पूरा करें, फिर आपकी ताकत, वॉल्यूम और रिकॉर्ड यहाँ दिखेंगे।',
  goHome: 'होम पर जाएँ',
  e1rmTitle: 'अनुमानित 1-रेप मैक्स',
  e1rmA11y: '{name}, अनुमानित 1-रेप मैक्स: {points}',
  current: 'अभी, {unit}',
  change: 'बदलाव',
  sessions: 'सेशन',
  needTwo: 'ट्रेंड देखने के लिए इस रेंज में {name} दो वर्कआउट में करें।',
  thisExercise: 'यह एक्सरसाइज़',
  e1rmNote:
    'हर सेशन के आपके सबसे अच्छे सेट से अंदाज़ा (Epley फ़ॉर्मूला, 12 या कम रेप्स वाले सेट)। यह असली टेस्ट किया हुआ मैक्स नहीं है।',
  weeklyVolume: 'हफ़्ते का वॉल्यूम',
  weeklyVolumeA11y: 'हफ़्ते का वॉल्यूम: {weeks}',
  weekOf: '{date} वाला हफ़्ता {value}',
  workoutsPerWeek: 'हर हफ़्ते वर्कआउट',
  workoutsPerWeekA11y: 'हर हफ़्ते वर्कआउट: {weeks}',
  avgPerWeek: 'औसत प्रति हफ़्ता',
  timeTrained: 'कुल ट्रेनिंग समय',
  weekStreak: 'हफ़्तों की स्ट्रीक',
  streakNote:
    'जिस हफ़्ते आप कम से कम दो बार ट्रेनिंग करते हैं, वो आपकी स्ट्रीक में गिना जाता है।',
  personalRecords: 'पर्सनल रिकॉर्ड',
  estE1rm: 'अनु. 1RM',
  heaviest: 'सबसे भारी',
  mostReps: 'सबसे ज़्यादा रेप्स',
  reps: '{reps} रेप्स',
};
