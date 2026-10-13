import type { plan as en } from '../en/plan';
import type { Translation } from '../../types';

export const plan: Translation<typeof en> = {
  weekStartsOn: 'हफ़्ता शुरू होता है',
  weekStartsSub: 'आपका प्लान और हफ़्ते के आंकड़े इसी क्रम में दिखेंगे।',
  trainingDays: { one: '{count} ट्रेनिंग का दिन', other: '{count} ट्रेनिंग के दिन' },
  restDays: { one: '{count} आराम का दिन', other: '{count} आराम के दिन' },
  today: 'आज',
  restDay: 'आराम का दिन',
  routineSummary: '{routine} · {count} एक्सरसाइज़',
  notPlanned: 'प्लान नहीं',
  rest: 'आराम',
  restA11y: '{day} आराम का दिन है',
  editExercises: 'एक्सरसाइज़ बदलें',
  addExercises: 'एक्सरसाइज़ जोड़ें',
  editHint: '{day} की एक्सरसाइज़ लिस्ट खोलता है',
  useRoutineA11y: '{day} के लिए सेव किया रूटीन चुनें',
  start: 'शुरू करें',
  recovery: 'रिकवरी भी ट्रेनिंग का हिस्सा है।',
  chooserTitle: '{day}: रूटीन चुनें',
  noRoutines: 'अभी कोई सेव किया रूटीन नहीं है। इस दिन को बनाने के लिए “एक्सरसाइज़ जोड़ें” दबाएं।',
  clearDay: 'यह दिन खाली करें',
};
